use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

/// 游戏完整性检查报告（供启动前自检与后续版本下载器共用）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityReport {
    pub is_complete: bool,
    pub missing_libraries: Vec<MissingLibraryInfo>,
    pub missing_assets: Vec<MissingAssetInfo>,
    pub missing_version_jar: bool,
    pub total_missing_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingLibraryInfo {
    pub name: String,
    pub path: String,
    pub url: Option<String>,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingAssetInfo {
    pub name: String,
    pub path: String,
    pub hash: String,
    pub size: u64,
}

/// 解析后的 Minecraft 版本元数据（合并继承链）
#[derive(Debug, Clone)]
pub struct ResolvedVersionMeta {
    pub id: String,
    pub main_class: String,
    pub java_major_version: u32,
    pub assets_index: String,
    pub classpath_entries: Vec<PathBuf>,
    pub jvm_args_template: Vec<String>,
    pub game_args_template: Vec<String>,
    pub loader_type: String, // "vanilla" | "forge" | "neoforge" | "fabric" | "quilt" | "other"
}

/// 规则计算器（解析 Mojang OS 与 Feature 规则）
fn evaluate_rules(rules: &[serde_json::Value]) -> bool {
    let mut allowed = false;
    let current_os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };

    let current_arch = if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x86"
    };

    for rule in rules {
        let action = rule.get("action").and_then(|a| a.as_str()).unwrap_or("allow");
        let is_allow = action == "allow";

        let mut applies = true;

        if let Some(os) = rule.get("os") {
            if let Some(name) = os.get("name").and_then(|n| n.as_str()) {
                if name != current_os {
                    applies = false;
                }
            }
            if let Some(arch) = os.get("arch").and_then(|a| a.as_str()) {
                if arch != current_arch {
                    applies = false;
                }
            }
        }

        // Features flag check
        if let Some(features) = rule.get("features") {
            if let Some(is_demo) = features.get("is_demo_user").and_then(|d| d.as_bool()) {
                if is_demo {
                    applies = false;
                }
            }
        }

        if applies {
            allowed = is_allow;
        }
    }

    if rules.is_empty() {
        true
    } else {
        allowed
    }
}

/// 根据版本 ID 推断推荐的目标 Java 主版本
pub fn infer_java_major_version(version_id: &str, raw_major: Option<u32>) -> u32 {
    if let Some(m) = raw_major {
        if m > 0 {
            return m;
        }
    }

    let lower = version_id.to_lowercase();
    if lower.starts_with("26.") || lower.contains("26w") || lower.contains("snapshot") {
        25
    } else if lower.starts_with("1.21") || lower.starts_with("1.20.5") || lower.starts_with("1.20.6") {
        21
    } else if lower.starts_with("1.18") || lower.starts_with("1.19") || lower.starts_with("1.20") {
        17
    } else if lower.starts_with("1.17") {
        16
    } else {
        8
    }
}

