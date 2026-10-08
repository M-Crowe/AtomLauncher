use super::types::{ArgumentRule, LauncherFeatureFlags};

pub fn evaluate_rules(rules: &[ArgumentRule], features: &LauncherFeatureFlags) -> bool {
    if rules.is_empty() {
        return true;
    }

    let mut result = false;

    for rule in rules {
        let mut matches = true;

        // 1. OS Matching
        if let Some(target_os) = &rule.os_name {
            let current_os = if cfg!(target_os = "windows") {
                "windows"
            } else if cfg!(target_os = "macos") {
                "osx"
            } else if cfg!(target_os = "linux") {
                "linux"
            } else {
                "unknown"
            };

            if target_os != current_os {
                matches = false;
            }
        }

        // 2. OS Arch Matching
        if let Some(target_arch) = &rule.os_arch {
            let current_arch = if cfg!(target_arch = "x86_64") {
                "x64"
            } else if cfg!(target_arch = "x86") {
                "x86"
            } else if cfg!(target_arch = "aarch64") {
                "arm64"
            } else {
                "unknown"
            };

            if target_arch != current_arch && target_arch != "x86_64" {
                matches = false;
            }
        }

        // 3. Demo User Matching
        if let Some(demo) = rule.is_demo_user {
            if demo != features.is_demo_user {
                matches = false;
            }
        }

        // 4. Custom Resolution Matching
        if let Some(has_res) = rule.has_custom_resolution {
            if has_res != features.has_custom_resolution {
                matches = false;
            }
        }

        // 5. Quick Play Singleplayer Matching
        if let Some(qp_sp) = rule.is_quick_play_singleplayer {
            if qp_sp != features.is_quick_play_singleplayer {
                matches = false;
            }
        }

        // 6. Quick Play Multiplayer Matching
        if let Some(qp_mp) = rule.is_quick_play_multiplayer {
            if qp_mp != features.is_quick_play_multiplayer {
                matches = false;
            }
        }

        // 7. Quick Play Realms Matching
        if let Some(qp_realms) = rule.is_quick_play_realms {
            if qp_realms != features.is_quick_play_realms {
                matches = false;
            }
        }

        // 8. Quick Play Path Matching
        if let Some(qp_path) = rule.is_quick_play_path {
            if qp_path != features.is_quick_play_path {
                matches = false;
            }
        }

        // 9. Generic Features Map Matching (Mojang standard)
        for (feat_name, &expected_val) in &rule.features {
            let actual_val = match feat_name.as_str() {
                "is_demo_user" => features.is_demo_user,
                "has_custom_resolution" => features.has_custom_resolution,
                "is_quick_play_singleplayer" => features.is_quick_play_singleplayer,
                "is_quick_play_multiplayer" => features.is_quick_play_multiplayer,
                "is_quick_play_realms" => features.is_quick_play_realms,
                "is_quick_play_path" => features.is_quick_play_path,
                _ => false, // 未在启动器中显式启用的未知/新特性，默认不匹配
            };
            if expected_val != actual_val {
                matches = false;
                break;
            }
        }

        if matches {
            if rule.action == "allow" {
                result = true;
            } else if rule.action == "disallow" {
                result = false;
            }
        }
    }

    result
}
