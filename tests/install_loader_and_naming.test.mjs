import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getAvailableLoaders,
  getDefaultInstanceName,
  validateInstanceName,
} from '../src/utils/loaderService.ts';

test('Install & Loader R1. Version Card removes 当前选中 label', () => {
  const downloadViewContent = readFileSync(resolve('src/components/DownloadView.tsx'), 'utf-8');
  assert.equal(
    downloadViewContent.includes('当前选中'),
    false,
    'Version item card eliminates redundant 当前选中 label'
  );
});

test('Install & Loader R2. DownloadDetailSidebar integrates Mod Loader options', () => {
  const sidebarContent = readFileSync(resolve('src/components/DownloadDetailSidebar.tsx'), 'utf-8');
  assert.ok(sidebarContent.includes('模组加载器选择'), 'Sidebar features mod loader selector section');
  assert.ok(sidebarContent.includes('Fabric'), 'Supports Fabric loader');
  assert.ok(sidebarContent.includes('NeoForge'), 'Supports NeoForge loader');
  assert.ok(sidebarContent.includes('Forge'), 'Supports Forge loader');
  assert.ok(sidebarContent.includes('Quilt'), 'Supports Quilt loader');
  assert.ok(sidebarContent.includes('getAvailableLoaders'), 'Connects to loader metadata service');
});

test('Install & Loader R3. loaderService instance naming and collision detection contracts', () => {
  // 1. 验证默认实例名称格式化规则
  assert.equal(getDefaultInstanceName('1.21.1', 'vanilla'), '1.21.1');
  assert.equal(getDefaultInstanceName('1.21.1', 'fabric'), '1.21.1-Fabric');
  assert.equal(getDefaultInstanceName('1.21.1', 'neoforge'), '1.21.1-NeoForge');
  assert.equal(getDefaultInstanceName('1.21.1', 'forge'), '1.21.1-Forge');
  assert.equal(getDefaultInstanceName('1.21.1', 'quilt'), '1.21.1-Quilt');

  // 2. 验证本地已有版本重名检测
  const installedMock = [
    { id: '1.20.4' },
    { id: '1.21.1' },
    { id: '1.21.1-Fabric' },
  ];

  // 空名称拦截
  const emptyRes = validateInstanceName('', installedMock);
  assert.equal(emptyRes.valid, false);
  assert.ok(emptyRes.error?.includes('请输入版本名称'));

  // 空格拦截
  const spaceRes = validateInstanceName('   ', installedMock);
  assert.equal(spaceRes.valid, false);

  // 非法字符拦截
  const illegalRes1 = validateInstanceName('1.21.1/test', installedMock);
  assert.equal(illegalRes1.valid, false);
  assert.ok(illegalRes1.error?.includes('非法字符'));

  const illegalRes2 = validateInstanceName('1.21.1:abc', installedMock);
  assert.equal(illegalRes2.valid, false);

  // 重名冲突拦截 (大小写不敏感)
  const conflictRes1 = validateInstanceName('1.20.4', installedMock);
  assert.equal(conflictRes1.valid, false);
  assert.ok(conflictRes1.error?.includes('已存在'));

  const conflictRes2 = validateInstanceName('1.21.1-fabric', installedMock);
  assert.equal(conflictRes2.valid, false);
  assert.ok(conflictRes2.error?.includes('已存在'));

  // 合法新名称放行
  const validRes = validateInstanceName('1.21.1-MyModpack', installedMock);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.error, undefined);
});

test('Install & Loader R4. InstallConfirmModal UI contracts and input state machine', () => {
  const modalContent = readFileSync(resolve('src/components/InstallConfirmModal.tsx'), 'utf-8');
  assert.ok(modalContent.includes('data-testid="install-confirm-modal"'), 'Modal container has testid');
  assert.ok(modalContent.includes('data-testid="install-name-input"'), 'Input element has testid');
  assert.ok(modalContent.includes('data-testid="install-confirm-submit"'), 'Confirm button has testid');
  assert.ok(modalContent.includes('data-testid="install-confirm-cancel"'), 'Cancel button has testid');
  assert.ok(modalContent.includes('validateInstanceName'), 'Binds validateInstanceName');
  assert.ok(modalContent.includes('disabled={!validation.valid}'), 'Disables submit button on validation failure');
});

test('Install & Loader R5. Zero Emoji Policy on newly added components', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const files = [
    'src/components/InstallConfirmModal.tsx',
    'src/utils/loaderService.ts',
    'src/components/DownloadDetailSidebar.tsx',
    'src/components/DownloadView.tsx',
  ];

  for (const f of files) {
    const content = readFileSync(resolve(f), 'utf-8');
    assert.equal(
      emojiRegex.test(content),
      false,
      `Strict Zero Emojis policy satisfied in ${f}`
    );
  }
});
