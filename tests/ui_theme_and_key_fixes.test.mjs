import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Fix 1. React Key uniqueness and deduplication across Java runtime listings', async () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');
  const initWizardContent = readFileSync(resolve('src/components/InitWizard.tsx'), 'utf-8');
  const settingsStorageContent = readFileSync(resolve('src/utils/settingsStorage.ts'), 'utf-8');
  const javaRsContent = readFileSync(resolve('src-tauri/src/launcher/java.rs'), 'utf-8');

  // 1. SettingsView renders Java runtimes with idx-suffixed unique keys
  assert.ok(
    settingsContent.includes('key={`${r.id || r.path}-${idx}`}'),
    'SettingsView maps runtimes using `${r.id || r.path}-${idx}` key'
  );

  // 2. InitWizard renders Java runtimes with idx-suffixed unique keys
  assert.ok(
    initWizardContent.includes('key={`${runtime.id || runtime.path}-${idx}`}'),
    'InitWizard maps runtimes using `${runtime.id || runtime.path}-${idx}` key'
  );

  // 3. scanSystemJavaRuntimes deduplicates detected runtimes
  assert.ok(
    settingsStorageContent.includes('const seen = new Set<string>();') &&
    settingsStorageContent.includes('(item.id || item.path || \'\').toLowerCase()'),
    'scanSystemJavaRuntimes filters out duplicate items'
  );

  // 4. Rust backend deduplicates results in detect_java_environments
  assert.ok(
    javaRsContent.includes('seen_ids.insert(info.id.clone())'),
    'Rust detect_java_environments deduplicates runtimes by ID'
  );
});

test('Fix 2. Bottom download bar click responsiveness and App.tsx inline transform slide', () => {
  const barContent = readFileSync(resolve('src/components/SteamDownloadBar.tsx'), 'utf-8');
  const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');

  // 1. SteamDownloadBar has pointer-events-auto, cursor-pointer, z-index and stopPropagation onClick
  assert.ok(barContent.includes('cursor-pointer'), 'SteamDownloadBar has cursor-pointer');
  assert.ok(barContent.includes('pointer-events-auto'), 'SteamDownloadBar enables pointer-events-auto');
  assert.ok(barContent.includes('onClick={(e) => {'), 'SteamDownloadBar handles onClick with event');
  assert.ok(barContent.includes('e.stopPropagation()'), 'SteamDownloadBar stops propagation');

  // 2. App.tsx uses inline transform style with translateX(-200%) for robust sliding into workbench
  assert.ok(
    appContent.includes("translateX(-200%)") &&
    appContent.includes("translateX(-100%)") &&
    appContent.includes("translateX(0%)"),
    'App.tsx uses inline style transform translateX(-200%) for DownloadManagerWorkbench'
  );
});

test('Fix 3. Complete unification with retro pixel warm theme and elimination of dark colors', () => {
  const downloadViewContent = readFileSync(resolve('src/components/DownloadView.tsx'), 'utf-8');
  const sidebarContent = readFileSync(resolve('src/components/DownloadDetailSidebar.tsx'), 'utf-8');

  // 1. No dark/slate hardcoded backgrounds in DownloadView
  const darkClasses = ['bg-slate-900', 'bg-[#0f141c]', 'bg-[#11161d]', 'bg-[#161b22]', 'bg-[#0e141b]'];
  for (const darkCls of darkClasses) {
    assert.equal(downloadViewContent.includes(darkCls), false, `DownloadView should not contain ${darkCls}`);
  }

  // 2. DownloadView uses retro warm theme classes
  assert.ok(downloadViewContent.includes('bg-surface-card'), 'DownloadView adopts bg-surface-card');
  assert.ok(downloadViewContent.includes('border-surface-slot'), 'DownloadView adopts border-surface-slot');
  assert.ok(downloadViewContent.includes('font-fusion'), 'DownloadView enforces font-fusion');

  // 3. DownloadDetailSidebar uses retro warm theme classes
  assert.ok(sidebarContent.includes('bg-surface-card'), 'DownloadDetailSidebar adopts bg-surface-card');
  assert.ok(sidebarContent.includes('border-surface-slot'), 'DownloadDetailSidebar adopts border-surface-slot');
  assert.ok(sidebarContent.includes('font-fusion'), 'DownloadDetailSidebar enforces font-fusion');
  assert.equal(sidebarContent.includes('border-stone-800'), false, 'DownloadDetailSidebar eliminated border-stone-800');
});

test('Fix 4. Download management control integrated cleanly in bottom safe area with grid layout', () => {
  const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');
  const barContent = readFileSync(resolve('src/components/SteamDownloadBar.tsx'), 'utf-8');

  // 1. SteamDownloadBar is rendered outside the main card container (before log button, not blocking nav)
  const cardStartIdx = appContent.indexOf('bg-surface-card ring-4 ring-inset ring-border-hard');
  const barIdx = appContent.indexOf('<SteamDownloadBar');
  const logButtonIdx = appContent.indexOf('data-testid="bottom-log-status-button"');

  assert.ok(cardStartIdx !== -1 && barIdx !== -1 && logButtonIdx !== -1, 'Elements exist in App.tsx');
  assert.ok(barIdx > cardStartIdx && barIdx < logButtonIdx, 'SteamDownloadBar is placed after main card and before log button');

  // 2. SteamDownloadBar uses clean unboxed display and safe area integration
  assert.ok(barContent.includes('fixed bottom-2'), 'SteamDownloadBar references safe area positioning');
  assert.ok(barContent.includes('管理下载'), 'SteamDownloadBar shows simplified "管理下载" when idle');
  assert.ok(appContent.includes('grid-rows-'), 'App.tsx uses grid rows layout for main window');
});

