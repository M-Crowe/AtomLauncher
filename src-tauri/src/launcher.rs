use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MinecraftVersionInfo {
    pub id: String,
    pub name: String,
    pub type_name: String,
    pub main_class: Option<String>,
    pub inherits_from: Option<String>,
    pub last_modified: Option<String>,
    pub source_path: String,
    pub source_label: String,
    pub json_path: String,
    pub jar_path: Option<String>,
    pub loader_type: String, // "vanilla" | "fabric" | "forge" | "neoforge" | "quilt" | "other"
    pub is_valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanOptions {
    pub game_dir: Option<String>,
    pub scan_system_dirs: bool,
    pub custom_dirs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchOptions {
    pub version_id: String,
    pub game_dir: String,
    pub java_path: String,
    pub allocated_memory_mb: u32,
    pub min_memory_mb: u32,
    pub jvm_args: Option<String>,
    pub fullscreen: Option<bool>,
    pub window_width: Option<u32>,
    pub window_height: Option<u32>,
    pub version_isolation: Option<bool>,
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResult {
    pub pid: u32,
    pub version_id: String,
    pub command_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogPayload {
    pub pid: u32,
    pub line: String,
    pub level: String, // "INFO" | "WARN" | "ERROR" | "DEBUG"
    pub timestamp: String,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExitPayload {
    pub pid: u32,
    pub exit_code: Option<i32>,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartedPayload {
    pub pid: u32,
    pub version_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaRuntimeInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub version: String,
    pub major_version: u32,
    pub arch: String,
    pub vendor: String,
    pub recommended_for: String,
    pub is_auto_detected: bool,
}

// Global active processes tracker
static RUNNING_PROCESSES: OnceLock<Arc<Mutex<HashMap<u32, Child>>>> = OnceLock::new();

fn get_running_processes() -> &'static Arc<Mutex<HashMap<u32, Child>>> {
    RUNNING_PROCESSES.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

fn detect_loader(json_content: &str, version_id: &str) -> String {
    let lower_id = version_id.to_lowercase();
    let lower_json = json_content.to_lowercase();

    if lower_id.contains("fabric") || lower_json.contains("fabric-loader") || lower_json.contains("net.fabricmc") {
        "fabric".to_string()
    } else if lower_id.contains("neoforge") || lower_json.contains("net.neoforged") {
        "neoforge".to_string()
    } else if lower_id.contains("forge") || lower_json.contains("net.minecraftforge") {
        "forge".to_string()
    } else if lower_id.contains("quilt") || lower_json.contains("org.quiltmc") {
        "quilt".to_string()
    } else if lower_id.contains("optifine") || lower_json.contains("optifine") {
        "optifine".to_string()
    } else {
        "vanilla".to_string()
    }
}

fn scan_single_minecraft_dir(root_path: &Path, source_label: &str) -> Vec<MinecraftVersionInfo> {
    let mut versions = Vec::new();
    let mut candidate_dirs: Vec<(PathBuf, PathBuf)> = Vec::new();

    // 1. root/versions
    let v1 = root_path.join("versions");
    if v1.exists() && v1.is_dir() {
        candidate_dirs.push((v1, root_path.to_path_buf()));
    }

    // 2. root/.minecraft/versions
    let v2 = root_path.join(".minecraft").join("versions");
    if v2.exists() && v2.is_dir() {
        candidate_dirs.push((v2, root_path.join(".minecraft")));
    }

    // 3. If root itself is named "versions"
    if root_path.file_name().map_or(false, |n| n.to_string_lossy().eq_ignore_ascii_case("versions")) && root_path.is_dir() {
        let parent = root_path.parent().unwrap_or(root_path).to_path_buf();
        candidate_dirs.push((root_path.to_path_buf(), parent));
    }

    // 4. If candidate dirs empty, check if root itself has version subdirectories with json
    if candidate_dirs.is_empty() && root_path.is_dir() {
        candidate_dirs.push((root_path.to_path_buf(), root_path.to_path_buf()));
    }

    let mut visited_jsons = std::collections::HashSet::new();

    for (versions_dir, effective_game_dir) in candidate_dirs {
        let entries = match fs::read_dir(&versions_dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let folder_name = match path.file_name() {
                Some(n) => n.to_string_lossy().to_string(),
                None => continue,
            };

            let json_file = {
                let direct = path.join(format!("{folder_name}.json"));
                if direct.exists() {
                    Some(direct)
                } else {
                    let mut found = None;
                    if let Ok(dir_entries) = fs::read_dir(&path) {
                        for e in dir_entries.flatten() {
                            let p = e.path();
                            if p.is_file() && p.extension().map_or(false, |ext| ext == "json") {
                                found = Some(p);
                                break;
                            }
                        }
                    }
                    found
                }
            };

            let json_file = match json_file {
                Some(j) => j,
                None => continue,
            };

            let json_canonical = json_file.to_string_lossy().to_lowercase();
            if visited_jsons.contains(&json_canonical) {
                continue;
            }
            visited_jsons.insert(json_canonical);

            let jar_file = {
                let direct = path.join(format!("{folder_name}.jar"));
                if direct.exists() {
                    Some(direct)
                } else {
                    let mut found = None;
                    if let Ok(dir_entries) = fs::read_dir(&path) {
                        for e in dir_entries.flatten() {
                            let p = e.path();
                            if p.is_file() && p.extension().map_or(false, |ext| ext == "jar") {
                                found = Some(p);
                                break;
                            }
                        }
                    }
                    found
                }
            };

            let jar_path_str = jar_file.map(|j| j.to_string_lossy().to_string());

            let last_modified = if let Ok(meta) = fs::metadata(&json_file) {
                if let Ok(modified) = meta.modified() {
                    let duration = modified.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
                    let secs = duration.as_secs();
                    let days = secs / 86400;
                    let hours = (secs % 86400) / 3600;
                    let mins = (secs % 3600) / 60;
                    Some(format!("{days}d {hours:02}:{mins:02}"))
                } else {
                    None
                }
            } else {
                None
            };

            if let Ok(content) = fs::read_to_string(&json_file) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    let id = v.get("id").and_then(|x| x.as_str()).unwrap_or(&folder_name).to_string();
                    let type_name = v.get("type").and_then(|x| x.as_str()).unwrap_or("release").to_string();
                    let main_class = v.get("mainClass").and_then(|x| x.as_str()).map(|s| s.to_string());
                    let inherits_from = v.get("inheritsFrom").and_then(|x| x.as_str()).map(|s| s.to_string());
                    let loader_type = detect_loader(&content, &id);

                    versions.push(MinecraftVersionInfo {
                        id: id.clone(),
                        name: format!("{id} ({type_name})"),
                        type_name,
                        main_class,
                        inherits_from,
                        last_modified,
                        source_path: effective_game_dir.to_string_lossy().to_string(),
                        source_label: source_label.to_string(),
                        json_path: json_file.to_string_lossy().to_string(),
                        jar_path: jar_path_str,
                        loader_type,
                        is_valid: true,
                    });
                }
            }
        }
    }

    versions
}

#[tauri::command]
pub fn scan_minecraft_versions(options: ScanOptions) -> Result<Vec<MinecraftVersionInfo>, String> {
    let mut all_versions = Vec::new();

    // 1. Scan default/configured game directory
    if let Some(ref dir) = options.game_dir {
        let p = PathBuf::from(dir);
        if p.exists() {
            all_versions.extend(scan_single_minecraft_dir(&p, "默认目录"));
        }
    }

    // 2. Scan standard system directories if requested
    if options.scan_system_dirs {
        #[cfg(target_os = "windows")]
        {
            // Standard %APPDATA%\.minecraft
            if let Ok(appdata) = std::env::var("APPDATA") {
                let default_appdata = PathBuf::from(appdata).join(".minecraft");
                if default_appdata.exists() && Some(default_appdata.to_string_lossy().to_string()) != options.game_dir {
                    all_versions.extend(scan_single_minecraft_dir(&default_appdata, "系统标准目录"));
                }
            }

            // Windows Store (UWP / Xbox app) Minecraft package path
            if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
                let uwp_path = PathBuf::from(localappdata)
                    .join("Packages")
                    .join("Microsoft.4297127D64EC6_8wekyb3d8bbwe")
                    .join("LocalCache")
                    .join("Roaming")
                    .join(".minecraft");
                if uwp_path.exists() {
                    all_versions.extend(scan_single_minecraft_dir(&uwp_path, "Windows Store"));
                }
            }
        }

        #[cfg(target_os = "macos")]
        {
            if let Ok(home) = std::env::var("HOME") {
                let mac_path = PathBuf::from(home)
                    .join("Library")
                    .join("Application Support")
                    .join("minecraft");
                if mac_path.exists() {
                    all_versions.extend(scan_single_minecraft_dir(&mac_path, "系统标准目录"));
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Ok(home) = std::env::var("HOME") {
                let linux_path = PathBuf::from(home).join(".minecraft");
                if linux_path.exists() {
                    all_versions.extend(scan_single_minecraft_dir(&linux_path, "系统标准目录"));
                }
            }
        }
    }

    // 3. Scan custom user directories
    for custom in options.custom_dirs {
        let p = PathBuf::from(&custom);
        if p.exists() {
            let label = format!("自定义: {}", p.file_name().map(|n| n.to_string_lossy()).unwrap_or(p.to_string_lossy()));
            all_versions.extend(scan_single_minecraft_dir(&p, &label));
        }
    }

    // Sort versions by ID
    all_versions.sort_by(|a, b| b.id.cmp(&a.id));

    Ok(all_versions)
}

fn inspect_java_executable(exe_path: &Path) -> Option<JavaRuntimeInfo> {
    if !exe_path.exists() {
        return None;
    }

    let output = Command::new(exe_path).arg("-version").output().ok()?;
    let text = String::from_utf8_lossy(&output.stderr).to_string() + &String::from_utf8_lossy(&output.stdout);
    if text.is_empty() {
        return None;
    }

    let mut version = "Unknown".to_string();
    let mut major_version = 17u32;

    if let Some(start_idx) = text.find("version \"") {
        let after = &text[start_idx + 9..];
        if let Some(end_idx) = after.find('"') {
            version = after[..end_idx].to_string();
        }
    } else if let Some(start_idx) = text.find("version ") {
        let after = &text[start_idx + 8..];
        let token = after.split_whitespace().next().unwrap_or("");
        version = token.trim_matches('"').to_string();
    }

    if version.starts_with("1.8") {
        major_version = 8;
    } else if let Some(first) = version.split('.').next() {
        if let Ok(m) = first.split('-').next().unwrap_or(first).parse::<u32>() {
            major_version = m;
        }
    }

    let arch = if text.contains("64-Bit") || text.contains("x86_64") || text.contains("amd64") || text.contains("aarch64") {
        "x64".to_string()
    } else {
        "x86".to_string()
    };

    let vendor = if text.contains("Temurin") || text.contains("Adoptium") {
        "Eclipse Adoptium".to_string()
    } else if text.contains("Microsoft") {
        "Microsoft".to_string()
    } else if text.contains("Oracle") || text.contains("Java(TM)") {
        "Oracle".to_string()
    } else if text.contains("Zulu") {
        "Azul Zulu".to_string()
    } else if text.contains("Corretto") {
        "Amazon Corretto".to_string()
    } else if text.contains("Liberica") || text.contains("BellSoft") {
        "BellSoft Liberica".to_string()
    } else if text.contains("Semeru") || text.contains("IBM") {
        "IBM Semeru".to_string()
    } else {
        "OpenJDK".to_string()
    };

    let recommended_for = if major_version >= 25 {
        "26.3+ 快照及未来版本".to_string()
    } else if major_version >= 21 {
        "1.20.5+ 及 1.21+ 现代版本".to_string()
    } else if major_version >= 17 {
        "1.18 ~ 1.20.4 中期版本".to_string()
    } else if major_version == 16 {
        "1.17 版本".to_string()
    } else if major_version == 8 {
        "1.12.2 及更早经典版本".to_string()
    } else {
        "Minecraft 通用运行环境".to_string()
    };

    let path_to_save = if cfg!(windows) {
        let parent = exe_path.parent().unwrap_or(exe_path);
        let javaw = parent.join("javaw.exe");
        if javaw.exists() {
            javaw.to_string_lossy().to_string()
        } else {
            exe_path.to_string_lossy().to_string()
        }
    } else {
        exe_path.to_string_lossy().to_string()
    };

    let id = format!("java-{}-{}", major_version, path_to_save.replace(['\\', '/', ':', ' '], "_"));
    let name = format!("{vendor} JDK {major_version} ({version})");

    Some(JavaRuntimeInfo {
        id,
        name,
        path: path_to_save,
        version,
        major_version,
        arch,
        vendor,
        recommended_for,
        is_auto_detected: true,
    })
}

#[tauri::command]
pub fn detect_java_environments() -> Result<Vec<JavaRuntimeInfo>, String> {
    let mut detected = Vec::new();
    let mut candidate_paths: Vec<PathBuf> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = Command::new("where").args(["javaw"]).output() {
            let out_str = String::from_utf8_lossy(&output.stdout);
            for line in out_str.lines() {
                let p = PathBuf::from(line.trim());
                if p.exists() {
                    candidate_paths.push(p);
                }
            }
        }
        if let Ok(output) = Command::new("where").args(["java"]).output() {
            let out_str = String::from_utf8_lossy(&output.stdout);
            for line in out_str.lines() {
                let p = PathBuf::from(line.trim());
                if p.exists() {
                    candidate_paths.push(p);
                }
            }
        }

        let roots = ["C:\\Program Files", "D:\\Program Files", "C:\\Program Files (x86)", "D:\\Program Files (x86)"];
        let sub_folders = ["Eclipse Adoptium", "Java", "Microsoft", "BellSoft", "Zulu", "Amazon Corretto", "Semeru"];
        let mut search_dirs = Vec::new();
        for root in roots {
            for sub in sub_folders {
                let base = PathBuf::from(root).join(sub);
                if base.exists() && base.is_dir() {
                    search_dirs.push(base);
                }
            }
        }

        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let user_jdks = PathBuf::from(&user_profile).join(".jdks");
            if user_jdks.exists() {
                search_dirs.push(user_jdks);
            }
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            let mc_runtime = PathBuf::from(&appdata).join(".minecraft").join("runtime");
            if mc_runtime.exists() {
                search_dirs.push(mc_runtime);
            }
        }

        for dir in search_dirs {
            if let Ok(entries) = fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let javaw = path.join("bin").join("javaw.exe");
                        if javaw.exists() {
                            candidate_paths.push(javaw);
                        }
                        let java_exe = path.join("bin").join("java.exe");
                        if java_exe.exists() {
                            candidate_paths.push(java_exe);
                        }
                        if let Ok(sub_entries) = fs::read_dir(&path) {
                            for sub_entry in sub_entries.flatten() {
                                let sub_path = sub_entry.path();
                                if sub_path.is_dir() {
                                    let sub_javaw = sub_path.join("bin").join("javaw.exe");
                                    if sub_javaw.exists() {
                                        candidate_paths.push(sub_javaw);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let mac_dir = PathBuf::from("/Library/Java/JavaVirtualMachines");
        if mac_dir.exists() {
            if let Ok(entries) = fs::read_dir(&mac_dir) {
                for entry in entries.flatten() {
                    let j = entry.path().join("Contents/Home/bin/java");
                    if j.exists() {
                        candidate_paths.push(j);
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let jvm_dir = PathBuf::from("/usr/lib/jvm");
        if jvm_dir.exists() {
            if let Ok(entries) = fs::read_dir(&jvm_dir) {
                for entry in entries.flatten() {
                    let j = entry.path().join("bin/java");
                    if j.exists() {
                        candidate_paths.push(j);
                    }
                }
            }
        }
    }

    for env_var in ["JAVA_HOME", "JDK_HOME"] {
        if let Ok(val) = std::env::var(env_var) {
            let p = PathBuf::from(val).join("bin").join(if cfg!(windows) { "javaw.exe" } else { "java" });
            if p.exists() {
                candidate_paths.push(p);
            }
        }
    }

    let mut visited_paths = std::collections::HashSet::new();
    for p in candidate_paths {
        let canonical = p.to_string_lossy().to_lowercase();
        if visited_paths.contains(&canonical) {
            continue;
        }
        visited_paths.insert(canonical);

        if let Some(info) = inspect_java_executable(&p) {
            if !detected.iter().any(|d: &JavaRuntimeInfo| d.path.eq_ignore_ascii_case(&info.path)) {
                detected.push(info);
            }
        }
    }

    detected.sort_by(|a, b| b.major_version.cmp(&a.major_version));
    Ok(detected)
}

fn parse_log_level(line: &str) -> &'static str {
    let upper = line.to_uppercase();
    if upper.contains("/ERROR")
        || upper.contains("ERROR]")
        || upper.contains("[ERROR")
        || upper.contains("ERROR:")
        || upper.contains("错误:")
        || upper.contains("错误：")
        || upper.contains("[FATAL")
        || upper.contains("EXCEPTION")
        || upper.contains("LINKAGEERROR")
        || upper.contains("UNSUPPORTEDCLASSVERSIONERROR")
        || upper.contains("CRITICAL")
        || upper.contains("CAUSED BY:")
    {
        "ERROR"
    } else if upper.contains("/WARN")
        || upper.contains("WARN]")
        || upper.contains("[WARN")
        || upper.contains("WARN:")
        || upper.contains("[WARNING")
        || upper.contains("警告:")
        || upper.contains("警告：")
    {
        "WARN"
    } else if upper.contains("/DEBUG") || upper.contains("DEBUG]") || upper.contains("[DEBUG") || upper.contains("[TRACE") {
        "DEBUG"
    } else {
        "INFO"
    }
}

fn get_current_time_str() -> String {
    let now = std::time::SystemTime::now();
    let duration = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    let hours = (secs / 3600) % 24;
    let mins = (secs / 60) % 60;
    let s = secs % 60;
    let ms = duration.subsec_millis();
    format!("{hours:02}:{mins:02}:{s:02}.{ms:03}")
}

#[tauri::command]
pub fn launch_minecraft(
    app: AppHandle,
    options: LaunchOptions,
) -> Result<LaunchResult, String> {
    let mut java_path = options.java_path.trim().to_string();

    // 智能版本匹配与自适应提升（例如 26.x / snapshot 需 Java 25，1.21 需 Java 21）
    if let Ok(runtimes) = detect_java_environments() {
        if options.version_id.starts_with("26.") || options.version_id.contains("snapshot") {
            if let Some(j25) = runtimes.iter().find(|r| r.major_version >= 25) {
                java_path = j25.path.clone();
            } else if let Some(j21) = runtimes.iter().find(|r| r.major_version >= 21) {
                java_path = j21.path.clone();
            }
        } else if options.version_id.starts_with("1.21") || options.version_id.starts_with("1.20.5") || options.version_id.starts_with("1.20.6") {
            if let Some(j21) = runtimes.iter().find(|r| r.major_version >= 21) {
                java_path = j21.path.clone();
            }
        } else if java_path == "javaw.exe" || java_path == "java.exe" || java_path.is_empty() {
            if let Some(first) = runtimes.first() {
                java_path = first.path.clone();
            }
        }
    }

    if java_path.is_empty() {
        return Err("Java 路径不能为空，请在设置中配置有效 Java 运行时".to_string());
    }

    let game_dir = PathBuf::from(&options.game_dir);
    if !game_dir.exists() {
        return Err(format!("游戏主目录不存在: {}", options.game_dir));
    }

    let version_dir = game_dir.join("versions").join(&options.version_id);
    let version_json_path = version_dir.join(format!("{}.json", options.version_id));

    // Determine launch working directory (isolation mode)
    let is_isolated = options.version_isolation.unwrap_or(true);
    let work_dir = if is_isolated {
        let iso_dir = version_dir.clone();
        if !iso_dir.exists() {
            let _ = fs::create_dir_all(&iso_dir);
        }
        iso_dir
    } else {
        game_dir.clone()
    };

    // Determine main class and classpath
    let mut main_class = "net.minecraft.client.main.Main".to_string();
    let mut classpath_entries: Vec<PathBuf> = Vec::new();

    // Check version jar
    let version_jar = version_dir.join(format!("{}.jar", options.version_id));
    if version_jar.exists() {
        classpath_entries.push(version_jar);
    }

    if version_json_path.exists() {
        if let Ok(content) = fs::read_to_string(&version_json_path) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(mc) = v.get("mainClass").and_then(|x| x.as_str()) {
                    main_class = mc.to_string();
                }

                // Parse libraries
                if let Some(libs) = v.get("libraries").and_then(|x| x.as_array()) {
                    let libraries_root = game_dir.join("libraries");
                    for lib in libs {
                        if let Some(downloads) = lib.get("downloads") {
                            if let Some(artifact) = downloads.get("artifact") {
                                if let Some(path) = artifact.get("path").and_then(|x| x.as_str()) {
                                    let lib_path = libraries_root.join(path);
                                    if lib_path.exists() {
                                        classpath_entries.push(lib_path);
                                    }
                                }
                            }
                        } else if let Some(name) = lib.get("name").and_then(|x| x.as_str()) {
                            // Maven format: group:artifact:version
                            let parts: Vec<&str> = name.split(':').collect();
                            if parts.len() >= 3 {
                                let group_path = parts[0].replace('.', "/");
                                let artifact_name = parts[1];
                                let version_str = parts[2];
                                let jar_name = format!("{artifact_name}-{version_str}.jar");
                                let lib_path = libraries_root
                                    .join(group_path)
                                    .join(artifact_name)
                                    .join(version_str)
                                    .join(jar_name);
                                if lib_path.exists() {
                                    classpath_entries.push(lib_path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let cp_separator = if cfg!(windows) { ";" } else { ":" };
    let classpath_str = if classpath_entries.is_empty() {
        // Fallback placeholder cp
        ".".to_string()
    } else {
        classpath_entries
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(cp_separator)
    };

    let mut cmd = Command::new(&java_path);
    cmd.current_dir(&work_dir);

    // JVM Memory
    let xmx = if options.allocated_memory_mb > 0 { options.allocated_memory_mb } else { 4096 };
    let xms = if options.min_memory_mb > 0 { options.min_memory_mb } else { 1024 };
    cmd.arg(format!("-Xmx{xmx}M"));
    cmd.arg(format!("-Xms{xms}M"));

    // Custom JVM Args
    if let Some(jvm_args) = options.jvm_args {
        for arg in jvm_args.split_whitespace() {
            if !arg.is_empty() {
                cmd.arg(arg);
            }
        }
    }

    // Classpath & Main Class
    cmd.arg("-cp");
    cmd.arg(&classpath_str);
    cmd.arg(&main_class);

    // Game arguments
    let username = options.username.unwrap_or_else(|| "Player".to_string());
    cmd.arg("--username").arg(&username);
    cmd.arg("--version").arg(&options.version_id);
    cmd.arg("--gameDir").arg(work_dir.to_string_lossy().to_string());
    cmd.arg("--assetsDir").arg(game_dir.join("assets").to_string_lossy().to_string());
    cmd.arg("--versionType").arg("AtomLauncher");

    if let Some(w) = options.window_width {
        cmd.arg("--width").arg(w.to_string());
    }
    if let Some(h) = options.window_height {
        cmd.arg("--height").arg(h.to_string());
    }
    if options.fullscreen.unwrap_or(false) {
        cmd.arg("--fullscreen");
    }

    // Setup streaming pipes
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let command_summary = format!("{java_path} -Xmx{xmx}M -Xms{xms}M ... {main_class} --version {}", options.version_id);

    let mut child = cmd.spawn().map_err(|e| format!("拉起游戏进程失败: {e} (请检查 Java 路径与环境)"))?;
    let pid = child.id();

    // Emit started event
    let _ = app.emit(
        "minecraft-started",
        StartedPayload {
            pid,
            version_id: options.version_id.clone(),
        },
    );

    // Log initial start message
    let _ = app.emit(
        "minecraft-log",
        LogPayload {
            pid,
            line: format!("[AtomLauncher] 正在启动 Minecraft 实例: {} (PID: {})", options.version_id, pid),
            level: "INFO".to_string(),
            timestamp: get_current_time_str(),
            is_error: false,
        },
    );
    let _ = app.emit(
        "minecraft-log",
        LogPayload {
            pid,
            line: format!("[AtomLauncher] 执行指令: {command_summary}"),
            level: "INFO".to_string(),
            timestamp: get_current_time_str(),
            is_error: false,
        },
    );

    // Read stdout
    if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line_res in reader.lines() {
                match line_res {
                    Ok(line) => {
                        let level = parse_log_level(&line);
                        let _ = app_clone.emit(
                            "minecraft-log",
                            LogPayload {
                                pid,
                                line,
                                level: level.to_string(),
                                timestamp: get_current_time_str(),
                                is_error: false,
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Read stderr
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line_res in reader.lines() {
                match line_res {
                    Ok(line) => {
                        let level = parse_log_level(&line);
                        let final_level = if level == "INFO" { "ERROR" } else { level };
                        let _ = app_clone.emit(
                            "minecraft-log",
                            LogPayload {
                                pid,
                                line,
                                level: final_level.to_string(),
                                timestamp: get_current_time_str(),
                                is_error: true,
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
        });
    }

    // Process exit listener thread
    let processes = get_running_processes();
    {
        let mut map = processes.lock().unwrap();
        map.insert(pid, child);
    }

    let app_exit = app.clone();
    thread::spawn(move || {
        // Poll wait for child
        loop {
            thread::sleep(std::time::Duration::from_millis(200));
            let mut map = get_running_processes().lock().unwrap();
            if let Some(child_ref) = map.get_mut(&pid) {
                match child_ref.try_wait() {
                    Ok(Some(status)) => {
                        let code = status.code();
                        let success = status.success();
                        let _ = app_exit.emit(
                            "minecraft-log",
                            LogPayload {
                                pid,
                                line: format!("[AtomLauncher] 进程已退出，状态码: {:?}", code),
                                level: if success { "INFO".to_string() } else { "WARN".to_string() },
                                timestamp: get_current_time_str(),
                                is_error: !success,
                            },
                        );
                        let _ = app_exit.emit(
                            "minecraft-exit",
                            ExitPayload {
                                pid,
                                exit_code: code,
                                success,
                            },
                        );
                        map.remove(&pid);
                        break;
                    }
                    Ok(None) => {
                        // Still running
                    }
                    Err(_) => {
                        map.remove(&pid);
                        break;
                    }
                }
            } else {
                break;
            }
        }
    });

    Ok(LaunchResult {
        pid,
        version_id: options.version_id,
        command_summary,
    })
}

#[tauri::command]
pub fn kill_minecraft_instance(pid: u32) -> Result<bool, String> {
    // 1. First attempt to kill via registered Child handle
    let processes = get_running_processes();
    {
        let mut map = processes.lock().unwrap();
        if let Some(mut child) = map.remove(&pid) {
            let _ = child.kill();
        }
    }

    // 2. Windows taskkill backup for full process tree cleanup
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output();
    }

    // 3. Unix kill backup
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }

    Ok(true)
}
