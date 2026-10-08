use super::types::{ArgumentEntry, ArgumentRule, ResolvedVersionMeta};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

pub fn parse_rules_from_json(rule_objs: &[serde_json::Value]) -> Vec<ArgumentRule> {
    let mut rules = Vec::new();
    for r in rule_objs {
        let action = r.get("action").and_then(|x| x.as_str()).unwrap_or("allow").to_string();
        let os_obj = r.get("os");
        let os_name = os_obj.and_then(|x| x.get("name")).and_then(|x| x.as_str()).map(|s| s.to_string());
        let os_version = os_obj.and_then(|x| x.get("version")).and_then(|x| x.as_str()).map(|s| s.to_string());
        let os_arch = os_obj.and_then(|x| x.get("arch")).and_then(|x| x.as_str()).map(|s| s.to_string());

        let mut feat_map = std::collections::HashMap::new();
        let mut is_demo_user = None;
        let mut has_custom_resolution = None;
        let mut is_quick_play_singleplayer = None;
        let mut is_quick_play_multiplayer = None;
        let mut is_quick_play_realms = None;
        let mut is_quick_play_path = None;

        if let Some(features) = r.get("features").and_then(|x| x.as_object()) {
            for (k, val) in features {
                if let Some(b) = val.as_bool() {
                    feat_map.insert(k.clone(), b);
                    match k.as_str() {
                        "is_demo_user" => is_demo_user = Some(b),
                        "has_custom_resolution" => has_custom_resolution = Some(b),
                        "is_quick_play_singleplayer" => is_quick_play_singleplayer = Some(b),
                        "is_quick_play_multiplayer" => is_quick_play_multiplayer = Some(b),
                        "is_quick_play_realms" => is_quick_play_realms = Some(b),
                        "is_quick_play_path" => is_quick_play_path = Some(b),
                        _ => {}
                    }
                }
            }
        }

        rules.push(ArgumentRule {
            action,
            os_name,
            os_version,
            os_arch,
            is_demo_user,
            has_custom_resolution,
            is_quick_play_singleplayer,
            is_quick_play_multiplayer,
            is_quick_play_realms,
            is_quick_play_path,
            features: feat_map,
        });
    }
    rules
}

pub fn infer_java_major_version(version_id: &str, declared_major: Option<u32>) -> u32 {
    if let Some(m) = declared_major {
        return m;
    }

    let vid = version_id.to_lowercase();
    if vid.starts_with("26.") || vid.contains("26w") || vid.contains("26.") {
        25 // Minecraft 26.x 快照需要 Java 25
    } else if vid.starts_with("1.21") || vid.contains("1.21.") || vid.contains("24w") {
        21 // 1.21+ 需要 Java 21
    } else if vid.starts_with("1.18") || vid.starts_with("1.19") || vid.starts_with("1.20") {
        17 // 1.18~1.20 需要 Java 17
    } else if vid.starts_with("1.17") {
        16 // 1.17 需要 Java 16
    } else {
        8  // 1.16 及以下需要 Java 8
    }
}

