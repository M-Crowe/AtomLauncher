import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getLauncherInitState,
  saveInitConfiguration,
  getAtomDirectory,
  setAtomDirectory,
  INIT_FALLBACK_KEY,
} from '../src/utils/initService.ts';

test('InitWizard R1. InitWizard component contracts, pixel theme & step structure', () => {
  const content = readFileSync(resolve('src/components/InitWizard.tsx'), 'utf-8');

  // 验证向导测试标识与像素主题
  assert.ok(content.includes('data-testid="init-wizard"'), 'Includes data-testid="init-wizard"');
  assert.ok(content.includes('font-fusion'), 'Uses pixel font-fusion');
  assert.ok(content.includes('ATOM'), 'Displays ATOM in title');
  assert.ok(content.includes('初始配置向导'), 'Displays subtitle');

  // 验证 4 大分步卡片
  assert.ok(content.includes('data-testid="init-step-1"'), 'Step 1: .atom storage config');
  assert.ok(content.includes('data-testid="init-step-2"'), 'Step 2: Account creation/login');
  assert.ok(content.includes('data-testid="init-step-3"'), 'Step 3: Game directory (.minecraft)');
  assert.ok(content.includes('data-testid="init-step-4"'), 'Step 4: Silent Java recommendation');

  // 验证导航与完成控制按钮
  assert.ok(content.includes('data-testid="init-next-btn"'), 'Includes next step button');
  assert.ok(content.includes('data-testid="init-prev-btn"'), 'Includes prev step button');
  assert.ok(content.includes('data-testid="init-complete-btn"'), 'Includes finish initialization button');
  assert.ok(content.includes('完成初始化并进入启动器'), 'Finish button text');
});

test('InitWizard R2. .atom portable directory specification and browse flow', () => {
  const content = readFileSync(resolve('src/components/InitWizard.tsx'), 'utf-8');

  // 验证步骤 1 便携存储说明与操作控件
  assert.ok(content.includes('data-testid="init-atom-dir-input"'), 'Includes atom dir text input');
  assert.ok(content.includes('data-testid="init-atom-browse-btn"'), 'Includes atom dir browse button');
  assert.ok(content.includes('[推荐 便携免安装模式]'), 'Highlights portable mode badge');
  assert.ok(content.includes('handleBrowseAtomDir'), 'Wires native browse handler');
  assert.ok(content.includes('config.json'), 'Mentions config.json storage');
  assert.ok(content.includes('accounts.json'), 'Mentions accounts.json storage');
});

test('InitWizard R3. Account setup: offline, Microsoft OAuth2 & guest skip', () => {
  const content = readFileSync(resolve('src/components/InitWizard.tsx'), 'utf-8');

  // 验证账号选项
  assert.ok(content.includes('快速离线角色'), 'Supports offline player mode');
  assert.ok(content.includes('微软正版账号'), 'Supports Microsoft official login');
  assert.ok(content.includes('稍后配置 / 游客'), 'Supports skip/guest mode');

  // 验证离线输入
  assert.ok(content.includes('data-testid="init-offline-name-input"'), 'Includes offline username input');

  // 验证微软设备代码登录
  assert.ok(content.includes('data-testid="init-ms-login-btn"'), 'Includes Microsoft login button');
  assert.ok(content.includes('startDeviceCodeLogin'), 'Calls startDeviceCodeLogin');
  assert.ok(content.includes('pollDeviceCodeLogin'), 'Calls pollDeviceCodeLogin');
});

test('InitWizard R4. Game directory & silent Java auto-recommendation', () => {
  const content = readFileSync(resolve('src/components/InitWizard.tsx'), 'utf-8');

  // 验证游戏目录选择
  assert.ok(content.includes('data-testid="init-game-dir-input"'), 'Includes game dir input');
  assert.ok(content.includes('data-testid="init-game-browse-btn"'), 'Includes game dir browse button');
  assert.ok(content.includes('scanMinecraftVersions'), 'Scans game versions in selected directory');

  // 验证静默后台 Java 扫描与优选
  assert.ok(content.includes('scanSystemJavaRuntimes'), 'Silently scans system Java in background');
  assert.ok(content.includes('⚡ 智能推荐'), 'Badges top recommended Java version');
  assert.ok(content.includes('majorVersion === 21'), 'Prefers Java 21 for modern Minecraft');
});

test('InitWizard R5. SettingsView .atom directory management integration', () => {
  const content = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 验证设置中心中查看和修改 .atom 目录
  assert.ok(content.includes('.atom 启动器核心数据目录'), 'Includes .atom directory section');
  assert.ok(content.includes('data-testid="settings-atom-dir-input"'), 'Includes settings atom-dir input');
  assert.ok(content.includes('data-testid="settings-atom-browse-button"'), 'Includes settings atom browse button');
  assert.ok(content.includes('data-testid="settings-atom-reset-button"'), 'Includes settings atom reset button');
  assert.ok(content.includes('handleBrowseAtomDir'), 'Wires atom browse handler');
  assert.ok(content.includes('handleResetAtomDir'), 'Wires atom reset handler');
  assert.ok(content.includes('handleBrowseGameDir'), 'Wires game directory native browse handler');
});

test('InitWizard R6. App.tsx initialization gate and seamless transition', () => {
  const content = readFileSync(resolve('src/App.tsx'), 'utf-8');

  // 验证初始化前拦截展示向导，初始化完成后切换主页
  assert.ok(content.includes('<InitWizard'), 'App mounts InitWizard');
  assert.ok(content.includes('getLauncherInitState'), 'App checks launcher initialization state');
  assert.ok(content.includes('isInitialized === false'), 'Renders InitWizard when not initialized');
  assert.ok(content.includes('setIsInitialized(true)'), 'Switches to main view on completion');
});

