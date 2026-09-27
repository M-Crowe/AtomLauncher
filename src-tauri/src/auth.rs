use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

pub const MS_CLIENT_ID: &str = "37c03091-93d8-4297-a59c-f3792cc080e0";

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

// Global accounts in-memory cache synchronized with disk
static ACCOUNTS_LOCK: OnceLock<Arc<Mutex<AccountsStorage>>> = OnceLock::new();

fn get_accounts_cache() -> &'static Arc<Mutex<AccountsStorage>> {
    ACCOUNTS_LOCK.get_or_init(|| {
        let storage = load_accounts_from_disk();
        Arc::new(Mutex::new(storage))
    })
}

pub fn get_accounts_file_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let atom_dir = PathBuf::from(appdata).join(".minecraft");
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

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

// ---------------- Standard MD5 implementation for Java UUID v3 ----------------
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

// ---------------- Microsoft OAuth2 Device Code Flow ----------------

#[tauri::command]
pub fn start_device_code_login() -> Result<DeviceCodeResponse, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {e}"))?;

    let res = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
        .form(&[
            ("client_id", MS_CLIENT_ID),
            ("scope", "XboxLive.signin offline_access"),
        ])
        .send()
        .map_err(|e| format!("请求设备验证码失败: {e} (请检查网络连接)"))?;

    if !res.status().is_success() {
        let err_text = res.text().unwrap_or_default();
        return Err(format!("获取微软设备验证码返回错误: {err_text}"));
    }

    let json: serde_json::Value = res
        .json()
        .map_err(|e| format!("解析设备码返回数据失败: {e}"))?;

    let device_code = json["device_code"].as_str().unwrap_or_default().to_string();
    let user_code = json["user_code"].as_str().unwrap_or_default().to_string();
    let verification_uri = json["verification_uri"]
        .as_str()
        .unwrap_or("https://microsoft.com/devicelogin")
        .to_string();
    let expires_in = json["expires_in"].as_u64().unwrap_or(900);
    let interval = json["interval"].as_u64().unwrap_or(5);
    let message = json["message"]
        .as_str()
        .unwrap_or("请在浏览器中打开验证页面并输入设备验证码完成登录")
        .to_string();

    Ok(DeviceCodeResponse {
        device_code,
        user_code,
        verification_uri,
        expires_in,
        interval,
        message,
    })
}

pub fn execute_microsoft_chain(ms_access_token: &str, ms_refresh_token: Option<&str>) -> Result<Account, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {e}"))?;

    // 1. Xbox Live Authenticate
    let xbl_res = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={ms_access_token}")
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        }))
        .send()
        .map_err(|e| format!("Xbox Live 身份验证失败: {e}"))?;

    if !xbl_res.status().is_success() {
        let txt = xbl_res.text().unwrap_or_default();
        return Err(format!("Xbox Live 验证异常: {txt}"));
    }

    let xbl_json: serde_json::Value = xbl_res.json().map_err(|e| format!("解析 Xbox Live 响应失败: {e}"))?;
    let xbl_token = xbl_json["Token"].as_str().ok_or("缺失 Xbox Live Token")?;
    let uhs = xbl_json["DisplayClaims"]["xui"][0]["uhs"]
        .as_str()
        .ok_or("缺失 Xbox Live UHS")?;

    // 2. XSTS Authorize
    let xsts_res = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbl_token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        }))
        .send()
        .map_err(|e| format!("XSTS 授权请求失败: {e}"))?;

    let xsts_status = xsts_res.status();
    let xsts_json: serde_json::Value = xsts_res.json().map_err(|e| format!("解析 XSTS 授权数据失败: {e}"))?;

    if !xsts_status.is_success() {
        if let Some(err_code) = xsts_json.get("XErr").and_then(|x| x.as_u64()) {
            match err_code {
                2148916233 => return Err("该微软账号尚未注册 Xbox 账户，请先在 xbox.com 完善账户".to_string()),
                2148916238 => return Err("该微软账号为未成年人/家庭账号，需由家长授权".to_string()),
                _ => return Err(format!("XSTS 错误代码: {err_code}")),
            }
        }
        return Err(format!("XSTS 授权失败: {xsts_json}"));
    }

    let xsts_token = xsts_json["Token"].as_str().ok_or("缺失 XSTS Token")?;

    // 3. Minecraft Services Login With Xbox
    let mc_res = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "identityToken": format!("XBL3.0 x={uhs};{xsts_token}")
        }))
        .send()
        .map_err(|e| format!("Minecraft 登录授权失败: {e}"))?;

    if !mc_res.status().is_success() {
        let txt = mc_res.text().unwrap_or_default();
        return Err(format!("Minecraft 登录服务响应异常: {txt}"));
    }

    let mc_json: serde_json::Value = mc_res.json().map_err(|e| format!("解析 Minecraft Token 失败: {e}"))?;
    let mc_access_token = mc_json["access_token"].as_str().ok_or("缺失 Minecraft access_token")?.to_string();
    let mc_expires_in = mc_json["expires_in"].as_i64().unwrap_or(86400);

    // 4. Fetch Minecraft Profile
    let profile_res = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .header("Authorization", format!("Bearer {mc_access_token}"))
        .send()
        .map_err(|e| format!("获取玩家档案失败: {e}"))?;

    if profile_res.status() == reqwest::StatusCode::NOT_FOUND {
        return Err("该微软账号未购买 Minecraft Java 版正版，请使用离线账号或购买正版".to_string());
    }

    if !profile_res.status().is_success() {
        let txt = profile_res.text().unwrap_or_default();
        return Err(format!("获取 Minecraft 档案失败: {txt}"));
    }

    let profile_json: serde_json::Value = profile_res.json().map_err(|e| format!("解析玩家档案失败: {e}"))?;
    let raw_uuid = profile_json["id"].as_str().ok_or("缺失玩家 UUID")?;
    let name = profile_json["name"].as_str().ok_or("缺失玩家用户名")?.to_string();

    let formatted_uuid = if raw_uuid.len() == 32 {
        format!(
            "{}-{}-{}-{}-{}",
            &raw_uuid[0..8],
            &raw_uuid[8..12],
            &raw_uuid[12..16],
            &raw_uuid[16..20],
            &raw_uuid[20..32]
        )
    } else {
        raw_uuid.to_string()
    };

    let skin_url = profile_json["skins"]
        .as_array()
        .and_then(|skins| {
            skins.iter().find_map(|s| {
                if s["state"].as_str() == Some("ACTIVE") {
                    s["url"].as_str().map(|u| u.to_string())
                } else {
                    None
                }
            }).or_else(|| skins.first().and_then(|s| s["url"].as_str().map(|u| u.to_string())))
        });

    let expires_at = now_secs() + mc_expires_in;

    Ok(Account {
        id: format!("msa-{}", formatted_uuid.to_lowercase()),
        name,
        uuid: formatted_uuid,
        account_type: AccountType::Microsoft,
        access_token: mc_access_token,
        refresh_token: ms_refresh_token.map(|s| s.to_string()),
        expires_at: Some(expires_at),
        skin_url,
        is_active: true,
        xuid: Some(uhs.to_string()),
    })
}

