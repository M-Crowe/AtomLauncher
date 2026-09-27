import type { Account, DeviceCodePollResult, DeviceCodeResponse } from '../types/account';

const ACCOUNT_STORAGE_KEY = 'atom_launcher_accounts_v1';

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

const DEFAULT_OFFLINE_ACCOUNT: Account = {
  id: 'offline-steve',
  name: 'Steve',
  uuid: '5627dd98-e6be-3c21-b8a8-e92344183641',
  accountType: 'offline',
  accessToken: '5627dd98e6be3c21b8a8e92344183641',
  isActive: true,
  xuid: '0',
};


type AccountsChangeListener = (accounts: Account[]) => void;
const accountListeners = new Set<AccountsChangeListener>();

export function onAccountsChange(listener: AccountsChangeListener): () => void {
  accountListeners.add(listener);
  return () => {
    accountListeners.delete(listener);
  };
}

function notifyAccountsChange(accounts: Account[]) {
  accountListeners.forEach((l) => {
    try {
      l(accounts);
    } catch (err) {
      console.error('Account change listener error:', err);
    }
  });
}

function loadLocalAccounts(): Account[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [DEFAULT_OFFLINE_ACCOUNT];
  }
  try {
    const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return [DEFAULT_OFFLINE_ACCOUNT];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [DEFAULT_OFFLINE_ACCOUNT];
  } catch {
    return [DEFAULT_OFFLINE_ACCOUNT];
  }
}

function saveLocalAccounts(accounts: Account[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
    notifyAccountsChange(accounts);
  } catch (err) {
    console.error('Failed to save accounts locally:', err);
  }
}

export async function getAccounts(): Promise<Account[]> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<Account[]>('get_accounts');
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch (err) {
      console.warn('[accountService] get_accounts failed, using local storage:', err);
    }
  }
  return loadLocalAccounts();
}

export async function getActiveAccount(): Promise<Account | null> {
  const accounts = await getAccounts();
  const active = accounts.find((a) => a.isActive);
  return active || accounts[0] || null;
}

export async function createOfflineAccount(name: string): Promise<Account> {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('玩家名不能为空');
  }

  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const acc = await invoke<Account>('create_offline_account', { name: cleanName });
      const current = await getAccounts();
      notifyAccountsChange(current);
      return acc;
    } catch (err) {
      console.warn('[accountService] create_offline_account failed, falling back:', err);
    }
  }

  // Fallback offline UUID generation
  const mockUuid = `offline-${cleanName.toLowerCase()}-${Date.now().toString(16)}`;
  const newAcc: Account = {
    id: `offline-${cleanName.toLowerCase()}`,
    name: cleanName,
    uuid: mockUuid,
    accountType: 'offline',
    accessToken: mockUuid.replace(/-/g, ''),
    isActive: true,
    xuid: '0',
  };

  const current = loadLocalAccounts().map((a) => ({ ...a, isActive: false }));
  const existingIdx = current.findIndex((a) => a.id === newAcc.id);
  if (existingIdx >= 0) {
    current[existingIdx] = newAcc;
  } else {
    current.push(newAcc);
  }
  saveLocalAccounts(current);
  return newAcc;
}

export async function setActiveAccount(id: string): Promise<Account[]> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const accounts = await invoke<Account[]>('set_active_account', { id });
      notifyAccountsChange(accounts);
      return accounts;
    } catch (err) {
      console.warn('[accountService] set_active_account failed, falling back:', err);
    }
  }

  const current = loadLocalAccounts().map((a) => ({
    ...a,
    isActive: a.id === id,
  }));
  saveLocalAccounts(current);
  return current;
}

export async function deleteAccount(id: string): Promise<Account[]> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const accounts = await invoke<Account[]>('delete_account', { id });
      notifyAccountsChange(accounts);
      return accounts;
    } catch (err) {
      console.warn('[accountService] delete_account failed, falling back:', err);
    }
  }

  let current = loadLocalAccounts().filter((a) => a.id !== id);
  if (current.length === 0) {
    current = [DEFAULT_OFFLINE_ACCOUNT];
  } else if (!current.some((a) => a.isActive)) {
    current[0].isActive = true;
  }
  saveLocalAccounts(current);
  return current;
}

export async function startDeviceCodeLogin(): Promise<DeviceCodeResponse> {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<DeviceCodeResponse>('start_device_code_login');
  }

  // Mock response for tests/browser preview
  return {
    deviceCode: 'mock-device-code-' + Date.now(),
    userCode: 'ATOM-8848',
    verificationUri: 'https://microsoft.com/devicelogin',
    expiresIn: 900,
    interval: 5,
    message: '请在浏览器中打开 https://microsoft.com/devicelogin 并输入设备码 ATOM-8848',
  };
}

export async function pollDeviceCodeLogin(deviceCode: string): Promise<DeviceCodePollResult> {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<DeviceCodePollResult>('poll_device_code_login', { deviceCode });
    if (result.status === 'success' && result.account) {
      const current = await getAccounts();
      notifyAccountsChange(current);
    }
    return result;
  }

  return {
    status: 'pending',
    message: '等待浏览器中完成授权...',
  };
}

export async function refreshAccountToken(id: string): Promise<Account> {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<Account>('refresh_account_token', { id });
  }
  const accounts = loadLocalAccounts();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) throw new Error('未找到该账号');
  return acc;
}
