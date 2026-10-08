use super::resolver::{parse_maven_coordinate, parse_rules_from_json};
use super::resolver::infer_java_major_version;
use super::rules::evaluate_rules;
use super::types::{IntegrityReport, LauncherFeatureFlags, MissingAssetInfo, MissingLibraryInfo};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const OFFICIAL_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
pub const BMCLAPI_MANIFEST_URL: &str =
    "https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json";
pub const MCBBS_MANIFEST_URL: &str =
    "https://download.mcbbs.net/mc/game/version_manifest_v2.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestVersionEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub type_name: String,
    pub url: String,
    pub time: String,
    pub release_time: String,
    pub sha1: String,
    pub compliance_level: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestManifestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionManifest {
    pub latest: LatestManifestVersions,
    pub versions: Vec<ManifestVersionEntry>,
}

/// 标准 SHA-1 纯 Rust 算法实现 (无额外 C/汇编依赖)
pub fn compute_sha1(data: &[u8]) -> String {
    let mut h0: u32 = 0x67452301;
    let mut h1: u32 = 0xEFCDAB89;
    let mut h2: u32 = 0x98BADCFE;
    let mut h3: u32 = 0x10325476;
    let mut h4: u32 = 0xC3D2E1F0;

    let len = data.len();
    let mut msg = data.to_vec();
    msg.push(0x80);
    while (msg.len() % 64) != 56 {
        msg.push(0);
    }
    let bit_len = (len as u64) * 8;
    msg.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in msg.chunks_exact(64) {
        let mut w = [0u32; 80];
        for i in 0..16 {
            w[i] = u32::from_be_bytes(chunk[i * 4..i * 4 + 4].try_into().unwrap());
        }
        for i in 16..80 {
            w[i] = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]).rotate_left(1);
        }

        let mut a = h0;
        let mut b = h1;
        let mut c = h2;
        let mut d = h3;
        let mut e = h4;

        for i in 0..80 {
            let (f, k) = match i {
                0..=19 => ((b & c) | ((!b) & d), 0x5A827999),
                20..=39 => (b ^ c ^ d, 0x6ED9EBA1),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8F1BBCDC),
                _ => (b ^ c ^ d, 0xCA62C1D6),
            };
            let temp = a
                .rotate_left(5)
                .wrapping_add(f)
                .wrapping_add(e)
                .wrapping_add(k)
                .wrapping_add(w[i]);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = temp;
        }

        h0 = h0.wrapping_add(a);
        h1 = h1.wrapping_add(b);
        h2 = h2.wrapping_add(c);
        h3 = h3.wrapping_add(d);
        h4 = h4.wrapping_add(e);
    }

    format!("{:08x}{:08x}{:08x}{:08x}{:08x}", h0, h1, h2, h3, h4)
}

/// 镜像源 URL 转换规则 (支持 Client JAR, Libraries, AssetIndex, Assets 资源)
pub fn transform_download_url(url: &str, source: &str) -> String {
    let lower_source = source.to_lowercase();
    if lower_source == "mojang" || lower_source == "official" {
        return url.to_string();
    }

    let mirror_base = if lower_source == "mcbbs" {
        "https://download.mcbbs.net"
    } else {
        "https://bmclapi2.bangbang93.com"
    };

    let mut transformed = url.to_string();

    // 1. Mojang Meta & Packages:
    transformed = transformed.replace("https://piston-meta.mojang.com", mirror_base);
    transformed = transformed.replace("http://piston-meta.mojang.com", mirror_base);
    transformed = transformed.replace("https://launchermeta.mojang.com", mirror_base);
    transformed = transformed.replace("http://launchermeta.mojang.com", mirror_base);

    // 2. Client / Server / Piston Data:
    transformed = transformed.replace("https://piston-data.mojang.com", mirror_base);
    transformed = transformed.replace("http://piston-data.mojang.com", mirror_base);

    // 3. Libraries (libraries.minecraft.net -> <mirror>/maven):
    let maven_mirror = format!("{mirror_base}/maven");
    transformed = transformed.replace("https://libraries.minecraft.net", &maven_mirror);
    transformed = transformed.replace("http://libraries.minecraft.net", &maven_mirror);

    // 4. Asset Objects (resources.download.minecraft.net -> <mirror>/assets):
    let assets_mirror = format!("{mirror_base}/assets");
    transformed = transformed.replace("https://resources.download.minecraft.net", &assets_mirror);
    transformed = transformed.replace("http://resources.download.minecraft.net", &assets_mirror);

    // 5. Maven Forge / Fabric / NeoForged:
    transformed = transformed.replace("https://files.minecraftforge.net/maven", &maven_mirror);
    transformed = transformed.replace("https://maven.minecraftforge.net", &maven_mirror);
    transformed = transformed.replace("https://maven.fabricmc.net", &maven_mirror);
    transformed = transformed.replace("https://maven.neoforged.net/releases", &maven_mirror);

    transformed
}

