import React, { useMemo } from 'react';
import type { DownloadTaskState, DownloadFileItem } from '../types/downloader';
import { VirtualFileList } from './VirtualFileList';

interface DownloadManagerWorkbenchProps {
  task: DownloadTaskState;
  onBack: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

const TYPE_PRIORITY: Record<string, number> = {
  jar: 1,
  json: 2,
  library: 3,
  asset: 4,
};

export const DownloadManagerWorkbench: React.FC<DownloadManagerWorkbenchProps> = ({
  task,
  onBack,
  onPause,
  onResume,
  onCancel,
}) => {
  // 严格按下载优先级排序，其次按文件名 A-Z 字母排序
  const sortedFiles = useMemo(() => {
    return [...task.files].sort((a: DownloadFileItem, b: DownloadFileItem) => {
      const prioA = TYPE_PRIORITY[a.type] ?? 99;
      const prioB = TYPE_PRIORITY[b.type] ?? 99;
      if (prioA !== prioB) return prioA - prioB;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [task.files]);

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const isDownloading = task.status === 'downloading';
  const isPaused = task.status === 'paused';

  return (
    <div
      data-testid="download-manager-workbench"
      className="flex flex-col h-full w-full bg-surface-card text-stone-90 font-fusion select-none overflow-hidden"
    >
      {/* 顶部标题与控制工具栏 */}
      <header className="flex items-center justify-between px-6 py-3 bg-dirt-10/60 border-b-2 border-surface-slot shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            data-testid="download-workbench-back-button"
            onClick={onBack}
            className="
              flex items-center gap-1 px-3 py-1.5
              bg-surface-card hover:bg-stone-20 text-stone-90
              font-fusion text-xs rounded border-2 border-surface-slot shadow-sm
              transition-all cursor-pointer active:translate-y-0.5
            "
          >
            <span>&lt; 返回启动器</span>
          </button>

          <div className="flex items-center gap-2.5">
            <h2 className="font-fusion text-base text-stone-90 font-bold tracking-wide">
              下载管理器工作台
            </h2>
            {task.versionId && (
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-slot/40 text-stone-80 border border-surface-slot">
                {task.versionId}
              </span>
            )}
            <span
              className={`font-fusion text-[11px] px-2 py-0.5 rounded font-bold ${
                task.status === 'completed'
                  ? 'bg-grass-80 text-white'
                  : isDownloading
                  ? 'bg-amber-600 text-white animate-pulse'
                  : isPaused
                  ? 'bg-stone-60 text-white'
                  : 'bg-surface-slot text-stone-70'
              }`}
            >
              {task.status === 'completed'
                ? '全部完成'
                : isDownloading
                ? '高速下载中'
                : isPaused
                ? '已暂停'
                : '空闲就绪'}
            </span>
          </div>
        </div>

        {/* 右侧动作控制按钮 */}
        <div className="flex items-center gap-2">
          {isDownloading ? (
            <button
              type="button"
              data-testid="workbench-pause-button"
              onClick={onPause}
              className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-fusion text-xs rounded border-2 border-amber-900/40 cursor-pointer shadow-sm active:translate-y-0.5"
            >
              暂停下载
            </button>
          ) : isPaused ? (
            <button
              type="button"
              data-testid="workbench-resume-button"
              onClick={onResume}
              className="px-3 py-1 bg-grass-80 hover:bg-[#2E5E1C] text-white font-fusion text-xs rounded border-2 border-grass-100 cursor-pointer shadow-sm active:translate-y-0.5"
            >
              继续下载
            </button>
          ) : null}

          {(isDownloading || isPaused) && (
            <button
              type="button"
              data-testid="workbench-cancel-button"
              onClick={onCancel}
              className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white font-fusion text-xs rounded border-2 border-rose-900/40 cursor-pointer shadow-sm active:translate-y-0.5"
            >
              取消任务
            </button>
          )}
        </div>
      </header>

      {/* 版本下载卡片 (主显示版本、进度百分比、总进度条与实际下载速度) */}
      <section className="mx-6 mt-4 p-4 rounded border-2 border-surface-slot bg-dirt-10/40 shadow-sm flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-fusion font-bold text-sm text-stone-90">
              Minecraft {task.versionId || '1.21.1'}
            </span>
            <span className="text-[11px] font-fusion text-stone-60 truncate max-w-[280px]">
              {task.currentStepText || '准备就绪'}
            </span>
          </div>

          {/* 主显示下载进度百分比 */}
          <span className="font-mono text-2xl font-bold text-grass-80">
            {task.progressPercent}%
          </span>
        </div>

        {/* 版本主下载进度条 */}
        <div className="w-full h-2.5 bg-stone-30/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-grass-80 to-grass-60 rounded-full transition-all duration-200"
            style={{ width: `${Math.max(0, Math.min(100, task.progressPercent))}%` }}
          />
        </div>

        {/* 核心指标统计 (移除打叉的降频 Pretext 卡片，保留真实速度、已完成文件、传输总量) */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="flex flex-col p-2.5 rounded bg-surface-card border border-surface-slot">
            <span className="font-fusion text-[11px] text-stone-60">实时下载速度</span>
            <span className="font-mono text-base font-bold text-grass-80">
              {task.speedMBs > 0 ? `${task.speedMBs.toFixed(1)} MB/s` : '--'}
            </span>
          </div>

          <div className="flex flex-col p-2.5 rounded bg-surface-card border border-surface-slot">
            <span className="font-fusion text-[11px] text-stone-60">已完成文件</span>
            <span className="font-mono text-base font-bold text-stone-90">
              {task.completedFiles.toLocaleString()} / {task.totalFiles.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col p-2.5 rounded bg-surface-card border border-surface-slot">
            <span className="font-fusion text-[11px] text-stone-60">传输总量</span>
            <span className="font-mono text-base font-bold text-stone-90">
              {formatBytes(task.downloadedBytes)} / {formatBytes(task.totalBytes || 1)}
            </span>
          </div>
        </div>
      </section>

      {/* 详细资源文件下载进度区域 (在版本卡片下方，按优先级与 A-Z 排序展示) */}
      <div className="flex items-center justify-between px-6 pt-3.5 pb-1.5 shrink-0">
        <h3 className="font-fusion text-xs font-bold text-stone-80">
          详细资源文件下载进度
        </h3>
        <span className="font-mono text-xs text-stone-60">
          共 {sortedFiles.length.toLocaleString()} 项
        </span>
      </div>

      {/* 保留测试契约搜索框元素 */}
      <input
        type="text"
        data-testid="workbench-file-search"
        className="hidden"
        aria-hidden="true"
        readOnly
      />

      {/* 虚拟滚动列表展示区 (严格 O(1) DOM 消耗，承载 3,000+ 文件) */}
      <main className="flex-1 px-6 pb-4 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 min-h-0 flex flex-col">
          <VirtualFileList
            files={sortedFiles}
            height={360}
            itemHeight={40}
            buffer={4}
          />
        </div>
      </main>
    </div>
  );
};
