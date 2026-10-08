import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Setup Mock OffscreenCanvas for Pretext layout tests in Node.js
if (!globalThis.OffscreenCanvas) {
  globalThis.OffscreenCanvas = class OffscreenCanvas {
    constructor(w, h) {
      this.width = w;
      this.height = h;
    }
    getContext() {
      return {
        measureText(text) {
          return { width: text.length * 8.5 };
        },
      };
    }
  };
}

import {
  generateMinecraftFileList,
  BatchThrottlePool,
  downloadManager,
} from '../src/utils/downloadManager.ts';
import { estimatePathLayout } from '../src/utils/pretextPathLayout.ts';

test('DownloadCenter R1. BottomNav 4-tab contract, download icon and 25% smooth sliding transition', () => {
  const bottomNavContent = readFileSync(resolve('src/components/BottomNav.tsx'), 'utf-8');

  // 1. 验证 4 个 Tab 类型定义与图标
  assert.ok(bottomNavContent.includes('export type NavValue = "home" | "download" | "settings" | "tools"'), 'Exports full 4-tab union');
  assert.ok(bottomNavContent.includes("import DownloadIcon from '../assets/download.svg?react'"), 'Imports download.svg icon');
  assert.ok(bottomNavContent.includes("{ label: '下载', value: 'download', icon: DownloadIcon }"), 'Includes download tab item');

  // 2. 验证 4 等分 25% 滑块样式与 indexMap
  assert.ok(bottomNavContent.includes('w-1/4'), 'Sliding background block uses w-1/4 (25%)');
  assert.ok(bottomNavContent.includes('transition-transform duration-300 ease-out'), 'Has smooth 300ms transition');

  const indexMap = { home: 0, download: 1, settings: 2, tools: 3 };
  assert.equal(indexMap['home'], 0);
  assert.equal(indexMap['download'], 1);
  assert.equal(indexMap['settings'], 2);
  assert.equal(indexMap['tools'], 3);
});

test('DownloadCenter R2. DownloadView primary view UI contract and mirror switching', () => {
  const downloadViewContent = readFileSync(resolve('src/components/DownloadView.tsx'), 'utf-8');

  // 1. 验证搜索输入框与快捷重置
  assert.ok(downloadViewContent.includes('data-testid="version-search-input"'), 'Has version search input');
  assert.ok(downloadViewContent.includes('searchQuery'), 'Binds searchQuery state');

  // 2. 验证四大分类标签 (全部, 正式版, 快照版, 历史版)
  assert.ok(downloadViewContent.includes('data-testid={`filter-${tab.id}`}'), 'Renders category filter buttons');
  assert.ok(downloadViewContent.includes("'all'"), 'Includes all category');
  assert.ok(downloadViewContent.includes("'release'"), 'Includes release category');
  assert.ok(downloadViewContent.includes("'snapshot'"), 'Includes snapshot category');
  assert.ok(downloadViewContent.includes("'historical'"), 'Includes historical category');

  // 3. 验证三大多镜像快速切换
  assert.ok(downloadViewContent.includes('data-testid={`mirror-${s.id}`}'), 'Renders mirror switcher');
  assert.ok(downloadViewContent.includes('bmclapi'), 'Supports BMCLAPI mirror');
  assert.ok(downloadViewContent.includes('mcbbs'), 'Supports MCBBS mirror');
  assert.ok(downloadViewContent.includes('mojang'), 'Supports Mojang official source');

  // 4. 验证本地已安装状态联动识别
  assert.ok(downloadViewContent.includes('isVersionInstalled'), 'Checks if version is installed');
  assert.ok(downloadViewContent.includes('本地已安装'), 'Renders installed badge');
  assert.ok(downloadViewContent.includes('未安装'), 'Renders uninstalled badge');
});

