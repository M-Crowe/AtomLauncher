use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherInitConfig {
    pub atom_dir: Option<String>,
    pub game_dir: String,
    pub selected_java_id: Option<String>,
    #[serde(default)]
    pub java_path: Option<String>,
    pub custom_java_path: Option<String>,
    pub offline_username: Option<String>,
    pub memory_mb: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherInitState {
    pub initialized: bool,
    pub atom_dir: String,
    pub default_atom_dir: String,
    pub default_minecraft_dir: String,
    pub config: Option<serde_json::Value>,
}

/// Retrieve launcher initialization state and resolved directories
#[tauri::command]
pub fn get_launcher_init_state() -> LauncherInitState {
    let atom_dir = crate::core::paths::get_atom_dir();
    let default_atom = crate::core::paths::get_default_atom_dir();
    let default_mc = crate::core::paths::get_default_minecraft_dir();

    let config_path = atom_dir.join("config.json");
    let (initialized, config) = if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                let init = val.get("initialized").and_then(|v| v.as_bool()).unwrap_or(false);
                (init, Some(val))
            } else {
                (false, None)
            }
        } else {
            (false, None)
        }
    } else {
        (false, None)
    };

    LauncherInitState {
        initialized,
        atom_dir: atom_dir.to_string_lossy().to_string(),
        default_atom_dir: default_atom.to_string_lossy().to_string(),
        default_minecraft_dir: default_mc.to_string_lossy().to_string(),
        config,
    }
}

/// Save first-launch initialization configuration to `.atom/config.json`
#[tauri::command]
pub fn save_init_configuration(config: LauncherInitConfig) -> Result<(), String> {
    if let Some(ref custom_atom) = config.atom_dir {
        let trimmed = custom_atom.trim();
        if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            crate::core::paths::set_atom_dir(&p)?;
        }
    }

    let atom_dir = crate::core::paths::get_atom_dir();
    let config_path = atom_dir.join("config.json");

    let mut config_map = if config_path.exists() {
        fs::read_to_string(&config_path)
            .ok()
            .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default()
    } else {
        serde_json::Map::new()
    };

    config_map.insert("initialized".to_string(), serde_json::Value::Bool(true));
    config_map.insert("gameDir".to_string(), serde_json::Value::String(config.game_dir));
    if let Some(java_id) = config.selected_java_id {
        config_map.insert("selectedJavaId".to_string(), serde_json::Value::String(java_id));
    }
    if let Some(jpath) = config.java_path {
        let trimmed = jpath.trim();
        if !trimmed.is_empty() {
            config_map.insert("javaPath".to_string(), serde_json::Value::String(trimmed.to_string()));
        }
    }
    if let Some(custom_java) = config.custom_java_path {
        let trimmed = custom_java.trim();
        if !trimmed.is_empty() {
            config_map.insert("customJavaPath".to_string(), serde_json::Value::String(trimmed.to_string()));
            config_map.insert("useCustomJava".to_string(), serde_json::Value::Bool(true));
        }
    }
    if let Some(mem) = config.memory_mb {
        config_map.insert("allocatedMemory".to_string(), serde_json::json!(mem));
    }

    let config_str = serde_json::to_string_pretty(&config_map)
        .map_err(|e| format!("无法序列化启动器配置: {}", e))?;
    fs::write(&config_path, config_str)
        .map_err(|e| format!("无法写入 config.json: {}", e))?;

    // If an offline player name was provided in the wizard, register or ensure account
    if let Some(ref username) = config.offline_username {
        let name = username.trim();
        if !name.is_empty() {
            let _ = crate::auth::create_offline_account(name.to_string());
        }
    }

    // Ensure .atom/accounts.json is guaranteed to be persisted to disk
    let cache = crate::auth::get_accounts_cache();
    let storage = cache.lock().unwrap();
    crate::auth::save_accounts_to_disk(&storage);

    Ok(())
}

/// Retrieve the active `.atom` directory
#[tauri::command]
pub fn get_atom_directory() -> String {
    crate::core::paths::get_atom_dir().to_string_lossy().to_string()
}

/// Set a custom `.atom` directory
#[tauri::command]
pub fn set_atom_directory(path: String) -> Result<String, String> {
    let p = PathBuf::from(path.trim());
    let res = crate::core::paths::set_atom_dir(&p)?;
    Ok(res.to_string_lossy().to_string())
}

/// Read `.atom/config.json`
#[tauri::command]
pub fn load_launcher_config() -> Result<serde_json::Value, String> {
    let config_path = crate::core::paths::get_atom_dir().join("config.json");
    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("无法读取配置: {}", e))?;
        let parsed = serde_json::from_str::<serde_json::Value>(&content)
            .map_err(|e| format!("无法解析配置 JSON: {}", e))?;
        Ok(parsed)
    } else {
        Ok(serde_json::json!({}))
    }
}