pub fn resolve_version_meta(
    game_dir: &Path,
    version_id: &str,
) -> Result<ResolvedVersionMeta, String> {
    let mut current_id = version_id.to_string();
    let mut visited_ids = HashSet::new();

    let mut main_class = "net.minecraft.client.main.Main".to_string();
    let mut java_major: Option<u32> = None;
    let mut assets_index = "legacy".to_string();
    let mut loader_type = "vanilla".to_string();

    let mut collected_libs: Vec<serde_json::Value> = Vec::new();
    let mut collected_jvm_entries: Vec<ArgumentEntry> = Vec::new();
    let mut collected_game_entries: Vec<ArgumentEntry> = Vec::new();
    let mut version_jars: Vec<PathBuf> = Vec::new();

    let versions_dir = game_dir.join("versions");

    let mut has_minecraft_args = false;

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
        let v: serde_json::Value = serde_json::from_str::<serde_json::Value>(&content)
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

        // 收集 Arguments 条目（保留 rules 供后续根据特性动态计算）
        if let Some(args) = v.get("arguments") {
            if let Some(jvm) = args.get("jvm").and_then(|x| x.as_array()) {
                for item in jvm {
                    if let Some(s) = item.as_str() {
                        collected_jvm_entries.push(ArgumentEntry {
                            values: vec![s.to_string()],
                            rules: Vec::new(),
                        });
                    } else if let Some(obj) = item.as_object() {
                        let values = if let Some(val_str) = obj.get("value").and_then(|x| x.as_str()) {
                            vec![val_str.to_string()]
                        } else if let Some(val_arr) = obj.get("value").and_then(|x| x.as_array()) {
                            val_arr.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()
                        } else {
                            Vec::new()
                        };

                        let rules = obj.get("rules").and_then(|x| x.as_array()).map(|arr| parse_rules_from_json(arr)).unwrap_or_default();
                        collected_jvm_entries.push(ArgumentEntry { values, rules });
                    }
                }
            }

            if let Some(game) = args.get("game").and_then(|x| x.as_array()) {
                for item in game {
                    if let Some(s) = item.as_str() {
                        collected_game_entries.push(ArgumentEntry {
                            values: vec![s.to_string()],
                            rules: Vec::new(),
                        });
                    } else if let Some(obj) = item.as_object() {
                        let values = if let Some(val_str) = obj.get("value").and_then(|x| x.as_str()) {
                            vec![val_str.to_string()]
                        } else if let Some(val_arr) = obj.get("value").and_then(|x| x.as_array()) {
                            val_arr.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect()
                        } else {
                            Vec::new()
                        };

                        let rules = obj.get("rules").and_then(|x| x.as_array()).map(|arr| parse_rules_from_json(arr)).unwrap_or_default();
                        collected_game_entries.push(ArgumentEntry { values, rules });
                    }
                }
            }
        }

        // 收集旧版 minecraftArguments（子版本必须完全覆盖父版本，防止参数重复叠加）
        if !has_minecraft_args {
            if let Some(mc_args) = v.get("minecraftArguments").and_then(|x| x.as_str()) {
                has_minecraft_args = true;
                for token in mc_args.split_whitespace() {
                    collected_game_entries.push(ArgumentEntry {
                        values: vec![token.to_string()],
                        rules: Vec::new(),
                    });
                }
            }
        }

        // 沿 inheritsFrom 链向上追溯
        if let Some(parent) = v.get("inheritsFrom").and_then(|x| x.as_str()) {
            current_id = parent.to_string();
        } else {
            break;
        }
    }

    // 解析 Libraries 构建真实 Classpath
    let libraries_root = game_dir.join("libraries");
    let mut classpath_entries = Vec::new();
    let mut seen_cp = HashSet::new();

    for lib in &collected_libs {
        // 评估 library rules (例如针对不同 OS 的筛选)
        if let Some(rules_arr) = lib.get("rules").and_then(|x| x.as_array()) {
            let parsed_rules = parse_rules_from_json(rules_arr);
            let default_features = super::types::LauncherFeatureFlags::default();
            if !super::rules::evaluate_rules(&parsed_rules, &default_features) {
                continue;
            }
        }

        let mut lib_rel_path: Option<String> = None;

        // 方式 A: 从 downloads.artifact.path 获取
        if let Some(downloads) = lib.get("downloads") {
            if let Some(artifact) = downloads.get("artifact") {
                if let Some(p) = artifact.get("path").and_then(|x| x.as_str()) {
                    lib_rel_path = Some(p.to_string());
                }
            }
        }

        // 方式 B: 从 Maven 坐标 name 获取（如 "com.mojang:authlib:1.5.25" 或带 @jar / @zip 扩展名）
        if lib_rel_path.is_none() {
            if let Some(name) = lib.get("name").and_then(|x| x.as_str()) {
                lib_rel_path = parse_maven_coordinate(name);
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
        jvm_args_entries: collected_jvm_entries,
        game_args_entries: collected_game_entries,
        loader_type,
    })
}

pub fn parse_maven_coordinate(name: &str) -> Option<String> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let mut version = parts[2];
    let mut ext = "jar";
    if let Some((v, e)) = version.split_once('@') {
        version = v;
        ext = e;
    }
    let mut classifier = parts.get(3).copied();
    if let Some(c) = classifier {
        if let Some((clean_c, e)) = c.split_once('@') {
            classifier = Some(clean_c);
            ext = e;
        }
    }
    let filename = if let Some(c) = classifier {
        format!("{artifact}-{version}-{c}.{ext}")
    } else {
        format!("{artifact}-{version}.{ext}")
    };
    Some(format!("{group}/{artifact}/{version}/{filename}"))
}