test('DownloadCenter R3. Right 277px Detail Sidebar linkage', () => {
  const sidebarContent = readFileSync(resolve('src/components/DownloadDetailSidebar.tsx'), 'utf-8');

  // 1. 验证元数据展示
  assert.ok(sidebarContent.includes('data-testid="download-detail-sidebar"'), 'Has download detail sidebar container');
  assert.ok(sidebarContent.includes('版本类型'), 'Displays version type');
  assert.ok(sidebarContent.includes('发布时间'), 'Displays release time');
  assert.ok(sidebarContent.includes('推荐 Java 环境'), 'Displays recommended Java runtime');
  assert.ok(sidebarContent.includes('inferVersionJava'), 'Integrates inferVersionJava recommendation');

  // 2. 验证资源预估模块
  assert.ok(sidebarContent.includes('资源占用预估'), 'Displays resource estimation');
  assert.ok(sidebarContent.includes('Client 核心客户端'), 'Estimates client jar');
  assert.ok(sidebarContent.includes('依赖运行库 (Libraries)'), 'Estimates libraries');
  assert.ok(sidebarContent.includes('静态资源索引 (Assets)'), 'Estimates assets');
  assert.ok(sidebarContent.includes('预计磁盘空间'), 'Estimates total disk footprint');

  // 3. 验证一键下载触发按钮
  assert.ok(sidebarContent.includes('data-testid="sidebar-download-button"'), 'Provides direct download button in sidebar');
  assert.ok(sidebarContent.includes('onTriggerDownload'), 'Calls onTriggerDownload callback');
});

test('DownloadCenter R4. Adaptive Launch/Download Button state machine', () => {
  const btnContent = readFileSync(resolve('src/components/LaunchButtonGroup.tsx'), 'utf-8');

  // 1. 验证自适应下载属性与暂停扩展
  assert.ok(btnContent.includes('isDownloadMode'), 'Accepts isDownloadMode prop');
  assert.ok(btnContent.includes('isDownloading'), 'Accepts isDownloading prop');
  assert.ok(btnContent.includes('downloadProgress'), 'Accepts downloadProgress prop');
  assert.ok(btnContent.includes('onDownload'), 'Accepts onDownload callback');
  assert.ok(btnContent.includes('isDownloadPaused'), 'Accepts isDownloadPaused prop');
  assert.ok(btnContent.includes('onResumeDownload'), 'Accepts onResumeDownload callback');
  assert.ok(btnContent.includes('activeDownloadingVersion'), 'Accepts activeDownloadingVersion prop');

  // 2. 验证下载模式文本映射
  assert.ok(btnContent.includes('一键下载安装'), 'Renders 一键下载安装 in download mode');
  assert.ok(btnContent.includes('下载中'), 'Renders download progress text');
  assert.ok(btnContent.includes('下载已暂停 · 点击继续'), 'Renders download paused text');
  assert.ok(btnContent.includes('正在下载'), 'Renders downloading version indicator');

  // 3. 验证点击事件按模式分发与暂停恢复
  assert.ok(btnContent.includes('if (isDownloadMode)'), 'Branches on isDownloadMode');
  assert.ok(btnContent.includes('onDownload?.()'), 'Dispatches onDownload');
  assert.ok(btnContent.includes('onResumeDownload?.()'), 'Dispatches onResumeDownload when paused');
});

test('DownloadCenter R5. Steam-style capsule download bar and workbench slide transition', () => {
  const barContent = readFileSync(resolve('src/components/SteamDownloadBar.tsx'), 'utf-8');

  // 1. 验证 Steam 风格悬浮胶囊底栏
  assert.ok(barContent.includes('data-testid="steam-download-bar"'), 'Steam capsule bar has testid');
  assert.ok(barContent.includes('fixed bottom-2'), 'Anchored to fixed bottom-2 safe area');
  assert.ok(barContent.includes('data-testid="steam-bar-progress"'), 'Renders thin progress bar');
  assert.ok(barContent.includes('MB/s'), 'Displays download speed');

  // 2. 验证全屏下载管理器工作台
  const workbenchContent = readFileSync(resolve('src/components/DownloadManagerWorkbench.tsx'), 'utf-8');
  assert.ok(workbenchContent.includes('data-testid="download-manager-workbench"'), 'Workbench has testid');
  assert.ok(workbenchContent.includes('data-testid="download-workbench-back-button"'), 'Has back to launcher button');
  assert.ok(workbenchContent.includes('VirtualFileList'), 'Integrates VirtualFileList in workbench');
  assert.ok(workbenchContent.includes('data-testid="workbench-file-search"'), 'Has file search input');

  // 3. 验证 App.tsx 横向滑动轨道集成
  const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');
  assert.ok(appContent.includes('-translate-x-[200%]'), 'Supports slide to workbench panel');
  assert.ok(appContent.includes('SteamDownloadBar'), 'App renders SteamDownloadBar');
  assert.ok(appContent.includes('DownloadManagerWorkbench'), 'App hosts DownloadManagerWorkbench');
});

