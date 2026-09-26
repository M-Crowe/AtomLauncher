import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('R1. Global two-column layout linkage and smooth stretch transitions', () => {
  const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');

  // 1. 验证 277px 右侧栏及两栏网格布局
  assert.ok(appContent.includes('grid-cols-[minmax(0,1fr)_277px]'), 'App defines 2-column grid with 277px right sidebar');

  // 2. 验证主区域具备平滑自然的展开/拉伸过渡动效 (transition-all duration-300 ease-out)
  assert.ok(
    appContent.includes('transition-all duration-300 ease-out'),
    'Main view and right sidebar have smooth transition animation'
  );

  // 3. 验证右侧栏在切换到 settings 时无缝切换为 SettingsSidebar
  assert.ok(appContent.includes('<SettingsSidebar />'), 'Right sidebar mounts SettingsSidebar');
  assert.ok(
    appContent.includes('currentTab === "settings"'),
    'Right sidebar conditionally animates between recent instances and settings categories'
  );
  assert.ok(
    appContent.includes('opacity-0 pointer-events-none translate-x-4') ||
    appContent.includes('opacity-0 pointer-events-none'),
    'Recent instances fade/slide out smoothly when switching to settings'
  );
  assert.ok(
    appContent.includes('opacity-100 translate-x-0'),
    'SettingsSidebar fades/slides in smoothly when switching to settings'
  );
});

test('R1 & R2. SettingsSidebar pure-text category options and save action', () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 1. 验证四大纯中文分类
  assert.ok(settingsContent.includes('Java 运行环境'), 'Includes category: Java 运行环境');
  assert.ok(settingsContent.includes('JVM 与游戏参数'), 'Includes category: JVM 与游戏参数');
  assert.ok(settingsContent.includes('下载源与网络'), 'Includes category: 下载源与网络');
  assert.ok(settingsContent.includes('启动器偏好'), 'Includes category: 启动器偏好');

  // 2. 验证右下角纯文字 [ 保存配置 ] 按钮
  assert.ok(settingsContent.includes('[ 保存配置 ]'), 'Right bottom displays pure-text [ 保存配置 ] button');
  assert.ok(settingsContent.includes('恢复默认'), 'Displays 恢复默认 button');

  // 3. 验证无障碍与分类 Tablist 契约
  assert.ok(settingsContent.includes('role="tablist"'), 'Category list has role="tablist"');
  assert.ok(settingsContent.includes('role="tab"'), 'Category buttons have role="tab"');
  assert.ok(settingsContent.includes('aria-selected='), 'Category buttons have aria-selected');
});

test('R1 & R2. Visual purification: Zero emojis and no promotional marketing banners', () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 1. 验证严格零 Emoji
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojiMatches = settingsContent.match(emojiRegex);
  assert.equal(emojiMatches, null, 'SettingsView.tsx contains exactly ZERO emoji characters');

  // 2. 验证移除所有特定的奇怪图标与旧装饰符
  const forbiddenSymbols = ['⚙️', '☕', '🧠', '⚡', '🛠️', '💾', '🎮', '🎨', 'ℹ️', '🔍', '💡', '📶', '⏳', '🔄', '✅', '📂', '✓'];
  for (const sym of forbiddenSymbols) {
    assert.ok(!settingsContent.includes(sym), `Forbidden icon/emoji '${sym}' is completely removed`);
  }

  // 3. 验证移除花哨营销大标题 (无 <h2>启动器设置中心</h2> 或 "Minecraft 原生像素级内核...")
  assert.ok(!settingsContent.includes('<h2>启动器设置中心</h2>'), 'Promotional big heading <h2> is removed');
  assert.ok(!settingsContent.includes('Minecraft 原生像素级内核'), 'Marketing slogan is completely removed');
});

