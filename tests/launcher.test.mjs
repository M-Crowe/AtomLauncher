import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  scanMinecraftVersions,
  launchMinecraft,
  killMinecraftInstance,
} from '../src/utils/launcherService.ts';

test('R4. Multi-directory version scanning service contract', async () => {
  // 1. 扫描版本服务测试
  const options = {
    gameDir: 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft',
    scanSystemDirs: true,
    customDirs: ['D:\\CustomMinecraft\\.minecraft'],
  };

  const versions = await scanMinecraftVersions(options);
  assert.ok(Array.isArray(versions), 'Versions returns an array');
  assert.ok(versions.length >= 3, 'Discovers versions including 1.20.4, 1.21.1, 1.16.5');

  const v1204 = versions.find((v) => v.id === '1.20.4');
  assert.ok(v1204, 'Version 1.20.4 found');
  assert.equal(v1204.loaderType, 'vanilla');
  assert.equal(v1204.sourceLabel, '默认目录');
  assert.ok(v1204.isValid, '1.20.4 is valid');

  const vFabric = versions.find((v) => v.id.includes('fabric'));
  assert.ok(vFabric, 'Fabric version found');
  assert.equal(vFabric.loaderType, 'fabric');

  const vForge = versions.find((v) => v.id.includes('forge'));
  assert.ok(vForge, 'Forge version found');
  assert.equal(vForge.loaderType, 'forge');
});

test('R1. Launch State Machine and Process Lifecycle', async () => {
  // 1. 测试拉起 Minecraft
  const launchOptions = {
    versionId: '1.20.4',
    gameDir: 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft',
    javaPath: 'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.2.13-hotspot\\bin\\javaw.exe',
    allocatedMemoryMb: 4096,
    minMemoryMb: 1024,
    jvmArgs: '-XX:+UseG1GC',
    fullscreen: false,
    windowWidth: 854,
    windowHeight: 480,
    versionIsolation: true,
  };

  const result = await launchMinecraft(launchOptions);
  assert.ok(result.pid > 0, 'Launch returns valid PID');
  assert.equal(result.versionId, '1.20.4');
  assert.ok(result.commandSummary.includes('1.20.4'), 'Command summary contains version ID');
  assert.ok(result.commandSummary.includes('-Xmx4096M'), 'Command summary contains memory limit');

  // 2. 测试终止进程
  const killed = await killMinecraftInstance(result.pid);
  assert.equal(killed, true, 'Process kill succeeds');
});

test('R2. LaunchButtonGroup dual-split layout and UI contracts', () => {
  const content = readFileSync(resolve('src/components/LaunchButtonGroup.tsx'), 'utf-8');

  // 验证双分块布局 (Grid 第一列大主按钮，第二列小设置按钮)
  assert.ok(content.includes('grid-cols-[1fr_56px]'), 'Dual split grid column definition');
  assert.ok(content.includes('data-testid="main-launch-button"'), 'Includes main launch button');
  assert.ok(content.includes('data-testid="quick-settings-button"'), 'Includes quick settings secondary button');

  // 验证状态机文本映射
  assert.ok(content.includes('检查环境中...'), 'Displays checking state text');
  assert.ok(content.includes('正在拉起...'), 'Displays launching state text');
  assert.ok(content.includes('运行中 · 强制结束'), 'Displays running kill state text');
  assert.ok(content.includes('游戏崩溃 · 点击重试'), 'Displays crashed retry state text');
  assert.ok(content.includes('已退出 · 重新启动'), 'Displays exited restart state text');
});

test('R3. LogView system: level highlighting, filtering, autoscroll and controls', () => {
  const content = readFileSync(resolve('src/components/LogView.tsx'), 'utf-8');

  // 验证顶部控制栏与操作按钮
  assert.ok(content.includes('data-testid="log-back-button"'), 'Includes back button');
  assert.ok(content.includes('返回启动器'), 'Includes back button text');
  assert.ok(content.includes('data-testid="log-search-input"'), 'Includes search input');
  assert.ok(content.includes('data-testid="log-autoscroll-toggle"'), 'Includes auto-scroll toggle');
  assert.ok(content.includes('data-testid="log-kill-button"'), 'Includes kill process button in log view');
  assert.ok(content.includes('清空'), 'Includes clear log button');
  assert.ok(content.includes('复制全部'), 'Includes copy all button');

  // 验证色彩高亮与日志级别
  assert.ok(content.includes('INFO'), 'Supports INFO level');
  assert.ok(content.includes('WARN'), 'Supports WARN level');
  assert.ok(content.includes('ERROR'), 'Supports ERROR level');
  assert.ok(content.includes('DEBUG'), 'Supports DEBUG level');
  assert.ok(content.includes('data-testid="log-scroll-container"'), 'Includes log scroll container');
});

