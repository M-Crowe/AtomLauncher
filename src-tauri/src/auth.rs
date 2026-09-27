pub mod microsoft;
pub mod offline;
pub mod storage;
pub mod types;
pub mod xbox;

pub use microsoft::{
    poll_device_code_login, refresh_account_token, refresh_microsoft_token_if_needed,
    start_device_code_login,
};
pub use offline::{create_default_offline_account, create_offline_account, generate_offline_uuid};
pub use storage::{
    delete_account, get_accounts, get_accounts_cache, get_accounts_file_path, get_active_account,
    load_accounts_from_disk, now_secs, reload_accounts_cache, save_accounts_to_disk,
    set_active_account,
};
pub use types::{
    Account, AccountType, AccountsStorage, DeviceCodePollResult, DeviceCodeResponse, MS_CLIENT_ID,
    MS_SCOPE,
};
pub use xbox::execute_microsoft_chain;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ms_client_id_constant() {
        assert_eq!(MS_CLIENT_ID, "37c03091-93d8-4297-a59c-f3792cc080e0");
        assert_eq!(MS_SCOPE, "XboxLive.signin offline_access");
    }

    #[test]
    fn test_standard_offline_uuid_generation() {
        // "OfflinePlayer:Steve" standard Minecraft Java UUID v3
        let steve_uuid = generate_offline_uuid("Steve");
        assert_eq!(steve_uuid, "5627dd98-e6be-3c21-b8a8-e92344183641");

        // "OfflinePlayer:Alex" standard Minecraft Java UUID v3
        let alex_uuid = generate_offline_uuid("Alex");
        assert_eq!(alex_uuid, "36532b5e-c442-3dbb-a24c-c7e55d0f979a");
    }

    #[test]
    fn test_create_default_offline_account() {
        let acc = create_default_offline_account("Notch");
        assert_eq!(acc.name, "Notch");
        assert_eq!(acc.id, "offline-notch");
        assert_eq!(acc.account_type, AccountType::Offline);
        assert!(acc.is_active);
        assert_eq!(acc.xuid, Some("0".to_string()));
    }

    #[test]
    fn test_accounts_storage_serde() {
        let default_acc = create_default_offline_account("Steve");
        let storage = AccountsStorage {
            active_account_id: Some(default_acc.id.clone()),
            accounts: vec![default_acc.clone()],
        };

        let json = serde_json::to_string(&storage).expect("Serialize success");
        assert!(json.contains("offline-steve"));
        assert!(json.contains("offline"));

        let deserialized: AccountsStorage = serde_json::from_str(&json).expect("Deserialize success");
        assert_eq!(deserialized.active_account_id, Some("offline-steve".to_string()));
        assert_eq!(deserialized.accounts.len(), 1);
        assert_eq!(deserialized.accounts[0].name, "Steve");
    }

    #[test]
    fn test_reload_accounts_cache() {
        let _lock = crate::core::paths::TEST_LOCK.lock().unwrap();
        let temp_dir = std::env::temp_dir().join(format!("atom_acc_test_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&temp_dir);
        std::env::set_var("ATOM_DATA_DIR", &temp_dir);

        let custom_acc = create_default_offline_account("AlexCustom");
        let storage = AccountsStorage {
            active_account_id: Some(custom_acc.id.clone()),
            accounts: vec![custom_acc],
        };
        save_accounts_to_disk(&storage);

        reload_accounts_cache();
        let active = get_active_account().expect("get_active_account");
        assert!(active.is_some());
        assert_eq!(active.unwrap().name, "AlexCustom");

        std::env::remove_var("ATOM_DATA_DIR");
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
