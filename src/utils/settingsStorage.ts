import type { JavaRuntime, LauncherSettings, DownloadSource, AfterLaunchBehavior } from '../types/settings';

export const SETTINGS_STORAGE_KEY = 'atom_launcher_settings_v1';

export const DEFAULT_JAVA_RUNTIMES: JavaRuntime[] = [];

export const MEMORY_PRESETS = [
  { label: '2G', value: 2048, desc: '轻量原版' },
  { label: '4G', value: 4096, desc: '推荐标准' },
  { label: '8G', value: 8192, desc: '大型模组包' },
  { label: '12G', value: 12288, desc: '光影与工业整合包' },
  { label: '16G', value: 16384, desc: '极限超重负载' },
];

export const RESOLUTION_PRESETS = [
  { label: '854 × 480', width: 854, height: 480, desc: '经典 16:9' },
  { label: '1280 × 720', width: 1280, height: 720, desc: '720P 高清' },
  { label: '1920 × 1080', width: 1920, height: 1080, desc: '1080P 全高清' },
  { label: '2560 × 1440', width: 2560, height: 1440, desc: '2K 极清' },
];

export const JVM_ARG_PRESETS = [
  {
    name: 'G1GC 基础优化',
    args: '-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50',
    desc: '平衡吞吐与 GC 暂停时间',
  },
  {
    name: 'Aikar 旗舰优化',
    args: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch',
    desc: '消除游戏卡顿与掉帧',
  },
  {
    name: 'ZGC 新一代低延迟',
    args: '-XX:+UseZGC -XX:+ZGenerational -XX:+UnlockExperimentalVMOptions',
    desc: '超低毫秒级暂停 (需 Java 21+)',
  },
];

export const DEFAULT_SETTINGS: LauncherSettings = {
  selectedJavaId: '',
  customJavaPath: '',
  useCustomJava: false,

  allocatedMemory: 4096,
  minMemory: 1024,
  windowWidth: 854,
  windowHeight: 480,
  fullscreen: false,
  jvmArgs: '-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions',

  gameDir: 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft',
  versionIsolation: true,
  scanSystemDirs: true,
  customDirs: [],
  selectedVersionId: '',

  downloadSource: 'bmclapi',
  downloadThreads: 32,
  autoRetry: true,

  afterLaunch: 'minimize',
  autoClose: true,
  creeperEffects: true,
  soundEffects: true,
  uiScale: 100,
};

export const VALID_DOWNLOAD_SOURCES: readonly DownloadSource[] = ['bmclapi', 'mojang', 'mcbbs'];
export const VALID_AFTER_LAUNCH: readonly AfterLaunchBehavior[] = ['keep', 'minimize', 'close'];

export function loadLauncherSettings(): LauncherSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const allocatedMemory =
      typeof parsed.allocatedMemory === 'number' && parsed.allocatedMemory >= 1024
        ? parsed.allocatedMemory
        : DEFAULT_SETTINGS.allocatedMemory;
    const minMemory =
      typeof parsed.minMemory === 'number' && parsed.minMemory >= 512
        ? Math.min(parsed.minMemory, allocatedMemory)
        : Math.min(DEFAULT_SETTINGS.minMemory, allocatedMemory);
    const downloadSource =
      typeof parsed.downloadSource === 'string' && VALID_DOWNLOAD_SOURCES.includes(parsed.downloadSource as DownloadSource)
        ? (parsed.downloadSource as DownloadSource)
        : DEFAULT_SETTINGS.downloadSource;
    const afterLaunch =
      typeof parsed.afterLaunch === 'string' && VALID_AFTER_LAUNCH.includes(parsed.afterLaunch as AfterLaunchBehavior)
        ? (parsed.afterLaunch as AfterLaunchBehavior)
        : DEFAULT_SETTINGS.afterLaunch;

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      windowWidth: typeof parsed.windowWidth === 'number' && parsed.windowWidth >= 320 ? parsed.windowWidth : DEFAULT_SETTINGS.windowWidth,
      windowHeight: typeof parsed.windowHeight === 'number' && parsed.windowHeight >= 240 ? parsed.windowHeight : DEFAULT_SETTINGS.windowHeight,
      allocatedMemory,
      minMemory,
      downloadSource,
      afterLaunch,
      downloadThreads: typeof parsed.downloadThreads === 'number' && parsed.downloadThreads >= 2 && parsed.downloadThreads <= 64 ? parsed.downloadThreads : DEFAULT_SETTINGS.downloadThreads,
      autoClose: parsed.afterLaunch ? parsed.afterLaunch === 'minimize' : (parsed.autoClose ?? DEFAULT_SETTINGS.autoClose),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

