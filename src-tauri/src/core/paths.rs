use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub static TEST_LOCK: Mutex<()> = Mutex::new(());

/// Get the executable directory (or fallback to current directory)
pub fn get_exe_dir() -> PathBuf {
    if let Ok(custom_exe) = std::env::var("ATOM_EXE_DIR") {
        if !custom_exe.trim().is_empty() {
            return PathBuf::from(custom_exe.trim());
        }
    }
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

/// Default `.atom` path adjacent to the launcher executable (<exe_dir>/.atom)
pub fn get_default_atom_dir() -> PathBuf {
    get_exe_dir().join(".atom")
}

/// Pointer file stored at <exe_dir>/.atom_path
pub fn get_atom_pointer_path() -> PathBuf {
    get_exe_dir().join(".atom_path")
}

/// Standard default Minecraft game directory (%APPDATA%/.minecraft on Windows)
pub fn get_default_minecraft_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata).join(".minecraft");
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("minecraft");
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join(".minecraft");
        }
    }
    PathBuf::from(".minecraft")
}

/// Initialize standard subdirectories inside `.atom`
pub fn init_atom_subdirs(atom_dir: &Path) {
    let _ = fs::create_dir_all(atom_dir.join("logs"));
    let _ = fs::create_dir_all(atom_dir.join("plugins"));
}

/// Resolve the active `.atom` directory:
/// 1. Environment variable override ATOM_DATA_DIR (useful for test isolation)
/// 2. Redirection pointer file `<exe_dir>/.atom_path`
/// 3. Default portable location `<exe_dir>/.atom`
/// 4. Graceful fallback to user directory `%APPDATA%/.atom` if executable directory is read-only
pub fn get_atom_dir() -> PathBuf {
    if let Ok(custom_env) = std::env::var("ATOM_DATA_DIR") {
        let trimmed = custom_env.trim();
        if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            let _ = fs::create_dir_all(&p);
            init_atom_subdirs(&p);
            return p;
        }
    }

    let pointer = get_atom_pointer_path();
    if pointer.exists() {
        if let Ok(content) = fs::read_to_string(&pointer) {
            let target_str = content.trim();
            if !target_str.is_empty() {
                let target = PathBuf::from(target_str);
                if fs::create_dir_all(&target).is_ok() {
                    init_atom_subdirs(&target);
                    return target;
                }
            }
        }
    }

    let default_dir = get_default_atom_dir();
    match fs::create_dir_all(&default_dir) {
        Ok(_) => {
            init_atom_subdirs(&default_dir);
            default_dir
        }
        Err(_) => {
            // Fallback to user home / AppData if exe_dir is not writable
            #[cfg(target_os = "windows")]
            {
                if let Ok(appdata) = std::env::var("APPDATA") {
                    let fallback = PathBuf::from(appdata).join(".atom");
                    let _ = fs::create_dir_all(&fallback);
                    init_atom_subdirs(&fallback);
                    return fallback;
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                if let Ok(home) = std::env::var("HOME") {
                    let fallback = PathBuf::from(home).join(".atom");
                    let _ = fs::create_dir_all(&fallback);
                    init_atom_subdirs(&fallback);
                    return fallback;
                }
            }
            default_dir
        }
    }
}

/// Set custom `.atom` directory by updating pointer `<exe_dir>/.atom_path`
pub fn set_atom_dir(new_path: &Path) -> Result<PathBuf, String> {
    let default_dir = get_default_atom_dir();
    let pointer = get_atom_pointer_path();
    let old_dir = get_atom_dir();

    if new_path == default_dir {
        // Reset to default: remove pointer if present
        if pointer.exists() {
            let _ = fs::remove_file(&pointer);
        }
        let _ = fs::create_dir_all(&default_dir);
        init_atom_subdirs(&default_dir);

        // Migrate config & accounts if resetting to default and default doesn't have them
        if old_dir != default_dir {
            let old_config = old_dir.join("config.json");
            let def_config = default_dir.join("config.json");
            if old_config.exists() && !def_config.exists() {
                let _ = fs::copy(&old_config, &def_config);
            }
            let old_accounts = old_dir.join("accounts.json");
            let def_accounts = default_dir.join("accounts.json");
            if old_accounts.exists() && !def_accounts.exists() {
                let _ = fs::copy(&old_accounts, &def_accounts);
            }
        }

        crate::auth::reload_accounts_cache();
        Ok(default_dir)
    } else {
        fs::create_dir_all(new_path)
            .map_err(|e| format!("无法创建指定的 .atom 目录 {:?}: {}", new_path, e))?;
        init_atom_subdirs(new_path);

        let parent = pointer.parent().unwrap_or(&default_dir);
        let _ = fs::create_dir_all(parent);
        fs::write(&pointer, new_path.to_string_lossy().to_string())
            .map_err(|e| format!("无法写入重定向指针文件 {:?}: {}", pointer, e))?;

        // Migrate config & accounts if target doesn't have them
        if old_dir != new_path {
            let old_config = old_dir.join("config.json");
            let new_config = new_path.join("config.json");
            if old_config.exists() && !new_config.exists() {
                let _ = fs::copy(&old_config, &new_config);
            }
            let old_accounts = old_dir.join("accounts.json");
            let new_accounts = new_path.join("accounts.json");
            if old_accounts.exists() && !new_accounts.exists() {
                let _ = fs::copy(&old_accounts, &new_accounts);
            }
        }

        crate::auth::reload_accounts_cache();
        Ok(new_path.to_path_buf())
    }
}

