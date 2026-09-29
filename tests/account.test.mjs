import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getAccounts,
  getActiveAccount,
  createOfflineAccount,
  setActiveAccount,
  deleteAccount,
  startDeviceCodeLogin,
  pollDeviceCodeLogin,
} from '../src/utils/accountService.ts';

test('Account R1. Top-right AccountCard component contracts & pixel badges', () => {
  const accountCardContent = readFileSync(resolve('src/components/AccountCard.tsx'), 'utf-8');

  // 验证组件属性及测试标识
  assert.ok(accountCardContent.includes('data-testid="top-account-card"'), 'AccountCard has data-testid');
  assert.ok(accountCardContent.includes('data-testid="account-card-username"'), 'Includes username display');
  assert.ok(accountCardContent.includes('data-testid="account-card-type-badge"'), 'Includes type badge display');

  // 验证正版与离线徽标文本
  assert.ok(accountCardContent.includes('[微软正版]'), 'Displays [微软正版] badge');
  assert.ok(accountCardContent.includes('[离线]'), 'Displays [离线] badge');

  // 验证像素头像嵌入
  assert.ok(accountCardContent.includes('<PixelAvatar'), 'Includes PixelAvatar');
  assert.ok(accountCardContent.includes('font-fusion'), 'Uses FusionPixelFont');
});

test('Account R1. Top-right placement in App.tsx grid layout', () => {
  const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');

  // 验证网格右上角包含 AccountCard
  assert.ok(appContent.includes('<AccountCard'), 'App embeds AccountCard');
  assert.ok(appContent.includes('account={activeAccount}'), 'AccountCard receives activeAccount prop');
  assert.ok(appContent.includes('setIsAccountModalOpen(true)'), 'AccountCard click opens AccountModal');
  assert.ok(appContent.includes('<AccountModal'), 'App embeds AccountModal');
});

test('Account R2. Microsoft Azure Client ID & OAuth2 chain constants in Rust backend', () => {
  const authFiles = [
    resolve('src-tauri/src/auth.rs'),
    resolve('src-tauri/src/auth/microsoft.rs'),
    resolve('src-tauri/src/auth/xbox.rs'),
    resolve('src-tauri/src/auth/offline.rs'),
    resolve('src-tauri/src/auth/storage.rs'),
    resolve('src-tauri/src/auth/types.rs'),
  ];
  const authRs = authFiles.map(f => readFileSync(f, 'utf-8')).join('\n');

  // 微软 Azure Client ID 验证
  assert.ok(
    authRs.includes('37c03091-93d8-4297-a59c-f3792cc080e0'),
    'Matches Azure Client ID: 37c03091-93d8-4297-a59c-f3792cc080e0'
  );

  // 微软认证链端点验证
  assert.ok(authRs.includes('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode'), 'Device code endpoint');
  assert.ok(authRs.includes('https://login.microsoftonline.com/consumers/oauth2/v2.0/token'), 'Token endpoint');
  assert.ok(authRs.includes('https://user.auth.xboxlive.com/user/authenticate'), 'Xbox Live auth endpoint');
  assert.ok(authRs.includes('https://xsts.auth.xboxlive.com/xsts/authorize'), 'XSTS auth endpoint');
  assert.ok(authRs.includes('https://api.minecraftservices.com/launcher/login'), 'Minecraft launcher login endpoint (Prism style)');
  assert.ok(authRs.includes('https://api.minecraftservices.com/minecraft/profile'), 'Minecraft profile endpoint');
  assert.ok(authRs.includes('https://api.minecraftservices.com/entitlements/license'), 'Entitlements license check endpoint');

  // 验证离线账号与正版账号管理命令导出
  assert.ok(authRs.includes('pub fn start_device_code_login'), 'Exports start_device_code_login');
  assert.ok(authRs.includes('pub fn poll_device_code_login'), 'Exports poll_device_code_login');
  assert.ok(authRs.includes('pub fn create_offline_account'), 'Exports create_offline_account');
  assert.ok(authRs.includes('pub fn set_active_account'), 'Exports set_active_account');
  assert.ok(authRs.includes('pub fn delete_account'), 'Exports delete_account');
  assert.ok(authRs.includes('pub fn refresh_account_token'), 'Exports refresh_account_token');
});

