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

    // 1. Xbox Live Authenticate (与 Prism Launcher XboxUserStep 一致)
    let xbl_res = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .header("x-xbl-contract-version", "1")
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

    // 2. XSTS Authorize (与 Prism Launcher XboxAuthorizationStep 一致)
    let xsts_res = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .header("x-xbl-contract-version", "1")
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
            // Prism Launcher XboxAuthorizationStep 完整错误码映射
            let msg = match err_code {
                2148916227 => "该 Xbox 账号因违反服务条款/安全规定已被封禁",
                2148916229 => "家长监护限制：需要在 account.microsoft.com/family 中授权",
                2148916233 => "该微软账号尚未注册 Xbox 账户，请先在 xbox.com 完善账户",
                2148916234 => "尚未同意 Xbox 服务条款，请先访问 xbox.com 接受条款",
                2148916235 => "Xbox Live 服务在您所在的国家/地区不可用",
                2148916236 => "需要完成年龄验证: 请访问 login.live.com 完成",
                2148916237 => "该账号已达到游戏时间限制",
                2148916238 => "该微软账号为未成年人/家庭账号，需由家长在 account.microsoft.com/family 授权",
                _ => "",
            };
            if !msg.is_empty() {
                return Err(msg.to_string());
            }
            return Err(format!("XSTS 错误代码: {err_code}"));
        }
        return Err(format!("XSTS 授权失败: {xsts_json}"));
    }

    let xsts_token = xsts_json["Token"].as_str().ok_or("缺失 XSTS Token")?;

    // 验证 XSTS 返回的 UHS 与 Xbox User Token 的 UHS 一致（Prism 的安全校验）
    if let Some(xsts_uhs) = xsts_json["DisplayClaims"]["xui"][0]["uhs"].as_str() {
        if xsts_uhs != uhs {
            return Err("XSTS 令牌 UHS 与 Xbox Live 用户令牌 UHS 不匹配，请重新登录".to_string());
        }
    }

    // 3. Minecraft Launcher Login (与 Prism Launcher LauncherLoginStep 一致)
    // 注意：Prism 使用 /launcher/login 而非旧版 /authentication/login_with_xbox
    let mc_res = client
        .post("https://api.minecraftservices.com/launcher/login")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "xtoken": format!("XBL3.0 x={uhs};{xsts_token}"),
            "platform": "PC_LAUNCHER"
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

    // 4. Entitlements / License Check (与 Prism Launcher EntitlementsStep 一致)
    let request_id = uuid::Uuid::new_v4().to_string();
    let ent_res = client
        .get(format!("https://api.minecraftservices.com/entitlements/license?requestId={request_id}"))
        .header("Authorization", format!("Bearer {mc_access_token}"))
        .header("Accept", "application/json")
        .send();

    if let Ok(ent_resp) = ent_res {
        if ent_resp.status().is_success() {
            if let Ok(ent_json) = ent_resp.json::<serde_json::Value>() {
                let items = ent_json["items"].as_array();
                let has_game = items.map(|arr| {
                    arr.iter().any(|item| {
                        item["name"].as_str() == Some("game_minecraft")
                            || item["name"].as_str() == Some("product_minecraft")
                    })
                }).unwrap_or(false);

                if !has_game {
                    eprintln!("[AtomLauncher] 提示：许可证检查未发现 Minecraft 所有权条目 (可能为 Xbox Game Pass 用户或新购买用户，继续尝试)");
                }
            }
        }
    }

    // 5. Fetch Minecraft Profile (与 Prism Launcher MinecraftProfileStep 一致)
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
