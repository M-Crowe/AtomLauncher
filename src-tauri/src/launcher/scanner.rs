use super::types::{MinecraftVersionInfo, ScanOptions};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

pub fn get_system_minecraft_dirs() -> Vec<(PathBuf, String)> {
    let mut dirs = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // 1. 标准 Roaming .minecraft
        if let Ok(app_data) = std::env::var("APPDATA") {
            let p = PathBuf::from(app_data).join(".minecraft");
            if p.exists() {
                dirs.push((p, "系统默认 .minecraft".to_string()));
            }
        }
        // 2. Windows Store / UWP Minecraft 目录 (Packages)
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let store_p = PathBuf::from(local_app_data)
                .join("Packages")
                .join("Microsoft.MinecraftUWP_8wekyb3d8bbwe")
                .join("LocalState")
                .join("games")
                .join("com.mojang");
            if store_p.exists() {
                dirs.push((store_p, "Windows 官方商店版".to_string()));
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let p = PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("minecraft");
            if p.exists() {
                dirs.push((p, "macOS 默认目录".to_string()));
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let p = PathBuf::from(home).join(".minecraft");
            if p.exists() {
                dirs.push((p, "Linux 默认目录".to_string()));
            }
        }
    }

    dirs
}

pub fn scan_versions_in_directory(dir: &Path, label: &str) -> Vec<MinecraftVersionInfo> {
    let mut results = Vec::new();
    let versions_dir = dir.join("versions");

    if !versions_dir.exists() || !versions_dir.is_dir() {
        return results;
    }

    let entries = match fs::read_dir(&versions_dir) {
        Ok(e) => e,
        Err(_) => return results,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let version_id = match path.file_name().and_then(|n| n.to_str()) {
                Some(name) => name.to_string(),
                None => continue,
            };

            let json_path = path.join(format!("{version_id}.json"));
            if !json_path.exists() {
                continue;
            }

            // 读取并解析版本 JSON
            let mut name = version_id.clone();
            let mut type_name = "release".to_string();
            let mut main_class = None;
            let mut inherits_from = None;
            let mut loader_type = "vanilla".to_string();
            let mut is_valid = false;

            if let Ok(content) = fs::read_to_string(&json_path) {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                    is_valid = true;
                    if let Some(id_str) = parsed.get("id").and_then(|v| v.as_str()) {
                        name = id_str.to_string();
                    }
                    if let Some(t_str) = parsed.get("type").and_then(|v| v.as_str()) {
                        type_name = t_str.to_string();
                    }
                    if let Some(mc_str) = parsed.get("mainClass").and_then(|v| v.as_str()) {
                        main_class = Some(mc_str.to_string());
                    }
                    if let Some(parent_str) = parsed.get("inheritsFrom").and_then(|v| v.as_str()) {
                        inherits_from = Some(parent_str.to_string());
                    }

                    // 智能识别 Mod 加载器
                    let content_lower = content.to_lowercase();
                    if content_lower.contains("fabricmc") || content_lower.contains("net.fabricmc") {
                        loader_type = "fabric".to_string();
                    } else if content_lower.contains("quiltmc") {
                        loader_type = "quilt".to_string();
                    } else if content_lower.contains("neoforged") {
                        loader_type = "neoforge".to_string();
                    } else if content_lower.contains("minecraftforge") || content_lower.contains("cpw.mods.bootstraplauncher") || version_id.to_lowercase().contains("forge") {
                        loader_type = "forge".to_string();
                    } else if content_lower.contains("optifine") {
                        loader_type = "optifine".to_string();
                    }
                }
            }

            // 获取最后修改时间
            let last_modified = fs::metadata(&json_path)
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let duration = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                    let secs = duration.as_secs();
                    // Simple UTC timestamp approximation (YYYY-MM-DD)
                    let days = secs / 86400;
                    let rem_secs = secs % 86400;
                    let hours = rem_secs / 3600;
                    let mins = (rem_secs % 3600) / 60;
                    // Approximate year/month/day from days since 1970
                    let mut y = 1970;
                    let mut d = days;
                    loop {
                        let leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
                        let days_in_year = if leap { 366 } else { 365 };
                        if d >= days_in_year {
                            d -= days_in_year;
                            y += 1;
                        } else {
                            break;
                        }
                    }
                    let leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
                    let days_in_months = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                    let mut m = 0;
                    for (idx, &dm) in days_in_months.iter().enumerate() {
                        if d >= dm {
                            d -= dm;
                        } else {
                            m = idx + 1;
                            break;
                        }
                    }
                    format!("{y:04}-{m:02}-{:02} {hours:02}:{mins:02}", d + 1)
                });

            // 检查对应 jar 文件（可能在当前目录或父版本继承）
            let jar_path_check = path.join(format!("{version_id}.jar"));
            let jar_path = if jar_path_check.exists() {
                Some(jar_path_check.to_string_lossy().to_string())
            } else {
                None
            };

            results.push(MinecraftVersionInfo {
                id: version_id,
                name,
                type_name,
                main_class,
                inherits_from,
                last_modified,
                source_path: dir.to_string_lossy().to_string(),
                source_label: label.to_string(),
                json_path: json_path.to_string_lossy().to_string(),
                jar_path,
                loader_type,
                is_valid,
            });
        }
    }

    results
}

#[tauri::command]
pub fn scan_minecraft_versions(options: ScanOptions) -> Result<Vec<MinecraftVersionInfo>, String> {
    let mut all_versions = Vec::new();
    let mut scanned_paths = HashSet::new();

    // 1. 优先扫描当前配置的主游戏目录
    if let Some(game_dir_str) = &options.game_dir {
        let game_dir = PathBuf::from(game_dir_str);
        if game_dir.exists() {
            let canonical = game_dir.canonicalize().unwrap_or_else(|_| game_dir.clone());
            if scanned_paths.insert(canonical) {
                let mut vers = scan_versions_in_directory(&game_dir, "当前目录");
                all_versions.append(&mut vers);
            }
        }
    }

    // 2. 扫描系统自带的默认标准目录
    if options.scan_system_dirs {
        for (sys_dir, label) in get_system_minecraft_dirs() {
            let canonical = sys_dir.canonicalize().unwrap_or_else(|_| sys_dir.clone());
            if scanned_paths.insert(canonical) {
                let mut vers = scan_versions_in_directory(&sys_dir, &label);
                all_versions.append(&mut vers);
            }
        }
    }

    // 3. 扫描用户自定义添加的外部目录
    for custom_path_str in &options.custom_dirs {
        let custom_dir = PathBuf::from(custom_path_str);
        if custom_dir.exists() {
            let canonical = custom_dir.canonicalize().unwrap_or_else(|_| custom_dir.clone());
            if scanned_paths.insert(canonical) {
                let label = format!("自定义: {}", custom_dir.file_name().and_then(|n| n.to_str()).unwrap_or(".minecraft"));
                let mut vers = scan_versions_in_directory(&custom_dir, &label);
                all_versions.append(&mut vers);
            }
        }
    }

    Ok(all_versions)
}
