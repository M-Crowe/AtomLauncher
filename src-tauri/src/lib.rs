use std::fs;
use std::path::PathBuf;
use tauri::http::{Response, StatusCode};

pub mod auth;
pub mod core;
pub mod launcher;
pub mod plugin;

use auth::{
    create_offline_account, delete_account, get_accounts, get_active_account,
    poll_device_code_login, refresh_account_token, set_active_account, start_device_code_login,
};
use launcher::{
    detect_java_environments, get_atom_directory, get_launcher_init_state, kill_minecraft_instance,
    launch_minecraft, load_launcher_config, pick_file, pick_folder, save_init_configuration,
    save_launcher_config, scan_minecraft_versions, set_atom_directory, verify_game_integrity,
};
use plugin::{read_plugin_file, run_plugin_wasm};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // 注册自定义资源协议 plugin-asset
        .register_uri_scheme_protocol("plugin-asset", |_app, request| {
            let uri_path = request.uri().path();
            let clean_path = if cfg!(windows) && uri_path.starts_with('/') {
                &uri_path[1..]
            } else {
                uri_path
            };

            let local_path = PathBuf::from(clean_path);

            if let Ok(content) = fs::read(&local_path) {
                let mime = mime_guess::from_path(&local_path).first_or_octet_stream();
                Response::builder()
                    .header("Content-Type", mime.as_ref())
                    .header("Access-Control-Allow-Origin", "*")
                    .body(content)
                    .unwrap_or_else(|_| {
                        Response::builder()
                            .status(StatusCode::INTERNAL_SERVER_ERROR)
                            .body(vec![])
                            .unwrap()
                    })
            } else {
                eprintln!("[plugin-asset 错误] 找不到本地文件: {:?}", local_path);
                Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(vec![])
                    .unwrap()
            }
        })
        .invoke_handler(tauri::generate_handler![
            run_plugin_wasm,
            read_plugin_file,
            scan_minecraft_versions,
            detect_java_environments,
            verify_game_integrity,
            launch_minecraft,
            kill_minecraft_instance,
            get_accounts,
            get_active_account,
            create_offline_account,
            set_active_account,
            delete_account,
            start_device_code_login,
            poll_device_code_login,
            refresh_account_token,
            get_launcher_init_state,
            save_init_configuration,
            get_atom_directory,
            set_atom_directory,
            load_launcher_config,
            save_launcher_config,
            pick_folder,
            pick_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
