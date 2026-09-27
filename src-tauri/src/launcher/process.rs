use super::java::detect_java_environments;
use super::types::{ExitPayload, LaunchOptions, LaunchResult, LogPayload, StartedPayload};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use tauri::{AppHandle, Emitter};

static RUNNING_PROCESSES: OnceLock<Arc<Mutex<HashMap<u32, Child>>>> = OnceLock::new();

pub fn get_process_map() -> &'static Arc<Mutex<HashMap<u32, Child>>> {
    RUNNING_PROCESSES.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

pub fn format_now_time() -> String {
    let now = std::time::SystemTime::now();
    let duration = now.duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let secs = duration.as_secs();
    let hours = (secs / 3600 + 8) % 24; // UTC+8
    let mins = (secs % 3600) / 60;
    let s = secs % 60;
    format!("{hours:02}:{mins:02}:{s:02}")
}

pub fn format_elapsed_time(duration: std::time::Duration) -> String {
    let secs = duration.as_secs();
    let hours = secs / 3600;
    let mins = (secs % 3600) / 60;
    let s = secs % 60;
    let ms = duration.subsec_millis();
    format!("{hours:02}:{mins:02}:{s:02}.{ms:03}")
}

#[tauri::command]
pub fn verify_game_integrity(
    game_dir: String,
    version_id: String,
) -> Result<crate::core::IntegrityReport, String> {
    let p = PathBuf::from(game_dir);
    Ok(crate::core::check_game_integrity(&p, &version_id))
}