/// Write `.atom/config.json`
#[tauri::command]
pub fn save_launcher_config(config: serde_json::Value) -> Result<(), String> {
    let atom_dir = crate::core::paths::get_atom_dir();
    let config_path = atom_dir.join("config.json");

    let mut config_map = if config_path.exists() {
        fs::read_to_string(&config_path)
            .ok()
            .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default()
    } else {
        serde_json::Map::new()
    };

    if let Some(obj) = config.as_object() {
        for (k, v) in obj {
            config_map.insert(k.clone(), v.clone());
        }
    }
    // 确保初始化状态始终保持为 true，防止后续保存设置时抹除 initialized 导致重复弹出初始化向导
    config_map.insert("initialized".to_string(), serde_json::Value::Bool(true));

    let content = serde_json::to_string_pretty(&config_map)
        .map_err(|e| format!("无法序列化配置: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("无法保存 config.json: {}", e))?;
    Ok(())
}

/// Native folder browser dialog (PowerShell FolderBrowserDialog on Windows)
#[tauri::command]
pub fn pick_folder(default_path: Option<String>) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut script = String::from(
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; \
             Add-Type -AssemblyName System.Windows.Forms; \
             $f = New-Object System.Windows.Forms.FolderBrowserDialog; \
             $f.ShowNewFolderButton = $true; \
             $f.Description = '请选择文件夹';"
        );
        if let Some(ref def) = default_path {
            let trimmed = def.trim();
            if !trimmed.is_empty() {
                let escaped = trimmed.replace('\'', "''");
                script.push_str(&format!(" if (Test-Path -LiteralPath '{}') {{ $f.SelectedPath = '{}' }};", escaped, escaped));
            }
        }
        script.push_str(" $dummy = New-Object System.Windows.Forms.Form; \
                          $dummy.TopMost = $true; \
                          $dummy.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen; \
                          if ($f.ShowDialog($dummy) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath } \
                          $dummy.Dispose();");

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();

        if let Ok(out) = output {
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !res.is_empty() {
                return Ok(Some(res));
            }
        }
        Ok(None)
    }

    #[cfg(target_os = "macos")]
    {
        let prompt = "Select Folder";
        let script = format!("POSIX path of (choose folder with prompt \"{}\")", prompt);
        let output = std::process::Command::new("osascript")
            .args(["-e", &script])
            .output();
        if let Ok(out) = output {
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !res.is_empty() {
                return Ok(Some(res));
            }
        }
        Ok(None)
    }

    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("zenity")
            .args(["--file-selection", "--directory"])
            .output();
        if let Ok(out) = output {
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !res.is_empty() {
                return Ok(Some(res));
            }
        }
        Ok(None)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = default_path;
        Ok(None)
    }
}

/// Native file browser dialog (PowerShell OpenFileDialog on Windows)
#[tauri::command]
pub fn pick_file(
    filter_name: Option<String>,
    filter_pattern: Option<String>,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let fname = filter_name.unwrap_or_else(|| "可执行文件".to_string());
        let fpat = filter_pattern.unwrap_or_else(|| "*.exe".to_string());
        let mut script = format!(
            "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; \
             Add-Type -AssemblyName System.Windows.Forms; \
             $f = New-Object System.Windows.Forms.OpenFileDialog; \
             $f.Title = '请选择文件'; \
             $f.Filter = '{0} ({1})|{1}|所有文件 (*.*)|*.*';",
            fname.replace('\'', "''"),
            fpat.replace('\'', "''"),
        );
        if let Some(ref def) = default_path {
            let trimmed = def.trim();
            if !trimmed.is_empty() {
                let escaped = trimmed.replace('\'', "''");
                script.push_str(&format!(
                    " if (Test-Path -LiteralPath '{}') {{ $f.InitialDirectory = [System.IO.Path]::GetDirectoryName('{}') }};",
                    escaped, escaped
                ));
            }
        }
        script.push_str(
            " $dummy = New-Object System.Windows.Forms.Form; \
              $dummy.TopMost = $true; \
              $dummy.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen; \
              if ($f.ShowDialog($dummy) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName } \
              $dummy.Dispose();",
        );

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .creation_flags(0x08000000)
            .output();

        if let Ok(out) = output {
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !res.is_empty() {
                return Ok(Some(res));
            }
        }
        Ok(None)
    }

    #[cfg(target_os = "macos")]
    {
        let script = "POSIX path of (choose file with prompt \"Select File\")";
        let output = std::process::Command::new("osascript")
            .args(["-e", script])
            .output();
        if let Ok(out) = output {
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !res.is_empty() {
                return Ok(Some(res));
            }
        }
        Ok(None)
    }

    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("zenity")
            .args(["--file-selection"])
            .output();
        if let Ok(out) = output {
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !res.is_empty() {
                return Ok(Some(res));
            }
        }
        Ok(None)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = (filter_name, filter_pattern, default_path);
        Ok(None)
    }
}