/// 递归解析版本 JSON 与其父继承版本
pub fn resolve_version_meta(
    game_dir: &Path,
    version_id: &str,
) -> Result<ResolvedVersionMeta, String> {
    let mut visited_ids = HashSet::new();
    let mut current_id = version_id.to_string();

    let mut main_class = "net.minecraft.client.main.Main".to_string();
    let mut java_major: Option<u32> = None;
    let mut assets_index = "legacy".to_string();
    let mut loader_type = "vanilla".to_string();

    let mut collected_libs: Vec<serde_json::Value> = Vec::new();
    let mut collected_jvm_args: Vec<String> = Vec::new();
    let mut collected_game_args: Vec<String> = Vec::new();
    let mut version_jars: Vec<PathBuf> = Vec::new();

    let versions_dir = game_dir.join("versions");

    while !current_id.is_empty() {
        if visited_ids.contains(&current_id) {
            break;
        }
        visited_ids.insert(current_id.clone());

        let json_path = versions_dir.join(&current_id).join(format!("{current_id}.json"));
        if !json_path.exists() {
            break;
        }

        let content = fs::read_to_string(&json_path)
            .map_err(|e| format!("读取版本 JSON 失败 [{:?}]: {e}", json_path))?;
        let v: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("解析版本 JSON 失败 [{:?}]: {e}", json_path))?;

        // 识别主类（优先使用最上层派生版本的主类，例如 Forge BootstrapLauncher）
        if let Some(mc) = v.get("mainClass").and_then(|x| x.as_str()) {
            if main_class == "net.minecraft.client.main.Main" || visited_ids.len() == 1 {
                main_class = mc.to_string();
            }
        }

        // 识别加载器
        let lower_content = content.to_lowercase();
        if loader_type == "vanilla" {
            if lower_content.contains("cpw.mods.bootstraplauncher")
                || lower_content.contains("net.minecraftforge")
                || current_id.to_lowercase().contains("forge")
            {
                loader_type = "forge".to_string();
            } else if lower_content.contains("net.neoforged") {
                loader_type = "neoforge".to_string();
            } else if lower_content.contains("net.fabricmc") {
                loader_type = "fabric".to_string();
            } else if lower_content.contains("org.quiltmc") {
                loader_type = "quilt".to_string();
            }
        }

        // 解析 Java 需求
        if java_major.is_none() {
            if let Some(jv) = v.get("javaVersion") {
                if let Some(m) = jv.get("majorVersion").and_then(|x| x.as_u64()) {
                    java_major = Some(m as u32);
                }
            }
        }

        // 解析 Assets Index
        if let Some(ai) = v.get("assets").and_then(|x| x.as_str()) {
            assets_index = ai.to_string();
        } else if let Some(ai) = v.get("assetIndex").and_then(|x| x.get("id")).and_then(|x| x.as_str()) {
            assets_index = ai.to_string();
        }

        // 记录关联的版本 JAR
        let jar_file = versions_dir.join(&current_id).join(format!("{current_id}.jar"));
        if jar_file.exists() && !version_jars.contains(&jar_file) {
            version_jars.push(jar_file);
        }

        // 收集 Libraries
        if let Some(libs) = v.get("libraries").and_then(|x| x.as_array()) {
            for lib in libs {
                collected_libs.push(lib.clone());
            }
        }

        // 收集 Arguments
        if let Some(args) = v.get("arguments") {
            if let Some(jvm) = args.get("jvm").and_then(|x| x.as_array()) {
                for item in jvm {
                    if let Some(s) = item.as_str() {
                        collected_jvm_args.push(s.to_string());
                    } else if let Some(obj) = item.as_object() {
                        if let Some(rules) = obj.get("rules").and_then(|r| r.as_array()) {
                            if evaluate_rules(rules) {
                                if let Some(v_str) = obj.get("value").and_then(|v| v.as_str()) {
                                    collected_jvm_args.push(v_str.to_string());
                                } else if let Some(v_arr) = obj.get("value").and_then(|v| v.as_array()) {
                                    for sub in v_arr {
                                        if let Some(s) = sub.as_str() {
                                            collected_jvm_args.push(s.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if let Some(game) = args.get("game").and_then(|x| x.as_array()) {
                for item in game {
                    if let Some(s) = item.as_str() {
                        collected_game_args.push(s.to_string());
                    } else if let Some(obj) = item.as_object() {
                        if let Some(rules) = obj.get("rules").and_then(|r| r.as_array()) {
                            if evaluate_rules(rules) {
                                if let Some(v_str) = obj.get("value").and_then(|v| v.as_str()) {
                                    collected_game_args.push(v_str.to_string());
                                } else if let Some(v_arr) = obj.get("value").and_then(|v| v.as_array()) {
                                    for sub in v_arr {
                                        if let Some(s) = sub.as_str() {
                                            collected_game_args.push(s.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if let Some(legacy_args) = v.get("minecraftArguments").and_then(|x| x.as_str()) {
            for part in legacy_args.split_whitespace() {
                collected_game_args.push(part.to_string());
            }
        }

        // 检查继承
        current_id = v.get("inheritsFrom").and_then(|x| x.as_str()).unwrap_or("").to_string();
    }

    let libraries_root = game_dir.join("libraries");
    let mut classpath_entries = Vec::new();
    let mut seen_cp = HashSet::new();

    // 解析 Libraries 构建真实 Classpath
    for lib in collected_libs {
        if let Some(rules) = lib.get("rules").and_then(|r| r.as_array()) {
            if !evaluate_rules(rules) {
                continue;
            }
        }

        let mut lib_rel_path: Option<String> = None;

        if let Some(downloads) = lib.get("downloads") {
            if let Some(artifact) = downloads.get("artifact") {
                if let Some(p) = artifact.get("path").and_then(|x| x.as_str()) {
                    lib_rel_path = Some(p.to_string());
                }
            }
        }

        if lib_rel_path.is_none() {
            if let Some(name) = lib.get("name").and_then(|x| x.as_str()) {
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 3 {
                    let group_path = parts[0].replace('.', "/");
                    let artifact_name = parts[1];
                    let version_str = parts[2];
                    let classifier = if parts.len() >= 4 { format!("-{}", parts[3]) } else { "".to_string() };
                    let jar_name = format!("{artifact_name}-{version_str}{classifier}.jar");
                    let rel = format!("{group_path}/{artifact_name}/{version_str}/{jar_name}");
                    lib_rel_path = Some(rel);
                }
            }
        }

        if let Some(rel) = lib_rel_path {
            let full_lib_path = libraries_root.join(rel.replace('/', "\\"));
            if full_lib_path.exists() {
                let canonical = full_lib_path.to_string_lossy().to_lowercase();
                if !seen_cp.contains(&canonical) {
                    seen_cp.insert(canonical);
                    classpath_entries.push(full_lib_path);
                }
            }
        }
    }

    // 加入版本 JAR
    for jar in version_jars {
        let canonical = jar.to_string_lossy().to_lowercase();
        if !seen_cp.contains(&canonical) {
            seen_cp.insert(canonical);
            classpath_entries.push(jar);
        }
    }

    let final_java_major = infer_java_major_version(version_id, java_major);

    Ok(ResolvedVersionMeta {
        id: version_id.to_string(),
        main_class,
        java_major_version: final_java_major,
        assets_index,
        classpath_entries,
        jvm_args_template: collected_jvm_args,
        game_args_template: collected_game_args,
        loader_type,
    })
}

/// 检查游戏完整性（检查缺失的库、版本 JAR 与资源文件）
pub fn check_game_integrity(
    game_dir: &Path,
    version_id: &str,
) -> IntegrityReport {
    let meta_res = resolve_version_meta(game_dir, version_id);
    let mut missing_libs = Vec::new();
    let mut missing_assets = Vec::new();
    let mut missing_version_jar = false;

    let version_jar = game_dir.join("versions").join(version_id).join(format!("{version_id}.jar"));
    if !version_jar.exists() {
        missing_version_jar = true;
    }

    if let Ok(meta) = meta_res {
        if meta.classpath_entries.is_empty() {
            missing_libs.push(MissingLibraryInfo {
                name: "Minecraft Client Classpath Libraries".to_string(),
                path: game_dir.join("libraries").to_string_lossy().to_string(),
                url: None,
                sha1: None,
                size: None,
            });
        }

        // 检查 Assets 索引
        let index_file = game_dir.join("assets").join("indexes").join(format!("{}.json", meta.assets_index));
        if !index_file.exists() {
            missing_assets.push(MissingAssetInfo {
                name: format!("Asset Index: {}", meta.assets_index),
                path: index_file.to_string_lossy().to_string(),
                hash: "".to_string(),
                size: 0,
            });
        }
    }

    let total_missing = missing_libs.len() + missing_assets.len() + if missing_version_jar { 1 } else { 0 };

    IntegrityReport {
        is_complete: total_missing == 0,
        missing_libraries: missing_libs,
        missing_assets,
        missing_version_jar,
        total_missing_count: total_missing,
    }
}

/// 构建包含标准 JVM Module Unlocks 的启动参数列表
pub fn build_launch_arguments(
    meta: &ResolvedVersionMeta,
    game_dir: &Path,
    work_dir: &Path,
    java_major: u32,
    username: &str,
    uuid: &str,
    access_token: &str,
    window_width: Option<u32>,
    window_height: Option<u32>,
    fullscreen: bool,
) -> (Vec<String>, Vec<String>) {
    let mut jvm_args = Vec::new();
    let mut game_args = Vec::new();

    let natives_dir = work_dir.join("natives");
    let assets_dir = game_dir.join("assets");

    // 1. 对于 Java 9+ (Java 16/17/21/25) 注入完整的 Module Open/Export 标志（彻底解决 Forge/NeoForge/ModLauncher 的 InaccessibleObjectException）
    if java_major >= 9 {
        let module_opens = [
            "java.base/java.lang=ALL-UNNAMED",
            "java.base/java.lang.invoke=ALL-UNNAMED",
            "java.base/java.lang.reflect=ALL-UNNAMED",
            "java.base/java.util=ALL-UNNAMED",
            "java.base/java.util.concurrent=ALL-UNNAMED",
            "java.base/sun.security.util=ALL-UNNAMED",
            "java.base/java.io=ALL-UNNAMED",
            "java.base/java.nio=ALL-UNNAMED",
            "java.base/sun.nio.ch=ALL-UNNAMED",
            "java.base/java.net=ALL-UNNAMED",
        ];

        for open in module_opens {
            jvm_args.push("--add-opens".to_string());
            jvm_args.push(open.to_string());
        }

        jvm_args.push("--add-exports".to_string());
        jvm_args.push("jdk.naming.dns/com.sun.jndi.dns=java.naming".to_string());
        jvm_args.push("--add-exports".to_string());
        jvm_args.push("java.base/sun.security.util=ALL-UNNAMED".to_string());
    }

    // 2. 基础 JVM 系统属性
    jvm_args.push(format!("-Djava.library.path={}", natives_dir.to_string_lossy()));
    jvm_args.push("-Dminecraft.launcher.brand=AtomLauncher".to_string());
    jvm_args.push("-Dminecraft.launcher.version=1.0.0".to_string());

    // 3. 解析版本自带的 JVM 参数模板
    let cp_separator = if cfg!(windows) { ";" } else { ":" };
    let classpath_str = meta
        .classpath_entries
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(cp_separator);

    for arg in &meta.jvm_args_template {
        let mut replaced = arg.clone();
        replaced = replaced.replace("${natives_directory}", &natives_dir.to_string_lossy());
        replaced = replaced.replace("${launcher_name}", "AtomLauncher");
        replaced = replaced.replace("${launcher_version}", "1.0.0");
        replaced = replaced.replace("${classpath}", &classpath_str);
        if !replaced.is_empty() && !jvm_args.contains(&replaced) {
            jvm_args.push(replaced);
        }
    }

    // 4. 解析 Game 参数
    if !meta.game_args_template.is_empty() {
        for arg in &meta.game_args_template {
            let mut replaced = arg.clone();
            replaced = replaced.replace("${auth_player_name}", username);
            replaced = replaced.replace("${version_name}", &meta.id);
            replaced = replaced.replace("${game_directory}", &work_dir.to_string_lossy());
            replaced = replaced.replace("${assets_root}", &assets_dir.to_string_lossy());
            replaced = replaced.replace("${assets_index_name}", &meta.assets_index);
            replaced = replaced.replace("${auth_uuid}", uuid);
            replaced = replaced.replace("${auth_access_token}", access_token);
            replaced = replaced.replace("${user_type}", "mojang");
            replaced = replaced.replace("${version_type}", "AtomLauncher");
            replaced = replaced.replace("${resolution_width}", &window_width.unwrap_or(854).to_string());
            replaced = replaced.replace("${resolution_height}", &window_height.unwrap_or(480).to_string());

            if !replaced.is_empty() {
                game_args.push(replaced);
            }
        }
    } else {
        // Fallback 标准游戏参数
        game_args.push("--username".to_string());
        game_args.push(username.to_string());
        game_args.push("--version".to_string());
        game_args.push(meta.id.clone());
        game_args.push("--gameDir".to_string());
        game_args.push(work_dir.to_string_lossy().to_string());
        game_args.push("--assetsDir".to_string());
        game_args.push(assets_dir.to_string_lossy().to_string());
        game_args.push("--assetIndex".to_string());
        game_args.push(meta.assets_index.clone());
        game_args.push("--uuid".to_string());
        game_args.push(uuid.to_string());
        game_args.push("--accessToken".to_string());
        game_args.push(access_token.to_string());
        game_args.push("--userType".to_string());
        game_args.push("mojang".to_string());
        game_args.push("--versionType".to_string());
        game_args.push("AtomLauncher".to_string());
    }

    if let Some(w) = window_width {
        if !game_args.contains(&"--width".to_string()) {
            game_args.push("--width".to_string());
            game_args.push(w.to_string());
        }
    }
    if let Some(h) = window_height {
        if !game_args.contains(&"--height".to_string()) {
            game_args.push("--height".to_string());
            game_args.push(h.to_string());
        }
    }
    if fullscreen && !game_args.contains(&"--fullscreen".to_string()) {
        game_args.push("--fullscreen".to_string());
    }

    (jvm_args, game_args)
}
