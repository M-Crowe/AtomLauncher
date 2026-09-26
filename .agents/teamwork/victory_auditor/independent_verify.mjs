import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

console.log('=== VICTORY AUDITOR INDEPENDENT VERIFICATION ===');

// 1. App.tsx layout & animation
const appPath = resolve('src/App.tsx');
const app = readFileSync(appPath, 'utf8');
assert.ok(app.includes('grid-cols-[minmax(0,1fr)_277px]'), 'Grid layout width must be 277px');
assert.ok(app.includes('transition-all duration-300 ease-out'), 'App must include transition duration-300 ease-out');
assert.ok(app.includes('<SettingsSidebar />'), 'App must render SettingsSidebar in right column');
assert.ok(app.includes('currentTab === "settings"'), 'App must toggle settings tab');
assert.ok(app.includes('aria-hidden={currentTab === "settings"}'), 'Recent instances must be aria-hidden on settings');
assert.ok(app.includes('inert={currentTab === "settings" ? true : undefined}'), 'Recent instances must be inert on settings');
assert.ok(app.includes('aria-hidden={currentTab !== "settings"}'), 'Settings sidebar must be aria-hidden when not on settings');
assert.ok(app.includes('inert={currentTab !== "settings" ? true : undefined}'), 'Settings sidebar must be inert when not on settings');
console.log('✔ App.tsx layout & animation checks: PASS');

// 2. SettingsView.tsx & SettingsSidebar exports and buttons
const settingsPath = resolve('src/components/SettingsView.tsx');
const settings = readFileSync(settingsPath, 'utf8');
assert.ok(settings.includes('export const SettingsSidebar: React.FC'), 'SettingsSidebar must be exported');
assert.ok(settings.includes('export const SettingsView: React.FC'), 'SettingsView must be exported');
assert.ok(settings.includes('[ 保存配置 ]'), '[ 保存配置 ] button must exist');
assert.ok(settings.includes('[ 已保存 ]'), '[ 已保存 ] feedback state must exist');
assert.ok(settings.includes('恢复默认'), 'Restore defaults button must exist');
console.log('✔ SettingsView & SettingsSidebar exports & buttons: PASS');

// 3. Category definitions
const categories = ['Java 运行环境', 'JVM 与游戏参数', '下载源与网络', '启动器偏好'];
categories.forEach((c) => {
  assert.ok(settings.includes(c), 'Must include category: ' + c);
});
console.log('✔ Settings categories checks: PASS');

// 4. Zero emoji check in SettingsView.tsx
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu;
const emojis = settings.match(emojiRegex);
assert.strictEqual(emojis, null, 'SettingsView must have 0 emojis');
console.log('✔ Zero emoji check: PASS');

// 5. No marketing slogans
assert.ok(!settings.includes('<h2>启动器设置中心</h2>'), 'No <h2> promotional title');
assert.ok(!settings.includes('Minecraft 原生像素级内核'), 'No marketing slogan');
console.log('✔ No marketing slogans check: PASS');

// 6. Contrast & styles
assert.ok(!settings.includes('#573D26'), 'Zero muddy #573D26 color');
assert.ok(settings.includes('#1F1F1F'), 'Uses deep ink #1F1F1F');
assert.ok(settings.includes('#2F1F17'), 'Uses deep roasted ink #2F1F17');
assert.ok(settings.includes('gap-6'), 'Uses gap-6');
assert.ok(settings.includes('p-6'), 'Uses p-6');
console.log('✔ Colors and typography checks: PASS');

// 7. App.css keyframes and reduced-motion
const cssPath = resolve('src/App.css');
const css = readFileSync(cssPath, 'utf8');
assert.ok(css.includes('viewExpandIn'), 'App.css defines viewExpandIn');
assert.ok(css.includes('tabpanelSlideIn'), 'App.css defines tabpanelSlideIn');
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'App.css defines prefers-reduced-motion');
assert.ok(css.includes('.animate-bounce'), 'prefers-reduced-motion includes .animate-bounce');
console.log('✔ CSS animation & accessibility checks: PASS');

// 8. Functional test of settingsCategory and settingsStorage modules
const { getActiveCategory, setActiveCategory, resetActiveCategory } = await import(
  '../../../src/utils/settingsCategory.ts'
);
resetActiveCategory();
assert.equal(getActiveCategory(), 'java');
setActiveCategory('game');
assert.equal(getActiveCategory(), 'game');
setActiveCategory('invalid_tab_name');
assert.equal(getActiveCategory(), 'game', 'Invalid category rejected');
resetActiveCategory();
assert.equal(getActiveCategory(), 'java');
console.log('✔ settingsCategory reactive machine: PASS');

// 9. Storage sanitization
const { loadLauncherSettings, saveLauncherSettings, DEFAULT_SETTINGS } = await import(
  '../../../src/utils/settingsStorage.ts'
);
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  },
};

saveLauncherSettings({
  ...DEFAULT_SETTINGS,
  allocatedMemory: 500, // Should clamp to default 4096
  minMemory: 10000,     // Inverted: minMemory > allocatedMemory
  downloadSource: 'hacked_cdn',
  afterLaunch: 'bad_action',
});

const loaded = loadLauncherSettings();
assert.equal(loaded.allocatedMemory, 4096, 'Clamped allocatedMemory');
assert.ok(loaded.minMemory <= loaded.allocatedMemory, 'minMemory <= allocatedMemory');
assert.equal(loaded.downloadSource, 'bmclapi', 'Fallback downloadSource');
assert.equal(loaded.afterLaunch, 'minimize', 'Fallback afterLaunch');
delete globalThis.window;
console.log('✔ settingsStorage defensive sanitization: PASS');

console.log('=== ALL INDEPENDENT VERIFICATION CHECKS COMPLETED SUCCESSFULLY ===');
