export type JavaRuntime = {
  id: string;
  name: string;
  path: string;
  version: string;
  majorVersion: number;
  arch: 'x64' | 'arm64' | 'x86';
  vendor: string;
  recommendedFor: string;
  isAutoDetected: boolean;
};

export type AfterLaunchBehavior = 'keep' | 'minimize' | 'close';

export type DownloadSource = 'bmclapi' | 'mojang' | 'mcbbs';

export type LauncherSettings = {
  // 1. Java 运行环境
  selectedJavaId: string;
  customJavaPath: string;
  useCustomJava: boolean;

  // 2. JVM 内存与启动参数
  allocatedMemory: number; // MB, default 4096
  minMemory: number; // MB, default 1024
  windowWidth: number; // default 854
  windowHeight: number; // default 480
  fullscreen: boolean;
  jvmArgs: string;

  // 3. 游戏目录与隔离
  gameDir: string;
  versionIsolation: boolean;

  // 4. 下载源与并发
  downloadSource: DownloadSource;
  downloadThreads: number;
  autoRetry: boolean;

  // 5. 启动器偏好与 UI
  afterLaunch: AfterLaunchBehavior;
  autoClose: boolean; // 兼容旧属性 (afterLaunch === 'minimize')
  creeperEffects: boolean;
  soundEffects: boolean;
  uiScale: number;
};