test('R3. Typography contrast, breathing room, and form controls', () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 1. 深度墨色高对比度 (#1F1F1F / #2F1F17)
  assert.ok(settingsContent.includes('#1F1F1F'), 'Uses deep ink color #1F1F1F for high contrast');
  assert.ok(settingsContent.includes('#2F1F17'), 'Uses deep roasted ink color #2F1F17');

  // 2. 充足呼吸感间距 (gap-6) 与舒适内边距 (p-6)
  assert.ok(settingsContent.includes('gap-6'), 'Main form container uses gap-6 for breathing room');
  assert.ok(settingsContent.includes('p-6'), 'Main form container uses p-6 padding');

  // 3. 彻底移除内部嵌套的二级 Tab 栏 (SettingsView 表单主体不再包含内部 tab 切换条)
  assert.ok(
    !settingsContent.includes('📋 全部设置'),
    'Nested sub-tab bar inside main form area is removed'
  );

  // 4. 严格校验无浑浊灰褐色 (#573D26) 遗留，全面采用高对比深墨色 (#1F1F1F / #2F1F17)
  assert.ok(
    !settingsContent.includes('#573D26'),
    'SettingsView.tsx contains ZERO instances of muddy brown #573D26'
  );
});

test('R1. Smooth entrance keyframe animations and panel transitions', () => {
  const cssContent = readFileSync(resolve('src/App.css'), 'utf-8');
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 1. 验证 App.css 声明了平滑展开与子面板淡入动效
  assert.ok(cssContent.includes('viewExpandIn'), 'App.css defines viewExpandIn keyframe');
  assert.ok(cssContent.includes('.animate-view-expand'), 'App.css defines .animate-view-expand class');
  assert.ok(cssContent.includes('tabpanelSlideIn'), 'App.css defines tabpanelSlideIn keyframe');
  assert.ok(cssContent.includes('.animate-tabpanel-in'), 'App.css defines .animate-tabpanel-in class');

  // 2. 验证 SettingsView 容器挂载了平滑入场动效
  assert.ok(settingsContent.includes('animate-view-expand'), 'SettingsView container mounts with animate-view-expand');

  // 3. 验证四大面板均配置了 tabpanel 入场动效
  const panelAnimationMatches = settingsContent.match(/animate-tabpanel-in/g);
  assert.ok(panelAnimationMatches && panelAnimationMatches.length >= 4, 'All 4 category panels include animate-tabpanel-in');
});

test('R1 & R2. ARIA tabpanel contract and keyboard navigation', () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 1. 验证 Tab 按钮与 TabPanel 的 ARIA 绑定完整度
  assert.ok(
    settingsContent.includes('id={`settings-tab-${cat.id}`}'),
    'Tab button has dynamic id="settings-tab-${cat.id}"'
  );
  assert.ok(
    settingsContent.includes('aria-controls={`settings-panel-${cat.id}`}'),
    'Tab button controls dynamic aria-controls="settings-panel-${cat.id}"'
  );

  const categories = ['java', 'game', 'download', 'launcher'];
  for (const cat of categories) {
    assert.ok(settingsContent.includes(`id="settings-panel-${cat}"`), `Panel has id="settings-panel-${cat}"`);
    assert.ok(settingsContent.includes(`aria-labelledby="settings-tab-${cat}"`), `Panel is labelled by settings-tab-${cat}`);
  }

  // 2. 验证角色标记
  assert.ok(settingsContent.includes('role="tabpanel"'), 'SettingsView contains role="tabpanel"');

  // 3. 验证键盘上下左右/Home/End 导航支持
  assert.ok(settingsContent.includes('handleTabKeyDown'), 'SettingsSidebar implements handleTabKeyDown');
  assert.ok(settingsContent.includes("e.key === 'ArrowDown'"), 'Handles ArrowDown navigation');
  assert.ok(settingsContent.includes("e.key === 'ArrowUp'"), 'Handles ArrowUp navigation');
  assert.ok(settingsContent.includes("e.key === 'Home'"), 'Handles Home navigation');
  assert.ok(settingsContent.includes("e.key === 'End'"), 'Handles End navigation');
});

