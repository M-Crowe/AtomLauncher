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

