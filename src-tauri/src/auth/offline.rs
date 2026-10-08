use super::storage::{get_accounts_cache, save_accounts_to_disk};
use super::types::{Account, AccountType};

pub fn generate_offline_uuid(name: &str) -> String {
    use md5::{Digest, Md5};
    let raw = format!("OfflinePlayer:{name}");
    let mut hasher = Md5::new();
    hasher.update(raw.as_bytes());
    let mut bytes: [u8; 16] = hasher.finalize().into();
    bytes[6] = (bytes[6] & 0x0f) | 0x30; // Version 3
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC4122
    let u = uuid::Builder::from_bytes(bytes).into_uuid();
    u.hyphenated().to_string()
}

pub fn create_default_offline_account(name: &str) -> Account {
    let clean_name = if name.trim().is_empty() { "Steve" } else { name.trim() };
    let uuid_str = generate_offline_uuid(clean_name);
    Account {
        id: format!("offline-{}", clean_name.to_lowercase()),
        name: clean_name.to_string(),
        uuid: uuid_str.clone(),
        account_type: AccountType::Offline,
        access_token: uuid_str.replace('-', ""),
        refresh_token: None,
        expires_at: None,
        skin_url: None,
        is_active: true,
        xuid: Some("0".to_string()),
    }
}

#[tauri::command]
pub fn create_offline_account(username: String) -> Result<Account, String> {
    let clean = username.trim();
    if clean.is_empty() {
        return Err("用户名不能为空".to_string());
    }

    let acc = create_default_offline_account(clean);
    let cache = get_accounts_cache();
    let mut storage = cache.lock().unwrap();

    for a in storage.accounts.iter_mut() {
        a.is_active = false;
    }

    if let Some(idx) = storage.accounts.iter().position(|a| a.id == acc.id) {
        storage.accounts[idx] = acc.clone();
    } else {
        storage.accounts.push(acc.clone());
    }
    storage.active_account_id = Some(acc.id.clone());
    save_accounts_to_disk(&storage);

    Ok(acc)
}