pub fn extract_natives(
    game_dir: &Path,
    work_dir: &Path,
    version_id: &str,
) -> Result<(), String> {
    let natives_dir = work_dir.join("natives");
    let _ = fs::create_dir_all(&natives_dir);
    let libraries_root = game_dir.join("libraries");

    let versions_dir = game_dir.join("versions");
    let mut current_id = version_id.to_string();
    let mut visited = HashSet::new();

    while !current_id.is_empty() {
        if visited.contains(&current_id) {
            break;
        }
        visited.insert(current_id.clone());

        let json_path = versions_dir.join(&current_id).join(format!("{current_id}.json"));
        if !json_path.exists() {
            break;
        }

        let content = match fs::read_to_string(&json_path) {
            Ok(c) => c,
            Err(_) => break,
        };
        let v: serde_json::Value = match serde_json::from_str(&content) {
            Ok(val) => val,
            Err(_) => break,
        };

        if let Some(libs) = v.get("libraries").and_then(|x| x.as_array()) {
            for lib in libs {
                let is_native = lib.get("natives").is_some()
                    || lib.get("downloads").and_then(|d| d.get("classifiers")).is_some()
                    || lib.get("name").and_then(|n| n.as_str()).map_or(false, |n| n.contains("-natives-"));

                if !is_native {
                    continue;
                }

                let mut rel_path: Option<String> = None;
                if let Some(downloads) = lib.get("downloads") {
                    if let Some(classifiers) = downloads.get("classifiers") {
                        #[cfg(target_os = "windows")]
                        let os_keys = ["natives-windows", "natives-windows-64", "natives-windows-32"];
                        #[cfg(target_os = "macos")]
                        let os_keys = ["natives-osx", "natives-macos", "natives-macos-arm64"];
                        #[cfg(target_os = "linux")]
                        let os_keys = ["natives-linux"];

                        for k in os_keys {
                            if let Some(art) = classifiers.get(k) {
                                if let Some(p) = art.get("path").and_then(|x| x.as_str()) {
                                    rel_path = Some(p.to_string());
                                    break;
                                }
                            }
                        }
                    }
                    if rel_path.is_none() {
                        if let Some(art) = downloads.get("artifact") {
                            if let Some(p) = art.get("path").and_then(|x| x.as_str()) {
                                rel_path = Some(p.to_string());
                            }
                        }
                    }
                }

                if rel_path.is_none() {
                    if let Some(name) = lib.get("name").and_then(|x| x.as_str()) {
                        rel_path = parse_maven_coordinate(name);
                    }
                }

                if let Some(rel) = rel_path {
                    let full_path = libraries_root.join(rel.replace('/', "\\"));
                    if full_path.exists() {
                        if let Ok(file) = fs::File::open(&full_path) {
                            if let Ok(mut archive) = zip::ZipArchive::new(file) {
                                for i in 0..archive.len() {
                                    if let Ok(mut zip_file) = archive.by_index(i) {
                                        let name = zip_file.name().to_string();
                                        if name.starts_with("META-INF") || name.ends_with('/') {
                                            continue;
                                        }
                                        #[cfg(windows)]
                                        let matches_ext = name.ends_with(".dll");
                                        #[cfg(target_os = "macos")]
                                        let matches_ext = name.ends_with(".dylib");
                                        #[cfg(target_os = "linux")]
                                        let matches_ext = name.ends_with(".so");

                                        if matches_ext {
                                            let filename = Path::new(&name).file_name().unwrap_or(std::ffi::OsStr::new(&name));
                                            let out_path = natives_dir.join(filename);
                                            if !out_path.exists() {
                                                if let Ok(mut outfile) = fs::File::create(&out_path) {
                                                    let _ = std::io::copy(&mut zip_file, &mut outfile);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if let Some(parent) = v.get("inheritsFrom").and_then(|x| x.as_str()) {
            current_id = parent.to_string();
        } else {
            break;
        }
    }

    Ok(())
}

