use atom_launcher_lib::core::paths::{
    get_atom_dir, get_atom_pointer_path, get_default_atom_dir, get_default_minecraft_dir,
    set_atom_dir, TEST_LOCK,
};
use std::fs;

#[test]
fn test_default_minecraft_dir() {
    let dir = get_default_minecraft_dir();
    assert!(dir.to_string_lossy().contains(".minecraft"));
}

#[test]
fn test_atom_dir_pointer_mechanism() {
    let _lock = TEST_LOCK.lock().unwrap();
    let temp_dir = std::env::temp_dir().join(format!("atom_test_{}", uuid::Uuid::new_v4()));
    let _ = fs::create_dir_all(&temp_dir);

    let exe_dir = temp_dir.join("exe_dir");
    let _ = fs::create_dir_all(&exe_dir);
    std::env::set_var("ATOM_EXE_DIR", &exe_dir);

    let default_atom = get_default_atom_dir();
    assert_eq!(default_atom, exe_dir.join(".atom"));

    // Default get_atom_dir should be <exe_dir>/.atom
    let resolved = get_atom_dir();
    assert_eq!(resolved, default_atom);
    assert!(default_atom.join("logs").exists());
    assert!(default_atom.join("plugins").exists());

    // Redirect to custom dir
    let custom_dir = temp_dir.join("custom_atom_data");
    let res = set_atom_dir(&custom_dir).expect("set_atom_dir should succeed");
    assert_eq!(res, custom_dir);
    assert_eq!(get_atom_dir(), custom_dir);
    assert!(get_atom_pointer_path().exists());

    // Reset to default
    let res_default = set_atom_dir(&default_atom).expect("reset to default should succeed");
    assert_eq!(res_default, default_atom);
    assert_eq!(get_atom_dir(), default_atom);
    assert!(!get_atom_pointer_path().exists());

    // Cleanup
    std::env::remove_var("ATOM_EXE_DIR");
    let _ = fs::remove_dir_all(&temp_dir);
}
