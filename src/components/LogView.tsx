import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LaunchState, LogEntry } from '../types/launcher';

interface LogViewProps {
  logs: LogEntry[];
  launchState: LaunchState;
  pid: number | null;
  selectedVersion: string;
  onBack: () => void;
  onKill: () => void;
  onClear: () => void;
}

type LevelFilter = 'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export const LogView: React.FC<LogViewProps> = ({
  logs,
  launchState,
  pid,
  selectedVersion,
  onBack,
  onKill,
  onClear,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLevel, setActiveLevel] = useState<LevelFilter>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Compute counts
  const counts = useMemo(() => {
    const res = { ALL: logs.length, INFO: 0, WARN: 0, ERROR: 0, DEBUG: 0 };
    for (const log of logs) {
      if (log.level in res) {
        res[log.level]++;
      }
    }
    return res;
  }, [logs]);

  // Filter logs by level and search query
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      const matchLevel = activeLevel === 'ALL' || log.level === activeLevel;
      const matchQuery = !q || log.line.toLowerCase().includes(q) || log.timestamp.includes(q);
      return matchLevel && matchQuery;
    });
  }, [logs, activeLevel, searchQuery]);

  const handleCopyAll = async () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.level}] ${l.line}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // Fallback
    }
  };

  const getLevelBadgeClass = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-400 bg-red-950/60 border-red-800';
      case 'WARN':
        return 'text-amber-400 bg-amber-950/60 border-amber-800';
      case 'DEBUG':
        return 'text-slate-400 bg-slate-900/60 border-slate-700';
      case 'INFO':
      default:
        return 'text-sky-400 bg-sky-950/60 border-sky-800';
    }
  };

  const getLineTextClass = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-300 font-semibold';
      case 'WARN':
        return 'text-amber-300';
      case 'DEBUG':
        return 'text-stone-400';
      case 'INFO':
      default:
        return 'text-stone-200';
    }
  };

  return (
    <div
      data-testid="full-log-view"
      className="
        flex flex-col h-full w-full
        bg-stone-90 text-stone-100 font-fusion
        overflow-hidden select-text
      "
    >
      {/* 顶部控制与状态栏 */}
      <div
        className="
          flex flex-wrap items-center justify-between
          px-3 py-2
          bg-surface-card border-b-2 border-surface-slot
          gap-2 shrink-0
        "
      >
        {/* 左侧：返回按钮与实例状态 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="log-back-button"
            onClick={onBack}
            className="
              flex items-center gap-1.5 px-3 py-1.5
              bg-stone-80 hover:bg-stone-70 active:bg-stone-90
              text-stone-100 text-xs font-bold
              border border-stone-60 rounded
              cursor-pointer select-none transition-colors
            "
          >
            <span>&larr;</span>
            <span>返回启动器</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-btn-primary-active">
              {selectedVersion}
            </span>
            {pid && (
              <span className="text-[11px] px-1.5 py-0.5 bg-stone-80 text-stone-30 border border-stone-60 rounded">
                PID: {pid}
              </span>
            )}
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                launchState === 'running'
                  ? 'bg-grass-80 text-white animate-pulse'
                  : launchState === 'crashed'
                  ? 'bg-red-800 text-white'
                  : 'bg-stone-70 text-stone-30'
              }`}
            >
              {launchState === 'running'
                ? '运行中'
                : launchState === 'crashed'
                ? '已崩溃'
                : launchState === 'launching'
                ? '拉起中'
                : '已退出'}
            </span>
          </div>
        </div>

        {/* 右侧：过滤与操作按钮 */}
        <div className="flex items-center gap-2">
          {/* 关键字搜索 */}
          <div className="relative flex items-center">
            <input
              type="text"
              data-testid="log-search-input"
              placeholder="搜索日志关键字..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                w-40 px-2 py-1 text-xs
                bg-stone-95 border border-stone-70 rounded
                text-stone-100 placeholder-stone-50
                focus:outline-none focus:border-btn-primary-active
              "
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 text-xs text-stone-40 hover:text-stone-20"
              >
                &times;
              </button>
            )}
          </div>

          {/* 锁定底部 */}
          <button
            type="button"
            data-testid="log-autoscroll-toggle"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`
              px-2 py-1 text-xs rounded border cursor-pointer select-none transition-colors
              ${
                autoScroll
                  ? 'bg-grass-80/40 border-grass-80 text-white font-bold'
                  : 'bg-stone-80 border-stone-70 text-stone-40'
              }
            `}
          >
            {autoScroll ? '锁定底部: 开' : '锁定底部: 关'}
          </button>

          {/* 复制全部 */}
          <button
            type="button"
            onClick={handleCopyAll}
            className="
              px-2 py-1 text-xs rounded
              bg-stone-80 hover:bg-stone-70 border border-stone-60
              text-stone-20 hover:text-white cursor-pointer select-none transition-colors
            "
          >
            {copyFeedback ? '已复制 ✓' : '复制全部'}
          </button>

          {/* 清空日志 */}
          <button
            type="button"
            onClick={onClear}
            className="
              px-2 py-1 text-xs rounded
              bg-stone-80 hover:bg-stone-70 border border-stone-60
              text-stone-20 hover:text-white cursor-pointer select-none transition-colors
            "
          >
            清空
          </button>

          {/* 终止进程 */}
          {launchState === 'running' && (
            <button
              type="button"
              data-testid="log-kill-button"
              onClick={onKill}
              className="
                px-2.5 py-1 text-xs rounded font-bold
                bg-redstone-100 hover:bg-red-700 text-white border border-red-900
                cursor-pointer select-none transition-colors shadow-sm
              "
            >
              强制结束 (Kill)
            </button>
          )}
        </div>
      </div>

      {/* 日志级别筛选栏 */}
      <div
        className="
          flex items-center gap-1 px-3 py-1.5
          bg-stone-95 border-b border-stone-80 text-xs shrink-0
        "
      >
        {(['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as LevelFilter[]).map((level) => {
          const isActive = activeLevel === level;
          const count = counts[level] || 0;
          return (
            <button
              key={level}
              type="button"
              onClick={() => setActiveLevel(level)}
              className={`
                px-2.5 py-0.5 rounded text-[11px] border cursor-pointer select-none transition-all
                ${
                  isActive
                    ? 'bg-btn-primary-bg text-btn-primary-text border-grass-80 font-bold'
                    : 'bg-stone-85 text-stone-40 hover:text-stone-20 border-transparent hover:border-stone-70'
                }
              `}
            >
              {level} ({count})
            </button>
          );
        })}
        <div className="ml-auto text-[11px] text-stone-50">
          显示 {filteredLogs.length} / {logs.length} 行
        </div>
      </div>

      {/* 实时日志流滚动显示区域 */}
      <div
        ref={logContainerRef}
        data-testid="log-scroll-container"
        className="
          flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed
          bg-[#141517] space-y-0.5 select-text
        "
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-stone-500 text-xs font-fusion">
            {logs.length === 0 ? '暂无日志输出，启动游戏后将在此处实时流式显示...' : '没有符合当前过滤条件的日志'}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2 hover:bg-stone-800/50 px-1 py-0.5 rounded transition-colors font-mono"
            >
              {/* 时间戳 */}
              <span className="text-stone-500 shrink-0 select-none text-[11px]">
                [{log.timestamp}]
              </span>

              {/* 日志级别徽章 */}
              <span
                className={`
                  text-[10px] px-1 py-0.2 rounded border font-bold shrink-0 select-none uppercase
                  ${getLevelBadgeClass(log.level)}
                `}
              >
                {log.level}
              </span>

              {/* 日志内容 */}
              <span className={`break-all whitespace-pre-wrap ${getLineTextClass(log.level)}`}>
                {log.line}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
