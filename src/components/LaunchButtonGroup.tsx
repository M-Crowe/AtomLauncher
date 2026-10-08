import React from 'react';
import type { LaunchState } from '../types/launcher';
import DownloadIcon from '../assets/download.svg?react';

interface LaunchButtonGroupProps {
  state: LaunchState;
  selectedVersion: string;
  onLaunch: () => void;
  onKill: () => void;
  onOpenSettings: () => void;
  isDownloadMode?: boolean;
  isDownloading?: boolean;
  downloadProgress?: number;
  onDownload?: () => void;
  isDownloadPaused?: boolean;
  activeDownloadingVersion?: string;
  onResumeDownload?: () => void;
}

export const LaunchButtonGroup: React.FC<LaunchButtonGroupProps> = ({
  state,
  selectedVersion,
  onLaunch,
  onKill,
  onOpenSettings,
  isDownloadMode = false,
  isDownloading = false,
  downloadProgress = 0,
  onDownload,
  isDownloadPaused = false,
  activeDownloadingVersion,
  onResumeDownload,
}) => {
  const isRunning = state === 'running';
  const isBusy = state === 'checking' || state === 'launching';

  const handleClickMain = () => {
    if (isDownloadMode) {
      if (isDownloadPaused) {
        onResumeDownload?.();
        return;
      }
      if (!isDownloading) {
        onDownload?.();
      }
      return;
    }
    if (isRunning) {
      onKill();
    } else if (!isBusy) {
      onLaunch();
    }
  };

  // Determine button text and styling based on state machine
  let buttonText = `启动 ${selectedVersion || '1.20.4'}`;
  let btnBgClass = 'bg-btn-primary-bg hover:bg-btn-primary-hover active:bg-btn-primary-active text-btn-primary-text border-grass-80 shadow-[inset_2px_2px_0_rgba(255,255,255,0.25),inset_-2px_-2px_0_rgba(0,0,0,0.35)]';

  if (isDownloadMode) {
    if (isDownloading) {
      if (activeDownloadingVersion && activeDownloadingVersion !== selectedVersion) {
        buttonText = `正在下载 ${activeDownloadingVersion} (${downloadProgress}%)`;
      } else {
        buttonText = `下载中 ${downloadProgress}%`;
      }
      btnBgClass = 'bg-amber-600/90 text-white border-amber-800 animate-pulse';
    } else if (isDownloadPaused) {
      buttonText = '下载已暂停 · 点击继续';
      btnBgClass = 'bg-stone-700 hover:bg-stone-600 active:bg-stone-800 text-stone-200 border-stone-600 shadow-[inset_2px_2px_0_rgba(255,255,255,0.15)]';
    } else {
      buttonText = '一键下载安装';
      btnBgClass = 'bg-btn-primary-bg hover:bg-btn-primary-hover active:bg-btn-primary-active text-btn-primary-text border-grass-80 shadow-[inset_2px_2px_0_rgba(255,255,255,0.25),inset_-2px_-2px_0_rgba(0,0,0,0.35)]';
    }
  } else {
    if (state === 'checking') {
      buttonText = '检查环境中...';
      btnBgClass = 'bg-amber-600/90 text-white border-amber-800 animate-pulse';
    } else if (state === 'launching') {
      buttonText = '正在拉起...';
      btnBgClass = 'bg-amber-500/90 text-white border-amber-700 animate-pulse';
    } else if (state === 'running') {
      buttonText = '运行中 · 强制结束';
      btnBgClass = 'bg-redstone-100 hover:bg-red-700 active:bg-red-800 text-white border-red-900 shadow-[inset_2px_2px_0_rgba(255,255,255,0.25),inset_-2px_-2px_0_rgba(0,0,0,0.35)]';
    } else if (state === 'crashed') {
      buttonText = '游戏崩溃 · 点击重试';
      btnBgClass = 'bg-red-800 hover:bg-red-700 active:bg-red-900 text-white border-red-950';
    } else if (state === 'exited') {
      buttonText = '已退出 · 重新启动';
      btnBgClass = 'bg-btn-primary-bg hover:bg-btn-primary-hover active:bg-btn-primary-active text-btn-primary-text border-grass-80';
    }
  }

  return (
    <div
      data-testid="launch-button-group"
      className="
        grid h-full w-full
        grid-cols-[1fr_56px]
        gap-2 p-2
        bg-surface-slot/40
        ring-2 ring-inset ring-surface-slot
      "
    >
      {/* 大块主按钮 (启动游戏控制与下载状态自适应) */}
      <button
        type="button"
        data-testid="main-launch-button"
        disabled={(!isDownloadMode && isBusy) || (isDownloadMode && isDownloading)}
        onClick={handleClickMain}
        className={`
          flex items-center justify-center gap-1.5
          px-3 py-2
          font-fusion font-bold text-sm
          border-2 rounded
          transition-all duration-150
          cursor-pointer disabled:cursor-wait select-none
          active:translate-y-0.5
          ${btnBgClass}
        `}
      >
        {isDownloadMode && !isDownloading && (
          <DownloadIcon className="w-4 h-4 fill-current shrink-0" />
        )}
        <span className="truncate">{buttonText}</span>
      </button>

      {/* 小块副按钮 (实例快速设置入口) */}
      <button
        type="button"
        data-testid="quick-settings-button"
        title="实例快速设置"
        aria-label="实例快速设置"
        onClick={onOpenSettings}
        className="
          flex items-center justify-center
          p-2
          bg-stone-80 hover:bg-stone-70 active:bg-stone-90
          text-stone-20 hover:text-white
          border-2 border-stone-90 rounded
          shadow-[inset_2px_2px_0_rgba(255,255,255,0.15),inset_-2px_-2px_0_rgba(0,0,0,0.35)]
          transition-all duration-150
          cursor-pointer select-none
          active:translate-y-0.5
        "
      >
        <svg
          className="w-5 h-5 fill-current"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      </button>
    </div>
  );
};
