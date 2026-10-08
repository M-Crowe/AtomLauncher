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

    // 2. 依据用户指定或版本需求精准选择 Java 运行时 (参考 SCL 智能适配逻辑)
    let mut java_path = options.java_path.trim().to_string();
    let is_auto_java = java_path.is_empty()
        || java_path.eq_ignore_ascii_case("auto")
        || java_path.eq_ignore_ascii_case("javaw.exe")
        || java_path.eq_ignore_ascii_case("java.exe");

    let runtimes = detect_java_environments().unwrap_or_default();

    if is_auto_java {
        // 自动模式：按 Minecraft 版本所需的大版本精准寻找最适合的 Java
        if let Some(exact) = runtimes.iter().find(|r| r.major_version == meta.java_major_version) {
            java_path = exact.path.clone();
        } else if let Some(compatible) = runtimes.iter().find(|r| {
            if meta.java_major_version <= 8 {
                r.major_version == 8
            } else {
                r.major_version >= meta.java_major_version
            }
        }) {
            java_path = compatible.path.clone();
        } else if let Some(first) = runtimes.first() {
            java_path = first.path.clone();
        }
    } else {
        // 用户指定了某个 Java 路径，先检查该路径是否能满足目标版本的最低大版本要求
        // 如果用户指定的 Java 版本过低（例如用 Java 17 尝试启动需要 Java 25 的 26.3 快照）：
        // 检查系统中是否有满足要求的 Java，若有则自动纠偏；若无则提前明确报错阻止崩溃！
        let is_incompatible = if let Some(user_rt) = runtimes.iter().find(|r| r.path.eq_ignore_ascii_case(&java_path)) {
            if meta.java_major_version <= 8 {
                user_rt.major_version != 8
            } else {
                user_rt.major_version < meta.java_major_version
            }
        } else {
            false
        };

        if is_incompatible {
            if let Some(matched) = runtimes.iter().find(|r| r.major_version == meta.java_major_version) {
                eprintln!(
                    "[AtomLauncher] 用户配置的 Java 无法运行版本 {} (需要 Java {})，已智能自动切换为匹配的 Java {}: {}",
                    options.version_id, meta.java_major_version, matched.major_version, matched.path
                );
                java_path = matched.path.clone();
            } else {
                return Err(format!(
                    "当前 Minecraft 版本 ({}) 需要 Java {} 运行环境，但当前配置的 Java 无法运行该版本。请安装对应版本的 JDK 或在设置中切换 Java。",
                    options.version_id, meta.java_major_version
                ));
            }
        }
    }

    if java_path.is_empty() {
        return Err(format!(
            "未检测到可运行 Minecraft {} 的 Java 运行环境（需要 Java {}）。请在设置中配置有效 Java 或前往下载 JDK。",
            options.version_id, meta.java_major_version
        ));
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

    // 提前解压该版本及继承链所需的 Natives 本地动态库 (.dll/.dylib/.so)
    let _ = crate::core::extract_natives(&game_dir, &work_dir, &options.version_id);

    // 3. 真实账号解析与 Token 自动续期（离线 / 微软正版）
    let mut username = options.username.clone().unwrap_or_default();
    let mut uuid = options.uuid.clone().unwrap_or_default();
    let mut access_token = options.access_token.clone().unwrap_or_default();
    let mut user_type = options.user_type.clone().unwrap_or_else(|| "mojang".to_string());
    let mut xuid = options.xuid.clone().unwrap_or_else(|| "0".to_string());

    // 检查微软正版 Token 有效性并适时自动续期
    if let Ok(Some(mut active_acc)) = crate::auth::get_active_account() {
        if active_acc.account_type == crate::auth::AccountType::Microsoft {
            let _ = crate::auth::refresh_microsoft_token_if_needed(&mut active_acc);
            user_type = "msa".to_string();
            xuid = active_acc.xuid.clone().unwrap_or_else(|| "0".to_string());
            username = active_acc.name.clone();
            uuid = active_acc.uuid.clone();
            access_token = active_acc.access_token.clone();
            let cache = crate::auth::get_accounts_cache();
            if let Ok(mut storage) = cache.lock() {
                if let Some(pos) = storage.accounts.iter().position(|a| a.id == active_acc.id) {
                    storage.accounts[pos] = active_acc;
                    crate::auth::save_accounts_to_disk(&storage);
                }
            }
        } else {
            user_type = "mojang".to_string();
        }
    }

    if username.is_empty() {
        username = "Player".to_string();
    }
    if uuid.is_empty() {
        uuid = "00000000-0000-0000-0000-000000000000".to_string();
    }
    if access_token.is_empty() {
        access_token = "00000000000000000000000000000000".to_string();
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

    // Windows 命令行 32KB 限制保护：若 classpath 过长且 Java >= 9，使用 @argfile 参数文件传参
    if cfg!(windows) && classpath_str.len() > 28000 && meta.java_major_version >= 9 {
        let argfile_path = work_dir.join(".atom_classpath.args");
        let safe_cp = classpath_str.replace('\\', "/");
        if let Err(e) = fs::write(&argfile_path, format!("-cp\n\"{}\"\n", safe_cp)) {
            eprintln!("[AtomLauncher] 写入 argfile 失败，回退到普通 -cp: {}", e);
            cmd.arg("-cp");
            cmd.arg(&classpath_str);
        } else {
            cmd.arg(format!("@{}", argfile_path.display()));
        }
    } else {
        cmd.arg("-cp");
        cmd.arg(&classpath_str);
    }

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
            let mut reader = BufReader::new(out);
            let mut buf = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buf) {
                if n == 0 {
                    break;
                }
                while buf.ends_with(b"\n") || buf.ends_with(b"\r") {
                    buf.pop();
                }
                let line = String::from_utf8_lossy(&buf).to_string();
                buf.clear();

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
        });
    }

    // Spawn stderr stream reader
    if let Some(err) = stderr {
        let app_handle = app.clone();
        thread::spawn(move || {
            let mut reader = BufReader::new(err);
            let mut buf = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buf) {
                if n == 0 {
                    break;
                }
                while buf.ends_with(b"\n") || buf.ends_with(b"\r") {
                    buf.pop();
                }
                let line = String::from_utf8_lossy(&buf).to_string();
                buf.clear();

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
