use atom_launcher_lib::core::resolver::parse_maven_coordinate;

#[test]
fn test_parse_maven_coordinate_standard() {
    let p = parse_maven_coordinate("org.lwjgl:lwjgl:3.3.3").unwrap();
    assert_eq!(p, "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar");
}

#[test]
fn test_parse_maven_coordinate_with_classifier() {
    let p = parse_maven_coordinate("org.lwjgl:lwjgl:3.3.3:natives-windows").unwrap();
    assert_eq!(p, "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar");
}

#[test]
fn test_parse_maven_coordinate_with_ext() {
    let p = parse_maven_coordinate("net.minecraftforge:forge:1.20.1-47.2.0@jar").unwrap();
    assert_eq!(
        p,
        "net/minecraftforge/forge/1.20.1-47.2.0/forge-1.20.1-47.2.0.jar"
    );

    let p2 = parse_maven_coordinate("com.example:test:1.0:client@zip").unwrap();
    assert_eq!(p2, "com/example/test/1.0/test-1.0-client.zip");
}