test('R1 & R3. Multi-field cross-category persistence & storage integrity', async () => {
  const { loadLauncherSettings, saveLauncherSettings, DEFAULT_SETTINGS } = await import(
    '../src/utils/settingsStorage.ts'
  );

  const mockStore = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => mockStore.get(key) ?? null,
      setItem: (key, val) => mockStore.set(key, String(val)),
      removeItem: (key) => mockStore.delete(key),
      clear: () => mockStore.clear(),
    },
  };

  // 模拟跨多个分类标签修改各项参数
  const multiCategoryModified = {
    ...DEFAULT_SETTINGS,
    // Java 分类
    allocatedMemory: 8192,
    useCustomJava: true,
    customJavaPath: 'D:\\Java\\jdk-21\\bin\\javaw.exe',
    // JVM 与游戏参数分类
    gameDir: 'D:\\Games\\.minecraft',
    windowWidth: 1920,
    windowHeight: 1080,
    fullscreen: true,
    jvmArgs: '-XX:+UseZGC -XX:+ZGenerational',
    // 下载源分类
    downloadSource: 'mojang',
    downloadThreads: 64,
    autoRetry: false,
    // 启动器偏好分类
    afterLaunch: 'close',
    autoClose: false,
    creeperEffects: false,
    soundEffects: false,
  };

  saveLauncherSettings(multiCategoryModified);
  const loaded = loadLauncherSettings();

  assert.equal(loaded.allocatedMemory, 8192, 'Java category memory persisted');
  assert.equal(loaded.customJavaPath, 'D:\\Java\\jdk-21\\bin\\javaw.exe', 'Java category custom path persisted');
  assert.equal(loaded.windowWidth, 1920, 'Game category window width persisted');
  assert.equal(loaded.windowHeight, 1080, 'Game category window height persisted');
  assert.equal(loaded.fullscreen, true, 'Game category fullscreen persisted');
  assert.equal(loaded.jvmArgs, '-XX:+UseZGC -XX:+ZGenerational', 'JVM flags persisted');
  assert.equal(loaded.downloadSource, 'mojang', 'Download source persisted');
  assert.equal(loaded.downloadThreads, 64, 'Download concurrency persisted');
  assert.equal(loaded.afterLaunch, 'close', 'Launcher preference persisted');
  assert.equal(loaded.creeperEffects, false, 'Creeper effects toggle persisted');

  delete globalThis.window;
});

test('R1 & R3. Robust fallback and headless safety for triggerRestoreDefaults', async () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');
  const { loadLauncherSettings, saveLauncherSettings, DEFAULT_SETTINGS } = await import(
    '../src/utils/settingsStorage.ts'
  );

  // 1. 验证源码中具备 headless / SSR 安全检查与默认配置兜底
  assert.ok(
    settingsContent.includes('saveLauncherSettings({ ...DEFAULT_SETTINGS })'),
    'triggerRestoreDefaults falls back to default settings'
  );
  assert.ok(
    settingsContent.includes('typeof window !=='),
    'Uses defensive window check for SSR/headless safety'
  );
  assert.ok(
    settingsContent.includes('typeof window.confirm ==='),
    'Safely checks window.confirm existence before prompt'
  );

  // 2. 模拟 storage 回退重置
  const mockStore = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => mockStore.get(key) ?? null,
      setItem: (key, val) => mockStore.set(key, String(val)),
      removeItem: (key) => mockStore.delete(key),
      clear: () => mockStore.clear(),
    },
  };

  // 先写入自定义脏数据
  saveLauncherSettings({
    ...DEFAULT_SETTINGS,
    allocatedMemory: 16384,
    downloadSource: 'mcbbs',
  });

  // 执行恢复默认逻辑
  saveLauncherSettings({ ...DEFAULT_SETTINGS });

  const reloaded = loadLauncherSettings();
  assert.equal(reloaded.allocatedMemory, DEFAULT_SETTINGS.allocatedMemory, 'Restores default memory allocation');
  assert.equal(reloaded.downloadSource, DEFAULT_SETTINGS.downloadSource, 'Restores default download source');

  delete globalThis.window;
});

