import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_SETTINGS,
  DEFAULT_JAVA_RUNTIMES,
  MEMORY_PRESETS,
  RESOLUTION_PRESETS,
  JVM_ARG_PRESETS,
  scanSystemJavaRuntimes,
} from '../src/utils/settingsStorage.ts';

test('R3. Settings Data Model and Default Constants', () => {
  assert.equal(DEFAULT_SETTINGS.allocatedMemory, 4096, 'Default memory is 4096 MB (4 GB)');
  assert.equal(DEFAULT_SETTINGS.minMemory, 1024, 'Default min memory is 1024 MB');
  assert.equal(DEFAULT_SETTINGS.downloadSource, 'bmclapi', 'Default download source is BMCLAPI');
  assert.equal(DEFAULT_SETTINGS.downloadThreads, 32, 'Default download concurrency is 32 threads');
  assert.equal(DEFAULT_SETTINGS.versionIsolation, true, 'Default version isolation is enabled');
  assert.equal(DEFAULT_SETTINGS.afterLaunch, 'minimize', 'Default after-launch is minimize');
  assert.equal(DEFAULT_SETTINGS.autoClose, true, 'Default autoClose matches minimize');
  assert.equal(DEFAULT_SETTINGS.creeperEffects, true, 'Default creeper dynamic effects enabled');
  assert.equal(DEFAULT_SETTINGS.fullscreen, false, 'Default fullscreen is disabled');
});

test('R3. Java Runtimes & Smart Recommendation Specifications', async () => {
  assert.ok(DEFAULT_JAVA_RUNTIMES.length >= 3, 'Contains standard Java runtimes (21, 17, 8)');
  
  const jdk21 = DEFAULT_JAVA_RUNTIMES.find((r) => r.majorVersion === 21);
  assert.ok(jdk21, 'JDK 21 is present');
  assert.ok(jdk21.recommendedFor.includes('1.20.5+'), 'JDK 21 recommends 1.20.5+');

  const jdk17 = DEFAULT_JAVA_RUNTIMES.find((r) => r.majorVersion === 17);
  assert.ok(jdk17, 'JDK 17 is present');
  assert.ok(jdk17.recommendedFor.includes('1.17'), 'JDK 17 recommends 1.17 - 1.20.4');

  const jre8 = DEFAULT_JAVA_RUNTIMES.find((r) => r.majorVersion === 8);
  assert.ok(jre8, 'Java 8 is present');
  assert.ok(jre8.recommendedFor.includes('1.16.5'), 'Java 8 recommends 1.16.5 and below');

  // 异步系统 Java 扫描测试
  const scanned = await scanSystemJavaRuntimes();
  assert.ok(scanned.length >= DEFAULT_JAVA_RUNTIMES.length, 'Scan discovers additional installed runtimes');
});

test('R3. JVM Memory & Resolution Quick Presets', () => {
  // 内存预设
  const memValues = MEMORY_PRESETS.map((p) => p.value);
  assert.deepEqual(memValues, [2048, 4096, 8192, 12288, 16384], 'Memory presets include 2G, 4G, 8G, 12G, 16G');

  // 分辨率预设
  const resLabels = RESOLUTION_PRESETS.map((p) => p.label);
  assert.ok(resLabels.includes('854 × 480'), 'Includes default 854x480');
  assert.ok(resLabels.includes('1280 × 720'), 'Includes 720P 1280x720');
  assert.ok(resLabels.includes('1920 × 1080'), 'Includes 1080P 1920x1080');

  // JVM 参数预设
  const jvmNames = JVM_ARG_PRESETS.map((p) => p.name);
  assert.ok(jvmNames.includes('G1GC 基础优化'), 'Includes G1GC preset');
  assert.ok(jvmNames.includes('Aikar 旗舰优化'), 'Includes Aikar preset');
  assert.ok(jvmNames.includes('ZGC 新一代低延迟'), 'Includes ZGC preset');
});

