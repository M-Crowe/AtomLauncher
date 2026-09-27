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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_minecraft_dir() {
        let dir = get_default_minecraft_dir();
        assert!(dir.to_string_lossy().contains(".minecraft"));
    }

    #[test]
    fn test_atom_dir_pointer_mechanism() {
        let _lock = TEST_LOCK.lock().unwrap();
        let temp_dir = std::env::temp_dir().join(format!("atom_test_{}", uuid::Uuid::new_v4()));
        let _ = fs::create_dir_all(&temp_dir);

        let exe_dir = temp_dir.join("exe_dir");
        let _ = fs::create_dir_all(&exe_dir);
        std::env::set_var("ATOM_EXE_DIR", &exe_dir);

        let default_atom = get_default_atom_dir();
        assert_eq!(default_atom, exe_dir.join(".atom"));

        // Default get_atom_dir should be <exe_dir>/.atom
        let resolved = get_atom_dir();
        assert_eq!(resolved, default_atom);
        assert!(default_atom.join("logs").exists());
        assert!(default_atom.join("plugins").exists());

        // Redirect to custom dir
        let custom_dir = temp_dir.join("custom_atom_data");
        let res = set_atom_dir(&custom_dir).expect("set_atom_dir should succeed");
        assert_eq!(res, custom_dir);
        assert_eq!(get_atom_dir(), custom_dir);
        assert!(get_atom_pointer_path().exists());

        // Reset to default
        let res_default = set_atom_dir(&default_atom).expect("reset to default should succeed");
        assert_eq!(res_default, default_atom);
        assert_eq!(get_atom_dir(), default_atom);
        assert!(!get_atom_pointer_path().exists());

        // Cleanup
        std::env::remove_var("ATOM_EXE_DIR");
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