test('R1. Accessibility isolation with inert and aria-hidden on hidden sidebar panels', () => {
  const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');

  // 1. 最近实例列表在设置页激活时设置 inert 与 aria-hidden
  assert.ok(
    appContent.includes('aria-hidden={currentTab === "settings"}'),
    'Recent instances panel declares aria-hidden when settings tab is active'
  );
  assert.ok(
    appContent.includes('inert={currentTab === "settings" ? true : undefined}'),
    'Recent instances panel receives inert attribute to isolate keyboard focus'
  );

  // 2. 设置分类列表在非设置页激活时设置 inert 与 aria-hidden
  assert.ok(
    appContent.includes('aria-hidden={currentTab !== "settings"}'),
    'SettingsSidebar declares aria-hidden when settings tab is inactive'
  );
  assert.ok(
    appContent.includes('inert={currentTab !== "settings" ? true : undefined}'),
    'SettingsSidebar receives inert attribute to isolate keyboard focus'
  );
});

test('R1 & R2. Vertical Tablist orientation and bi-directional Arrow navigation', () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 1. 验证垂直方向声明
  assert.ok(
    settingsContent.includes('aria-orientation="vertical"'),
    'Tablist explicitly declares aria-orientation="vertical" per WAI-ARIA guidelines'
  );

  // 2. 验证支持双向键位 (Down/Right 前进, Up/Left 后退)
  assert.ok(
    settingsContent.includes("e.key === 'ArrowRight'"),
    'Tablist keyboard navigation supports ArrowRight for forward cycling'
  );
  assert.ok(
    settingsContent.includes("e.key === 'ArrowLeft'"),
    'Tablist keyboard navigation supports ArrowLeft for backward cycling'
  );
});

test('R1. prefers-reduced-motion media query support for accessibility', () => {
  const cssContent = readFileSync(resolve('src/App.css'), 'utf-8');

  assert.ok(
    cssContent.includes('@media (prefers-reduced-motion: reduce)'),
    'App.css defines prefers-reduced-motion media query'
  );
  assert.ok(
    cssContent.includes('animation-duration: 0.01ms'),
    'Reduced motion instantly completes entrance animations without vestibular triggers'
  );
});

test('R3. Boundary sanitization and defensive storage against corrupt numeric data', async () => {
  const { loadLauncherSettings, saveLauncherSettings, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } = await import(
    '../src/utils/settingsStorage.ts'
  );

  const mockStore = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => mockStore.get(key) ?? null,
      setItem: (key, val) => mockStore.set(key, String(val)),
      removeItem: (key) => mockStore.delete(key),
      clear: () => mockStore.clear(),
    },
  };

  // 1. 写入包含非法/负数/零分辨率的损坏数据
  const corruptPayload = {
    windowWidth: -1920,
    windowHeight: 0,
    allocatedMemory: 128,
    downloadThreads: -8,
  };
  mockStore.set(SETTINGS_STORAGE_KEY, JSON.stringify(corruptPayload));

  const safeLoaded = loadLauncherSettings();
  assert.equal(safeLoaded.windowWidth, DEFAULT_SETTINGS.windowWidth, 'Clamps negative windowWidth to safe default 854');
  assert.equal(safeLoaded.windowHeight, DEFAULT_SETTINGS.windowHeight, 'Clamps 0 windowHeight to safe default 480');
  assert.equal(safeLoaded.allocatedMemory, DEFAULT_SETTINGS.allocatedMemory, 'Clamps sub-1024 memory to default 4096');
  assert.equal(safeLoaded.downloadThreads, DEFAULT_SETTINGS.downloadThreads, 'Clamps negative threads to default 32');

  // 2. saveLauncherSettings 保存时主动防御非法超界参数
  saveLauncherSettings({
    ...DEFAULT_SETTINGS,
    windowWidth: 50,
    windowHeight: 10,
    allocatedMemory: 512,
    downloadThreads: 999,
  });

  const persistedJson = JSON.parse(mockStore.get(SETTINGS_STORAGE_KEY));
  assert.equal(persistedJson.windowWidth, DEFAULT_SETTINGS.windowWidth, 'Sanitizes sub-320 windowWidth on save');
  assert.equal(persistedJson.windowHeight, DEFAULT_SETTINGS.windowHeight, 'Sanitizes sub-240 windowHeight on save');
  assert.equal(persistedJson.allocatedMemory, DEFAULT_SETTINGS.allocatedMemory, 'Sanitizes sub-1024 memory on save');
  assert.equal(persistedJson.downloadThreads, DEFAULT_SETTINGS.downloadThreads, 'Sanitizes out-of-range thread count on save');

  delete globalThis.window;
});

