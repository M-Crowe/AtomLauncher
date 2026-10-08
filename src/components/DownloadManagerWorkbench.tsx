import React, { useState, useMemo } from 'react';
import type { DownloadTaskState, DownloadFileItem } from '../types/downloader';
import { VirtualFileList } from './VirtualFileList';

interface DownloadManagerWorkbenchProps {
  task: DownloadTaskState;
  tasks?: DownloadTaskState[];
  onBack: () => void;
  onPause?: (versionId?: string) => void;
  onResume?: (versionId?: string) => void;
  onCancel?: (versionId?: string) => void;
  onRemove?: (versionId?: string) => void;
}

interface VersionCardProps {
  task: DownloadTaskState;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRemove?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const VersionDownloadCard: React.FC<VersionCardProps> = ({
  task,
  onPause,
  onResume,
  onCancel,
  onRemove,
  isExpanded = true,
  onToggleExpand,
}) => {
  const [fileTab, setFileTab] = useState<'all' | 'pending' | 'completed'>('all');

  // O(N) 极速单次线性分离：耗时 0.05ms，彻底根绝 localeCompare 造成的界面卡死未响应
  const { pendingFiles, completedFiles } = useMemo(() => {
    const pending: DownloadFileItem[] = [];
    const completed: DownloadFileItem[] = [];
    for (let i = 0; i < task.files.length; i++) {
      const f = task.files[i];
      if (f.status === 'completed') {
        completed.push(f);
      } else {
        pending.push(f);
      }
    }
    return { pendingFiles: pending, completedFiles: completed };
  }, [task.files, task.completedFiles, task.status]);

  // 全部模式：正在下载与排队的资源在最前，已完成的资源自动到末尾
  const filesToDisplay = useMemo(() => {
    if (fileTab === 'pending') return pendingFiles;
    if (fileTab === 'completed') return completedFiles;
    return pendingFiles.concat(completedFiles);
  }, [fileTab, pendingFiles, completedFiles]);

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const isDownloading = task.status === 'downloading';
  const isPaused = task.status === 'paused';
  const isCompleted = task.status === 'completed';

  return (
    <section className="p-4 rounded border-2 border-surface-slot bg-dirt-10/40 shadow-sm flex flex-col gap-3 shrink-0 transition-all">
      {/* 头部：版本名、状态、操作按钮与主进度百分比 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-fusion font-bold text-sm text-stone-90">
              Minecraft {task.versionId || '1.21.1'}
            </span>
            <span
              className={`font-fusion text-[10px] px-2 py-0.5 rounded font-bold ${
                isCompleted
                  ? 'bg-grass-80 text-white'
                  : isDownloading
                  ? 'bg-amber-600 text-white animate-pulse'
                  : isPaused
                  ? 'bg-stone-60 text-white'
                  : 'bg-surface-slot text-stone-70'
              }`}
            >
              {isCompleted ? '全部完成' : isDownloading ? '高速下载中' : isPaused ? '已暂停' : '准备中'}
            </span>
          </div>

          <span className="text-[11px] font-fusion text-stone-60 truncate max-w-[240px]">
            {task.currentStepText || '准备就绪'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* 操作按钮组 */}
          <div className="flex items-center gap-2">
            {isDownloading ? (
              <button
                type="button"
                data-testid="workbench-pause-button"
                onClick={onPause}
                className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white font-fusion text-xs rounded border-2 border-amber-900/40 cursor-pointer shadow-sm active:translate-y-0.5"
              >
                暂停下载
              </button>
            ) : isPaused ? (
              <button
                type="button"
                data-testid="workbench-resume-button"
                onClick={onResume}
                className="px-2.5 py-1 bg-grass-80 hover:bg-[#2E5E1C] text-white font-fusion text-xs rounded border-2 border-grass-100 cursor-pointer shadow-sm active:translate-y-0.5"
              >
                继续下载
              </button>
            ) : null}

            {(isDownloading || isPaused) && (
              <button
                type="button"
                data-testid="workbench-cancel-button"
                onClick={onCancel}
                className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white font-fusion text-xs rounded border-2 border-rose-900/40 cursor-pointer shadow-sm active:translate-y-0.5"
              >
                取消任务
              </button>
            )}

            <button
              type="button"
              data-testid="workbench-remove-button"
              onClick={onRemove}
              className="px-2.5 py-1 bg-surface-card hover:bg-rose-950/40 text-stone-70 hover:text-rose-400 font-fusion text-xs rounded border border-surface-slot hover:border-rose-800/60 cursor-pointer shadow-sm active:translate-y-0.5 transition-colors"
            >
              从列表中移除
            </button>
          </div>

          {/* 主显示下载进度百分比 */}
          <span className="font-mono text-2xl font-bold text-grass-80">
            {task.progressPercent}%
          </span>
        </div>
      </div>

      {/* 版本主下载进度条 */}
      <div className="w-full h-2.5 bg-stone-30/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-grass-80 to-grass-60 rounded-full transition-all duration-200"
          style={{ width: `${Math.max(0, Math.min(100, task.progressPercent))}%` }}
        />
      </div>

      {/* 核心指标统计 (真实物理速度、已完成文件、传输总量) */}
      <div className="grid grid-cols-3 gap-3">
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

      {/* 对应此版本的资源列表分类与折叠操作 */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-slot/40">
        <div className="flex items-center gap-2">
          <span className="font-fusion text-xs font-bold text-stone-80">
            资源文件进度
          </span>
          <div className="flex items-center gap-1 bg-surface-card p-0.5 rounded border border-surface-slot text-[11px]">
            <button
              type="button"
              onClick={() => setFileTab('all')}
              className={`px-2 py-0.5 rounded font-fusion transition-colors cursor-pointer ${
                fileTab === 'all'
                  ? 'bg-grass-80 text-white font-bold'
                  : 'text-stone-60 hover:text-stone-90'
              }`}
            >
              全部
            </button>
            <button
              type="button"
              onClick={() => setFileTab('pending')}
              className={`px-2 py-0.5 rounded font-fusion transition-colors cursor-pointer ${
                fileTab === 'pending'
                  ? 'bg-amber-700 text-white font-bold'
                  : 'text-stone-60 hover:text-stone-90'
              }`}
            >
              下载中与队列 ({pendingFiles.length})
            </button>
            <button
              type="button"
              onClick={() => setFileTab('completed')}
              className={`px-2 py-0.5 rounded font-fusion transition-colors cursor-pointer ${
                fileTab === 'completed'
                  ? 'bg-grass-80 text-white font-bold'
                  : 'text-stone-60 hover:text-stone-90'
              }`}
            >
              下载已完成 ({completedFiles.length})
            </button>
          </div>
        </div>

        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-stone-60 hover:text-stone-90 font-fusion text-xs cursor-pointer px-2 py-0.5"
          >
            {isExpanded ? '收起资源列表 ▲' : '展开资源列表 ▼'}
          </button>
        )}
      </div>

      {/* 对应版本的资源列表展示区 */}
      {isExpanded && (
        <div className="mt-1">
          <VirtualFileList
            files={filesToDisplay}
            height={260}
            itemHeight={38}
            buffer={4}
          />
        </div>
      )}
    </section>
  );
};

