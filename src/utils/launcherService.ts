import type {
  ExitEventPayload,
  LaunchOptions,
  LaunchResult,
  LogEntry,
  MinecraftVersionInfo,
  ScanOptions,
  StartedEventPayload,
} from '../types/launcher';

// Check if running in real Tauri environment
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

export async function scanMinecraftVersions(options: ScanOptions): Promise<MinecraftVersionInfo[]> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<MinecraftVersionInfo[]>('scan_minecraft_versions', { options });
    } catch (err) {
      console.warn('[launcherService] Tauri invoke scan_minecraft_versions failed, falling back:', err);
    }
  }

  // Graceful fallback for browser/node test environments
  return [
    {
      id: '1.20.4',
      name: '1.20.4 (release)',
      typeName: 'release',
      sourcePath: options.gameDir || 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft',
      sourceLabel: '默认目录',
      jsonPath: `${options.gameDir || 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft'}\\versions\\1.20.4\\1.20.4.json`,
      loaderType: 'vanilla',
      isValid: true,
      lastModified: '今天 14:22',
    },
    {
      id: '1.21.1-fabric',
      name: '1.21.1 (Fabric 0.16.0)',
      typeName: 'modified',
      sourcePath: options.gameDir || 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft',
      sourceLabel: '默认目录',
      jsonPath: `${options.gameDir || 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft'}\\versions\\1.21.1-fabric\\1.21.1-fabric.json`,
      loaderType: 'fabric',
      isValid: true,
      lastModified: '昨天 20:15',
    },
    {
      id: '1.16.5-forge',
      name: '1.16.5 (Forge 36.2.39)',
      typeName: 'modified',
      sourcePath: options.gameDir || 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft',
      sourceLabel: '默认目录',
      jsonPath: `${options.gameDir || 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft'}\\versions\\1.16.5-forge\\1.16.5-forge.json`,
      loaderType: 'forge',
      isValid: true,
      lastModified: '3天前',
    },
  ];
}

export async function launchMinecraft(options: LaunchOptions): Promise<LaunchResult> {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<LaunchResult>('launch_minecraft', { options });
  }

  // Simulated launch result for development / test fallback
  const mockPid = Math.floor(10000 + Math.random() * 90000);
  return {
    pid: mockPid,
    versionId: options.versionId,
    commandSummary: `${options.javaPath} -Xmx${options.allocatedMemoryMb}M -cp ... net.minecraft.client.main.Main --version ${options.versionId}`,
  };
}

export async function killMinecraftInstance(pid: number): Promise<boolean> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<boolean>('kill_minecraft_instance', { pid });
    } catch (err) {
      console.error('[launcherService] kill_minecraft_instance failed:', err);
      return false;
    }
  }
  return true;
}

export async function listenMinecraftLog(
  callback: (entry: Omit<LogEntry, 'id'>) => void
): Promise<() => void> {
  if (isTauriEnvironment()) {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<Omit<LogEntry, 'id'>>('minecraft-log', (event) => {
        callback(event.payload);
      });
      return unlisten;
    } catch (err) {
      console.warn('[launcherService] Failed to listen to minecraft-log:', err);
    }
  }
  return () => {};
}

export async function listenMinecraftExit(
  callback: (payload: ExitEventPayload) => void
): Promise<() => void> {
  if (isTauriEnvironment()) {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<ExitEventPayload>('minecraft-exit', (event) => {
        callback(event.payload);
      });
      return unlisten;
    } catch (err) {
      console.warn('[launcherService] Failed to listen to minecraft-exit:', err);
    }
  }
  return () => {};
}

export async function listenMinecraftStarted(
  callback: (payload: StartedEventPayload) => void
): Promise<() => void> {
  if (isTauriEnvironment()) {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<StartedEventPayload>('minecraft-started', (event) => {
        callback(event.payload);
      });
      return unlisten;
    } catch (err) {
      console.warn('[launcherService] Failed to listen to minecraft-started:', err);
    }
  }
  return () => {};
}
