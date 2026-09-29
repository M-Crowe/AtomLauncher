pub mod args;
pub mod downloader;
pub mod integrity;
pub mod paths;
pub mod resolver;
pub mod rules;
pub mod types;

pub use downloader::*;

pub use args::build_launch_arguments;
pub use integrity::check_game_integrity;
pub use paths::*;
pub use resolver::{
    extract_natives, infer_java_major_version, parse_maven_coordinate, parse_rules_from_json,
    resolve_version_meta,
};
pub use rules::evaluate_rules;
pub use types::{
    ArgumentEntry, ArgumentRule, IntegrityReport, LauncherFeatureFlags, MissingAssetInfo,
    MissingLibraryInfo, ResolvedVersionMeta,
};

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_java_version_inference() {
        assert_eq!(infer_java_major_version("26.3-snapshot", None), 25);
        assert_eq!(infer_java_major_version("1.21.1", None), 21);
        assert_eq!(infer_java_major_version("1.20.4", None), 17);
        assert_eq!(infer_java_major_version("1.17.1", None), 16);
        assert_eq!(infer_java_major_version("1.12.2", None), 8);
    }

    #[test]
    fn test_build_launch_arguments_module_opens() {
        let meta = ResolvedVersionMeta {
            id: "1.20.4".to_string(),
            main_class: "net.minecraft.client.main.Main".to_string(),
            java_major_version: 17,
            assets_index: "1.20".to_string(),
            classpath_entries: vec![PathBuf::from("dummy.jar")],
            jvm_args_entries: Vec::new(),
            game_args_entries: Vec::new(),
            loader_type: "vanilla".to_string(),
        };

        let (jvm_flags, game_flags) = build_launch_arguments(
            &meta,
            &PathBuf::from(".minecraft"),
            &PathBuf::from(".minecraft/versions/1.20.4"),
            17,
            "Steve",
            "5627dd98-e6be-3c21-b8a8-e92344183641",
            "test_token",
            "mojang",
            "0",
            Some(1920),
            Some(1080),
            true,
        );

        assert!(jvm_flags.iter().any(|f| f == "--add-opens=java.base/java.lang=ALL-UNNAMED"));
        assert!(jvm_flags.iter().any(|f| f == "--add-opens=java.base/jdk.internal.misc=ALL-UNNAMED"));
        assert!(game_flags.contains(&"--username".to_string()));
        assert!(game_flags.contains(&"Steve".to_string()));
        assert!(game_flags.contains(&"--width".to_string()));
        assert!(game_flags.contains(&"1920".to_string()));
        assert!(game_flags.contains(&"--fullscreen".to_string()));
    }
}
