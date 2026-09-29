import React from 'react';
import type { DownloadTaskState } from '../types/downloader';
import DownloadIcon from '../assets/download.svg?react';

interface SteamDownloadBarProps {
  task: DownloadTaskState;
  onClick: () => void;
}

export const SteamDownloadBar: React.FC<SteamDownloadBarProps> = ({ task, onClick }) => {
  // If idle with no task history, do not render or render subtle standby
  if (task.status === 'idle' && task.totalFiles === 0) {
    return null;
  }

  const isDownloading = task.status === 'downloading';
  const isCompleted = task.status === 'completed';
  const isPaused = task.status === 'paused';

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="steam-download-bar"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
      aria-label={`下载管理器: ${task.versionId || 'Minecraft'} ${task.progressPercent}%`}
      className="
        fixed bottom-2 left-1/2 -translate-x-1/2 z-40
        flex flex-col items-center
        w-[440px] max-w-[92vw]
        px-3.5 py-1.5
        rounded-xl backdrop-blur-md bg-[#171a21]/95 hover:bg-[#1f242d] active:bg-[#13161c]
        text-stone-200 font-fusion text-xs
        border border-[#2a475e]/80 hover:border-[#66c0f4]
        shadow-[0_8px_24px_rgba(0,0,0,0.55)]
        cursor-pointer select-none transition-all duration-200
        active:scale-[0.99]
      "
    >
      <div className="flex items-center justify-between w-full gap-3">
        {/* Left: Icon & Version */}
        <div className="flex items-center gap-2 truncate min-w-0">
          <div className="flex items-center justify-center w-5 h-5 rounded bg-[#2a475e]/40 text-[#66c0f4] shrink-0">
            <DownloadIcon className={`w-3.5 h-3.5 fill-current ${isDownloading ? 'animate-bounce' : ''}`} />
          </div>
          <span className="font-bold text-stone-100 truncate">
            {task.versionId ? `MC ${task.versionId}` : '下载队列'}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-sans shrink-0 ${
              isCompleted
                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                : isDownloading
                ? 'bg-amber-900/60 text-amber-300 border border-amber-700/60'
                : isPaused
                ? 'bg-stone-800 text-stone-300 border border-stone-600'
                : 'bg-neutral-800 text-stone-400'
            }`}
          >
            {isCompleted ? '已完成' : isDownloading ? '下载中' : isPaused ? '已暂停' : '就绪'}
          </span>
        </div>

        {/* Right: Metrics & Files */}
        <div className="flex items-center gap-3 shrink-0 text-[11px] font-mono">
          {isDownloading && (
            <span className="text-emerald-400 font-bold">
              {task.speedMBs.toFixed(1)} MB/s
            </span>
          )}
          <span className="text-stone-400">
            {task.completedFiles.toLocaleString()} / {task.totalFiles.toLocaleString()} 项
          </span>
          <span className="font-bold text-[#66c0f4]">
            {task.progressPercent}%
          </span>
        </div>
      </div>

      {/* Sleek thin progress bar (Steam style) */}
      <div className="w-full h-1 bg-[#0e141b] rounded-full overflow-hidden mt-1.5">
        <div
          data-testid="steam-bar-progress"
          className="h-full bg-gradient-to-r from-grass-80 to-[#66c0f4] transition-all duration-150 rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, task.progressPercent))}%` }}
        />
      </div>
    </div>
  );
};
