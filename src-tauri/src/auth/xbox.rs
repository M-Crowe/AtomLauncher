use super::storage::now_secs;
use super::types::{Account, AccountType};

pub fn execute_microsoft_chain(ms_access_token: &str, ms_refresh_token: Option<&str>) -> Result<Account, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {e}"))?;

    let rps_ticket = if ms_access_token.starts_with("d=") {
        ms_access_token.to_string()
    } else {
        format!("d={ms_access_token}")
    };

    // 1. Xbox Live Authenticate
    let xbl_res = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": rps_ticket
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        }))
        .send()
        .map_err(|e| format!("Xbox Live 身份验证网络请求失败: {e}"))?;

    if !xbl_res.status().is_success() {
        let txt = xbl_res.text().unwrap_or_default();
        return Err(format!("Xbox Live 验证异常: {txt}"));
    }

    let xbl_json: serde_json::Value = xbl_res.json().map_err(|e| format!("解析 Xbox Live 响应失败: {e}"))?;
    let xbl_token = xbl_json["Token"].as_str().ok_or("缺失 Xbox Live Token")?;
    let uhs = xbl_json["DisplayClaims"]["xui"][0]["uhs"]
        .as_str()
        .ok_or("缺失 Xbox Live UHS")?;
    let xid = xbl_json["DisplayClaims"]["xui"][0]["xid"]
        .as_str()
        .or_else(|| xbl_json["DisplayClaims"]["xui"][0]["xuid"].as_str())
        .unwrap_or(uhs)
        .to_string();

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
        xuid: Some(xid),
    })
}
