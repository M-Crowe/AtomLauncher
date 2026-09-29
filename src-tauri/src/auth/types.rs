use serde::{Deserialize, Serialize};

/// 微软 Azure 注册 Application (client) ID
pub const MS_CLIENT_ID: &str = "37c03091-93d8-4297-a59c-f3792cc080e0";
pub const MS_SCOPE: &str = "XboxLive.signin offline_access";

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
