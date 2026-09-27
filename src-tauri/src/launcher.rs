pub mod java;
pub mod process;
pub mod scanner;
pub mod types;

pub use java::{detect_java_environments, get_java_info_from_executable, scan_java_in_directory};
pub use process::{
    format_elapsed_time, get_process_map, kill_minecraft_instance, launch_minecraft,
    verify_game_integrity,
};
pub use scanner::{
    get_system_minecraft_dirs, scan_minecraft_versions, scan_versions_in_directory,
};
pub use types::{
    ExitPayload, JavaRuntimeInfo, LaunchOptions, LaunchResult, LogPayload, MinecraftVersionInfo,
    ScanOptions, StartedPayload,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_minecraft_dirs_detection() {
        let dirs = get_system_minecraft_dirs();
        // On dev system, default APPDATA .minecraft should be discovered if exists
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
}
