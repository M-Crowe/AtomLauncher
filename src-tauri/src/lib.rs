use std::fs;
use std::path::PathBuf;
use tauri::http::{Response, StatusCode};
use wasmtime::*;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DetectedJava {
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

// 1. 定义读取插件文本文件的 Command
#[tauri::command]
fn read_plugin_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("无法读取文件 [{path}]: {e}"))
}

// 2. 真实扫描本机安装的 Java 运行环境
#[tauri::command]
fn detect_java_environments() -> Vec<DetectedJava> {
    let mut results: Vec<DetectedJava> = Vec::new();
    let mut visited_paths = std::collections::HashSet::new();
    let mut candidate_dirs: Vec<PathBuf> = Vec::new();

    // (1) 检查 JAVA_HOME
    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        candidate_dirs.push(PathBuf::from(java_home));
    }

    // (2) 检查系统 PATH 环境变量
    if let Ok(path_var) = std::env::var("PATH") {
        let separator = if cfg!(windows) { ';' } else { ':' };
        for entry in path_var.split(separator) {
            let p = PathBuf::from(entry.trim());
            if p.is_dir() {
                candidate_dirs.push(p.clone());
                if let Some(parent) = p.parent() {
                    candidate_dirs.push(parent.to_path_buf());
                }
            }
        }
    }

    // (3) 扫描 Windows 常见安装目录与各大盘符
    let roots = vec![
        "C:\\Program Files",
        "C:\\Program Files (x86)",
        "D:\\Program Files",
        "D:\\Program Files (x86)",
        "E:\\Program Files",
    ];
    let vendors = vec![
        "Eclipse Adoptium",
        "Java",
        "Microsoft",
        "Zulu",
        "BellSoft",
        "Amazon Corretto",
        "AdoptOpenJDK",
        "Semeru",
    ];

    for root in roots {
        let root_path = PathBuf::from(root);
        if !root_path.exists() {
            continue;
        }
        for vendor in &vendors {
            let vendor_path = root_path.join(vendor);
            if let Ok(entries) = fs::read_dir(&vendor_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        candidate_dirs.push(path);
                    }
                }
            }
        }
    }

    // (4) 用户目录 LocalAppData\Programs
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let local_programs = PathBuf::from(local_appdata).join("Programs");
        if let Ok(entries) = fs::read_dir(local_programs) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    candidate_dirs.push(path);
                }
            }
        }
    }

    // 处理并解析所有候选目录中的 Java 可执行程序
    for dir in candidate_dirs {
        let javaw = if cfg!(windows) {
            let bin_javaw = dir.join("bin").join("javaw.exe");
            if bin_javaw.exists() {
                Some(bin_javaw)
            } else if dir.join("javaw.exe").exists() {
                Some(dir.join("javaw.exe"))
            } else {
                let bin_java = dir.join("bin").join("java.exe");
                if bin_java.exists() {
                    Some(bin_java)
                } else if dir.join("java.exe").exists() {
                    Some(dir.join("java.exe"))
                } else {
                    None
                }
            }
        } else {
            let bin_java = dir.join("bin").join("java");
            if bin_java.exists() {
                Some(bin_java)
            } else if dir.join("java").exists() {
                Some(dir.join("java"))
            } else {
                None
            }
        };

        if let Some(exe_path) = javaw {
            let normalized_path = exe_path.to_string_lossy().to_string();
            let key = normalized_path.to_lowercase();
            if visited_paths.contains(&key) {
                continue;
            }
            visited_paths.insert(key);

            let root_dir = exe_path
                .parent()
                .and_then(|p| {
                    if p.file_name().map(|n| n == "bin").unwrap_or(false) {
                        p.parent()
                    } else {
                        Some(p)
                    }
                })
                .unwrap_or(&exe_path);
            let release_file = root_dir.join("release");

            let mut java_version = String::new();
            let mut vendor_name = String::new();
            let mut arch = "x64".to_string();

            if let Ok(release_content) = fs::read_to_string(&release_file) {
                for line in release_content.lines() {
                    let line = line.trim();
                    if line.starts_with("JAVA_VERSION=") {
                        java_version = line
                            .trim_start_matches("JAVA_VERSION=")
                            .trim_matches('"')
                            .to_string();
                    } else if line.starts_with("IMPLEMENTOR=") {
                        vendor_name = line
                            .trim_start_matches("IMPLEMENTOR=")
                            .trim_matches('"')
                            .to_string();
                    } else if line.starts_with("OS_ARCH=") {
                        arch = line
                            .trim_start_matches("OS_ARCH=")
                            .trim_matches('"')
                            .to_string();
                    }
                }
            }

            if java_version.is_empty() {
                let folder_name = root_dir
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                if folder_name.contains("25") {
                    java_version = "25.0.0".to_string();
                } else if folder_name.contains("21") {
                    java_version = "21.0.0".to_string();
                } else if folder_name.contains("17") {
                    java_version = "17.0.0".to_string();
                } else if folder_name.contains("1.8")
                    || folder_name.contains("jre8")
                    || folder_name.contains("jdk8")
                {
                    java_version = "1.8.0".to_string();
                } else {
                    java_version = "Unknown".to_string();
                }
            }

            if vendor_name.is_empty() {
                let path_str = normalized_path.to_lowercase();
                if path_str.contains("adoptium") || path_str.contains("temurin") {
                    vendor_name = "Eclipse Adoptium".to_string();
                } else if path_str.contains("microsoft") {
                    vendor_name = "Microsoft".to_string();
                } else if path_str.contains("zulu") {
                    vendor_name = "Azul Zulu".to_string();
                } else if path_str.contains("corretto") {
                    vendor_name = "Amazon Corretto".to_string();
                } else if path_str.contains("oracle") {
                    vendor_name = "Oracle Corporation".to_string();
                } else {
                    vendor_name = "OpenJDK".to_string();
                }
            }

            let major_version = if java_version.starts_with("1.8") {
                8
            } else {
                java_version
                    .split('.')
                    .next()
                    .and_then(|s| s.parse::<u32>().ok())
                    .unwrap_or(21)
            };

            let arch_label = if arch == "x86_64" || arch == "amd64" || arch == "x64" {
                "x64".to_string()
            } else {
                arch.clone()
            };

            let recommended_for = match major_version {
                21 => "Minecraft 1.20.5+ / 1.21+ (强力推荐)".to_string(),
                17 => "Minecraft 1.17 - 1.20.4 (官方推荐)".to_string(),
                8 => "Minecraft 1.16.5 及以下经典版本".to_string(),
                25 => "Java 25 (尝鲜开发版)".to_string(),
                m => format!("Minecraft Java {}", m),
            };

            let name = format!("{} {} ({})", vendor_name, major_version, arch_label);
            let id = format!("jdk-{}-{}", major_version, results.len());

            results.push(DetectedJava {
                id,
                name,
                path: normalized_path,
                version: java_version,
                major_version,
                arch: arch_label,
                vendor: vendor_name,
                recommended_for,
                is_auto_detected: true,
            });
        }
    }

    results
}

