use atom_launcher_lib::core::downloader::{
    compute_sha1, resolve_version_install_plan, transform_download_url, VersionManifest,
};

#[test]
fn test_sha1_standard_vector() {
    let text = b"The quick brown fox jumps over the lazy dog";
    assert_eq!(
        compute_sha1(text),
        "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12"
    );

    // 标准空字符串 SHA-1 向量测试
    assert_eq!(
        compute_sha1(b""),
        "da39a3ee5e6b4b0d3255bfef95601890afd80709"
    );
}

#[test]
fn test_transform_download_url_mojang_official() {
    let official_url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
    assert_eq!(
        transform_download_url(official_url, "official"),
        official_url
    );
    assert_eq!(
        transform_download_url(official_url, "mojang"),
        official_url
    );
}

#[test]
fn test_transform_download_url_bmclapi_rules() {
    // 1. Client JAR
    let client_url = "https://piston-data.mojang.com/v1/objects/abc12345/client.jar";
    assert_eq!(
        transform_download_url(client_url, "bmclapi"),
        "https://bmclapi2.bangbang93.com/v1/objects/abc12345/client.jar"
    );

    // 2. Libraries
    let lib_url = "https://libraries.minecraft.net/com/mojang/authlib/1.5.25/authlib-1.5.25.jar";
    assert_eq!(
        transform_download_url(lib_url, "bmclapi"),
        "https://bmclapi2.bangbang93.com/maven/com/mojang/authlib/1.5.25/authlib-1.5.25.jar"
    );

    // 3. Asset Objects
    let asset_url = "https://resources.download.minecraft.net/a0/a0123456789";
    assert_eq!(
        transform_download_url(asset_url, "bmclapi"),
        "https://bmclapi2.bangbang93.com/assets/a0/a0123456789"
    );

    // 4. Manifest / Meta
    let meta_url = "https://piston-meta.mojang.com/v1/packages/1.20.4.json";
    assert_eq!(
        transform_download_url(meta_url, "bmclapi"),
        "https://bmclapi2.bangbang93.com/v1/packages/1.20.4.json"
    );
}

#[test]
fn test_transform_download_url_mcbbs_rules() {
    let client_url = "https://piston-data.mojang.com/v1/objects/abc12345/client.jar";
    assert_eq!(
        transform_download_url(client_url, "mcbbs"),
        "https://download.mcbbs.net/v1/objects/abc12345/client.jar"
    );

    let lib_url = "https://libraries.minecraft.net/com/mojang/authlib/1.5.25/authlib-1.5.25.jar";
    assert_eq!(
        transform_download_url(lib_url, "mcbbs"),
        "https://download.mcbbs.net/maven/com/mojang/authlib/1.5.25/authlib-1.5.25.jar"
    );
}

#[test]
fn test_uninstalled_version_plan_graceful() {
    let temp_dir = std::env::temp_dir().join("atom_test_empty_game_dir");
    let plan = tauri::async_runtime::block_on(resolve_version_install_plan(
        temp_dir.to_string_lossy().to_string(),
        "1.21.999-not-installed".to_string(),
        None,
        Some("bmclapi".to_string()),
    )).unwrap();

    assert!(!plan.is_complete);
    assert!(plan.missing_version_jar);
    assert_eq!(plan.total_missing_count, 1);
}

#[test]
fn test_manifest_deserialization_contract() {
    let sample = r#"{
        "latest": {
            "release": "1.21.1",
            "snapshot": "24w33a"
        },
        "versions": [
            {
                "id": "1.21.1",
                "type": "release",
                "url": "https://piston-meta.mojang.com/v1/packages/123/1.21.1.json",
                "time": "2024-08-08T00:00:00+00:00",
                "releaseTime": "2024-08-08T00:00:00+00:00",
                "sha1": "abcdef123456"
            }
        ]
    }"#;

    let manifest: VersionManifest = serde_json::from_str(sample).unwrap();
    assert_eq!(manifest.latest.release, "1.21.1");
    assert_eq!(manifest.latest.snapshot, "24w33a");
    assert_eq!(manifest.versions.len(), 1);
    assert_eq!(manifest.versions[0].id, "1.21.1");
    assert_eq!(manifest.versions[0].type_name, "release");
}
