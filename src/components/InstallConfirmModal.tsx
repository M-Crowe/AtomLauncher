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
  const [customName, setCustomName] = useState<string>('');

  const mcVersionId = version?.id || '1.21.1';
  const availableLoaders = useMemo(() => getAvailableLoaders(mcVersionId), [mcVersionId]);
  const currentLoaderInfo = useMemo(
    () => availableLoaders.find((l) => l.type === initialLoader) || availableLoaders[0],
    [availableLoaders, initialLoader]
  );

  // 当弹窗打开时，根据外部已选的 loader 和版本初始化名称
  useEffect(() => {
    if (isOpen && version) {
      const defaultName = getDefaultInstanceName(version.id, initialLoader);
      setCustomName(defaultName);
    }
  }, [isOpen, version, initialLoader]);

  const validation = useMemo(() => {
    return validateInstanceName(customName, installedVersions);
  }, [customName, installedVersions]);

  if (!isOpen || !version) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validation.valid) return;
    onConfirm(customName.trim(), initialLoader, initialLoaderVersion || currentLoaderInfo?.recommendedVersion);
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
            <span className="font-bold text-sm text-stone-90">版本命名与安装确认</span>
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

        {/* 弹窗内容表单：不重复展示加载器选择按钮，仅呈现已选摘要与命名输入 */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* 版本与加载器摘要（只读展示，消除界面重复） */}
          <div className="flex items-center justify-between p-3 rounded bg-white/80 border-2 border-surface-slot/40">
            <div className="flex flex-col">
              <span className="text-[10px] text-stone-60">基础游戏版本</span>
              <span className="text-xs font-bold font-mono text-stone-90">
                Minecraft {version.id}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-stone-60">已选模组加载器</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${currentLoaderInfo.badgeColor}`}>
                  {currentLoaderInfo.badge}
                </span>
                <span className="text-xs font-bold text-stone-90">
                  {currentLoaderInfo.name}
                  {initialLoader !== 'vanilla' && initialLoaderVersion ? ` (${initialLoaderVersion})` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* 版本自定义命名与防冲突校验输入框 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="install-instance-name" className="text-xs font-bold text-stone-80">
                自定义版本名称 (存储于 versions 目录)
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