test('Account R2. Launch Argument Injection eliminates AuthLib 401 errors', () => {
  const launcherFiles = [
    resolve('src-tauri/src/launcher.rs'),
    resolve('src-tauri/src/launcher/process.rs'),
  ];
  const launcherRs = launcherFiles.map(f => readFileSync(f, 'utf-8')).join('\n');

  const coreFiles = [
    resolve('src-tauri/src/core.rs'),
    resolve('src-tauri/src/core/args.rs'),
  ];
  const coreRs = coreFiles.map(f => readFileSync(f, 'utf-8')).join('\n');
  const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');

  // Rust 后端与核心构建参数验证
  assert.ok(launcherRs.includes('crate::auth::get_active_account()'), 'launcher.rs resolves active account');
  assert.ok(launcherRs.includes('crate::auth::refresh_microsoft_token_if_needed'), 'launcher.rs auto-refreshes token');
  assert.ok(launcherRs.includes('user_type = "msa".to_string()'), 'Sets msa user_type for Microsoft accounts');
  assert.ok(launcherRs.includes('user_type = "mojang".to_string()'), 'Sets mojang user_type for offline accounts');

  assert.ok(coreRs.includes('replaced.replace("${auth_uuid}", uuid)'), 'core.rs replaces ${auth_uuid}');
  assert.ok(coreRs.includes('replaced.replace("${auth_access_token}", access_token)'), 'core.rs replaces ${auth_access_token}');
  assert.ok(coreRs.includes('replaced.replace("${user_type}", user_type)'), 'core.rs replaces ${user_type}');
  assert.ok(coreRs.includes('replaced.replace("${auth_xuid}", xuid)'), 'core.rs replaces ${auth_xuid}');

  // 前端启动时注入活跃账号参数
  assert.ok(appContent.includes('userType = activeAccount?.accountType === "microsoft" ? "msa" : "mojang"'), 'App determines userType');
  assert.ok(appContent.includes('accessToken = activeAccount?.accessToken'), 'App passes accessToken');
  assert.ok(appContent.includes('uuid = activeAccount?.uuid'), 'App passes uuid');
});

test('Account R3. AccountModal UI workflow: list, offline create, Microsoft devicelogin', () => {
  const modalContent = readFileSync(resolve('src/components/AccountModal.tsx'), 'utf-8');

  // 验证弹窗结构与操作按钮
  assert.ok(modalContent.includes('data-testid="account-modal-container"'), 'Includes modal container');
  assert.ok(modalContent.includes('data-testid="account-modal-close-button"'), 'Includes close button');
  assert.ok(modalContent.includes('data-testid="add-microsoft-account-btn"'), 'Includes + 添加微软正版账号 button');
  assert.ok(modalContent.includes('data-testid="add-offline-account-btn"'), 'Includes + 添加离线账号 button');

  // 验证离线账号输入与创建
  assert.ok(modalContent.includes('data-testid="offline-username-input"'), 'Includes offline username input');
  assert.ok(modalContent.includes('data-testid="submit-add-offline-btn"'), 'Includes submit offline button');

  // 验证微软设备码流程
  assert.ok(modalContent.includes('data-testid="microsoft-user-code-display"'), 'Displays Microsoft user code');
  assert.ok(modalContent.includes('data-testid="open-microsoft-login-btn"'), 'Includes open browser and copy code button');
  assert.ok(modalContent.includes('data-testid="microsoft-poll-status"'), 'Includes live polling status text');
});

test('Account R2 & R3. Account Service CRUD & Offline Account logic', async () => {
  // 模拟 localStorage
  const storage = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
      clear: () => storage.clear(),
    },
  };

  // 1. 默认账号加载
  const initialAccounts = await getAccounts();
  assert.ok(initialAccounts.length >= 1, 'Returns default accounts');
  const active = await getActiveAccount();
  assert.ok(active, 'Active account exists');
  assert.equal(active.name, 'Steve');

  // 2. 创建离线账号
  const alex = await createOfflineAccount('Alex');
  assert.equal(alex.name, 'Alex');
  assert.equal(alex.accountType, 'offline');
  assert.equal(alex.isActive, true);

  const updatedList = await getAccounts();
  assert.equal(updatedList.length, 2);
  const currentActive = await getActiveAccount();
  assert.equal(currentActive.name, 'Alex');

  // 3. 切换活跃账号
  const switched = await setActiveAccount(initialAccounts[0].id);
  const nowActive = switched.find((a) => a.isActive);
  assert.equal(nowActive.id, initialAccounts[0].id);

  // 4. 删除非活跃账号
  const afterDelete = await deleteAccount(alex.id);
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].name, 'Steve');

  // 5. 微软设备码登录接口 Mock 验证
  const deviceCodeData = await startDeviceCodeLogin();
  assert.ok(deviceCodeData.userCode, 'Returns user code');
  assert.ok(deviceCodeData.verificationUri.includes('microsoft.com/devicelogin'), 'Verification uri contains devicelogin');

  const pollRes = await pollDeviceCodeLogin(deviceCodeData.deviceCode);
  assert.ok(pollRes.status, 'Returns poll status');

  delete globalThis.window;
});
