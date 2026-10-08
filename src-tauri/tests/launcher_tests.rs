use atom_launcher_lib::launcher::{
    format_elapsed_time, get_system_minecraft_dirs, ScanOptions,
};

#[test]
fn test_system_minecraft_dirs_detection() {
    let dirs = get_system_minecraft_dirs();
    println!("Discovered system MC dirs: {:?}", dirs);
}

#[test]
fn test_elapsed_time_formatting() {
    let dur = std::time::Duration::from_secs(3665);
    let formatted = format_elapsed_time(dur);
    assert!(formatted.starts_with("01:01:05"));
}

#[test]
fn test_scan_options_serde() {
    let opts = ScanOptions {
        game_dir: Some(".minecraft".to_string()),
        scan_system_dirs: true,
        custom_dirs: vec!["D:/games/.minecraft".to_string()],
    };
    let json = serde_json::to_string(&opts).unwrap();
    assert!(json.contains("gameDir"));
    assert!(json.contains("scanSystemDirs"));
    assert!(json.contains("customDirs"));
}