type SettingsChangeListener = (settings: LauncherSettings) => void;
const settingsListeners = new Set<SettingsChangeListener>();

export function onSettingsChange(listener: SettingsChangeListener): () => void {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

export function syncLauncherSettingsFromConfig(config: Record<string, unknown>): LauncherSettings {
  const current = loadLauncherSettings();
  const updated: LauncherSettings = {
    ...current,
  };

  if (typeof config.gameDir === 'string' && config.gameDir.trim()) {
    updated.gameDir = config.gameDir.trim();
  }
  if (typeof config.selectedJavaId === 'string') {
    updated.selectedJavaId = config.selectedJavaId;
  }
  if (typeof config.customJavaPath === 'string') {
    updated.customJavaPath = config.customJavaPath;
  }
  if (typeof config.useCustomJava === 'boolean') {
    updated.useCustomJava = config.useCustomJava;
  }
  if (typeof config.allocatedMemory === 'number' && config.allocatedMemory >= 1024) {
    updated.allocatedMemory = config.allocatedMemory;
  }
  if (typeof config.minMemory === 'number' && config.minMemory >= 512) {
    updated.minMemory = config.minMemory;
  }
  if (typeof config.downloadSource === 'string' && VALID_DOWNLOAD_SOURCES.includes(config.downloadSource as DownloadSource)) {
    updated.downloadSource = config.downloadSource as DownloadSource;
  }
  if (typeof config.downloadThreads === 'number' && config.downloadThreads >= 2 && config.downloadThreads <= 64) {
    updated.downloadThreads = config.downloadThreads;
  }
  if (typeof config.afterLaunch === 'string' && VALID_AFTER_LAUNCH.includes(config.afterLaunch as AfterLaunchBehavior)) {
    updated.afterLaunch = config.afterLaunch as AfterLaunchBehavior;
    updated.autoClose = config.afterLaunch === 'minimize';
  }
  if (Array.isArray(config.customDirs)) {
    updated.customDirs = config.customDirs.filter((d): d is string => typeof d === 'string');
  }
  if (typeof config.versionIsolation === 'boolean') {
    updated.versionIsolation = config.versionIsolation;
  }
  if (typeof config.scanSystemDirs === 'boolean') {
    updated.scanSystemDirs = config.scanSystemDirs;
  }
  if (typeof config.selectedVersionId === 'string') {
    updated.selectedVersionId = config.selectedVersionId;
  }
  if (typeof config.creeperEffects === 'boolean') {
    updated.creeperEffects = config.creeperEffects;
  }
  if (typeof config.soundEffects === 'boolean') {
    updated.soundEffects = config.soundEffects;
  }
  if (typeof config.jvmArgs === 'string') {
    updated.jvmArgs = config.jvmArgs;
  }
  if (typeof config.windowWidth === 'number' && config.windowWidth >= 320) {
    updated.windowWidth = config.windowWidth;
  }
  if (typeof config.windowHeight === 'number' && config.windowHeight >= 240) {
    updated.windowHeight = config.windowHeight;
  }
  if (typeof config.fullscreen === 'boolean') {
    updated.fullscreen = config.fullscreen;
  }

  saveLauncherSettings(updated);
  return updated;
}

export function saveLauncherSettings(settings: LauncherSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const allocatedMemory =
      typeof settings.allocatedMemory === 'number' && settings.allocatedMemory >= 1024
        ? settings.allocatedMemory
        : DEFAULT_SETTINGS.allocatedMemory;
    const minMemory = Math.min(
      typeof settings.minMemory === 'number' && settings.minMemory >= 512
        ? settings.minMemory
        : DEFAULT_SETTINGS.minMemory,
      allocatedMemory
    );
    const downloadSource =
      typeof settings.downloadSource === 'string' && VALID_DOWNLOAD_SOURCES.includes(settings.downloadSource)
        ? settings.downloadSource
        : DEFAULT_SETTINGS.downloadSource;
    const afterLaunch =
      typeof settings.afterLaunch === 'string' && VALID_AFTER_LAUNCH.includes(settings.afterLaunch)
        ? settings.afterLaunch
        : DEFAULT_SETTINGS.afterLaunch;

    const toSave: LauncherSettings = {
      ...settings,
      windowWidth: typeof settings.windowWidth === 'number' && settings.windowWidth >= 320 ? settings.windowWidth : DEFAULT_SETTINGS.windowWidth,
      windowHeight: typeof settings.windowHeight === 'number' && settings.windowHeight >= 240 ? settings.windowHeight : DEFAULT_SETTINGS.windowHeight,
      allocatedMemory,
      minMemory,
      downloadSource,
      afterLaunch,
      downloadThreads: typeof settings.downloadThreads === 'number' && settings.downloadThreads >= 2 && settings.downloadThreads <= 64 ? settings.downloadThreads : DEFAULT_SETTINGS.downloadThreads,
      autoClose: afterLaunch === 'minimize',
    };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(toSave));

    // Also persist to .atom/config.json in Tauri backend
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      import('./initService').then(({ saveLauncherConfig }) => {
        saveLauncherConfig(toSave as unknown as Record<string, unknown>).catch((e) =>
          console.warn('Failed to save config.json:', e)
        );
      });
    }

    // 通知所有已注册的设置变更监听器
    settingsListeners.forEach((listener) => {
      try {
        listener(toSave);
      } catch (listenerErr) {
        console.error('Error in settings change listener:', listenerErr);
      }
    });
  } catch (err) {
    console.error('Failed to save launcher settings:', err);
  }
}

