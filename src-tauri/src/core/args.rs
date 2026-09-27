use super::rules::evaluate_rules;
use super::types::{LauncherFeatureFlags, ResolvedVersionMeta};
use std::path::Path;

pub fn build_launch_arguments(
    meta: &ResolvedVersionMeta,
    game_dir: &Path,
    work_dir: &Path,
    java_major: u32,
    username: &str,
    uuid: &str,
    access_token: &str,
    user_type: &str,
    xuid: &str,
    window_width: Option<u32>,
    window_height: Option<u32>,
    fullscreen: bool,
) -> (Vec<String>, Vec<String>) {
    let mut jvm_args = Vec::new();
    let mut game_args = Vec::new();

    let natives_dir = work_dir.join("natives");
    let assets_dir = game_dir.join("assets");

    // 1. 对于 Java 9+ (Java 16/17/21/25) 注入标准单标记格式的 --add-opens=... 与 --add-exports=...（防止参数拆分被误认为主类）
    if java_major >= 9 {
        let module_opens = [
            "java.base/java.lang=ALL-UNNAMED",
            "java.base/java.lang.invoke=ALL-UNNAMED",
            "java.base/java.lang.reflect=ALL-UNNAMED",
            "java.base/java.util=ALL-UNNAMED",
            "java.base/java.util.concurrent=ALL-UNNAMED",
            "java.base/sun.security.util=ALL-UNNAMED",
            "java.base/java.io=ALL-UNNAMED",
            "java.base/java.nio=ALL-UNNAMED",
            "java.base/sun.nio.ch=ALL-UNNAMED",
            "java.base/java.net=ALL-UNNAMED",
            "java.base/jdk.internal.misc=ALL-UNNAMED",
        ];

        for open in module_opens {
            let flag = format!("--add-opens={open}");
            if !jvm_args.contains(&flag) {
                jvm_args.push(flag);
            }
        }

        let exports = [
            "jdk.naming.dns/com.sun.jndi.dns=java.naming",
            "java.base/sun.security.util=ALL-UNNAMED",
        ];
        for exp in exports {
            let flag = format!("--add-exports={exp}");
            if !jvm_args.contains(&flag) {
                jvm_args.push(flag);
            }
        }
    }

    // 2. 基础 JVM 系统属性与控制台编码统一
    jvm_args.push(format!("-Djava.library.path={}", natives_dir.to_string_lossy()));
    jvm_args.push("-Dminecraft.launcher.brand=AtomLauncher".to_string());
    jvm_args.push("-Dminecraft.launcher.version=1.0.0".to_string());
    jvm_args.push("-Dfile.encoding=UTF-8".to_string());
    if java_major >= 9 {
        jvm_args.push("-Dsun.stdout.encoding=UTF-8".to_string());
        jvm_args.push("-Dsun.stderr.encoding=UTF-8".to_string());
    }

    // 3. 构建当前运行特性的 FeatureFlags
    let has_custom_res = window_width.is_some() || window_height.is_some();
    let runtime_features = LauncherFeatureFlags {
        is_demo_user: false,
        has_custom_resolution: has_custom_res,
        is_quick_play_singleplayer: false,
        is_quick_play_multiplayer: false,
        is_quick_play_realms: false,
        is_quick_play_path: false,
    };

    let cp_separator = if cfg!(windows) { ";" } else { ":" };
    let lib_dir = game_dir.join("libraries");

    // 4. 解析版本自带的 JVM 参数模板（过滤掉 standalone -cp / -classpath / ${classpath}，评估 rules，替换宏变量）
    for entry in &meta.jvm_args_entries {
        if !evaluate_rules(&entry.rules, &runtime_features) {
            continue;
        }

        let mut idx = 0;
        while idx < entry.values.len() {
            let arg = &entry.values[idx];
            if arg == "-cp" || arg == "-classpath" || arg == "${classpath}" {
                idx += 1;
                continue;
            }

            if arg == "--add-opens" && idx + 1 < entry.values.len() {
                let next = &entry.values[idx + 1];
                let flag = format!("--add-opens={next}");
                if !jvm_args.contains(&flag) {
                    jvm_args.push(flag);
                }
                idx += 2;
                continue;
            }

            if arg == "--add-exports" && idx + 1 < entry.values.len() {
                let next = &entry.values[idx + 1];
                let flag = format!("--add-exports={next}");
                if !jvm_args.contains(&flag) {
                    jvm_args.push(flag);
                }
                idx += 2;
                continue;
            }

            let mut replaced = arg.clone();
            replaced = replaced.replace("${natives_directory}", &natives_dir.to_string_lossy());
            replaced = replaced.replace("${launcher_name}", "AtomLauncher");
            replaced = replaced.replace("${launcher_version}", "1.0.0");
            replaced = replaced.replace("${library_directory}", &lib_dir.to_string_lossy());
            replaced = replaced.replace("${classpath_separator}", cp_separator);
            replaced = replaced.replace("${game_directory}", &work_dir.to_string_lossy());
            replaced = replaced.replace("${version_name}", &meta.id);

            if !replaced.is_empty() && !jvm_args.contains(&replaced) && !replaced.starts_with("${") {
                jvm_args.push(replaced);
            }
            idx += 1;
        }
    }

    // 5. 解析 Game 参数（根据 FeatureFlags 过滤掉未启用的 Quick Play / Demo 规则，替换模板变量）
    let width_str = window_width.unwrap_or(854).to_string();
    let height_str = window_height.unwrap_or(480).to_string();

    if !meta.game_args_entries.is_empty() {
        for entry in &meta.game_args_entries {
            if !evaluate_rules(&entry.rules, &runtime_features) {
                continue; // 彻底排除未启用的 Quick Play / Demo 选项！
            }

            let mut entry_args = Vec::new();
            let mut skip_entry = false;

            for val in &entry.values {
                let mut replaced = val.clone();
                replaced = replaced.replace("${auth_player_name}", username);
                replaced = replaced.replace("${version_name}", &meta.id);
                replaced = replaced.replace("${game_directory}", &work_dir.to_string_lossy());
                replaced = replaced.replace("${assets_root}", &assets_dir.to_string_lossy());
                replaced = replaced.replace("${assets_index_name}", &meta.assets_index);
                replaced = replaced.replace("${auth_uuid}", uuid);
                replaced = replaced.replace("${auth_access_token}", access_token);
                replaced = replaced.replace("${user_type}", user_type);
                replaced = replaced.replace("${version_type}", "AtomLauncher");
                replaced = replaced.replace("${clientid}", uuid);
                replaced = replaced.replace("${auth_xuid}", xuid);
                replaced = replaced.replace("${resolution_width}", &width_str);
                replaced = replaced.replace("${resolution_height}", &height_str);

                // 如果参数含有未被识别/未被替换的宏变量（如未启用的 ${quick_play_path}），说明当前启动配置不具备该参数所需的环境，
                // 必须放弃整组参数条目（如同时放弃 --quickPlayPath 与其参数），以防 joptsimple 报 OptionMissingRequiredArgumentException
                if replaced.starts_with("${") && replaced.ends_with('}') {
                    skip_entry = true;
                    break;
                }

                if !replaced.is_empty() {
                    entry_args.push(replaced);
                }
            }

            if !skip_entry {
                game_args.extend(entry_args);
            }
        }
    } else {
        // Fallback 标准经典游戏参数
        game_args.push("--username".to_string());
        game_args.push(username.to_string());
        game_args.push("--version".to_string());
        game_args.push(meta.id.clone());
        game_args.push("--gameDir".to_string());
        game_args.push(work_dir.to_string_lossy().to_string());
        game_args.push("--assetsDir".to_string());
        game_args.push(assets_dir.to_string_lossy().to_string());
        game_args.push("--assetIndex".to_string());
        game_args.push(meta.assets_index.clone());
        game_args.push("--uuid".to_string());
        game_args.push(uuid.to_string());
        game_args.push("--accessToken".to_string());
        game_args.push(access_token.to_string());
        game_args.push("--userType".to_string());
        game_args.push(user_type.to_string());
        game_args.push("--xuid".to_string());
        game_args.push(xuid.to_string());
        game_args.push("--versionType".to_string());
        game_args.push("AtomLauncher".to_string());
    }

    if let Some(w) = window_width {
        if !game_args.contains(&"--width".to_string()) {
            game_args.push("--width".to_string());
            game_args.push(w.to_string());
        }
    }
    if let Some(h) = window_height {
        if !game_args.contains(&"--height".to_string()) {
            game_args.push("--height".to_string());
            game_args.push(h.to_string());
        }
    }
    if fullscreen && !game_args.contains(&"--fullscreen".to_string()) {
        game_args.push("--fullscreen".to_string());
    }

    (jvm_args, game_args)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::types::{ArgumentEntry, ArgumentRule, ResolvedVersionMeta};
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
}
