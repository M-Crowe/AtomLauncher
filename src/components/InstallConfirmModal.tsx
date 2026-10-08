import React, { useState, useEffect, useMemo } from 'react';
import type { ManifestVersionEntry, ModLoaderType } from '../types/downloader';
import type { MinecraftVersionInfo } from '../types/launcher';
import {
  getAvailableLoaders,
  getDefaultInstanceName,
  validateInstanceName,
} from '../utils/loaderService';

export interface InstallConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: ManifestVersionEntry | null;
  initialLoader?: ModLoaderType;
  initialLoaderVersion?: string;
  installedVersions: MinecraftVersionInfo[];
  onConfirm: (customName: string, loader: ModLoaderType, loaderVersion?: string) => void;
}

export const InstallConfirmModal: React.FC<InstallConfirmModalProps> = ({
  isOpen,
  onClose,
  version,
  initialLoader = 'vanilla',
  initialLoaderVersion,
  installedVersions,
  onConfirm,
}) => {
  const [selectedLoader, setSelectedLoader] = useState<ModLoaderType>(initialLoader);
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState<string>(initialLoaderVersion || '');
  const [customName, setCustomName] = useState<string>('');

  const mcVersionId = version?.id || '1.21.1';
  const availableLoaders = useMemo(() => getAvailableLoaders(mcVersionId), [mcVersionId]);

  // 当弹窗打开或版本/加载器改变时，初始化名称
  useEffect(() => {
    if (isOpen && version) {
      const loader = initialLoader || 'vanilla';
      setSelectedLoader(loader);
      const defaultName = getDefaultInstanceName(version.id, loader);
      setCustomName(defaultName);

      const loaderData = availableLoaders.find((l) => l.type === loader);
      setSelectedLoaderVersion(initialLoaderVersion || loaderData?.recommendedVersion || '');
    }
  }, [isOpen, version, initialLoader, initialLoaderVersion]);

  // 当加载器切换时，如果用户没有手动重度改名，同步更新默认后缀
  const handleSelectLoader = (loaderType: ModLoaderType) => {
    setSelectedLoader(loaderType);
    const loaderData = availableLoaders.find((l) => l.type === loaderType);
    setSelectedLoaderVersion(loaderData?.recommendedVersion || '');
    if (version) {
      setCustomName(getDefaultInstanceName(version.id, loaderType));
    }
  };

  const validation = useMemo(() => {
    return validateInstanceName(customName, installedVersions);
  }, [customName, installedVersions]);

  if (!isOpen || !version) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validation.valid) return;
    onConfirm(customName.trim(), selectedLoader, selectedLoaderVersion);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="install-confirm-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] p-4 select-none font-fusion"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-card border-4 border-surface-slot rounded shadow-[4px_4px_0_0_#1F1F1F] text-stone-90 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-dirt-10/70 border-b-2 border-surface-slot">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-stone-90">安装 Minecraft 客户端</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-grass-80 text-white font-bold">
              {version.id}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-60 hover:text-stone-90 text-sm font-mono cursor-pointer px-1"
          >
            [X]
          </button>
        </div>

        {/* 弹窗内容表单 */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* 加载器快捷确认 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-80">选择模组加载器</label>
            <div className="grid grid-cols-3 gap-2">
              {availableLoaders.map((l) => {
                const isChosen = selectedLoader === l.type;
                return (
                  <button
                    key={l.type}
                    type="button"
                    onClick={() => handleSelectLoader(l.type)}
                    className={`
                      flex flex-col items-center justify-center p-2 rounded text-xs transition-all cursor-pointer
                      ${
                        isChosen
                          ? 'bg-grass-80 text-white font-bold ring-2 ring-grass-100 shadow-sm'
                          : 'bg-white/80 hover:bg-stone-20 text-stone-80 border border-surface-slot'
                      }
                    `}
                  >
                    <span>{l.name}</span>
                    <span className="text-[10px] opacity-80">{l.badge}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 若选择了非原版加载器，显示版本选择 */}
          {selectedLoader !== 'vanilla' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-80">
                {selectedLoader.toUpperCase()} 加载器版本
              </label>
              <select
                value={selectedLoaderVersion}
                onChange={(e) => setSelectedLoaderVersion(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border-2 border-surface-slot rounded text-xs font-fusion text-stone-90 focus:outline-none focus:border-grass-80"
              >
                {availableLoaders
                  .find((l) => l.type === selectedLoader)
                  ?.versions.map((ver) => (
                    <option key={ver} value={ver}>
                      {ver}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* 版本自定义命名与防冲突校验输入框 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="install-instance-name" className="text-xs font-bold text-stone-80">
                版本自定义名称 (存储于 versions 目录)
              </label>
              <span className="text-[10px] text-stone-60 font-mono">
                {customName.length}/50
              </span>
            </div>

            <input
              id="install-instance-name"
              type="text"
              autoFocus
              data-testid="install-name-input"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="请输入自定义版本名称"
              className={`
                w-full px-3 py-2 text-xs font-fusion rounded transition-all focus:outline-none
                ${
                  !validation.valid
                    ? 'border-2 border-rose-600 bg-rose-50/50 text-stone-90 focus:ring-1 focus:ring-rose-500'
                    : 'border-2 border-surface-slot bg-white text-stone-90 focus:border-grass-80'
                }
              `}
            />

            {/* 校验提示反馈 */}
            {!validation.valid ? (
              <span
                data-testid="install-name-error"
                className="text-[11px] font-bold text-rose-600 flex items-center gap-1"
              >
                [!] {validation.error}
              </span>
            ) : (
              <span
                data-testid="install-name-success"
                className="text-[11px] font-bold text-grass-80 flex items-center gap-1"
              >
                [OK] 名称可用，将保存为独立游戏版本
              </span>
            )}
          </div>

          {/* 底部按钮栏 */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-surface-slot/60">
            <button
              type="button"
              data-testid="install-confirm-cancel"
              onClick={onClose}
              className="px-4 py-1.5 rounded font-fusion text-xs text-stone-80 bg-surface-card hover:bg-stone-20 border border-surface-slot cursor-pointer transition-colors"
            >
              取消
            </button>

            <button
              type="submit"
              data-testid="install-confirm-submit"
              disabled={!validation.valid}
              className={`
                px-5 py-1.5 rounded font-fusion text-xs font-bold transition-all shadow-sm
                ${
                  validation.valid
                    ? 'bg-grass-80 hover:bg-[#2E5E1C] active:translate-y-0.5 text-white border border-grass-100 cursor-pointer'
                    : 'bg-stone-30 text-stone-60 border border-stone-40 cursor-not-allowed opacity-60'
                }
              `}
            >
              开始下载安装
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
