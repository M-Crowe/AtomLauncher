import React from 'react';
import type { DownloadTaskState } from '../types/downloader';
import DownloadIcon from '../assets/download.svg?react';

interface SteamDownloadBarProps {
  task: DownloadTaskState;
  onClick: () => void;
}

export const SteamDownloadBar: React.FC<SteamDownloadBarProps> = ({ task, onClick }) => {
  const isDownloading = task.status === 'downloading';
  const isCompleted = task.status === 'completed';
  const isPaused = task.status === 'paused';

  // Flat embedded bar in the outer white frame (same layer as window controls), streamlined & permanently displayed
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="steam-download-bar"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      }}
      aria-label={`下载管理器: ${task.versionId || 'Minecraft'} ${task.progressPercent}%`}
      className="
        fixed bottom-2 left-1/2 -translate-x-1/2 z-40
        flex items-center justify-between
        w-[440px] max-w-[75%]
        h-[24px] px-2.5
        bg-surface-app-bg/85 hover:bg-dirt-10/90 active:bg-dirt-20/40
        text-stone-80 hover:text-stone-100 font-fusion text-[11px]
        border border-surface-slot/40 hover:border-surface-slot
        rounded
        cursor-pointer select-none transition-all duration-150
        pointer-events-auto relative overflow-hidden
      "
    >
      {/* Left: Icon & Streamlined Title */}
      <div className="flex items-center gap-1.5 truncate min-w-0 z-10">
        <DownloadIcon
          className={`w-3 h-3 shrink-0 ${
            isDownloading ? 'text-grass-80 animate-bounce fill-current' : 'text-stone-60 fill-current'
          }`}
        />
        <span className="font-bold truncate text-[11px]">
          {isDownloading
            ? `下载中: ${task.versionId ? `MC ${task.versionId}` : '资源'}`
            : isCompleted
            ? `已完成: ${task.versionId ? `MC ${task.versionId}` : '下载'}`
            : isPaused
            ? `已暂停: ${task.versionId ? `MC ${task.versionId}` : '任务'}`
            : '下载管理'}
        </span>
      </div>

      {/* Right: Metrics / Status */}
      <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono z-10">
        {isDownloading ? (
          <>
            <span className="text-grass-80 font-bold">
              {task.speedMBs.toFixed(1)} MB/s
            </span>
            <span className="font-bold text-stone-100">
              {task.progressPercent}%
            </span>
          </>
        ) : isCompleted ? (
          <span className="text-grass-80 font-bold">100% · 已就绪</span>
        ) : isPaused ? (
          <span className="text-amber-700 font-bold">{task.progressPercent}% · 已暂停</span>
        ) : (
          <span className="text-stone-60">点击展开</span>
        )}
      </div>

      {/* Embedded slim progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-stone-40/20 overflow-hidden">
        <div
          data-testid="steam-bar-progress"
          className="h-full bg-gradient-to-r from-grass-80 to-grass-60 transition-all duration-150"
          style={{ width: `${Math.max(0, Math.min(100, task.progressPercent))}%` }}
        />
      </div>
    </div>
  );
};
