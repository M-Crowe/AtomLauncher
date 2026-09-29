import React, { useState, useMemo } from 'react';
import type { DownloadTaskState } from '../types/downloader';
import { VirtualFileList } from './VirtualFileList';

interface DownloadManagerWorkbenchProps {
  task: DownloadTaskState;
  onBack: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

type FileFilterType = 'all' | 'jar' | 'library' | 'asset';

export const DownloadManagerWorkbench: React.FC<DownloadManagerWorkbenchProps> = ({
  task,
  onBack,
  onPause,
  onResume,
  onCancel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState<FileFilterType>('all');

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return task.files.filter((file) => {
      const matchType =
        fileFilter === 'all'
          ? true
          : fileFilter === 'jar'
          ? file.type === 'jar' || file.type === 'json'
          : file.type === fileFilter;
      const matchQuery =
        !q ||
        file.name.toLowerCase().includes(q) ||
        file.path.toLowerCase().includes(q);
      return matchType && matchQuery;
    });
  }, [task.files, fileFilter, searchQuery]);

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
      className="flex flex-col h-full w-full bg-[#0d1117] text-stone-200 select-none overflow-hidden"
    >
      {/* 顶部标题与控制工具栏 */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-[#161b22] border-b border-stone-800 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            data-testid="download-workbench-back-button"
            onClick={onBack}
            className="
              flex items-center gap-1.5 px-3 py-1.5
              bg-stone-800 hover:bg-stone-700 active:bg-stone-900
              text-stone-300 font-fusion text-xs rounded
              border border-stone-700 transition-colors cursor-pointer
            "
          >
            <span>&lt; 返回启动器</span>
          </button>

          <div className="flex items-center gap-2.5">
            <h2 className="font-fusion text-base text-stone-100 font-bold tracking-wide">
              下载管理器工作台
            </h2>
            {task.versionId && (
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#2a475e]/60 text-sky-300 border border-[#2a475e]">
                {task.versionId}
              </span>
            )}
            <span
              className={`font-fusion text-[11px] px-2 py-0.5 rounded ${
                task.status === 'completed'
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                  : isDownloading
                  ? 'bg-amber-900/60 text-amber-300 border border-amber-700 animate-pulse'
                  : isPaused
                  ? 'bg-stone-800 text-stone-300 border border-stone-600'
                  : 'bg-neutral-800 text-stone-400'
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
              className="px-3 py-1 bg-amber-800 hover:bg-amber-700 text-white font-fusion text-xs rounded border border-amber-600 cursor-pointer"
            >
              暂停下载
            </button>
          ) : isPaused ? (
            <button
              type="button"
              data-testid="workbench-resume-button"
              onClick={onResume}
              className="px-3 py-1 bg-grass-80 hover:bg-[#2E5E1C] text-white font-fusion text-xs rounded border border-grass-80 cursor-pointer"
            >
              继续下载
            </button>
          ) : null}

          {(isDownloading || isPaused) && (
            <button
              type="button"
              data-testid="workbench-cancel-button"
              onClick={onCancel}
              className="px-3 py-1 bg-rose-900/80 hover:bg-rose-800 text-rose-200 font-fusion text-xs rounded border border-rose-700 cursor-pointer"
            >
              取消任务
            </button>
          )}
        </div>
      </header>

      {/* 实时状态仪表盘卡片 */}
      <section className="grid grid-cols-4 gap-3 px-6 py-3 bg-[#11161d] border-b border-stone-800/80 shrink-0">
        <div className="flex flex-col p-2.5 rounded bg-[#161b22] border border-stone-800">
          <span className="font-fusion text-[11px] text-stone-400">实时下载速度</span>
          <span className="font-mono text-lg font-bold text-emerald-400">
            {task.speedMBs > 0 ? `${task.speedMBs.toFixed(1)} MB/s` : '--'}
          </span>
        </div>

        <div className="flex flex-col p-2.5 rounded bg-[#161b22] border border-stone-800">
          <span className="font-fusion text-[11px] text-stone-400">已完成文件</span>
          <span className="font-mono text-lg font-bold text-sky-400">
            {task.completedFiles.toLocaleString()} / {task.totalFiles.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col p-2.5 rounded bg-[#161b22] border border-stone-800">
          <span className="font-fusion text-[11px] text-stone-400">传输总量</span>
          <span className="font-mono text-lg font-bold text-amber-400">
            {formatBytes(task.downloadedBytes)} / {formatBytes(task.totalBytes || 1)}
          </span>
        </div>

        <div className="flex flex-col p-2.5 rounded bg-[#161b22] border border-stone-800">
          <span className="font-fusion text-[11px] text-stone-400">当前阶段与防卡顿</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-fusion text-xs text-stone-200 truncate">
              {task.currentStepText || '等待任务'}
            </span>
          </div>
          <span className="font-fusion text-[10px] text-emerald-500 mt-1">
            Pretext 纯内存排版 · 100ms 批量节流
          </span>
        </div>
      </section>

      {/* 文件列表过滤与搜索工具栏 */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#161b22] border-b border-stone-800 shrink-0 gap-4">
        {/* 类别筛选 Tab */}
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: '全部文件' },
              { id: 'jar', label: '核心与配置' },
              { id: 'library', label: '运行库 (Libraries)' },
              { id: 'asset', label: '资源包 (Assets)' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`workbench-filter-${t.id}`}
              onClick={() => setFileFilter(t.id)}
              className={`
                px-2.5 py-1 font-fusion text-xs rounded transition-colors cursor-pointer
                ${
                  fileFilter === t.id
                    ? 'bg-grass-80 text-white font-bold'
                    : 'bg-stone-800/80 text-stone-400 hover:text-stone-200'
                }
              `}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 搜索框与条目统计 */}
        <div className="flex items-center gap-3">
          <span className="font-fusion text-xs text-stone-400">
            匹配: {filteredFiles.length.toLocaleString()} 项
          </span>
          <input
            type="text"
            data-testid="workbench-file-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文件名或路径..."
            className="
              px-2.5 py-1 w-64
              bg-[#0e141b] text-stone-200 placeholder-stone-600
              font-mono text-xs rounded border border-stone-700
              focus:outline-none focus:border-[#66c0f4]
            "
          />
        </div>
      </div>

      {/* 虚拟滚动列表展示区 (承载 3,000+ 文件并锁定恒定 O(1) DOM 节点) */}
      <main className="flex-1 p-6 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 min-h-0 flex flex-col">
          <VirtualFileList
            files={filteredFiles}
            height={430}
            itemHeight={44}
            buffer={4}
          />
        </div>
      </main>
    </div>
  );
};