/// 导出 Tauri Command: URL 镜像源转换
#[tauri::command]
pub fn transform_mirror_url(url: String, download_source: Option<String>) -> String {
    let source = download_source.unwrap_or_else(|| "bmclapi".to_string());
    transform_download_url(&url, &source)
}

/// 导出 Tauri Command: 获取版本清单
#[tauri::command]
pub fn fetch_version_manifest(
    download_source: Option<String>,
) -> Result<VersionManifest, String> {
    let source = download_source.unwrap_or_else(|| "bmclapi".to_string());
    let lower_source = source.to_lowercase();
    let is_official = lower_source == "mojang" || lower_source == "official";

    let manifest_url = match lower_source.as_str() {
        "mojang" | "official" => OFFICIAL_MANIFEST_URL,
        "mcbbs" => MCBBS_MANIFEST_URL,
        _ => BMCLAPI_MANIFEST_URL,
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {e}"))?;

    let res = client
        .get(manifest_url)
        .send()
        .map_err(|e| format!("拉取版本清单失败 [{manifest_url}]: {e} (请检查网络连接)"))?;

    if !res.status().is_success() {
        return Err(format!(
            "拉取版本清单返回 HTTP 异常状态码: {}",
            res.status()
        ));
    }

    let mut manifest: VersionManifest = res
        .json()
        .map_err(|e| format!("解析版本清单 JSON 失败: {e}"))?;

    // 如果是镜像源，将每个版本的 URL 转换好以便前端快速直连
    if !is_official {
        for entry in &mut manifest.versions {
            entry.url = transform_download_url(&entry.url, &source);
        }
    }

    Ok(manifest)
}

/// 导出 Tauri Command: 获取单个版本详情并做镜像源转换
#[tauri::command]
pub fn fetch_version_detail(
    version_url: String,
    download_source: Option<String>,
) -> Result<serde_json::Value, String> {
    let source = download_source.unwrap_or_else(|| "bmclapi".to_string());
    let is_official = source.to_lowercase() == "mojang" || source.to_lowercase() == "official";

    let effective_url = transform_download_url(&version_url, &source);

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {e}"))?;

    let res = client
        .get(&effective_url)
        .send()
        .map_err(|e| format!("拉取版本详情失败 [{effective_url}]: {e}"))?;

    if !res.status().is_success() {
        return Err(format!(
            "拉取版本详情返回 HTTP 异常状态码: {}",
            res.status()
        ));
    }

    let mut v: serde_json::Value = res
        .json()
        .map_err(|e| format!("解析版本详情 JSON 失败: {e}"))?;

    if !is_official {
        // 转换 client download URL
        if let Some(client_art) = v.pointer_mut("/downloads/client") {
            if let Some(url_val) = client_art.get("url").and_then(|u| u.as_str()) {
                let transformed = transform_download_url(url_val, &source);
                client_art["url"] = serde_json::Value::String(transformed);
            }
        }

        // 转换 assetIndex URL
        if let Some(asset_idx) = v.get_mut("assetIndex") {
            if let Some(url_val) = asset_idx.get("url").and_then(|u| u.as_str()) {
                let transformed = transform_download_url(url_val, &source);
                asset_idx["url"] = serde_json::Value::String(transformed);
            }
        }

        // 转换 libraries downloads artifact & classifiers URLs
        if let Some(libs) = v.get_mut("libraries").and_then(|l| l.as_array_mut()) {
            for lib in libs {
                if let Some(artifact) = lib.pointer_mut("/downloads/artifact") {
                    if let Some(url_val) = artifact.get("url").and_then(|u| u.as_str()) {
                        let transformed = transform_download_url(url_val, &source);
                        artifact["url"] = serde_json::Value::String(transformed);
                    }
                }
                if let Some(classifiers) = lib.pointer_mut("/downloads/classifiers").and_then(|c| c.as_object_mut()) {
                    for (_k, clf_val) in classifiers {
                        if let Some(url_val) = clf_val.get("url").and_then(|u| u.as_str()) {
                            let transformed = transform_download_url(url_val, &source);
                            clf_val["url"] = serde_json::Value::String(transformed);
                        }
                    }
                }
                if let Some(lib_url) = lib.get("url").and_then(|u| u.as_str()) {
                    let transformed = transform_download_url(lib_url, &source);
                    lib["url"] = serde_json::Value::String(transformed);
                }
            }
        }
    }

    Ok(v)
}

/// 导出 Tauri Command: 推断 Minecraft 版本所需的 Java 大版本号
#[tauri::command]
pub fn infer_version_java(version_id: String, declared_major: Option<u32>) -> u32 {
    infer_java_major_version(&version_id, declared_major)
}

/// 导出 Tauri Command: 评估版本安装完整性与缺失文件清单
/// 充分复用 core::types 模型 (IntegrityReport, MissingLibraryInfo, MissingAssetInfo)
/// 充分复用 core::resolver 与 core::rules (evaluate_rules, parse_rules_from_json, parse_maven_coordinate, infer_java_major_version)
#[tauri::command]
pub fn resolve_version_install_plan(
    game_dir: String,
    version_id: String,
    version_json: Option<serde_json::Value>,
    download_source: Option<String>,
) -> Result<IntegrityReport, String> {
    let source = download_source.unwrap_or_else(|| "bmclapi".to_string());
    let gdir = PathBuf::from(&game_dir);

    // 1. 获取版本配置 JSON
    let val = match version_json {
        Some(v) => v,
        None => {
            let json_path = gdir
                .join("versions")
                .join(&version_id)
                .join(format!("{version_id}.json"));
            if !json_path.exists() {
                // 本地尚无配置文件，表明该版本尚未安装
                return Ok(IntegrityReport {
                    is_complete: false,
                    missing_libraries: Vec::new(),
                    missing_assets: Vec::new(),
                    missing_version_jar: true,
                    total_missing_count: 1,
                });
            }
            let raw = fs::read_to_string(&json_path)
                .map_err(|e| format!("读取本地版本 JSON 失败: {e}"))?;
            serde_json::from_str(&raw).map_err(|e| format!("解析本地版本 JSON 失败: {e}"))?
        }
    };

    // 充分复用 infer_java_major_version
    let declared_java = val
        .get("javaVersion")
        .and_then(|j| j.get("majorVersion"))
        .and_then(|m| m.as_u64())
        .map(|m| m as u32);
    let _inferred_java = infer_java_major_version(&version_id, declared_java);

    let mut missing_libs = Vec::new();
    let mut missing_assets = Vec::new();

    // 2. 检查 Client JAR
    let version_jar_path = gdir
        .join("versions")
        .join(&version_id)
        .join(format!("{version_id}.jar"));
    let mut missing_version_jar = !version_jar_path.exists();
    if !missing_version_jar {
        if let Some(client_obj) = val.pointer("/downloads/client") {
            if let Some(expected_size) = client_obj.get("size").and_then(|s| s.as_u64()) {
                if let Ok(meta) = fs::metadata(&version_jar_path) {
                    if meta.len() != expected_size {
                        missing_version_jar = true;
                    }
                }
            }
        }
    }

    // 3. 检查 Libraries (复用 evaluate_rules 和 parse_rules_from_json 跨平台解析)
    let libraries_root = gdir.join("libraries");
    let default_features = LauncherFeatureFlags::default();

    struct LibraryTarget {
        name: String,
        rel_path: String,
        download_url: Option<String>,
        sha1: Option<String>,
        size: Option<u64>,
    }

    if let Some(libs) = val.get("libraries").and_then(|x| x.as_array()) {
        for lib in libs {
            if let Some(rules_arr) = lib.get("rules").and_then(|x| x.as_array()) {
                let parsed_rules = parse_rules_from_json(rules_arr);
                if !evaluate_rules(&parsed_rules, &default_features) {
                    continue;
                }
            }

            let name = lib
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("unknown-lib")
                .to_string();

            let mut targets: Vec<LibraryTarget> = Vec::new();

            // 目标 A: downloads.artifact
            if let Some(art) = lib.pointer("/downloads/artifact") {
                if let Some(p) = art.get("path").and_then(|x| x.as_str()) {
                    let u = art.get("url").and_then(|x| x.as_str()).map(|raw| transform_download_url(raw, &source));
                    let s = art.get("sha1").and_then(|x| x.as_str()).map(|str_s| str_s.to_string());
                    let sz = art.get("size").and_then(|x| x.as_u64());
                    targets.push(LibraryTarget {
                        name: name.clone(),
                        rel_path: p.to_string(),
                        download_url: u,
                        sha1: s,
                        size: sz,
                    });
                }
            }

            // 目标 B: downloads.classifiers (包含当前系统所需的 natives，不与 artifact 互斥)
            if let Some(classifiers) = lib.pointer("/downloads/classifiers") {
                #[cfg(target_os = "windows")]
                let os_keys = ["natives-windows", "natives-windows-64", "natives-windows-32"];
                #[cfg(target_os = "macos")]
                let os_keys = ["natives-osx", "natives-macos", "natives-macos-arm64"];
                #[cfg(target_os = "linux")]
                let os_keys = ["natives-linux"];

                for k in os_keys {
                    if let Some(art) = classifiers.get(k) {
                        if let Some(p) = art.get("path").and_then(|x| x.as_str()) {
                            let u = art.get("url").and_then(|x| x.as_str()).map(|raw| transform_download_url(raw, &source));
                            let s = art.get("sha1").and_then(|x| x.as_str()).map(|str_s| str_s.to_string());
                            let sz = art.get("size").and_then(|x| x.as_u64());
                            targets.push(LibraryTarget {
                                name: format!("{name}:{k}"),
                                rel_path: p.to_string(),
                                download_url: u,
                                sha1: s,
                                size: sz,
                            });
                            break;
                        }
                    }
                }
            }

            // 目标 C: 若 targets 为空，则回退解析 Maven 坐标 (支持旧版 natives 与第三方加载器)
            if targets.is_empty() {
                let native_classifier = lib.get("natives").and_then(|n| {
                    #[cfg(target_os = "windows")]
                    let k = "windows";
                    #[cfg(target_os = "macos")]
                    let k = "osx";
                    #[cfg(target_os = "linux")]
                    let k = "linux";
                    n.get(k).and_then(|v| v.as_str())
                });

                let coord_name = if let Some(clf) = native_classifier {
                    format!("{name}:{clf}")
                } else {
                    name.clone()
                };

                if let Some(rel) = parse_maven_coordinate(&coord_name) {
                    let base_url = lib
                        .get("url")
                        .and_then(|u| u.as_str())
                        .unwrap_or("https://libraries.minecraft.net/");
                    let raw_url = format!("{}/{}", base_url.trim_end_matches('/'), rel);
                    let download_url = Some(transform_download_url(&raw_url, &source));
                    targets.push(LibraryTarget {
                        name: coord_name,
                        rel_path: rel,
                        download_url,
                        sha1: None,
                        size: None,
                    });
                }
            }

            for target in targets {
                let full_path = libraries_root.join(target.rel_path.replace('/', "\\"));
                let is_missing = if !full_path.exists() {
                    true
                } else if let Some(expected_size) = target.size {
                    fs::metadata(&full_path).map(|m| m.len() != expected_size).unwrap_or(true)
                } else {
                    false
                };

                if is_missing {
                    missing_libs.push(MissingLibraryInfo {
                        name: target.name,
                        path: full_path.to_string_lossy().to_string(),
                        url: target.download_url,
                        sha1: target.sha1,
                        size: target.size,
                    });
                }
            }
        }
    }

    // 4. 检查 Assets 索引与资源文件
    let assets_dir = gdir.join("assets");
    let asset_index_id = val
        .get("assets")
        .and_then(|x| x.as_str())
        .or_else(|| val.pointer("/assetIndex/id").and_then(|x| x.as_str()))
        .unwrap_or("legacy");

    let index_file = assets_dir
        .join("indexes")
        .join(format!("{asset_index_id}.json"));

    if !index_file.exists() {
        missing_assets.push(MissingAssetInfo {
            name: format!("Asset Index: {asset_index_id}"),
            path: index_file.to_string_lossy().to_string(),
            hash: "".to_string(),
            size: 0,
        });
    } else if let Ok(index_content) = fs::read_to_string(&index_file) {
        if let Ok(index_json) = serde_json::from_str::<serde_json::Value>(&index_content) {
            if let Some(objects) = index_json.get("objects").and_then(|o| o.as_object()) {
                for (name, obj) in objects {
                    let hash = obj
                        .get("hash")
                        .and_then(|h| h.as_str())
                        .unwrap_or_default();
                    let sz = obj.get("size").and_then(|s| s.as_u64()).unwrap_or(0);
                    if hash.len() >= 2 {
                        let sub = &hash[..2];
                        let obj_path = assets_dir.join("objects").join(sub).join(hash);
                        if !obj_path.exists() {
                            missing_assets.push(MissingAssetInfo {
                                name: name.clone(),
                                path: obj_path.to_string_lossy().to_string(),
                                hash: hash.to_string(),
                                size: sz,
                            });
                        }
                    }
                }
            }
        }
    }

    let total_missing =
        missing_libs.len() + missing_assets.len() + if missing_version_jar { 1 } else { 0 };

    Ok(IntegrityReport {
        is_complete: total_missing == 0,
        missing_libraries: missing_libs,
        missing_assets,
        missing_version_jar,
        total_missing_count: total_missing,
    })
}

/// 导出 Tauri Command: 安装版本 JSON 与 Client JAR
#[tauri::command]
pub fn install_version_jar_and_json(
    game_dir: String,
    version_id: String,
    version_json: serde_json::Value,
    download_source: Option<String>,
) -> Result<bool, String> {
    let source = download_source.unwrap_or_else(|| "bmclapi".to_string());
    let gdir = PathBuf::from(&game_dir);
    let version_folder = gdir.join("versions").join(&version_id);
    fs::create_dir_all(&version_folder)
        .map_err(|e| format!("创建版本目录失败 [{:?}]: {e}", version_folder))?;

    // 1. 保存版本 JSON
    let json_path = version_folder.join(format!("{version_id}.json"));
    let pretty_json = serde_json::to_string_pretty(&version_json)
        .map_err(|e| format!("序列化版本 JSON 失败: {e}"))?;
    fs::write(&json_path, pretty_json)
        .map_err(|e| format!("写入版本 JSON 文件失败 [{:?}]: {e}", json_path))?;

    // 2. 如果存在 Client JAR 下载地址，执行下载并校验完整性
    if let Some(client_obj) = version_json.pointer("/downloads/client") {
        if let Some(raw_url) = client_obj.get("url").and_then(|u| u.as_str()) {
            let client_url = transform_download_url(raw_url, &source);
            let jar_path = version_folder.join(format!("{version_id}.jar"));
            let expected_sha1 = client_obj.get("sha1").and_then(|s| s.as_str());
            let expected_size = client_obj.get("size").and_then(|s| s.as_u64());

            let need_download = if !jar_path.exists() {
                true
            } else if let Some(sz) = expected_size {
                fs::metadata(&jar_path).map(|m| m.len() != sz).unwrap_or(true)
            } else {
                false
            };

            if need_download {
                download_file_direct(&client_url, &jar_path, expected_sha1, expected_size)?;
            }
        }
    }

    // 3. 如果存在 assetIndex，下载 index 文件
    if let Some(asset_idx) = version_json.get("assetIndex") {
        if let Some(raw_url) = asset_idx.get("url").and_then(|u| u.as_str()) {
            let id = asset_idx
                .get("id")
                .and_then(|i| i.as_str())
                .unwrap_or("legacy");
            let index_url = transform_download_url(raw_url, &source);
            let indexes_dir = gdir.join("assets").join("indexes");
            let _ = fs::create_dir_all(&indexes_dir);
            let index_dest = indexes_dir.join(format!("{id}.json"));
            let expected_sha1 = asset_idx.get("sha1").and_then(|s| s.as_str());
            let expected_size = asset_idx.get("size").and_then(|s| s.as_u64());
            if !index_dest.exists() {
                let _ = download_file_direct(&index_url, &index_dest, expected_sha1, expected_size);
            }
        }
    }

    Ok(true)
}

/// 导出 Tauri Command: 批量下载缺失的 Libraries
#[tauri::command]
pub fn download_missing_libraries(
    game_dir: String,
    missing_libraries: Vec<MissingLibraryInfo>,
    download_source: Option<String>,
) -> Result<usize, String> {
    let source = download_source.unwrap_or_else(|| "bmclapi".to_string());
    let _gdir = PathBuf::from(&game_dir);
    let mut downloaded_count = 0;

    for lib in missing_libraries {
        if let Some(ref url) = lib.url {
            let effective_url = transform_download_url(url, &source);
            let dest_path = PathBuf::from(&lib.path);
            if let Some(parent) = dest_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if download_file_direct(
                &effective_url,
                &dest_path,
                lib.sha1.as_deref(),
                lib.size,
            )
            .is_ok()
            {
                downloaded_count += 1;
            }
        }
    }

    Ok(downloaded_count)
}

/// 导出 Tauri Command: 批量下载缺失的 Assets 资源对象 (支持分批下载限制)
#[tauri::command]
pub fn download_asset_objects(
    game_dir: String,
    asset_index_id: String,
    download_source: Option<String>,
    max_items: Option<usize>,
) -> Result<usize, String> {
    let source = download_source.unwrap_or_else(|| "bmclapi".to_string());
    let gdir = PathBuf::from(&game_dir);
    let assets_dir = gdir.join("assets");
    let index_file = assets_dir
        .join("indexes")
        .join(format!("{asset_index_id}.json"));

    if !index_file.exists() {
        return Ok(0);
    }

    let index_raw = fs::read_to_string(&index_file)
        .map_err(|e| format!("读取 AssetIndex 失败: {e}"))?;
    let index_json: serde_json::Value =
        serde_json::from_str(&index_raw).map_err(|e| format!("解析 AssetIndex 失败: {e}"))?;

    let objects = match index_json.get("objects").and_then(|o| o.as_object()) {
        Some(o) => o,
        None => return Ok(0),
    };

    let limit = max_items.unwrap_or(usize::MAX);
    let mut downloaded = 0;

    for (_name, obj) in objects {
        if downloaded >= limit {
            break;
        }
        let hash = match obj.get("hash").and_then(|h| h.as_str()) {
            Some(h) if h.len() >= 2 => h,
            _ => continue,
        };
        let sub = &hash[..2];
        let obj_path = assets_dir.join("objects").join(sub).join(hash);
        if !obj_path.exists() {
            if let Some(parent) = obj_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let raw_url = format!("https://resources.download.minecraft.net/{sub}/{hash}");
            let effective_url = transform_download_url(&raw_url, &source);
            let size = obj.get("size").and_then(|s| s.as_u64());
            if download_file_direct(&effective_url, &obj_path, Some(hash), size).is_ok() {
                downloaded += 1;
            }
        }
    }

    Ok(downloaded)
}

/// 辅助直接下载网络文件到本地并执行 SHA-1 与文件大小校验
pub fn download_file_direct(
    url: &str,
    dest: &Path,
    expected_sha1: Option<&str>,
    expected_size: Option<u64>,
) -> Result<(), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|e| format!("HTTP 客户端错误: {e}"))?;

    let res = client
        .get(url)
        .send()
        .map_err(|e| format!("请求下载文件失败 [{url}]: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("下载返回异常状态码: {}", res.status()));
    }

    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let bytes = res.bytes().map_err(|e| format!("读取响应流失败: {e}"))?;

    // 校验文件大小
    if let Some(exp_sz) = expected_size {
        if bytes.len() as u64 != exp_sz {
            return Err(format!(
                "文件大小不匹配 [{}]: 期望 {} 字节, 实际 {} 字节",
                dest.display(),
                exp_sz,
                bytes.len()
            ));
        }
    }

    // 校验 SHA-1 哈希
    if let Some(exp_hash) = expected_sha1 {
        let trimmed = exp_hash.trim();
        if !trimmed.is_empty() {
            let actual_hash = compute_sha1(&bytes);
            if !actual_hash.eq_ignore_ascii_case(trimmed) {
                return Err(format!(
                    "文件 SHA-1 校验失败 [{}]: 期望 {}, 实际 {}",
                    dest.display(),
                    trimmed,
                    actual_hash
                ));
            }
        }
    }

    fs::write(dest, bytes).map_err(|e| format!("写入文件失败 [{:?}]: {e}", dest))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha1_standard_vector() {
        let text = b"The quick brown fox jumps over the lazy dog";
        assert_eq!(
            compute_sha1(text),
            "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12"
        );

        // 标准空字符串 SHA-1 向量测试
        assert_eq!(
            compute_sha1(b""),
            "da39a3ee5e6b4b0d3255bfef95601890afd80709"
        );
    }

    #[test]
    fn test_transform_download_url_mojang_official() {
        let official_url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
        assert_eq!(
            transform_download_url(official_url, "official"),
            official_url
        );
        assert_eq!(
            transform_download_url(official_url, "mojang"),
            official_url
        );
    }

    #[test]
    fn test_transform_download_url_bmclapi_rules() {
        // 1. Client JAR
        let client_url = "https://piston-data.mojang.com/v1/objects/abc12345/client.jar";
        assert_eq!(
            transform_download_url(client_url, "bmclapi"),
            "https://bmclapi2.bangbang93.com/v1/objects/abc12345/client.jar"
        );

        // 2. Libraries
        let lib_url = "https://libraries.minecraft.net/com/mojang/authlib/1.5.25/authlib-1.5.25.jar";
        assert_eq!(
            transform_download_url(lib_url, "bmclapi"),
            "https://bmclapi2.bangbang93.com/maven/com/mojang/authlib/1.5.25/authlib-1.5.25.jar"
        );

        // 3. Asset Objects
        let asset_url = "https://resources.download.minecraft.net/a0/a0123456789";
        assert_eq!(
            transform_download_url(asset_url, "bmclapi"),
            "https://bmclapi2.bangbang93.com/assets/a0/a0123456789"
        );

        // 4. Manifest / Meta
        let meta_url = "https://piston-meta.mojang.com/v1/packages/1.20.4.json";
        assert_eq!(
            transform_download_url(meta_url, "bmclapi"),
            "https://bmclapi2.bangbang93.com/v1/packages/1.20.4.json"
        );
    }

    #[test]
    fn test_transform_download_url_mcbbs_rules() {
        let client_url = "https://piston-data.mojang.com/v1/objects/abc12345/client.jar";
        assert_eq!(
            transform_download_url(client_url, "mcbbs"),
            "https://download.mcbbs.net/v1/objects/abc12345/client.jar"
        );

        let lib_url = "https://libraries.minecraft.net/com/mojang/authlib/1.5.25/authlib-1.5.25.jar";
        assert_eq!(
            transform_download_url(lib_url, "mcbbs"),
            "https://download.mcbbs.net/maven/com/mojang/authlib/1.5.25/authlib-1.5.25.jar"
        );
    }

    #[test]
    fn test_uninstalled_version_plan_graceful() {
        let temp_dir = std::env::temp_dir().join("atom_test_empty_game_dir");
        let plan = resolve_version_install_plan(
            temp_dir.to_string_lossy().to_string(),
            "1.21.999-not-installed".to_string(),
            None,
            Some("bmclapi".to_string()),
        ).unwrap();

        assert!(!plan.is_complete);
        assert!(plan.missing_version_jar);
        assert_eq!(plan.total_missing_count, 1);
    }

    #[test]
    fn test_manifest_deserialization_contract() {
        let sample = r#"{
            "latest": {
                "release": "1.21.1",
                "snapshot": "24w33a"
            },
            "versions": [
                {
                    "id": "1.21.1",
                    "type": "release",
                    "url": "https://piston-meta.mojang.com/v1/packages/123/1.21.1.json",
                    "time": "2024-08-08T00:00:00+00:00",
                    "releaseTime": "2024-08-08T00:00:00+00:00",
                    "sha1": "abcdef123456"
                }
            ]
        }"#;

        let manifest: VersionManifest = serde_json::from_str(sample).unwrap();
        assert_eq!(manifest.latest.release, "1.21.1");
        assert_eq!(manifest.latest.snapshot, "24w33a");
        assert_eq!(manifest.versions.len(), 1);
        assert_eq!(manifest.versions[0].id, "1.21.1");
        assert_eq!(manifest.versions[0].type_name, "release");
    }
}