#[tauri::command]
pub fn poll_device_code_login(device_code: String) -> Result<DeviceCodePollResult, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {e}"))?;

    let res = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("client_id", MS_CLIENT_ID),
            ("device_code", &device_code),
        ])
        .send()
        .map_err(|e| format!("轮询设备授权状态失败: {e}"))?;

    let json: serde_json::Value = res.json().map_err(|e| format!("解析轮询返回失败: {e}"))?;

    if let Some(err) = json.get("error").and_then(|e| e.as_str()) {
        match err {
            "authorization_pending" => {
                return Ok(DeviceCodePollResult {
                    status: "pending".to_string(),
                    message: Some("等待用户在浏览器中完成授权...".to_string()),
                    account: None,
                });
            }
            "slow_down" => {
                return Ok(DeviceCodePollResult {
                    status: "pending".to_string(),
                    message: Some("轮询频率限制，正在等待...".to_string()),
                    account: None,
                });
            }
            "expired_token" => {
                return Ok(DeviceCodePollResult {
                    status: "expired".to_string(),
                    message: Some("设备验证码已过期，请重新点击添加".to_string()),
                    account: None,
                });
            }
            _ => {
                let desc = json.get("error_description").and_then(|d| d.as_str()).unwrap_or(err);
                if desc.contains("already been used") || desc.contains("AADSTS70000") {
                    let cache = get_accounts_cache();
                    let storage = cache.lock().unwrap();
                    if let Some(active_id) = &storage.active_account_id {
                        if let Some(acc) = storage.accounts.iter().find(|a| a.id == *active_id && a.account_type == AccountType::Microsoft) {
                            return Ok(DeviceCodePollResult {
                                status: "success".to_string(),
                                message: Some("微软正版账号验证成功！".to_string()),
                                account: Some(acc.clone()),
                            });
                        }
                    }
                }
                return Ok(DeviceCodePollResult {
                    status: "error".to_string(),
                    message: Some(format!("授权失败: {desc}")),
                    account: None,
                });
            }
        }
    }

    let ms_access_token = json["access_token"].as_str().ok_or("缺失微软 access_token")?;
    let ms_refresh_token = json["refresh_token"].as_str();

    // 成功获取微软 Token，执行后续 Xbox/Minecraft 验证链
    let account = execute_microsoft_chain(ms_access_token, ms_refresh_token)?;

    // 存入全局账号列表并持久化
    let cache = get_accounts_cache();
    let mut storage = cache.lock().unwrap();
    
    // Deactivate previous active accounts
    for acc in storage.accounts.iter_mut() {
        acc.is_active = false;
    }

    // Replace existing account with same ID or append
    if let Some(idx) = storage.accounts.iter().position(|a| a.id == account.id || a.uuid == account.uuid) {
        storage.accounts[idx] = account.clone();
    } else {
        storage.accounts.push(account.clone());
    }
    storage.active_account_id = Some(account.id.clone());
    save_accounts_to_disk(&storage);

    Ok(DeviceCodePollResult {
        status: "success".to_string(),
        message: Some("微软正版账号验证成功！".to_string()),
        account: Some(account),
    })
}

