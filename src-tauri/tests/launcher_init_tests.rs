use atom_launcher_lib::core::paths::TEST_LOCK;
use atom_launcher_lib::launcher::init::{
    get_launcher_init_state, load_launcher_config, save_init_configuration, save_launcher_config,
    LauncherInitConfig,
};
use std::fs;

#[test]
fn test_launcher_init_state_and_save() {
    let _lock = TEST_LOCK.lock().unwrap();
    let temp_dir = std::env::temp_dir().join(format!("atom_init_test_{}", uuid::Uuid::new_v4()));
    let _ = fs::create_dir_all(&temp_dir);
    std::env::set_var("ATOM_DATA_DIR", &temp_dir);

    // Before init: should be false
    let state_before = get_launcher_init_state();
    assert!(!state_before.initialized);
    assert_eq!(state_before.atom_dir, temp_dir.to_string_lossy());

    // Perform initialization
    let config = LauncherInitConfig {
        atom_dir: None,
        game_dir: "D:\\Minecraft\\.minecraft".to_string(),
        selected_java_id: Some("java-21-test".to_string()),
        java_path: Some("C:\\Java\\bin\\javaw.exe".to_string()),
        custom_java_path: None,
        offline_username: Some("Alex".to_string()),
        memory_mb: Some(4096),
    };

    save_init_configuration(config).expect("save_init_configuration should succeed");

    // After init: should be true
    let state_after = get_launcher_init_state();
    assert!(state_after.initialized);
    assert!(state_after.config.is_some());
    let val = state_after.config.unwrap();
    assert_eq!(val["gameDir"], "D:\\Minecraft\\.minecraft");
    assert_eq!(val["selectedJavaId"], "java-21-test");
    assert_eq!(val["javaPath"], "C:\\Java\\bin\\javaw.exe");
    assert_eq!(val["allocatedMemory"], 4096);

    // Test load and save config
    let mut loaded = load_launcher_config().expect("load_launcher_config should succeed");
    loaded["customDirs"] = serde_json::json!(["D:\\MC1", "D:\\MC2"]);
    save_launcher_config(loaded.clone()).expect("save_launcher_config should succeed");

    let reloaded = load_launcher_config().expect("reloaded should succeed");
    assert_eq!(reloaded["customDirs"], serde_json::json!(["D:\\MC1", "D:\\MC2"]));

    // Cleanup
    std::env::remove_var("ATOM_DATA_DIR");
    let _ = fs::remove_dir_all(&temp_dir);
}
