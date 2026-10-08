use super::storage::{get_accounts_cache, now_secs, save_accounts_to_disk};
use super::types::{Account, AccountType, DeviceCodePollResult, DeviceCodeResponse, MS_CLIENT_ID, MS_SCOPE};
use super::xbox::execute_microsoft_chain;

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
            ("scope", MS_SCOPE),
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
    let account = match execute_microsoft_chain(ms_access_token, ms_refresh_token) {
        Ok(acc) => acc,
        Err(e) => {
            eprintln!("[Microsoft Auth 验证链异常]: {e}");
            return Ok(DeviceCodePollResult {
                status: "error".to_string(),
                message: Some(format!("正版验证失败: {e}")),
                account: None,
            });
        }
    };

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
            ("scope", MS_SCOPE),
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

#[tauri::command]
pub fn refresh_account_token(account_id: String) -> Result<Account, String> {
    let cache = get_accounts_cache();
    let mut storage = cache.lock().unwrap();

    let acc = storage
        .accounts
        .iter_mut()
        .find(|a| a.id == account_id)
        .ok_or_else(|| format!("未找到账号: {account_id}"))?;

    let _ = refresh_microsoft_token_if_needed(acc)?;
    let cloned = acc.clone();
    save_accounts_to_disk(&storage);
    Ok(cloned)
}