#[tauri::command]
pub fn launch_minecraft(
    app: AppHandle,
    options: LaunchOptions,
) -> Result<LaunchResult, String> {
    let game_dir = PathBuf::from(&options.game_dir);
    if !game_dir.exists() {
        return Err(format!("游戏主目录不存在: {}", options.game_dir));
    }

    // 1. 深度解析版本元数据与继承链 (Inheritance)
    let meta = crate::core::resolve_version_meta(&game_dir, &options.version_id)
        .map_err(|e| format!("解析版本信息失败: {e}"))?;

    // 2. 依据版本需求精准选择 Java 运行时（例如 MC Eternal 2 / 1.18~1.20 选 Java 17，26.3 快照选 Java 25，1.21 选 Java 21）
    let mut java_path = options.java_path.trim().to_string();
    if let Ok(runtimes) = detect_java_environments() {
        if let Some(exact) = runtimes.iter().find(|r| r.major_version == meta.java_major_version) {
            java_path = exact.path.clone();
        } else if let Some(compatible) = runtimes.iter().find(|r| r.major_version >= meta.java_major_version) {
            java_path = compatible.path.clone();
        } else if java_path == "javaw.exe" || java_path == "java.exe" || java_path.is_empty() {
            if let Some(first) = runtimes.first() {
                java_path = first.path.clone();
            }
        }
    }

    if java_path.is_empty() {
        return Err("Java 路径不能为空，请在设置中配置有效 Java 运行时".to_string());
    }

    let version_dir = game_dir.join("versions").join(&options.version_id);
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

    // 3. 真实账号解析与 Token 自动续期（离线 / 微软正版）
    let mut username = options.username.clone().unwrap_or_default();
    let mut uuid = options.uuid.clone().unwrap_or_default();
    let mut access_token = options.access_token.clone().unwrap_or_default();
    let mut user_type = options.user_type.clone().unwrap_or_else(|| "mojang".to_string());
    let mut xuid = options.xuid.clone().unwrap_or_else(|| "0".to_string());

    if username.is_empty() || uuid.is_empty() || access_token.is_empty() {
        if let Ok(Some(mut active_acc)) = crate::auth::get_active_account() {
            if active_acc.account_type == crate::auth::AccountType::Microsoft {
                let _ = crate::auth::refresh_microsoft_token_if_needed(&mut active_acc);
                user_type = "msa".to_string();
                xuid = active_acc.xuid.clone().unwrap_or_else(|| "0".to_string());
            } else {
                user_type = "mojang".to_string();
                xuid = "0".to_string();
            }
            username = active_acc.name;
            uuid = active_acc.uuid;
            access_token = active_acc.access_token;
        } else {
            username = "Player".to_string();
            uuid = "00000000-0000-0000-0000-000000000000".to_string();
            access_token = "00000000000000000000000000000000".to_string();
            user_type = "mojang".to_string();
            xuid = "0".to_string();
        }
    }

    let (jvm_flags, game_flags) = crate::core::build_launch_arguments(
        &meta,
        &game_dir,
        &work_dir,
        meta.java_major_version,
        &username,
        &uuid,
        &access_token,
        &user_type,
        &xuid,
        options.window_width,
        options.window_height,
        options.fullscreen.unwrap_or(false),
    );

    let mut cmd = Command::new(&java_path);
    cmd.current_dir(&work_dir);

    // JVM Memory
    let xmx = if options.allocated_memory_mb > 0 { options.allocated_memory_mb } else { 4096 };
    let xms = if options.min_memory_mb > 0 { options.min_memory_mb } else { 1024 };
    cmd.arg(format!("-Xmx{xmx}M"));
    cmd.arg(format!("-Xms{xms}M"));

    // 注入核心引擎构建的完整 JVM 参数（含 --add-opens 模块解锁）
    for flag in &jvm_flags {
        cmd.arg(flag);
    }

    // 用户自定义 JVM 参数
    if let Some(jvm_args) = options.jvm_args {
        for arg in jvm_args.split_whitespace() {
            if !arg.is_empty() && !jvm_flags.contains(&arg.to_string()) {
                cmd.arg(arg);
            }
        }
    }

    // Classpath
    let cp_separator = if cfg!(windows) { ";" } else { ":" };
    let classpath_str = if meta.classpath_entries.is_empty() {
        ".".to_string()
    } else {
        meta.classpath_entries
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(cp_separator)
    };
    cmd.arg("-cp");
    cmd.arg(&classpath_str);

    // Main Class
    cmd.arg(&meta.main_class);

    // Game Arguments
    for arg in &game_flags {
        cmd.arg(arg);
    }

    // Setup streaming pipes
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let command_summary = format!("{java_path} -Xmx{xmx}M -Xms{xms}M ... {} --version {}", meta.main_class, options.version_id);

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

    // Initial system logs
    let now = format_now_time();
    let _ = app.emit(
        "minecraft-log",
        LogPayload {
            pid,
            line: format!("[AtomLauncher] 正在启动 Minecraft 实例: {} (PID: {})", options.version_id, pid),
            level: "INFO".to_string(),
            timestamp: now.clone(),
            is_error: false,
        },
    );
    let _ = app.emit(
        "minecraft-log",
        LogPayload {
            pid,
            line: format!("[AtomLauncher] 执行指令: {}", command_summary),
            level: "INFO".to_string(),
            timestamp: now,
            is_error: false,
        },
    );

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Store child in process map
    {
        let map = get_process_map();
        let mut guard = map.lock().unwrap();
        guard.insert(pid, child);
    }

    // Spawn stdout stream reader
    if let Some(out) = stdout {
        let app_handle = app.clone();
        thread::spawn(move || {
            let reader = BufReader::new(out);
            for line_res in reader.lines() {
                if let Ok(line) = line_res {
                    let level = if line.contains("ERROR") || line.contains("Exception") || line.contains("Error") {
                        "ERROR"
                    } else if line.contains("WARN") {
                        "WARN"
                    } else if line.contains("DEBUG") {
                        "DEBUG"
                    } else {
                        "INFO"
                    };
                    let ts = format_now_time();
                    let _ = app_handle.emit(
                        "minecraft-log",
                        LogPayload {
                            pid,
                            line,
                            level: level.to_string(),
                            timestamp: ts,
                            is_error: false,
                        },
                    );
                }
            }
        });
    }

    // Spawn stderr stream reader
    if let Some(err) = stderr {
        let app_handle = app.clone();
        thread::spawn(move || {
            let reader = BufReader::new(err);
            for line_res in reader.lines() {
                if let Ok(line) = line_res {
                    let ts = format_now_time();
                    let _ = app_handle.emit(
                        "minecraft-log",
                        LogPayload {
                            pid,
                            line,
                            level: "ERROR".to_string(),
                            timestamp: ts,
                            is_error: true,
                        },
                    );
                }
            }
        });
    }

    // Spawn process waiter thread
    let app_handle = app.clone();
    thread::spawn(move || {
        loop {
            thread::sleep(std::time::Duration::from_millis(500));
            let mut guard = get_process_map().lock().unwrap();
            if let Some(child) = guard.get_mut(&pid) {
                match child.try_wait() {
                    Ok(Some(status)) => {
                        let code = status.code();
                        let success = status.success();
                        let ts = format_now_time();
                        let _ = app_handle.emit(
                            "minecraft-log",
                            LogPayload {
                                pid,
                                line: format!("[AtomLauncher] 游戏进程已退出，退出代码: {:?}", code.unwrap_or(0)),
                                level: if success { "INFO".to_string() } else { "WARN".to_string() },
                                timestamp: ts,
                                is_error: !success,
                            },
                        );
                        let _ = app_handle.emit(
                            "minecraft-exit",
                            ExitPayload {
                                pid,
                                exit_code: code,
                                success,
                            },
                        );
                        guard.remove(&pid);
                        break;
                    }
                    Ok(None) => {} // Still running
                    Err(_) => {
                        guard.remove(&pid);
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
    let map = get_process_map();
    let mut guard = map.lock().unwrap();
    if let Some(mut child) = guard.remove(&pid) {
        let _ = child.kill();
        Ok(true)
    } else {
        // Try OS level kill
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output();
        }
        #[cfg(not(windows))]
        {
            let _ = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }
        Ok(true)
    }
}