// 3. 之前定义的 WASM 执行 Command
#[tauri::command]
fn run_plugin_wasm(
    plugin_dir: String,
    wasm_file: String,
    func_name: String,
    a: i32,
    b: i32,
) -> Result<i32, String> {
    println!("\n=== [Rust] 收到 WASM 调用请求 ===");
    let wasm_path = PathBuf::from(&plugin_dir).join(&wasm_file);
    let wasm_bytes = fs::read(&wasm_path).map_err(|e| format!("读取 Wasm 失败: {e}"))?;

    let engine = Engine::default();
    let mut store = Store::new(&engine, ());
    let module = Module::new(&engine, &wasm_bytes).map_err(|e| format!("编译 Wasm 失败: {e}"))?;
    let instance = Instance::new(&mut store, &module, &[]).map_err(|e| format!("实例化失败: {e}"))?;

    let func = instance
        .get_typed_func::<(i32, i32), i32>(&mut store, &func_name)
        .map_err(|e| format!("找不到函数: {e}"))?;

    let res = func.call(&mut store, (a, b)).map_err(|e| format!("计算失败: {e}"))?;
    println!("✅ [Rust] WASM 计算成功，结果: {}", res);
    Ok(res)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        //注册自定义资源协议
        .register_uri_scheme_protocol("plugin-asset", |_app, request| {
            let uri_path = request.uri().path();
            let clean_path = if cfg!(windows) && uri_path.starts_with('/') {
                &uri_path[1..]
            } else {
                uri_path
            };

            let local_path = PathBuf::from(clean_path);

            if let Ok(content) = fs::read(&local_path) {
                let mime = mime_guess::from_path(&local_path).first_or_octet_stream();
                Response::builder()
                    .header("Content-Type", mime.as_ref())
                    .header("Access-Control-Allow-Origin", "*")
                    .body(content)
                    .unwrap_or_else(|_| {
                        Response::builder()
                            .status(StatusCode::INTERNAL_SERVER_ERROR)
                            .body(vec![])
                            .unwrap()
                    })
            } else {
                eprintln!("[plugin-asset 错误] 找不到本地文件: {:?}", local_path);
                Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(vec![])
                    .unwrap()
            }
        })
        .invoke_handler(tauri::generate_handler![
            run_plugin_wasm,
            read_plugin_file,
            detect_java_environments
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