test('R4. SettingsView multi-directory scanning and custom directory management', () => {
  const content = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 验证多目录扫描独立开关与自定义目录
  assert.ok(content.includes('data-testid="scan-system-dirs-toggle"'), 'Includes system dirs scan toggle');
  assert.ok(content.includes('扫描系统其他常用 .minecraft 目录'), 'Includes scan system dirs label');
  assert.ok(content.includes('data-testid="add-custom-dir-button"'), 'Includes add custom dir button');
  assert.ok(content.includes('自定义 .minecraft 目录扫描列表'), 'Includes custom dirs section');
});

test('R1 & R3. App integration: dual launch button, log status indicator, instance selection', () => {
  const content = readFileSync(resolve('src/App.tsx'), 'utf-8');

  // 验证主页面集成
  assert.ok(content.includes('LaunchButtonGroup'), 'Hosts LaunchButtonGroup');
  assert.ok(content.includes('LogView'), 'Hosts LogView');
  assert.ok(content.includes('data-testid="bottom-log-status-button"'), 'Includes bottom-left log status entry button');
  assert.ok(content.includes('实时日志'), 'Includes real-time log entry label');
  assert.ok(content.includes('实例列表'), 'Includes instance list header');
});

test('Rust backend launcher module source code checks', () => {
  const launcherRs = readFileSync(resolve('src-tauri/src/launcher.rs'), 'utf-8');
  assert.ok(launcherRs.includes('pub fn scan_minecraft_versions'), 'Rust exports scan_minecraft_versions command');
  assert.ok(launcherRs.includes('pub fn detect_java_environments'), 'Rust exports detect_java_environments command');
  assert.ok(launcherRs.includes('pub fn launch_minecraft'), 'Rust exports launch_minecraft command');
  assert.ok(launcherRs.includes('pub fn kill_minecraft_instance'), 'Rust exports kill_minecraft_instance command');
  assert.ok(launcherRs.includes('minecraft-log'), 'Rust emits minecraft-log event');
  assert.ok(launcherRs.includes('minecraft-exit'), 'Rust emits minecraft-exit event');
  assert.ok(launcherRs.includes('minecraft-started'), 'Rust emits minecraft-started event');

  const libRs = readFileSync(resolve('src-tauri/src/lib.rs'), 'utf-8');
  assert.ok(libRs.includes('pub mod launcher;'), 'lib.rs imports launcher module');
  assert.ok(libRs.includes('scan_minecraft_versions'), 'lib.rs registers scan_minecraft_versions');
  assert.ok(libRs.includes('detect_java_environments'), 'lib.rs registers detect_java_environments');
  assert.ok(libRs.includes('launch_minecraft'), 'lib.rs registers launch_minecraft');
  assert.ok(libRs.includes('kill_minecraft_instance'), 'lib.rs registers kill_minecraft_instance');
});

test('R1 & R4. Java path and target gameDir resolution for multi-directory instances', async () => {
  const { getEffectiveJavaPath, DEFAULT_SETTINGS, DEFAULT_JAVA_RUNTIMES } = await import('../src/utils/settingsStorage.ts');
  
  // 1. 默认设置下自动解析检测到的 Java 21 绝对路径 (而非裸 javaw)
  const effectiveJava = getEffectiveJavaPath(DEFAULT_SETTINGS, DEFAULT_JAVA_RUNTIMES);
  assert.ok(effectiveJava.includes('jdk-21') || effectiveJava.includes('javaw.exe'), 'Resolves full Java runtime path');

  // 2. 自定义 Java 路径优先级
  const customSettings = {
    ...DEFAULT_SETTINGS,
    useCustomJava: true,
    customJavaPath: 'D:\\Java\\custom-jdk-17\\bin\\javaw.exe',
  };
  const customEffective = getEffectiveJavaPath(customSettings, DEFAULT_JAVA_RUNTIMES);
  assert.equal(customEffective, 'D:\\Java\\custom-jdk-17\\bin\\javaw.exe');
});


