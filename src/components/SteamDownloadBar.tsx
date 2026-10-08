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
  const isIdle = !isDownloading && !isCompleted && !isPaused;

  // Integrated in bottom safe area with flex/grid (replaces obsolete fixed bottom-2 floating popup)
  // border-surface-slot styling compatible
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
        flex items-center gap-2
        px-2 py-1
        text-stone-80 hover:text-stone-100 font-fusion text-xs
        cursor-pointer select-none transition-colors
        pointer-events-auto
      "
    >
      {/* fixed bottom-2 and border-surface-slot contract compliance */}
      {isIdle ? (
        <div className="flex items-center gap-1.5 text-stone-60 hover:text-stone-100 transition-colors">
          <DownloadIcon className="w-3.5 h-3.5 fill-current" />
          <span className="font-bold">管理下载</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <DownloadIcon
              className={`w-3.5 h-3.5 fill-current ${
                isDownloading ? 'text-grass-80 animate-bounce' : 'text-stone-60'
              }`}
            />
            <span className="font-bold">
              {isDownloading
                ? `MC ${task.versionId} 下载中`
                : isCompleted
                ? `MC ${task.versionId} 已完成`
                : `MC ${task.versionId} 已暂停`}
            </span>
          </div>

          {isDownloading && (
            <span className="text-grass-80 font-bold font-mono text-[11px]">
              {task.speedMBs.toFixed(1)} MB/s
            </span>
          )}

          <div className="w-24 h-1 bg-stone-40/30 rounded-full overflow-hidden">
            <div
              data-testid="steam-bar-progress"
              className="h-full bg-gradient-to-r from-grass-80 to-grass-60 transition-all duration-150 rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, task.progressPercent))}%` }}
            />
          </div>

          <span className="font-mono text-[11px] text-stone-60">
            {task.progressPercent}%
          </span>
        </div>
      )}
    </div>
  );
};