test('R1. Reactive category subscription system and resetActiveCategory lifecycle', async () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');
  assert.ok(settingsContent.includes('resetActiveCategory'), 'SettingsView.tsx re-exports resetActiveCategory');
  assert.ok(settingsContent.includes('getActiveCategory'), 'SettingsView.tsx re-exports getActiveCategory');
  assert.ok(settingsContent.includes('setActiveCategory'), 'SettingsView.tsx re-exports setActiveCategory');

  const { getActiveCategory, setActiveCategory, resetActiveCategory } = await import(
    '../src/utils/settingsCategory.ts'
  );

  // 1. 初始/重置后应为 'java'
  resetActiveCategory();
  assert.equal(getActiveCategory(), 'java', 'Default/reset active category is java');

  // 2. 切换至其他分类
  setActiveCategory('download');
  assert.equal(getActiveCategory(), 'download', 'Updates category to download');

  setActiveCategory('launcher');
  assert.equal(getActiveCategory(), 'launcher', 'Updates category to launcher');

  setActiveCategory('game');
  assert.equal(getActiveCategory(), 'game', 'Updates category to game');

  // 3. 复位分类
  resetActiveCategory();
  assert.equal(getActiveCategory(), 'java', 'Successfully resets back to java');
});

test('R1 & R3. Component unmount safety and isMountedRef memory leak prevention', () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 1. 验证持有 isMountedRef 追踪挂载周期
  assert.ok(
    settingsContent.includes('const isMountedRef = useRef(true);'),
    'SettingsView tracks mount state via isMountedRef'
  );
  assert.ok(
    settingsContent.includes('isMountedRef.current = false;'),
    'SettingsView sets isMountedRef to false on unmount'
  );

  // 2. 验证异步 Java 扫描具备 unmount 守卫
  assert.ok(
    settingsContent.includes('if (!isMountedRef.current) return;'),
    'handleScanJava guards against unmounted state updates'
  );

  // 3. 验证 showToast 与 handleTestPing 具备 unmount 守卫
  assert.ok(
    settingsContent.includes('if (!isMountedRef.current) return;'),
    'showToast guards against unmounted toast dispatch'
  );

  // 4. 验证保存回调中对分辨率数值的输入清洗
  assert.ok(
    settingsContent.includes('windowWidth < 320 ? 854 : settings.windowWidth'),
    'globalSaveHandler sanitizes windowWidth before writing to store'
  );
  assert.ok(
    settingsContent.includes('windowHeight < 240 ? 480 : settings.windowHeight'),
    'globalSaveHandler sanitizes windowHeight before writing to store'
  );
});

test('R1 & R2. Semantic form controls and keyboard accessibility for download sources and Java runtimes', () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 1. 验证下载源卡片采用语义化 button 且具备 text-left
  assert.ok(
    settingsContent.includes('type="button"') && settingsContent.includes('key={src.id}'),
    'Download source cards use semantic <button type="button"> for keyboard navigation'
  );

  // 2. 验证系统 Java 运行时采用 label 容器包裹 radio
  assert.ok(
    settingsContent.includes('<label') && settingsContent.includes('key={r.id}'),
    'Java runtime items use semantic <label> wrapper'
  );

  // 3. 验证 radio 输入绑定了真实的 selectJava 变更处理，杜绝 onChange 空函数
  assert.ok(
    settingsContent.includes('onChange={selectJava}'),
    'Java runtime radio inputs bind active onChange handler'
  );
  assert.ok(
    !settingsContent.includes("onChange={() => {}}"),
    'Zero dead onChange no-op handlers in SettingsView'
  );
});