export function getEffectiveJavaPath(settings: LauncherSettings, runtimes: JavaRuntime[] = []): string {
  if (settings.useCustomJava && settings.customJavaPath && settings.customJavaPath.trim()) {
    return settings.customJavaPath.trim();
  }
  const matched = runtimes.find((r) => r.id === settings.selectedJavaId);
  if (matched?.path) {
    return matched.path;
  }
  return runtimes[0]?.path || 'javaw.exe';
}

export async function scanSystemJavaRuntimes(): Promise<JavaRuntime[]> {
  try {
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
      const { invoke } = await import('@tauri-apps/api/core');
      const detected = await invoke<JavaRuntime[]>('detect_java_environments');
      if (Array.isArray(detected)) {
        return detected;
      }
    }
  } catch (err) {
    console.warn('Tauri detect_java_environments invocation failed:', err);
  }
  return [];
}

export async function measureDownloadSourceLatency(source: DownloadSource): Promise<number | null> {
  const urlMap: Record<DownloadSource, string> = {
    bmclapi: 'https://bmclapi2.bangbang93.com',
    mojang: 'https://launchermeta.mojang.com',
    mcbbs: 'https://download.mcbbs.net',
  };
  const targetUrl = urlMap[source];
  if (!targetUrl) return null;
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    await fetch(targetUrl, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
    clearTimeout(timeout);
    return Math.round(performance.now() - start);
  } catch {
    return null;
  }
}

