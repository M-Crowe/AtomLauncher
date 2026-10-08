use super::resolver::resolve_version_meta;
use super::types::{IntegrityReport, MissingAssetInfo, MissingLibraryInfo};
use std::path::Path;

pub fn check_game_integrity(
    game_dir: &Path,
    version_id: &str,
) -> IntegrityReport {
    let meta_res = resolve_version_meta(game_dir, version_id);
    let mut missing_libs = Vec::new();
    let mut missing_assets = Vec::new();
    let mut missing_version_jar = false;

    let version_jar = game_dir.join("versions").join(version_id).join(format!("{version_id}.jar"));
    if !version_jar.exists() {
        let mut found_parent_jar = false;
        if let Ok(ref meta) = meta_res {
            if meta.classpath_entries.iter().any(|p| {
                p.extension().map_or(false, |ext| ext == "jar")
                    && p.to_string_lossy().replace('\\', "/").contains("/versions/")
            }) {
                found_parent_jar = true;
            }
        }
        if !found_parent_jar {
            missing_version_jar = true;
        }
    }

    if let Ok(meta) = meta_res {
        if meta.classpath_entries.is_empty() {
            missing_libs.push(MissingLibraryInfo {
                name: "Minecraft Client Classpath Libraries".to_string(),
                path: game_dir.join("libraries").to_string_lossy().to_string(),
                url: None,
                sha1: None,
                size: None,
            });
        }

        // 检查 Assets 索引
        let index_file = game_dir.join("assets").join("indexes").join(format!("{}.json", meta.assets_index));
        if !index_file.exists() {
            missing_assets.push(MissingAssetInfo {
                name: format!("Asset Index: {}", meta.assets_index),
                path: index_file.to_string_lossy().to_string(),
                hash: "".to_string(),
                size: 0,
            });
        }
    }

    let total_missing = missing_libs.len() + missing_assets.len() + if missing_version_jar { 1 } else { 0 };

    IntegrityReport {
        is_complete: total_missing == 0,
        missing_libraries: missing_libs,
        missing_assets,
        missing_version_jar,
        total_missing_count: total_missing,
    }
}
