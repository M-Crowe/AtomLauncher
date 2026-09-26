import type { JavaRuntime, LauncherSettings, DownloadSource, AfterLaunchBehavior } from '../types/settings';

export const SETTINGS_STORAGE_KEY = 'atom_launcher_settings_v1';

export const DEFAULT_JAVA_RUNTIMES: JavaRuntime[] = [
  {
    id: 'jdk-21-adoptium',
    name: 'Eclipse Adoptium OpenJDK 21 (LTS)',
    path: 'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.2.13-hotspot\\bin\\javaw.exe',
    version: '21.0.2',
    majorVersion: 21,
    arch: 'x64',
    vendor: 'Eclipse Adoptium',
    recommendedFor: 'Minecraft 1.20.5+ / 1.21+ (强力推荐)',
    isAutoDetected: true,
  },
  {
    id: 'jdk-17-microsoft',
    name: 'Microsoft Build of OpenJDK 17 (LTS)',
    path: 'C:\\Program Files\\Microsoft\\jdk-17.0.10.7-hotspot\\bin\\javaw.exe',
    version: '17.0.10',
    majorVersion: 17,
    arch: 'x64',
    vendor: 'Microsoft',
    recommendedFor: 'Minecraft 1.17 - 1.20.4 (官方推荐)',
    isAutoDetected: true,
  },
  {
    id: 'jre-8-oracle',
    name: 'Oracle Java 8 SE Runtime Environment',
    path: 'C:\\Program Files\\Java\\jre1.8.0_391\\bin\\javaw.exe',
    version: '1.8.0_391',
    majorVersion: 8,
    arch: 'x64',
    vendor: 'Oracle Corporation',
    recommendedFor: 'Minecraft 1.16.5 及以下经典版本',
    isAutoDetected: true,
  },
];

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
  selectedJavaId: 'jdk-21-adoptium',
  customJavaPath: 'C:\\Program Files\\Java\\jdk-21\\bin\\javaw.exe',
  useCustomJava: false,

  allocatedMemory: 4096,
  minMemory: 1024,
  windowWidth: 854,
  windowHeight: 480,
  fullscreen: false,
  jvmArgs: '-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions',

  gameDir: 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft',
  versionIsolation: true,

  downloadSource: 'bmclapi',
  downloadThreads: 32,
  autoRetry: true,

  afterLaunch: 'minimize',
  autoClose: true,
  creeperEffects: true,
  soundEffects: true,
  uiScale: 100,
};

const VALID_DOWNLOAD_SOURCES: readonly DownloadSource[] = ['bmclapi', 'mojang', 'mcbbs'];
const VALID_AFTER_LAUNCH: readonly AfterLaunchBehavior[] = ['keep', 'minimize', 'close'];

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
  } catch (err) {
    console.error('Failed to save launcher settings:', err);
  }
}

export async function scanSystemJavaRuntimes(): Promise<JavaRuntime[]> {
  // 模拟异步扫描系统 PATH, 注册表, Program Files 及标准 JVM 目录
  await new Promise((resolve) => setTimeout(resolve, 600));
  return [
    ...DEFAULT_JAVA_RUNTIMES,
    {
      id: 'jdk-11-corretto',
      name: 'Amazon Corretto OpenJDK 11 (LTS)',
      path: 'C:\\Program Files\\Amazon Corretto\\jdk11.0.22_7\\bin\\javaw.exe',
      version: '11.0.22',
      majorVersion: 11,
      arch: 'x64',
      vendor: 'Amazon',
      recommendedFor: 'Minecraft 1.12 - 1.16.5 模组包',
      isAutoDetected: true,
    },
  ];
}