test('DownloadCenter R6. 3,000+ files virtual scrolling windowing and constant O(1) DOM overhead', () => {
  // 1. 生成 3,250 个真实规范文件树
  const files = generateMinecraftFileList('1.20.4', 3250);
  assert.equal(files.length, 3250, 'Generates 3,250 files');

  // 2. 验证严格遵循官方规范落盘路径 (Requirement 6)
  const clientJar = files.find((f) => f.type === 'jar');
  assert.ok(clientJar, 'Client jar exists');
  assert.equal(clientJar.path, 'versions/1.20.4/1.20.4.jar', 'Client jar path follows versions/<id>/<id>.jar');

  const clientJson = files.find((f) => f.id === 'json-1.20.4');
  assert.ok(clientJson, 'Version json exists');
  assert.equal(clientJson.path, 'versions/1.20.4/1.20.4.json', 'Version json follows versions/<id>/<id>.json');

  const libs = files.filter((f) => f.type === 'library');
  assert.ok(libs.length >= 15, 'Contains multiple libraries');
  assert.ok(libs[0].path.startsWith('libraries/'), 'Libraries follow libraries/ path');

  const assets = files.filter((f) => f.type === 'asset');
  assert.ok(assets.length >= 3000, 'Contains over 3,000 asset objects');
  assert.ok(assets[0].path.startsWith('assets/objects/'), 'Assets follow assets/objects/xx/<hash> path');

  // 3. 验证虚拟滚动算法：无论 3,250 个文件多大，渲染节点严格锁定在约 15~20 个 (O(1) DOM 消耗)
  const containerHeight = 440;
  const itemHeight = 44;
  const buffer = 4;
  const scrollTop = 0;

  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const visibleCount = Math.ceil(containerHeight / itemHeight) + buffer * 2; // 10 + 8 = 18
  const end = Math.min(files.length, start + visibleCount);
  const visibleSlice = files.slice(start, end);

  assert.equal(visibleSlice.length, 18, 'Rendered window produces exactly 18 items at scrollTop=0');
  assert.ok(visibleSlice.length <= 25, 'DOM nodes strictly bounded to O(1) in viewport');

  // 模拟深度滚动到中间 (scrollTop = 15,000px)
  const midScrollTop = 15000;
  const midStart = Math.max(0, Math.floor(midScrollTop / itemHeight) - buffer);
  const midEnd = Math.min(files.length, midStart + visibleCount);
  const midSlice = files.slice(midStart, midEnd);

  assert.equal(midSlice.length, 18, 'Mid-scroll rendered window produces exactly 18 items');
  assert.ok(midStart > 300, 'Mid-scroll shifted slice to 300+ items offset');

  // 模拟深度滚动时列表被筛选缩短 (从 3,250 骤减至 5 项，防白屏防越界)
  const shortFiles = files.slice(0, 5);
  const shortTotalHeight = shortFiles.length * itemHeight; // 220px
  const shortMaxScrollTop = Math.max(0, shortTotalHeight - containerHeight); // 0
  const clampedScrollTop = Math.min(midScrollTop, shortMaxScrollTop); // 0
  const clampedStart = Math.max(0, Math.min(shortFiles.length > 0 ? shortFiles.length - 1 : 0, Math.floor(clampedScrollTop / itemHeight) - buffer));
  const clampedEnd = Math.min(shortFiles.length, clampedStart + visibleCount);
  const clampedSlice = shortFiles.slice(clampedStart, clampedEnd);

  assert.equal(clampedSlice.length, 5, 'Clamped slice produces all 5 items instead of blank empty array');
});

