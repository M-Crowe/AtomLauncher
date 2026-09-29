export type LaunchState = 'idle' | 'checking' | 'launching' | 'running' | 'crashed' | 'exited';

export interface MinecraftVersionInfo {
  id: string;
  name: string;
  typeName: string;
  mainClass?: string;
  inheritsFrom?: string;
  lastModified?: string;
  sourcePath: string;
  sourceLabel: string;
  jsonPath: string;
  jarPath?: string;
  loaderType: 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'optifine' | 'other' | string;
  isValid: boolean;
}

export interface ScanOptions {
  gameDir?: string;
  scanSystemDirs: boolean;
  customDirs: string[];
}

export interface LaunchOptions {
  versionId: string;
  gameDir: string;
  javaPath: string;
  allocatedMemoryMb: number;
  minMemoryMb: number;
  jvmArgs?: string;
  fullscreen?: boolean;
  windowWidth?: number;
  windowHeight?: number;
  versionIsolation?: boolean;
  username?: string;
  uuid?: string;
  accessToken?: string;
  userType?: string;
  xuid?: string;
}

export interface LaunchResult {
  pid: number;
  versionId: string;
  commandSummary: string;
}

export interface LogEntry {
  id: string;
  pid: number;
  line: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  timestamp: string;
  isError: boolean;
}

export interface ExitEventPayload {
  pid: number;
  exitCode: number | null;
  success: boolean;
}

export interface StartedEventPayload {
  pid: number;
  versionId: string;
}

export interface MissingLibraryInfo {
  name: string;
  path: string;
  url?: string;
  sha1?: string;
  size?: number;
}

export interface MissingAssetInfo {
  name: string;
  path: string;
  hash: string;
  size: number;
}

export interface IntegrityReport {
  isComplete: boolean;
  missingLibraries: MissingLibraryInfo[];
  missingAssets: MissingAssetInfo[];
  missingVersionJar: boolean;
  totalMissingCount: number;
}