pub fn refresh_microsoft_token_if_needed(account: &mut Account) -> Result<bool, String> {
    if account.account_type != AccountType::Microsoft {
        return Ok(false);
    }

    let now = now_secs();
    if let Some(exp) = account.expires_at {
        if exp > now + 300 {
            // Token 仍有效（剩余时间大于 5 分钟），无需续期
            return Ok(false);
        }
    }

    let refresh_token = match &account.refresh_token {
        Some(rt) if !rt.is_empty() => rt,
        _ => return Err("微软账号缺失 RefreshToken，无法自动续期".to_string()),
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {e}"))?;

    let res = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", MS_CLIENT_ID),
            ("refresh_token", refresh_token),
            ("scope", "XboxLive.signin offline_access"),
        ])
        .send()
        .map_err(|e| format!("请求微软 Token 续期失败: {e}"))?;

    if !res.status().is_success() {
        let err_txt = res.text().unwrap_or_default();
        return Err(format!("Token 续期返回异常: {err_txt}"));
    }

    let json: serde_json::Value = res.json().map_err(|e| format!("解析 Token 续期返回失败: {e}"))?;
    let new_ms_token = json["access_token"].as_str().ok_or("缺失续期后的 access_token")?;
    let new_refresh_token = json["refresh_token"].as_str();

    let updated = execute_microsoft_chain(new_ms_token, new_refresh_token.or(Some(refresh_token)))?;
    account.access_token = updated.access_token;
    account.refresh_token = updated.refresh_token;
    account.expires_at = updated.expires_at;
    account.skin_url = updated.skin_url;
    account.name = updated.name;
    account.uuid = updated.uuid;

    Ok(true)
}

// ---------------- Tauri Commands for Account Management ----------------

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
    let active = storage
        .accounts
        .iter()
        .find(|a| a.is_active || Some(&a.id) == storage.active_account_id.as_ref())
        .cloned()
        .or_else(|| storage.accounts.first().cloned());
    Ok(active)
}

#[tauri::command]
pub fn create_offline_account(name: String) -> Result<Account, String> {
    let clean = name.trim();
    if clean.is_empty() {
        return Err("玩家名不能为空".to_string());
    }
    if clean.len() > 16 {
        return Err("玩家名长度不能超过 16 个字符".to_string());
    }

    let account = create_default_offline_account(clean);
    let cache = get_accounts_cache();
    let mut storage = cache.lock().unwrap();

    for acc in storage.accounts.iter_mut() {
        acc.is_active = false;
    }

    if let Some(idx) = storage.accounts.iter().position(|a| a.id == account.id) {
        storage.accounts[idx] = account.clone();
    } else {
        storage.accounts.push(account.clone());
    }
    storage.active_account_id = Some(account.id.clone());
    save_accounts_to_disk(&storage);

    Ok(account)
}

#[tauri::command]
pub fn set_active_account(id: String) -> Result<Vec<Account>, String> {
    let cache = get_accounts_cache();
    let mut storage = cache.lock().unwrap();

    let mut found = false;
    for acc in storage.accounts.iter_mut() {
        if acc.id == id {
            acc.is_active = true;
            found = true;
        } else {
            acc.is_active = false;
        }
    }

    if !found {
        return Err(format!("未找到 ID 为 {id} 的账号"));
    }

    storage.active_account_id = Some(id);
    save_accounts_to_disk(&storage);
    Ok(storage.accounts.clone())
}

#[tauri::command]
pub fn delete_account(id: String) -> Result<Vec<Account>, String> {
    let cache = get_accounts_cache();
    let mut storage = cache.lock().unwrap();

    let is_active = storage.accounts.iter().any(|a| a.id == id && a.is_active);
    if is_active && storage.accounts.len() > 1 {
        // If deleting active, switch active to another account
        storage.accounts.retain(|a| a.id != id);
        if let Some(first) = storage.accounts.first_mut() {
            first.is_active = true;
            storage.active_account_id = Some(first.id.clone());
        }
    } else {
        storage.accounts.retain(|a| a.id != id);
        if storage.accounts.is_empty() {
            let default_acc = create_default_offline_account("Steve");
            storage.active_account_id = Some(default_acc.id.clone());
            storage.accounts.push(default_acc);
        }
    }

    save_accounts_to_disk(&storage);
    Ok(storage.accounts.clone())
}

#[tauri::command]
pub fn refresh_account_token(id: String) -> Result<Account, String> {
    let cache = get_accounts_cache();
    let mut storage = cache.lock().unwrap();

    let idx = storage.accounts.iter().position(|a| a.id == id).ok_or_else(|| format!("未找到账号 {id}"))?;
    let mut acc = storage.accounts[idx].clone();

    if acc.account_type == AccountType::Microsoft {
        refresh_microsoft_token_if_needed(&mut acc)?;
        storage.accounts[idx] = acc.clone();
        save_accounts_to_disk(&storage);
    }

    Ok(acc)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ms_client_id_constant() {
        assert_eq!(MS_CLIENT_ID, "37c03091-93d8-4297-a59c-f3792cc080e0");
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
}

