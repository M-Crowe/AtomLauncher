use super::offline::create_default_offline_account;
use super::types::{Account, AccountsStorage};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

// Global accounts in-memory cache synchronized with disk
static ACCOUNTS_LOCK: OnceLock<Arc<Mutex<AccountsStorage>>> = OnceLock::new();

pub fn get_accounts_cache() -> &'static Arc<Mutex<AccountsStorage>> {
    ACCOUNTS_LOCK.get_or_init(|| Arc::new(Mutex::new(load_accounts_from_disk())))
}

pub fn get_accounts_file_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(app_data) = std::env::var("APPDATA") {
            let atom_dir = PathBuf::from(app_data).join(".minecraft");
            if !atom_dir.exists() {
                let _ = fs::create_dir_all(&atom_dir);
            }
            return atom_dir.join("atom_accounts.json");
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let atom_dir = PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("minecraft");
            if !atom_dir.exists() {
                let _ = fs::create_dir_all(&atom_dir);
            }
            return atom_dir.join("atom_accounts.json");
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let atom_dir = PathBuf::from(home).join(".minecraft");
            if !atom_dir.exists() {
                let _ = fs::create_dir_all(&atom_dir);
            }
            return atom_dir.join("atom_accounts.json");
        }
    }

    PathBuf::from("atom_accounts.json")
}

pub fn load_accounts_from_disk() -> AccountsStorage {
    let p = get_accounts_file_path();
    if p.exists() {
        if let Ok(content) = fs::read_to_string(&p) {
            if let Ok(storage) = serde_json::from_str::<AccountsStorage>(&content) {
                return storage;
            }
        }
    }

    // Default with initial offline player if empty
    let default_offline = create_default_offline_account("Steve");
    AccountsStorage {
        active_account_id: Some(default_offline.id.clone()),
        accounts: vec![default_offline],
    }
}

pub fn save_accounts_to_disk(storage: &AccountsStorage) {
    let p = get_accounts_file_path();
    if let Some(parent) = p.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(storage) {
        let _ = fs::write(&p, json);
    }
}

pub fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[tauri::command]
pub fn get_accounts() -> Result<Vec<Account>, String> {
    let cache = get_accounts_cache();
    let storage = cache.lock().unwrap();
    Ok(storage.accounts.clone())
}

#[tauri::command]
pub fn get_active_account() -> Result<Option<Account>, String> {
    let cache = get_accounts_cache();
    let storage = cache.lock().unwrap();
    if let Some(active_id) = &storage.active_account_id {
        Ok(storage.accounts.iter().find(|a| a.id == *active_id).cloned())
    } else {
        Ok(storage.accounts.first().cloned())
    }
}

#[tauri::command]
pub fn set_active_account(account_id: String) -> Result<Vec<Account>, String> {
    let cache = get_accounts_cache();
    let mut storage = cache.lock().unwrap();

    let mut found = false;
    for acc in storage.accounts.iter_mut() {
        if acc.id == account_id {
            acc.is_active = true;
            found = true;
        } else {
            acc.is_active = false;
        }
    }

    if !found {
        return Err(format!("找不到指定账户: {account_id}"));
    }

    storage.active_account_id = Some(account_id);
    save_accounts_to_disk(&storage);
    Ok(storage.accounts.clone())
}

#[tauri::command]
pub fn delete_account(account_id: String) -> Result<Vec<Account>, String> {
    let cache = get_accounts_cache();
    let mut storage = cache.lock().unwrap();

    storage.accounts.retain(|a| a.id != account_id);

    // If active account was deleted, fallback to first available
    if storage.active_account_id.as_deref() == Some(&account_id) {
        if let Some(first) = storage.accounts.first_mut() {
            first.is_active = true;
            storage.active_account_id = Some(first.id.clone());
        } else {
            // Keep at least one default offline player
            let default_acc = create_default_offline_account("Steve");
            storage.active_account_id = Some(default_acc.id.clone());
            storage.accounts.push(default_acc);
        }
    }

    save_accounts_to_disk(&storage);
    Ok(storage.accounts.clone())
}