test('InitWizard R7. Rust backend .atom path management, storage migration & commands', () => {
  const pathsRs = readFileSync(resolve('src-tauri/src/core/paths.rs'), 'utf-8');
  assert.ok(pathsRs.includes('pub fn get_atom_dir'), 'paths.rs exports get_atom_dir');
  assert.ok(pathsRs.includes('pub fn set_atom_dir'), 'paths.rs exports set_atom_dir');
  assert.ok(pathsRs.includes('pub fn get_default_atom_dir'), 'paths.rs exports get_default_atom_dir');
  assert.ok(pathsRs.includes('pub fn get_default_minecraft_dir'), 'paths.rs exports get_default_minecraft_dir');
  assert.ok(pathsRs.includes('.atom_path'), 'paths.rs uses .atom_path redirect pointer');

  const storageRs = readFileSync(resolve('src-tauri/src/auth/storage.rs'), 'utf-8');
  assert.ok(storageRs.includes('crate::core::paths::get_atom_dir()'), 'Accounts resolve via get_atom_dir()');
  assert.ok(storageRs.includes('"accounts.json"'), 'Accounts stored under accounts.json');
  assert.ok(storageRs.includes('get_legacy_accounts_file_path'), 'Preserves legacy path detection for automatic migration');

  const initRs = readFileSync(resolve('src-tauri/src/launcher/init.rs'), 'utf-8');
  assert.ok(initRs.includes('pub fn get_launcher_init_state'), 'init.rs exports get_launcher_init_state');
  assert.ok(initRs.includes('pub fn save_init_configuration'), 'init.rs exports save_init_configuration');
  assert.ok(initRs.includes('pub fn pick_folder'), 'init.rs exports pick_folder');
  assert.ok(initRs.includes('config.json'), 'Saves to .atom/config.json');

  const libRs = readFileSync(resolve('src-tauri/src/lib.rs'), 'utf-8');
  assert.ok(libRs.includes('get_launcher_init_state'), 'lib.rs registers get_launcher_init_state');
  assert.ok(libRs.includes('save_init_configuration'), 'lib.rs registers save_init_configuration');
  assert.ok(libRs.includes('get_atom_directory'), 'lib.rs registers get_atom_directory');
  assert.ok(libRs.includes('set_atom_directory'), 'lib.rs registers set_atom_directory');
  assert.ok(libRs.includes('pick_folder'), 'lib.rs registers pick_folder');
});

test('InitWizard R8. initService CRUD and Fallback Resilience', async () => {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  };

  // 1. 初始未初始化
  const state1 = await getLauncherInitState();
  assert.equal(state1.initialized, false);
  assert.ok(state1.atom_dir.includes('.atom'));

  // 2. 保存初始化配置
  await saveInitConfiguration({
    atom_dir: 'D:\\AtomData\\.atom',
    game_dir: 'D:\\Minecraft\\.minecraft',
    offline_username: 'Player1',
  });
  assert.equal(store.get(INIT_FALLBACK_KEY), 'true');

  const state2 = await getLauncherInitState();
  assert.equal(state2.initialized, true);

  // 3. Atom 目录操作
  const currentAtom = await getAtomDirectory();
  assert.ok(currentAtom.includes('.atom'));
  const updated = await setAtomDirectory('D:\\NewAtom');
  assert.equal(updated, 'D:\\NewAtom');

  delete globalThis.window;
});

test('InitWizard R9. Settings synchronizer from .atom/config.json and native file picking', async () => {
  const { DEFAULT_SETTINGS, syncLauncherSettingsFromConfig, loadLauncherSettings } = await import(
    '../src/utils/settingsStorage.ts'
  );
  const { pickFile } = await import('../src/utils/initService.ts');

  // 1. 确保默认设置不硬编码开发人员个人路径
  assert.ok(!DEFAULT_SETTINGS.gameDir.includes('XuanY'), 'DEFAULT_SETTINGS does not hardcode personal dev path');

  // 2. 验证 syncLauncherSettingsFromConfig 同步 .atom/config.json 字段
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  };

  const synced = syncLauncherSettingsFromConfig({
    gameDir: 'D:\\Games\\Minecraft\\.minecraft',
    selectedJavaId: 'java-21-custom',
    customJavaPath: 'D:\\Java\\jdk-21\\bin\\javaw.exe',
    useCustomJava: true,
    allocatedMemory: 8192,
  });

  assert.equal(synced.gameDir, 'D:\\Games\\Minecraft\\.minecraft');
  assert.equal(synced.selectedJavaId, 'java-21-custom');
  assert.equal(synced.customJavaPath, 'D:\\Java\\jdk-21\\bin\\javaw.exe');
  assert.equal(synced.useCustomJava, true);
  assert.equal(synced.allocatedMemory, 8192);

  const reloaded = loadLauncherSettings();
  assert.equal(reloaded.gameDir, 'D:\\Games\\Minecraft\\.minecraft');

  // 3. 验证 pickFile 导出与组件测试属性
  assert.equal(typeof pickFile, 'function', 'pickFile is exported');

  const wizardContent = readFileSync(resolve('src/components/InitWizard.tsx'), 'utf-8');
  assert.ok(wizardContent.includes('data-testid="init-custom-java-browse-btn"'), 'InitWizard provides custom Java browse');

  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');
  assert.ok(
    settingsContent.includes('data-testid="settings-custom-java-browse-button"'),
    'SettingsView provides custom Java browse button'
  );
  assert.ok(
    settingsContent.includes('data-testid="browse-custom-dir-button"'),
    'SettingsView provides customDirs browse button'
  );

  delete globalThis.window;
});
