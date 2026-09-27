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
