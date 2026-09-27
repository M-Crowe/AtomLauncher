use serde::{Deserialize, Serialize};

/// Prism Launcher 的 Azure Client ID (公开应用标识，非机密凭证)
/// 来源: https://github.com/PrismLauncher/PrismLauncher CMakeLists.txt -> Launcher_MSA_CLIENT_ID
pub const MS_CLIENT_ID: &str = "c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb";
pub const MS_SCOPE: &str = "XboxLive.SignIn XboxLive.offline_access";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum AccountType {
    Microsoft,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub name: String,
    pub uuid: String,
    pub account_type: AccountType,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
    pub skin_url: Option<String>,
    pub is_active: bool,
    pub xuid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCodePollResult {
    pub status: String, // "pending" | "success" | "expired" | "error"
    pub message: Option<String>,
    pub account: Option<Account>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AccountsStorage {
    pub active_account_id: Option<String>,
    pub accounts: Vec<Account>,
}
