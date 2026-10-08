use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingLibraryInfo {
    pub name: String,
    pub path: String,
    pub url: Option<String>,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingAssetInfo {
    pub name: String,
    pub path: String,
    pub hash: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityReport {
    pub is_complete: bool,
    pub missing_libraries: Vec<MissingLibraryInfo>,
    pub missing_assets: Vec<MissingAssetInfo>,
    pub missing_version_jar: bool,
    pub total_missing_count: usize,
}

#[derive(Debug, Clone)]
pub struct ArgumentRule {
    pub action: String, // "allow" | "disallow"
    pub os_name: Option<String>,
    pub os_version: Option<String>,
    pub os_arch: Option<String>,
    pub is_demo_user: Option<bool>,
    pub has_custom_resolution: Option<bool>,
    pub is_quick_play_singleplayer: Option<bool>,
    pub is_quick_play_multiplayer: Option<bool>,
    pub is_quick_play_realms: Option<bool>,
    pub is_quick_play_path: Option<bool>,
    pub features: std::collections::HashMap<String, bool>,
}

#[derive(Debug, Clone)]
pub struct ArgumentEntry {
    pub values: Vec<String>,
    pub rules: Vec<ArgumentRule>,
}

#[derive(Debug, Clone)]
pub struct ResolvedVersionMeta {
    pub id: String,
    pub main_class: String,
    pub java_major_version: u32,
    pub assets_index: String,
    pub classpath_entries: Vec<PathBuf>,
    pub jvm_args_entries: Vec<ArgumentEntry>,
    pub game_args_entries: Vec<ArgumentEntry>,
    pub loader_type: String,
}

#[derive(Debug, Clone, Default)]
pub struct LauncherFeatureFlags {
    pub is_demo_user: bool,
    pub has_custom_resolution: bool,
    pub is_quick_play_singleplayer: bool,
    pub is_quick_play_multiplayer: bool,
    pub is_quick_play_realms: bool,
    pub is_quick_play_path: bool,
}
