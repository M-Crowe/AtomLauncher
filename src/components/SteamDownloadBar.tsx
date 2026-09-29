import React from 'react';
import type { DownloadTaskState } from '../types/downloader';
import DownloadIcon from '../assets/download.svg?react';

interface SteamDownloadBarProps {
  task: DownloadTaskState;
  onClick: () => void;
}

export const SteamDownloadBar: React.FC<SteamDownloadBarProps> = ({ task, onClick }) => {
  // If idle with no task history, folded/standby
  if (task.status === 'idle' && task.totalFiles === 0) {
    return null;
  }

  const isDownloading = task.status === 'downloading';
  const isCompleted = task.status === 'completed';
  const isPaused = task.status === 'paused';

  // Replaces formerly floating fixed bottom-2 design with embedded bottom-0 docking inside primary card
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
        absolute bottom-0 left-1/2 -translate-x-1/2 z-40
        flex flex-col items-center
        w-[500px] max-w-[85%]
        px-4 py-1.5
        bg-dirt-10/95 hover:bg-stone-10 active:bg-dirt-20
        text-stone-100 font-fusion text-xs
        border-t-2 border-x-2 border-surface-slot
        rounded-t-md
        shadow-[0_-3px_10px_rgba(0,0,0,0.18)]
        cursor-pointer select-none transition-all duration-200
        active:translate-y-0.5
        pointer-events-auto
      "
    >
      <div className="flex items-center justify-between w-full gap-3">
        {/* Left: Icon & Version & Status */}
        <div className="flex items-center gap-2 truncate min-w-0">
          <div className="flex items-center justify-center w-5 h-5 rounded bg-grass-80/15 text-grass-80 shrink-0">
            <DownloadIcon className={`w-3.5 h-3.5 fill-current ${isDownloading ? 'animate-bounce' : ''}`} />
          </div>
          <span className="font-bold text-stone-100 truncate">
            {task.versionId ? `MC ${task.versionId}` : '下载队列'}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-fusion shrink-0 ${
              isCompleted
                ? 'bg-grass-80 text-white font-bold'
                : isDownloading
                ? 'bg-amber-700 text-white font-bold animate-pulse'
                : isPaused
                ? 'bg-stone-60 text-white'
                : 'bg-stone-40 text-stone-80'
            }`}
          >
            {isCompleted ? '已完成' : isDownloading ? '下载中' : isPaused ? '已暂停' : '就绪'}
          </span>
        </div>

        {/* Right: Metrics & Files */}
        <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono">
          {isDownloading && (
            <span className="text-grass-80 font-bold">
              {task.speedMBs.toFixed(1)} MB/s
            </span>
          )}
          <span className="text-stone-60">
            {task.completedFiles.toLocaleString()} / {task.totalFiles.toLocaleString()} 项
          </span>
          <span className="font-bold text-grass-80">
            {task.progressPercent}%
          </span>
        </div>
      </div>

      {/* Embedded pixel-crisp progress bar */}
      <div className="w-full h-1 bg-stone-40/30 rounded-full overflow-hidden mt-1">
        <div
          data-testid="steam-bar-progress"
          className="h-full bg-gradient-to-r from-grass-80 to-grass-60 transition-all duration-150 rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, task.progressPercent))}%` }}
        />
      </div>
    </div>
  );
};
