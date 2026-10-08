import type { LauncherInitConfig, LauncherInitState } from '../types/init';

const IS_TAURI = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export const INIT_FALLBACK_KEY = 'atom_launcher_initialized_v1';

export async function getLauncherInitState(): Promise<LauncherInitState> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<LauncherInitState>('get_launcher_init_state');
    } catch (err) {
      console.warn('Failed to invoke get_launcher_init_state:', err);
    }
  }

  // Browser / Test fallback
  const isInit = typeof window !== 'undefined' && window.localStorage
    ? window.localStorage.getItem(INIT_FALLBACK_KEY) === 'true'
    : false;

  return {
    initialized: isInit,
    atom_dir: 'C:\\Users\\Default\\.atom',
    default_atom_dir: 'C:\\Users\\Default\\.atom',
    default_minecraft_dir: 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft',
    config: null,
  };
}

export async function saveInitConfiguration(config: LauncherInitConfig): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(INIT_FALLBACK_KEY, 'true');
  }

  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_init_configuration', { config });
      return;
    } catch (err) {
      console.warn('Failed to invoke save_init_configuration:', err);
    }
  }
}

export async function getAtomDirectory(): Promise<string> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('get_atom_directory');
    } catch (err) {
      console.warn('Failed to invoke get_atom_directory:', err);
    }
  }
  return 'C:\\Users\\Default\\.atom';
}

export async function setAtomDirectory(path: string): Promise<string> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('set_atom_directory', { path });
    } catch (err) {
      console.warn('Failed to invoke set_atom_directory:', err);
    }
  }
  return path;
}

export async function pickFolder(defaultPath?: string): Promise<string | null> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string | null>('pick_folder', { defaultPath });
    } catch (err) {
      console.warn('Failed to invoke pick_folder:', err);
    }
  }
  return null;
}

export async function pickFile(
  filterName?: string,
  filterPattern?: string,
  defaultPath?: string
): Promise<string | null> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string | null>('pick_file', { filterName, filterPattern, defaultPath });
    } catch (err) {
      console.warn('Failed to invoke pick_file:', err);
    }
  }
  return null;
}

export async function loadLauncherConfig(): Promise<Record<string, unknown>> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<Record<string, unknown>>('load_launcher_config');
    } catch (err) {
      console.warn('Failed to invoke load_launcher_config:', err);
    }
  }
  return {};
}

export async function saveLauncherConfig(config: Record<string, unknown>): Promise<void> {
  if (IS_TAURI) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_launcher_config', { config });
      return;
    } catch (err) {
      console.warn('Failed to invoke save_launcher_config:', err);
    }
  }
}
