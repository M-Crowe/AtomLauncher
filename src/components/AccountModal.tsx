import React, { useEffect, useRef, useState } from 'react';
import type { Account, DeviceCodeResponse } from '../types/account';
import {
  createOfflineAccount,
  deleteAccount,
  getAccounts,
  pollDeviceCodeLogin,
  setActiveAccount,
  startDeviceCodeLogin,
} from '../utils/accountService';
import { PixelAvatar } from './PixelAvatar';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountSwitched?: (account: Account) => void;
}

type ModalView = 'list' | 'add-offline' | 'add-microsoft';

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onAccountSwitched,
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [view, setView] = useState<ModalView>('list');
  const [offlineName, setOfflineName] = useState('');
  const [offlineError, setOfflineError] = useState('');
  
  // Microsoft Device Code Login State
  const [deviceCodeData, setDeviceCodeData] = useState<DeviceCodeResponse | null>(null);
  const [msLoginStatus, setMsLoginStatus] = useState<string>('');
  const [isPollingMs, setIsPollingMs] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePollIdRef = useRef<number>(0);

  const refreshList = async () => {
    const list = await getAccounts();
    setAccounts(list);
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      setView('list');
      setOfflineName('');
      setOfflineError('');
      setDeviceCodeData(null);
      setMsLoginStatus('');
    }
    return () => {
      activePollIdRef.current += 1;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen]);

  // Clean up polling timer on unmount or view change
  useEffect(() => {
    if (view !== 'add-microsoft') {
      activePollIdRef.current += 1;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setIsPollingMs(false);
    }
  }, [view]);

  if (!isOpen) return null;

  const handleSelectActive = async (acc: Account) => {
    const updated = await setActiveAccount(acc.id);
    setAccounts(updated);
    onAccountSwitched?.(acc);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = await deleteAccount(id);
    setAccounts(updated);
    const active = updated.find((a) => a.isActive);
    if (active) {
      onAccountSwitched?.(active);
    }
  };

  // Offline Account Creation
  const handleCreateOffline = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = offlineName.trim();
    if (!clean) {
      setOfflineError('玩家名不能为空');
      return;
    }
    if (clean.length > 16) {
      setOfflineError('玩家名不能超过 16 个字符');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setOfflineError('只支持英文字母、数字与下划线');
      return;
    }

    try {
      const newAcc = await createOfflineAccount(clean);
      await refreshList();
      onAccountSwitched?.(newAcc);
      setView('list');
      setOfflineName('');
      setOfflineError('');
    } catch (err) {
      setOfflineError(String(err));
    }
  };

  // Microsoft Device Code Login Flow (Safe Sequential Polling)
  const handleStartMicrosoftLogin = async () => {
    setView('add-microsoft');
    setMsLoginStatus('正在向微软请求设备授权码...');
    setIsPollingMs(true);
    setCopiedCode(false);

    activePollIdRef.current += 1;
    const currentPollId = activePollIdRef.current;

    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    try {
      const data = await startDeviceCodeLogin();
      if (activePollIdRef.current !== currentPollId) return;

      setDeviceCodeData(data);
      setMsLoginStatus('等待浏览器中完成授权...');

      const pollInterval = Math.max((data.interval || 5) * 1000, 3500);

      const pollStep = async () => {
        if (activePollIdRef.current !== currentPollId) return;

        try {
          const pollRes = await pollDeviceCodeLogin(data.deviceCode);
          if (activePollIdRef.current !== currentPollId) return;

          if (pollRes.status === 'success' && pollRes.account) {
            setIsPollingMs(false);
            setMsLoginStatus('微软正版账号验证成功！');
            await refreshList();
            onAccountSwitched?.(pollRes.account);
            setTimeout(() => {
              if (activePollIdRef.current === currentPollId) {
                setView('list');
              }
            }, 1200);
            return;
          }

          if (pollRes.status === 'expired') {
            setIsPollingMs(false);
            setMsLoginStatus('设备授权码已过期，请重新尝试');
            return;
          }

          if (pollRes.status === 'error') {
            setIsPollingMs(false);
            setMsLoginStatus(pollRes.message || '授权过程中出现错误');
            return;
          }

          // Still pending, schedule next sequential tick
          setMsLoginStatus(pollRes.message || '等待微软网页授权中...');
          pollTimerRef.current = setTimeout(pollStep, pollInterval);
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
          setIsPollingMs(false);
          setMsLoginStatus(`请求异常: ${String(pollErr)}`);
        }
      };

      // Start initial poll after 1 interval
      pollTimerRef.current = setTimeout(pollStep, pollInterval);
    } catch (err) {
      setMsLoginStatus(`获取微软设备码失败: ${String(err)}`);
      setIsPollingMs(false);
    }
  };

  const handleOpenMicrosoftBrowser = async () => {
    if (!deviceCodeData) return;
    try {
      await navigator.clipboard.writeText(deviceCodeData.userCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch {
      // clipboard fallback
    }

    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(deviceCodeData.verificationUri);
    } catch {
      window.open(deviceCodeData.verificationUri, '_blank');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="account-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        data-testid="account-modal-container"
        onClick={(e) => e.stopPropagation()}
        className="
          bg-surface-card ring-4 ring-inset ring-border-hard
          w-full max-w-[500px]
          shadow-[6px_6px_0_0_rgba(0,0,0,0.5)]
          flex flex-col
          overflow-hidden
          select-none
        "
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-dirt-20/40 ring-b-2 ring-surface-slot">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-btn-primary-bg inline-block"></span>
            <h2 className="font-fusion text-base font-bold text-btn-primary-bg tracking-wide">
              {view === 'list' && 'MINECRAFT 账户中心'}
              {view === 'add-offline' && '添加离线账户 (Offline)'}
              {view === 'add-microsoft' && '微软正版设备码登录'}
            </h2>
          </div>
          <button
            type="button"
            data-testid="account-modal-close-button"
            onClick={onClose}
            className="
              w-7 h-7 flex items-center justify-center
              font-fusion text-sm font-bold text-stone-60 hover:text-white
              bg-surface-card hover:bg-redstone-100
              ring-1 ring-surface-slot
              cursor-pointer transition-colors
            "
          >
            ×
          </button>
        </div>

        {/* 视图 1: 账号列表 */}
        {view === 'list' && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-fusion text-xs text-stone-60">已保存的 Minecraft 账号 ({accounts.length})</span>
              <span className="font-fusion text-[10px] text-grass-80">点击卡片即可设为当前活跃账号</span>
            </div>

            {/* 账号滚动列表 */}
            <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto no-scrollbar pr-1">
              {accounts.map((acc) => {
                const isMicrosoft = acc.accountType === 'microsoft';
                return (
                  <div
                    key={acc.id}
                    data-testid={`account-list-item-${acc.id}`}
                    onClick={() => handleSelectActive(acc)}
                    className={`
                      flex items-center justify-between p-3
                      ring-2 ring-inset cursor-pointer transition-all
                      ${acc.isActive
                        ? 'bg-dirt-20/60 ring-grass-80 shadow-[2px_2px_0_0_rgba(76,143,38,0.4)]'
                        : 'bg-surface-card ring-surface-slot hover:bg-dirt-20/30'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <PixelAvatar skinUrl={acc.skinUrl} size={34} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-fusion text-xs font-bold text-stone-100 truncate">
                            {acc.name}
                          </span>
                          <span
                            className={`
                              font-fusion text-[9px] px-1 py-0.2 rounded-xs font-medium
                              ${isMicrosoft
                                ? 'bg-emerald-800 text-emerald-100 ring-1 ring-emerald-500/40'
                                : 'bg-stone-700 text-stone-300 ring-1 ring-stone-500/40'
                              }
                            `}
                          >
                            {isMicrosoft ? '[微软正版]' : '[离线]'}
                          </span>
                        </div>
                        <span className="font-fusion text-[9px] text-stone-60 truncate font-mono mt-0.5">
                          UUID: {acc.uuid}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {acc.isActive ? (
                        <span
                          data-testid={`account-active-badge-${acc.id}`}
                          className="font-fusion text-[10px] px-2 py-1 bg-grass-80 text-white font-bold"
                        >
                          ✓ 使用中
                        </span>
                      ) : (
                        <button
                          type="button"
                          data-testid={`account-switch-btn-${acc.id}`}
                          onClick={() => handleSelectActive(acc)}
                          className="font-fusion text-[10px] px-2 py-1 bg-surface-card hover:bg-btn-primary-bg hover:text-white ring-1 ring-surface-slot text-stone-80 cursor-pointer"
                        >
                          切换
                        </button>
                      )}

                      {accounts.length > 1 && (
                        <button
                          type="button"
                          data-testid={`account-delete-btn-${acc.id}`}
                          onClick={(e) => handleDelete(acc.id, e)}
                          title="删除该账号"
                          className="font-fusion text-[10px] px-1.5 py-1 text-stone-60 hover:text-white hover:bg-redstone-100 ring-1 ring-surface-slot cursor-pointer transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 底部添加账号按钮组 */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t-2 border-surface-slot">
              <button
                type="button"
                data-testid="add-microsoft-account-btn"
                onClick={handleStartMicrosoftLogin}
                className="
                  flex items-center justify-center gap-2 py-2.5 px-3
                  bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800
                  text-white font-fusion text-xs font-bold
                  ring-2 ring-inset ring-emerald-500
                  shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]
                  cursor-pointer transition-all
                "
              >
                <span>+</span>
                <span>添加微软正版账号</span>
              </button>

              <button
                type="button"
                data-testid="add-offline-account-btn"
                onClick={() => {
                  setView('add-offline');
                  setOfflineError('');
                  setOfflineName('');
                }}
                className="
                  flex items-center justify-center gap-2 py-2.5 px-3
                  bg-surface-card hover:bg-dirt-20/50 active:bg-dirt-20/80
                  text-stone-100 font-fusion text-xs font-bold
                  ring-2 ring-inset ring-surface-slot
                  shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]
                  cursor-pointer transition-all
                "
              >
                <span>+</span>
                <span>添加离线账号</span>
              </button>
            </div>
          </div>
        )}

        {/* 视图 2: 添加离线账号 */}
        {view === 'add-offline' && (
          <form onSubmit={handleCreateOffline} className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-fusion text-xs font-bold text-stone-100">
                离线玩家用户名 (Username)
              </label>
              <span className="font-fusion text-[10px] text-stone-60">
                支持 1-16 位英文字母、数字与下划线（支持局域网联机与离线皮肤）
              </span>
              <input
                type="text"
                autoFocus
                data-testid="offline-username-input"
                value={offlineName}
                onChange={(e) => {
                  setOfflineName(e.target.value);
                  setOfflineError('');
                }}
                placeholder="例如: Steve / Alex / Notch"
                maxLength={16}
                className="
                  mt-1 px-3 py-2 bg-dirt-20/40 text-stone-100 font-fusion text-xs
                  ring-2 ring-inset ring-surface-slot focus:ring-grass-80 focus:outline-none
                "
              />
              {offlineError && (
                <span data-testid="offline-error-msg" className="font-fusion text-[10px] text-redstone-100">
                  {offlineError}
                </span>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                data-testid="cancel-add-offline-btn"
                onClick={() => setView('list')}
                className="
                  px-4 py-2 font-fusion text-xs bg-surface-card hover:bg-dirt-20/50
                  ring-2 ring-inset ring-surface-slot text-stone-60 hover:text-white cursor-pointer
                "
              >
                返回列表
              </button>
              <button
                type="submit"
                data-testid="submit-add-offline-btn"
                className="
                  px-5 py-2 font-fusion text-xs font-bold bg-btn-primary-bg hover:bg-btn-primary-hover active:bg-btn-primary-active
                  text-white ring-2 ring-inset ring-border-hard cursor-pointer shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]
                "
              >
                确定创建
              </button>
            </div>
          </form>
        )}

        {/* 视图 3: 微软 OAuth2 设备码登录 */}
        {view === 'add-microsoft' && (
          <div className="p-5 flex flex-col gap-4 text-center">
            {deviceCodeData ? (
              <>
                <div className="flex flex-col gap-1 text-left">
                  <span className="font-fusion text-xs text-stone-100 font-bold">1. 请在打开的浏览器中完成微软授权:</span>
                  <span className="font-fusion text-[10px] text-stone-60">
                    验证网址: <span className="text-emerald-400 font-mono select-all">microsoft.com/devicelogin</span>
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-dirt-20/50 ring-2 ring-inset ring-surface-slot">
                  <span className="font-fusion text-[11px] text-stone-60 mb-1">2. 你的专属设备验证码 (User Code)</span>
                  <span
                    data-testid="microsoft-user-code-display"
                    className="font-mono text-2xl font-bold tracking-widest text-btn-primary-bg select-all py-1"
                  >
                    {deviceCodeData.userCode}
                  </span>
                  <span className="font-fusion text-[10px] text-stone-60 mt-1">
                    {copiedCode ? '✓ 已复制到剪贴板！请在网页中粘贴' : '点击下方按钮一键复制并直达验证网页'}
                  </span>
                </div>

                <button
                  type="button"
                  data-testid="open-microsoft-login-btn"
                  onClick={handleOpenMicrosoftBrowser}
                  className="
                    w-full py-2.5 px-4 font-fusion text-xs font-bold
                    bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800
                    text-white ring-2 ring-inset ring-emerald-500 shadow-[2px_2px_0_0_rgba(0,0,0,0.3)]
                    cursor-pointer transition-all flex items-center justify-center gap-2
                  "
                >
                  <span>↗</span>
                  <span>{copiedCode ? '已复制设备码！已打开验证页' : '复制设备码并打开验证页面'}</span>
                </button>
              </>
            ) : (
              <div className="py-6 flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-btn-primary-bg border-t-transparent animate-spin"></div>
                <span className="font-fusion text-xs text-stone-80">正在连接微软认证服务器...</span>
              </div>
            )}

            {/* 状态轮询提示 */}
            <div className="flex items-center justify-center gap-2 py-1">
              {isPollingMs && (
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping shrink-0" />
              )}
              <span data-testid="microsoft-poll-status" className="font-fusion text-[11px] text-stone-80">
                {msLoginStatus}
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t-2 border-surface-slot">
              <button
                type="button"
                data-testid="cancel-microsoft-login-btn"
                onClick={() => setView('list')}
                className="
                  px-4 py-2 font-fusion text-xs bg-surface-card hover:bg-dirt-20/50
                  ring-2 ring-inset ring-surface-slot text-stone-60 hover:text-white cursor-pointer
                "
              >
                取消并返回
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
