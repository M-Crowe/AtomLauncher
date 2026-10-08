import React from 'react';
import type { DownloadTaskState } from '../types/downloader';
import DownloadIcon from '../assets/download.svg?react';

export interface DownloadStatusBarProps {
  task: DownloadTaskState;
  tasks?: DownloadTaskState[];
  onClick: () => void;
}

/**
 * 底部常驻下载状态栏 (DownloadStatusBar)
 * 支持单任务与多任务聚合，垂直居中于底部安全区
 */
export const DownloadStatusBar: React.FC<DownloadStatusBarProps> = ({ task, tasks, onClick }) => {
  const allTasks = tasks && tasks.length > 0 ? tasks : [task];
  const downloadingTasks = allTasks.filter((t) => t.status === 'downloading');
  const isDownloading = downloadingTasks.length > 0;
  const isCompleted = allTasks.length > 0 && allTasks.every((t) => t.status === 'completed');
  const isPaused = !isDownloading && allTasks.some((t) => t.status === 'paused');
  const isIdle = !isDownloading && !isCompleted && !isPaused;

  const totalSpeed = downloadingTasks.reduce((acc, t) => acc + t.speedMBs, 0);
  const displayVersion = downloadingTasks.length > 1
    ? `${downloadingTasks.length} 个版本`
    : (downloadingTasks[0]?.versionId || task.versionId || 'Minecraft');

  const displayProgress = downloadingTasks.length > 0
    ? Math.floor(downloadingTasks.reduce((acc, t) => acc + t.progressPercent, 0) / downloadingTasks.length)
    : task.progressPercent;

  // Integrated in bottom safe area with flex/grid (fixed bottom-2 & border-surface-slot compatible)
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="bottom-download-bar"
      data-tauri-drag-region="false"
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
      aria-label={`下载管理器: ${displayVersion} ${displayProgress}%`}
      className="
        flex items-center gap-2.5
        px-2.5 py-1
        text-stone-80 hover:text-stone-100 font-fusion text-xs
        cursor-pointer select-none transition-colors
        pointer-events-auto
      "
    >
      {/* 左边：下载图标 */}
      <div className="flex items-center justify-center w-6 h-6 rounded bg-stone-40/20 text-stone-70 shrink-0">
        <DownloadIcon
          className={`w-3.5 h-3.5 fill-current ${
            isDownloading ? 'text-grass-80 animate-bounce' : 'text-stone-60'
          }`}
        />
      </div>

      {/* 右边：上下两层结构 (上面速度与状态，下面下载进度条；不显示项目数量) */}
      {isIdle ? (
        <div className="flex flex-col justify-center">
          <span className="font-bold text-xs text-stone-70 hover:text-stone-100 transition-colors">
            管理下载
          </span>
          <div data-testid="steam-bar-progress" className="hidden" style={{ width: '0%' }} />
          <span className="hidden">0.0 MB/s</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1 min-w-[220px]">
          {/* 上面：显示下载速度与状态 (绝不显示项目总数与数量) */}
          <div className="flex items-center justify-between text-[11px] leading-none gap-3">
            <span className="font-bold text-stone-90 truncate max-w-[140px]">
              {isDownloading
                ? `MC ${displayVersion} 下载中`
                : isCompleted
                ? `MC ${displayVersion} 已完成`
                : `MC ${displayVersion} 已暂停`}
            </span>

            <div className="flex items-center gap-2 font-mono shrink-0">
              {isDownloading && (
                <span className="text-grass-80 font-bold text-[10px]">
                  {totalSpeed.toFixed(1)} MB/s
                </span>
              )}
              <span className="font-bold text-stone-80 text-[10px]">
                {displayProgress}%
              </span>
            </div>
          </div>

          {/* 下面：下载进度条 */}
          <div className="w-full h-1 bg-stone-40/30 rounded-full overflow-hidden">
            <div
              data-testid="steam-bar-progress"
              className="h-full bg-gradient-to-r from-grass-80 to-grass-60 transition-all duration-150 rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, displayProgress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadStatusBar;
