use super::types::JavaRuntimeInfo;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;

pub fn get_java_info_from_executable(exe_path: &Path) -> Option<JavaRuntimeInfo> {
    if !exe_path.exists() {
        return None;
    }

    #[cfg(windows)]
    let mut cmd = {
        let mut c = Command::new(exe_path);
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x08000000); // CREATE_NO_WINDOW
        c
    };

    #[cfg(not(windows))]
    let mut cmd = Command::new(exe_path);

    cmd.arg("-version");
    let output = cmd.output().ok()?;
    let out_str = String::from_utf8_lossy(&output.stderr).to_string()
        + &String::from_utf8_lossy(&output.stdout);

    let mut major_version: u32 = 0;
    let mut version_string = "未知版本".to_string();
    let mut vendor = "未知厂商".to_string();
    let is_64bit = out_str.contains("64-Bit") || out_str.contains("x86_64") || out_str.contains("amd64") || out_str.contains("arm64") || out_str.contains("aarch64");

    for line in out_str.lines() {
        let l = line.trim();
        if l.contains("version") {
            if let Some(start) = l.find('"') {
                if let Some(end) = l[start + 1..].find('"') {
                    let full_ver = &l[start + 1..start + 1 + end];
                    version_string = full_ver.to_string();

                    if full_ver.starts_with("1.") {
                        if let Some(m) = full_ver.split('.').nth(1).and_then(|s| s.parse::<u32>().ok()) {
                            major_version = m;
                        }
                    } else if let Some(m) = full_ver.split('.').next().and_then(|s| s.parse::<u32>().ok()) {
                        major_version = m;
                    }
                }
            }
        }

        let l_lower = l.to_lowercase();
        if l_lower.contains("temurin") || l_lower.contains("adoptium") {
            vendor = "Eclipse Temurin".to_string();
        } else if l_lower.contains("zulu") || l_lower.contains("azul") {
            vendor = "Azul Zulu".to_string();
        } else if l_lower.contains("corretto") || l_lower.contains("amazon") {
            vendor = "Amazon Corretto".to_string();
        } else if l_lower.contains("liberica") || l_lower.contains("bellsoft") {
            vendor = "BellSoft Liberica".to_string();
        } else if l_lower.contains("graalvm") {
            vendor = "GraalVM".to_string();
        } else if l_lower.contains("microsoft") {
            vendor = "Microsoft OpenJDK".to_string();
        } else if l_lower.contains("hotspot") || l_lower.contains("oracle") {
            if vendor == "未知厂商" {
                vendor = "Oracle / OpenJDK".to_string();
            }
        }
    }

    if major_version == 0 {
        return None;
    }

    let is_recommended = major_version >= 17 && is_64bit;

    Some(JavaRuntimeInfo {
        path: exe_path.to_string_lossy().to_string(),
        major_version,
        version_string,
        vendor,
        is_64bit,
        is_recommended,
    })
}

pub fn scan_java_in_directory(dir: &Path, visited: &mut HashSet<String>, results: &mut Vec<JavaRuntimeInfo>) {
    if !dir.exists() || !dir.is_dir() {
        return;
    }

    let java_bin_names = if cfg!(windows) {
        vec!["javaw.exe", "java.exe"]
    } else {
        vec!["java"]
    };

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                // Check bin/ subdirectory
                let bin_dir = p.join("bin");
                for name in &java_bin_names {
                    let exe = bin_dir.join(name);
                    if exe.exists() {
                        if let Ok(canonical) = exe.canonicalize() {
                            let key = canonical.to_string_lossy().to_lowercase();
                            if visited.insert(key) {
                                if let Some(info) = get_java_info_from_executable(&exe) {
                                    results.push(info);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub fn detect_java_environments() -> Result<Vec<JavaRuntimeInfo>, String> {
    let mut results = Vec::new();
    let mut visited_paths = HashSet::new();

    // 1. JAVA_HOME 环境变量
    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        let p = PathBuf::from(java_home);
        let exe = if cfg!(windows) { p.join("bin").join("javaw.exe") } else { p.join("bin").join("java") };
        if exe.exists() {
            if let Ok(canonical) = exe.canonicalize() {
                if visited_paths.insert(canonical.to_string_lossy().to_lowercase()) {
                    if let Some(info) = get_java_info_from_executable(&exe) {
                        results.push(info);
                    }
                }
            }
        }
    }

    // 2. PATH 环境变量搜索
    if let Ok(path_var) = std::env::var("PATH") {
        let separator = if cfg!(windows) { ';' } else { ':' };
        let java_exe_name = if cfg!(windows) { "javaw.exe" } else { "java" };
        for dir in path_var.split(separator) {
            let p = PathBuf::from(dir);
            let exe = p.join(java_exe_name);
            if exe.exists() {
                if let Ok(canonical) = exe.canonicalize() {
                    if visited_paths.insert(canonical.to_string_lossy().to_lowercase()) {
                        if let Some(info) = get_java_info_from_executable(&exe) {
                            results.push(info);
                        }
                    }
                }
            }
        }
    }

    // 3. 操作系统常见 JDK 安装根目录扫描
    #[cfg(target_os = "windows")]
    {
        let check_roots = [
            r"C:\Program Files\Eclipse Adoptium",
            r"C:\Program Files\Java",
            r"C:\Program Files\Zulu",
            r"C:\Program Files\BellSoft",
            r"C:\Program Files\Amazon Corretto",
            r"C:\Program Files\Microsoft",
            r"C:\Program Files (x86)\Java",
        ];

        for root in &check_roots {
            scan_java_in_directory(Path::new(root), &mut visited_paths, &mut results);
        }

        // 扫描用户 LocalAppData / AppData 下的 Runtime 目录 (PCL / HMCL / Official Launcher 运行时)
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p = PathBuf::from(local_app_data).join("Packages").join("Microsoft.4297127D64C57_8wekyb3d8bbwe").join("LocalCache").join("Local").join("runtime");
            scan_java_in_directory(&p, &mut visited_paths, &mut results);
        }
        if let Ok(app_data) = std::env::var("APPDATA") {
            let p = PathBuf::from(app_data).join(".minecraft").join("runtime");
            scan_java_in_directory(&p, &mut visited_paths, &mut results);
        }
    }

    #[cfg(target_os = "macos")]
    {
        scan_java_in_directory(Path::new("/Library/Java/JavaVirtualMachines"), &mut visited_paths, &mut results);
        scan_java_in_directory(Path::new("/usr/local/opt/openjdk/bin"), &mut visited_paths, &mut results);
        scan_java_in_directory(Path::new("/opt/homebrew/opt/openjdk/bin"), &mut visited_paths, &mut results);
    }

    #[cfg(target_os = "linux")]
    {
        scan_java_in_directory(Path::new("/usr/lib/jvm"), &mut visited_paths, &mut results);
        scan_java_in_directory(Path::new("/usr/java"), &mut visited_paths, &mut results);
        scan_java_in_directory(Path::new("/opt/jdk"), &mut visited_paths, &mut results);
    }

    // 优先按版本倒序排列（推荐 Java 21 / 17 在前）
    results.sort_by(|a, b| b.major_version.cmp(&a.major_version));

    Ok(results)
}
