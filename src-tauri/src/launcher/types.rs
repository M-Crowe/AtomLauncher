use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MinecraftVersionInfo {
    pub id: String,
    pub name: String,
    pub type_name: String,
    pub main_class: Option<String>,
    pub inherits_from: Option<String>,
    pub last_modified: Option<String>,
    pub source_path: String,
    pub source_label: String,
    pub json_path: String,
    pub jar_path: Option<String>,
    pub loader_type: String, // "vanilla" | "fabric" | "forge" | "neoforge" | "quilt" | "other"
    pub is_valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanOptions {
    pub game_dir: Option<String>,
    pub scan_system_dirs: bool,
    pub custom_dirs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchOptions {
    pub version_id: String,
    pub game_dir: String,
    pub java_path: String,
    pub allocated_memory_mb: u32,
    pub min_memory_mb: u32,
    pub jvm_args: Option<String>,
    pub fullscreen: Option<bool>,
    pub window_width: Option<u32>,
    pub window_height: Option<u32>,
    pub version_isolation: Option<bool>,
    pub username: Option<String>,
    pub uuid: Option<String>,
    pub access_token: Option<String>,
    pub user_type: Option<String>,
    pub xuid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResult {
    pub pid: u32,
    pub version_id: String,
    pub command_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogPayload {
    pub pid: u32,
    pub line: String,
    pub level: String,
    pub timestamp: String,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExitPayload {
    pub pid: u32,
    pub exit_code: Option<i32>,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartedPayload {
    pub pid: u32,
    pub version_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaRuntimeInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub version: String,
    pub major_version: u32,
    pub arch: String,
    pub vendor: String,
    pub recommended_for: String,
    pub is_auto_detected: bool,
    pub is_64bit: bool,
    pub is_recommended: bool,
}