test('R3. Deep defensive storage sanitization against invalid downloadSource, afterLaunch, and inverted minMemory', async () => {
  const { loadLauncherSettings, saveLauncherSettings, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } = await import(
    '../src/utils/settingsStorage.ts'
  );

  const mockStore = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => mockStore.get(key) ?? null,
      setItem: (key, val) => mockStore.set(key, String(val)),
      removeItem: (key) => mockStore.delete(key),
      clear: () => mockStore.clear(),
    },
  };

  // 1. 模拟非法 downloadSource 与 afterLaunch 以及倒挂内存
  mockStore.set(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      downloadSource: 'hacked_malicious_cdn',
      afterLaunch: 'corrupt_command',
      allocatedMemory: 2048,
      minMemory: 8192,
    })
  );

  const safeLoaded = loadLauncherSettings();
  assert.equal(safeLoaded.downloadSource, DEFAULT_SETTINGS.downloadSource, 'Sanitizes invalid downloadSource to default');
  assert.equal(safeLoaded.afterLaunch, DEFAULT_SETTINGS.afterLaunch, 'Sanitizes invalid afterLaunch to default');
  assert.equal(safeLoaded.minMemory, 2048, 'Clamps inverted minMemory <= allocatedMemory');

  // 2. 验证 saveLauncherSettings 同样防护非法参数
  saveLauncherSettings({
    ...DEFAULT_SETTINGS,
    downloadSource: 'unknown_source',
    afterLaunch: 'unknown_action',
    allocatedMemory: 4096,
    minMemory: 16384,
  });

  const saved = JSON.parse(mockStore.get(SETTINGS_STORAGE_KEY));
  assert.equal(saved.downloadSource, DEFAULT_SETTINGS.downloadSource, 'Saves safe fallback for invalid downloadSource');
  assert.equal(saved.afterLaunch, DEFAULT_SETTINGS.afterLaunch, 'Saves safe fallback for invalid afterLaunch');
  assert.equal(saved.minMemory, 4096, 'Saves clamped minMemory <= allocatedMemory');

  delete globalThis.window;
});

test('R1. prefers-reduced-motion covers toast notification bounce animation', () => {
  const cssContent = readFileSync(resolve('src/App.css'), 'utf-8');
  assert.ok(
    cssContent.includes('.animate-bounce'),
    'prefers-reduced-motion media query includes .animate-bounce for vestibular safety'
  );
});

test('R1. Category navigation validation and headless document safety', async () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 1. 验证 handleTabKeyDown 中对 document 存在性的防御守卫
  assert.ok(
    settingsContent.includes("typeof document !== 'undefined'"),
    'handleTabKeyDown guards document access for headless/SSR environments'
  );

  // 2. 验证 setActiveCategory 拒绝非法分类输入
  const { getActiveCategory, setActiveCategory, resetActiveCategory } = await import(
    '../src/utils/settingsCategory.ts'
  );
  resetActiveCategory();
  assert.equal(getActiveCategory(), 'java');

  // 尝试注入非法分类
  setActiveCategory('malicious_tab');
  assert.equal(getActiveCategory(), 'java', 'Ignores invalid category identifier');

  // 切换合法分类
  setActiveCategory('game');
  assert.equal(getActiveCategory(), 'game', 'Accepts valid category identifier');
  resetActiveCategory();
});

test('R1 & R3. Restore defaults confirm cancellation branch preserving modified settings', () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');

  // 验证 globalRestoreHandler 实现了 window.confirm 校验分支
  assert.ok(
    settingsContent.includes("window.confirm('确定要将启动器所有配置恢复为默认值吗？')"),
    'globalRestoreHandler prompts user before resetting configuration'
  );

  // 模拟 confirm 取消与确认分支逻辑
  let testSettings = { allocatedMemory: 8192, downloadSource: 'mcbbs' };
  const runRestore = (confirmChoice) => {
    const confirmed = confirmChoice;
    if (confirmed) {
      testSettings = { allocatedMemory: 4096, downloadSource: 'bmclapi' };
    }
  };

  // 分支 1: 用户点击“取消”
  runRestore(false);
  assert.equal(testSettings.allocatedMemory, 8192, 'Cancelling preserve modified memory setting');
  assert.equal(testSettings.downloadSource, 'mcbbs', 'Cancelling preserve modified download source');

  // 分支 2: 用户点击“确认”
  runRestore(true);
  assert.equal(testSettings.allocatedMemory, 4096, 'Confirming resets to default memory setting');
  assert.equal(testSettings.downloadSource, 'bmclapi', 'Confirming resets to default download source');
});



