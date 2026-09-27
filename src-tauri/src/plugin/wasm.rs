use std::fs;
use std::path::PathBuf;
use wasmtime::*;

#[tauri::command]
pub fn read_plugin_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("无法读取文件 [{path}]: {e}"))
}

#[tauri::command]
pub fn run_plugin_wasm(
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
