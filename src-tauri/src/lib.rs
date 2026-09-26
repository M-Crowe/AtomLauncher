use std::fs;
use std::path::PathBuf;
use tauri::http::{Response, StatusCode};
use wasmtime::*;

// 1. 定义读取插件文本文件的 Command
#[tauri::command]
fn read_plugin_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("无法读取文件 [{path}]: {e}"))
}

// 2. 之前定义的 WASM 执行 Command
#[tauri::command]
fn run_plugin_wasm(
    plugin_dir: String,
    wasm_file: String,
    func_name: String,
    a: i32,
    b: i32,
) -> Result<i32, String> {
    println!("\n=== [Rust] 收到 WASM 调用请求 ===");
    let wasm_path = PathBuf::from(&plugin_dir).join(&wasm_file);
    let wasm_bytes = fs::read(&wasm_path).map_err(|e| format!("读取 Wasm 失败: {e}"))?;

    let engine = Engine::default();
    let mut store = Store::new(&engine, ());
    let module = Module::new(&engine, &wasm_bytes).map_err(|e| format!("编译 Wasm 失败: {e}"))?;
    let instance = Instance::new(&mut store, &module, &[]).map_err(|e| format!("实例化失败: {e}"))?;

    let func = instance
        .get_typed_func::<(i32, i32), i32>(&mut store, &func_name)
        .map_err(|e| format!("找不到函数: {e}"))?;

    let res = func.call(&mut store, (a, b)).map_err(|e| format!("计算失败: {e}"))?;
    println!("✅ [Rust] WASM 计算成功，结果: {}", res);
    Ok(res)
}

pub mod launcher;
use launcher::{
    detect_java_environments, kill_minecraft_instance, launch_minecraft, scan_minecraft_versions,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        //注册自定义资源协议
        .register_uri_scheme_protocol("plugin-asset", |_app, request|{
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
                    .unwrap_or_else(|_| Response::builder().status(StatusCode::INTERNAL_SERVER_ERROR).body(vec![]).unwrap())
            }else {
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
            launch_minecraft,
            kill_minecraft_instance
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