test('R3. SettingsView Component Structure and UI Contracts', () => {
  const content = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 1. Java 运行环境
  assert.ok(content.includes('Java 运行环境 (Runtime)'), 'Includes Java Runtime section');
  assert.ok(content.includes('handleScanJava'), 'Includes Java scanning handler');
  assert.ok(content.includes('手动指定自定义 Java 路径'), 'Includes custom Java path selector');
  assert.ok(content.includes('Java 版本推荐指南'), 'Includes recommendation guide');

  // 2. JVM 内存与游戏参数
  assert.ok(content.includes('最大内存分配 (JVM Xmx)'), 'Includes Memory slider section');
  assert.ok(content.includes('MEMORY_PRESETS'), 'Uses memory presets');
  assert.ok(content.includes('游戏窗口分辨率与显示模式'), 'Includes resolution section');
  assert.ok(content.includes('全屏启动游戏'), 'Includes fullscreen toggle');
  assert.ok(content.includes('自定义 JVM 附加参数'), 'Includes JVM flags input');

  // 3. 游戏目录与隔离
  assert.ok(content.includes('.minecraft 游戏主目录路径'), 'Includes .minecraft path setting');
  assert.ok(content.includes('独立版本隔离 (Version Isolation)'), 'Includes version isolation setting');

  // 4. 下载源与并发
  assert.ok(content.includes('BMCLAPI 极速源'), 'Includes BMCLAPI source');
  assert.ok(content.includes('Mojang 官方源'), 'Includes Mojang source');
  assert.ok(content.includes('并发下载线程数 (Download Concurrency)'), 'Includes thread concurrency setting');
  assert.ok(content.includes('下载校验失败时自动重试'), 'Includes auto retry setting');

  // 5. 启动器偏好与保存恢复
  assert.ok(content.includes('启动游戏后自动最小化'), 'Includes after launch minimize option');
  assert.ok(content.includes('首页苦力怕展台与 Pretext 排版动态动效'), 'Includes creeper animation toggle');
  assert.ok(content.includes('保存设置'), 'Includes save button');
  assert.ok(content.includes('恢复默认'), 'Includes restore defaults button');

  // 6. 分类子标签与无障碍
  assert.ok(content.includes('role="tablist"'), 'Sub-tab list has role="tablist"');
  assert.ok(content.includes('role="tab"'), 'Sub-tab buttons have role="tab"');
  assert.ok(content.includes('aria-selected='), 'Sub-tab buttons have aria-selected');
  assert.ok(content.includes('运行环境与内存'), 'Sub-tab for Java & Memory');
  assert.ok(content.includes('游戏与参数'), 'Sub-tab for Game & Args');
  assert.ok(content.includes('下载与网络'), 'Sub-tab for Download & Net');
  assert.ok(content.includes('偏好与视觉'), 'Sub-tab for Preferences & UI');
});

test('R3. Settings Storage Persistence and Schema Resilience', async () => {
  const { loadLauncherSettings, saveLauncherSettings, SETTINGS_STORAGE_KEY } = await import(
    '../src/utils/settingsStorage.ts'
  );

  // 模拟 window.localStorage
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    },
  };

  // 1. 初始为空时返回默认设置
  const initial = loadLauncherSettings();
  assert.equal(initial.allocatedMemory, 4096);
  assert.equal(initial.downloadSource, 'bmclapi');

  // 2. 保存并重新读取完整设置
  const custom = {
    ...DEFAULT_SETTINGS,
    allocatedMemory: 8192,
    downloadSource: 'mojang',
    afterLaunch: 'close',
  };
  saveLauncherSettings(custom);
  const reloaded = loadLauncherSettings();
  assert.equal(reloaded.allocatedMemory, 8192);
  assert.equal(reloaded.downloadSource, 'mojang');
  assert.equal(reloaded.afterLaunch, 'close');
  assert.equal(reloaded.autoClose, false, 'autoClose is false when afterLaunch is close');

  // 3. 兼容性迁移：当 afterLaunch 为 minimize 时 autoClose 保持 true
  const minCustom = {
    ...DEFAULT_SETTINGS,
    afterLaunch: 'minimize',
  };
  saveLauncherSettings(minCustom);
  const minReloaded = loadLauncherSettings();
  assert.equal(minReloaded.autoClose, true, 'autoClose is true when afterLaunch is minimize');

  // 4. 损坏的 JSON 数据安全回退至默认配置，不引发 Crash
  globalThis.window.localStorage.setItem(SETTINGS_STORAGE_KEY, '{ invalid_json_syntax ');
  const safeFallback = loadLauncherSettings();
  assert.equal(safeFallback.allocatedMemory, 4096);
  assert.equal(safeFallback.downloadSource, 'bmclapi');

  // 清理全局 mock
  delete globalThis.window;
});

test('R3. CreeperCanvas Dynamic Effects Toggle Integration', () => {
  const creeperContent = readFileSync(resolve('src/components/CreeperCanvas.tsx'), 'utf-8');
  assert.ok(creeperContent.includes('loadLauncherSettings'), 'CreeperCanvas imports loadLauncherSettings');
});