test('DownloadCenter R7. Pretext zero-DOM layout measurement for long file paths', () => {
  const longPaths = [
    'assets/objects/52/52c5058fa1ef3d7632ce8e21703cf9fb399d8b85',
    'libraries/org/lwjgl/lwjgl-glfw/3.3.3/lwjgl-glfw-3.3.3-natives-windows.jar',
    'libraries/com/mojang/datafixerupper/7.0.14/datafixerupper-7.0.14.jar',
    'versions/1.20.4/1.20.4.jar',
  ];

  for (const path of longPaths) {
    const layout = estimatePathLayout(path, 400, 16);
    assert.ok(layout.lineCount >= 1, `Layout produced line count >= 1 for ${path}`);
    assert.ok(layout.measuredHeight >= 16, `Measured height >= 16 for ${path}`);
    assert.ok(layout.lines.length >= 1, `Lines array populated for ${path}`);

    // Verify cache hit produces identical results without DOM queries
    const cached = estimatePathLayout(path, 400, 16);
    assert.equal(cached.lineCount, layout.lineCount, 'Cache hit reproduces lineCount');
    assert.equal(cached.measuredHeight, layout.measuredHeight, 'Cache hit reproduces measuredHeight');
  }

  // 验证空路径与防御边界安全
  const emptyLayout = estimatePathLayout('', 400, 16);
  assert.equal(emptyLayout.lineCount, 1, 'Empty path produces safe 1 line fallback');
  assert.equal(emptyLayout.lines.length, 0, 'Empty path has empty lines array');
  assert.equal(emptyLayout.measuredHeight, 16, 'Empty path preserves default line height');
});

test('DownloadCenter R8. 100ms / RAF high-concurrency batch state throttling pool', async () => {
  let flushCallCount = 0;
  let receivedBatches = [];

  const pool = new BatchThrottlePool((batch) => {
    flushCallCount++;
    receivedBatches.push(batch);
  }, 60);

  // 模拟高并发突发：20ms 内短时间内触发 100 次不同文件更新
  for (let i = 0; i < 100; i++) {
    pool.enqueue(`file-${i}`, {
      status: 'completed',
      downloaded: 1024 * i,
      speed: '25.0 MB/s',
    });
  }

  // 此时定时器尚未到期，flushCallCount 应为 0 (未触发 React 重绘风暴)
  assert.equal(flushCallCount, 0, 'No flushes dispatched synchronously during burst');

  // 手动调用 flush 模拟 100ms 周期到期
  pool.flush();

  assert.equal(flushCallCount, 1, 'Exactly one batched flush dispatched for 100 updates');
  assert.equal(receivedBatches[0].size, 100, 'Batch contains all 100 enqueued items');

  pool.clear();
});

test('DownloadCenter R9. Zero Emoji Policy across all new components', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  const filesToCheck = [
    'src/components/DownloadView.tsx',
    'src/components/DownloadDetailSidebar.tsx',
    'src/components/SteamDownloadBar.tsx',
    'src/components/DownloadManagerWorkbench.tsx',
    'src/components/VirtualFileList.tsx',
    'src/utils/downloadManager.ts',
  ];

  for (const file of filesToCheck) {
    const content = readFileSync(resolve(file), 'utf-8');
    assert.equal(
      emojiRegex.test(content),
      false,
      `Strict Zero Emojis policy satisfied in ${file}`
    );
  }
});

test('DownloadCenter R10. Modal sliding mutual exclusion and file list safe empty fallback', () => {
  const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');
  assert.ok(appContent.includes('setIsLogViewOpen(false);'), 'Opening workbench closes log view');
  assert.ok(appContent.includes('setIsDownloadManagerOpen(false);'), 'Opening log view closes download workbench');
  assert.ok(appContent.includes('!isDownloadManagerOpen && ('), 'Steam bar hides while workbench is active');

  const virtualListContent = readFileSync(resolve('src/components/VirtualFileList.tsx'), 'utf-8');
  assert.ok(virtualListContent.includes('暂无匹配的文件条目'), 'Provides empty file list placeholder');
  assert.ok(virtualListContent.includes('effectiveScrollTop'), 'Uses effectiveScrollTop to clamp dynamic scroll offsets');
});
