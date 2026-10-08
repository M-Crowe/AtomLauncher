use atom_launcher_lib::core::args::build_launch_arguments;
use atom_launcher_lib::core::types::{ArgumentEntry, ArgumentRule, ResolvedVersionMeta};
use std::collections::HashMap;

#[test]
fn test_quick_play_path_arguments_excluded() {
    let mut feat_map = HashMap::new();
    feat_map.insert("is_quick_play_path".to_string(), true);

    let qp_rule = ArgumentRule {
        action: "allow".to_string(),
        os_name: None,
        os_version: None,
        os_arch: None,
        is_demo_user: None,
        has_custom_resolution: None,
        is_quick_play_singleplayer: None,
        is_quick_play_multiplayer: None,
        is_quick_play_realms: None,
        is_quick_play_path: Some(true),
        features: feat_map,
    };

    let meta = ResolvedVersionMeta {
        id: "26.3".to_string(),
        main_class: "net.minecraft.client.main.Main".to_string(),
        java_major_version: 25,
        assets_index: "26".to_string(),
        classpath_entries: vec![],
        jvm_args_entries: vec![],
        game_args_entries: vec![
            ArgumentEntry {
                values: vec!["--username".to_string(), "${auth_player_name}".to_string()],
                rules: vec![],
            },
            ArgumentEntry {
                values: vec![
                    "--quickPlayPath".to_string(),
                    "${quick_play_path}".to_string(),
                ],
                rules: vec![qp_rule],
            },
        ],
        loader_type: "vanilla".to_string(),
    };

    let game_dir = std::path::PathBuf::from("dummy_game");
    let work_dir = std::path::PathBuf::from("dummy_work");
    let (_jvm, game) = build_launch_arguments(
        &meta,
        &game_dir,
        &work_dir,
        meta.java_major_version,
        "Steve",
        "00000000-0000-0000-0000-000000000000",
        "dummy_token",
        "mojang",
        "0",
        None,
        None,
        false,
    );

    // --quickPlayPath MUST NOT be included!
    assert!(!game.contains(&"--quickPlayPath".to_string()));
    assert!(game.contains(&"--username".to_string()));
    assert!(game.contains(&"Steve".to_string()));
}

#[test]
fn test_unresolved_placeholder_atomic_skip() {
    // Even if rules are empty, an unreplaced pair like ["--customFlag", "${unresolved_var}"]
    // must be discarded atomically to prevent joptsimple ArgumentAcceptingOptionSpec crash
    let meta = ResolvedVersionMeta {
        id: "26.3".to_string(),
        main_class: "net.minecraft.client.main.Main".to_string(),
        java_major_version: 25,
        assets_index: "26".to_string(),
        classpath_entries: vec![],
        jvm_args_entries: vec![],
        game_args_entries: vec![ArgumentEntry {
            values: vec![
                "--customFlag".to_string(),
                "${unresolved_var}".to_string(),
            ],
            rules: vec![],
        }],
        loader_type: "vanilla".to_string(),
    };

    let game_dir = std::path::PathBuf::from("dummy_game");
    let work_dir = std::path::PathBuf::from("dummy_work");
    let (_jvm, game) = build_launch_arguments(
        &meta,
        &game_dir,
        &work_dir,
        meta.java_major_version,
        "Steve",
        "00000000-0000-0000-0000-000000000000",
        "dummy_token",
        "mojang",
        "0",
        None,
        None,
        false,
    );

    assert!(!game.contains(&"--customFlag".to_string()));
}

#[test]
fn test_forge_multi_add_opens_and_exports_handling() {
    let meta = ResolvedVersionMeta {
        id: "MC Eternal 2".to_string(),
        main_class: "cpw.mods.bootstraplauncher.BootstrapLauncher".to_string(),
        java_major_version: 17,
        assets_index: "5".to_string(),
        classpath_entries: vec![],
        jvm_args_entries: vec![
            ArgumentEntry {
                values: vec!["-DlibraryDirectory=${library_directory}".to_string()],
                rules: vec![],
            },
            ArgumentEntry {
                values: vec![
                    "-p".to_string(),
                    "${library_directory}/cpw/mods/bootstraplauncher.jar".to_string(),
                ],
                rules: vec![],
            },
            ArgumentEntry {
                values: vec!["--add-modules".to_string(), "ALL-MODULE-PATH".to_string()],
                rules: vec![],
            },
            ArgumentEntry {
                values: vec![
                    "--add-opens".to_string(),
                    "java.base/java.util.jar=cpw.mods.securejarhandler".to_string(),
                ],
                rules: vec![],
            },
            ArgumentEntry {
                values: vec![
                    "--add-opens".to_string(),
                    "java.base/java.lang.invoke=cpw.mods.securejarhandler".to_string(),
                ],
                rules: vec![],
            },
            ArgumentEntry {
                values: vec![
                    "--add-exports".to_string(),
                    "java.base/sun.security.util=cpw.mods.securejarhandler".to_string(),
                ],
                rules: vec![],
            },
        ],
        game_args_entries: vec![],
        loader_type: "forge".to_string(),
    };

    let game_dir = std::path::PathBuf::from("D:/MineCraft/.minecraft");
    let work_dir = std::path::PathBuf::from("D:/MineCraft/.minecraft/versions/MC Eternal 2");
    let (jvm, _game) = build_launch_arguments(
        &meta,
        &game_dir,
        &work_dir,
        meta.java_major_version,
        "Player",
        "00000000-0000-0000-0000-000000000000",
        "dummy_token",
        "mojang",
        "0",
        None,
        None,
        false,
    );

    // 1. Both --add-opens MUST be formatted as single-token --add-opens=...
    assert!(jvm.contains(&"--add-opens=java.base/java.util.jar=cpw.mods.securejarhandler".to_string()));
    assert!(jvm.contains(&"--add-opens=java.base/java.lang.invoke=cpw.mods.securejarhandler".to_string()));
    assert!(jvm.contains(&"--add-exports=java.base/sun.security.util=cpw.mods.securejarhandler".to_string()));
    assert!(jvm.contains(&"--add-modules=ALL-MODULE-PATH".to_string()));

    // 2. NO naked target without prefix must exist!
    assert!(!jvm.contains(&"java.base/java.lang.invoke=cpw.mods.securejarhandler".to_string()));
    assert!(!jvm.contains(&"--add-opens".to_string()));
    assert!(!jvm.contains(&"--add-exports".to_string()));
    assert!(!jvm.contains(&"--add-modules".to_string()));

    // 3. -p and module path must be paired
    let p_idx = jvm.iter().position(|x| x == "-p").expect("Must contain -p");
    assert_eq!(
        jvm[p_idx + 1],
        format!("{}/cpw/mods/bootstraplauncher.jar", game_dir.join("libraries").to_string_lossy())
    );
}