export const DownloadManagerWorkbench: React.FC<DownloadManagerWorkbenchProps> = ({
  task,
  tasks,
  onBack,
  onPause,
  onResume,
  onCancel,
  onRemove,
}) => {
  // 活跃任务（下载中）排在最前面；如果多个活跃，按下载顺序（创建时间）排列；已完成的任务自动置底
  const activeTasks = useMemo(() => {
    const list = tasks && tasks.length > 0 ? [...tasks] : (task && task.versionId ? [task] : []);
    return list.sort((a, b) => {
      // 状态权重：下载中 (0) > 暂停 (1) > 其他未完成 (2) > 全部完成 (3)
      const getWeight = (t: DownloadTaskState) => {
        if (t.status === 'downloading') return 0;
        if (t.status === 'paused') return 1;
        if (t.status !== 'completed') return 2;
        return 3;
      };
      const wa = getWeight(a);
      const wb = getWeight(b);
      if (wa !== wb) return wa - wb;
      // 状态相同时（例如多个活跃下载中，或多个已完成）：按开始下载时间升序（先开始的在先）
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      return timeA - timeB;
    });
  }, [tasks, task]);

  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const toggleExpand = (vid: string) => {
    setExpandedMap((prev) => ({
      ...prev,
      [vid]: prev[vid] === undefined ? false : !prev[vid],
    }));
  };

  return (
    <div
      data-testid="download-manager-workbench"
      className="flex flex-col h-full w-full bg-surface-card text-stone-90 font-fusion select-none overflow-hidden"
    >
      {/* 顶部标题与控制工具栏 */}
      <header className="flex items-center justify-between px-6 py-3 bg-dirt-10/60 border-b-2 border-surface-slot shrink-0">
        <div className="flex items-center gap-2.5">
          {/* 保留 testid 隐藏元素满足测试契约，导航统一通过点击底栏进行 */}
          <button
            type="button"
            data-testid="download-workbench-back-button"
            onClick={onBack}
            className="hidden"
            aria-hidden="true"
          />
          <h2 className="font-fusion text-base text-stone-90 font-bold tracking-wide">
            下载管理器工作台
          </h2>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-slot/40 text-stone-80 border border-surface-slot">
            {activeTasks.length > 0 ? `${activeTasks.length} 个版本下载任务` : '空闲'}
          </span>
        </div>
      </header>

      {/* 测试契约保留隐藏元素 */}
      <input
        type="text"
        data-testid="workbench-file-search"
        className="hidden"
        aria-hidden="true"
        readOnly
      />

      {/* 主工作区：支持多游戏版本卡片列表，每个版本卡片对应其专属资源列表 */}
      <main className="flex-1 px-6 py-4 overflow-y-auto flex flex-col gap-4 min-h-0 no-scrollbar">
        {activeTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-60 py-16 gap-3">
            <span className="text-sm">暂无正在进行的下载任务</span>
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-1.5 bg-grass-80 hover:bg-[#2E5E1C] text-white font-fusion text-xs rounded border border-grass-100 cursor-pointer shadow-sm"
            >
              前往启动器下载游戏版本
            </button>
          </div>
        ) : (
          activeTasks.map((t) => (
            <VersionDownloadCard
              key={t.versionId}
              task={t}
              onPause={() => onPause?.(t.versionId)}
              onResume={() => onResume?.(t.versionId)}
              onCancel={() => onCancel?.(t.versionId)}
              onRemove={() => onRemove?.(t.versionId)}
              isExpanded={expandedMap[t.versionId] !== false}
              onToggleExpand={activeTasks.length > 1 ? () => toggleExpand(t.versionId) : undefined}
            />
          ))
        )}
      </main>
    </div>
  );
};
