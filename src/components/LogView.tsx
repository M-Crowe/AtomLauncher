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
        return 'text-rose-400 bg-rose-950/80 border border-rose-700/80';
      case 'WARN':
        return 'text-amber-400 bg-amber-950/80 border border-amber-700/80';
      case 'DEBUG':
        return 'text-purple-400 bg-purple-950/80 border border-purple-700/80';
      case 'INFO':
      default:
        return 'text-sky-400 bg-sky-950/80 border border-sky-700/80';
    }
  };

  const getLineTextClass = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-rose-300 font-semibold';
      case 'WARN':
        return 'text-amber-200';
      case 'DEBUG':
        return 'text-zinc-400';
      case 'INFO':
      default:
        return 'text-zinc-200';
    }
  };

  return (
    <div
      data-testid="full-log-view"
      className="
        flex flex-col h-full w-full
        bg-[#0d1117] text-zinc-100 font-sans
        overflow-hidden select-text
      "
    >
      {/* 顶部现代化控制与状态栏 */}
      <div
        className="
          flex flex-wrap items-center justify-between
          px-4 py-2.5
          bg-[#161b22] border-b border-[#30363d]
          gap-3 shrink-0
        "
      >
        {/* 左侧：返回按钮与实例状态 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="log-back-button"
            onClick={onBack}
            className="
              flex items-center gap-2 px-3.5 py-1.5
              rounded-md bg-[#21262d] hover:bg-[#30363d] active:bg-[#161b22]
              text-white font-sans text-xs font-semibold
              border border-[#30363d] shadow-sm
              cursor-pointer select-none transition-all duration-150
            "
          >
            <span className="text-sm font-bold">&larr;</span>
            <span>返回启动器</span>
          </button>

          <div className="flex items-center gap-2 font-sans">
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/70 px-2.5 py-1 rounded border border-emerald-800/70">
              {selectedVersion}
            </span>
            {pid && (
              <span className="text-[11px] px-2 py-0.5 bg-[#21262d] text-zinc-300 border border-[#30363d] rounded font-mono">
                PID: {pid}
              </span>
            )}
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5 ${
                launchState === 'running'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : launchState === 'crashed'
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : launchState === 'launching'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  launchState === 'running'
                    ? 'bg-emerald-400 animate-ping'
                    : launchState === 'launching'
                    ? 'bg-amber-400 animate-pulse'
                    : launchState === 'crashed'
                    ? 'bg-rose-500'
                    : 'bg-zinc-400'
                }`}
              />
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
        <div className="flex items-center gap-2 font-sans">
          {/* 关键字搜索 */}
          <div className="relative flex items-center">
            <input
              type="text"
              data-testid="log-search-input"
              placeholder="搜索日志关键字..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                w-44 px-3 py-1.5 text-xs rounded-md
                bg-[#0d1117] border border-[#30363d]
                text-zinc-100 placeholder-zinc-500
                focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500
                transition-all
              "
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-xs text-zinc-400 hover:text-zinc-100 cursor-pointer"
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
              px-3 py-1.5 text-xs rounded-md border cursor-pointer select-none transition-colors font-medium
              ${
                autoScroll
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 font-bold'
                  : 'bg-[#21262d] border-[#30363d] text-zinc-400 hover:text-zinc-200'
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
              px-3 py-1.5 text-xs rounded-md
              bg-[#21262d] hover:bg-[#30363d] border border-[#30363d]
              text-zinc-200 hover:text-white cursor-pointer select-none transition-colors font-medium
            "
          >
            {copyFeedback ? '已复制 ✓' : '复制全部'}
          </button>

          {/* 清空日志 */}
          <button
            type="button"
            onClick={onClear}
            className="
              px-3 py-1.5 text-xs rounded-md
              bg-[#21262d] hover:bg-[#30363d] border border-[#30363d]
              text-zinc-200 hover:text-white cursor-pointer select-none transition-colors font-medium
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
                px-3 py-1.5 text-xs rounded-md font-bold
                bg-rose-700 hover:bg-rose-600 text-white border border-rose-800
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
          flex items-center gap-1.5 px-4 py-1.5
          bg-[#0d1117] border-b border-[#21262d] text-xs shrink-0 font-sans
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
                px-3 py-0.5 rounded-full text-[11px] cursor-pointer select-none transition-all
                ${
                  isActive
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'bg-[#21262d] text-zinc-400 hover:text-zinc-200 hover:bg-[#30363d]'
                }
              `}
            >
              {level} ({count})
            </button>
          );
        })}
        <div className="ml-auto text-[11px] text-zinc-500 font-mono">
          显示 {filteredLogs.length} / {logs.length} 行
        </div>
      </div>

      {/* 实时日志流滚动显示区域 */}
      <div
        ref={logContainerRef}
        data-testid="log-scroll-container"
        className="
          flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed
          bg-[#0d1117] space-y-0.5 select-text
        "
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-xs font-sans">
            {logs.length === 0 ? '暂无日志输出，启动游戏后将在此处实时流式显示...' : '没有符合当前过滤条件的日志'}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2.5 hover:bg-[#161b22] px-2 py-0.5 rounded transition-colors font-mono"
            >
              {/* 时间戳 */}
              <span className="text-zinc-500 shrink-0 select-none text-[11px]">
                [{log.timestamp}]
              </span>

              {/* 日志级别徽章 */}
              <span
                className={`
                  text-[10px] px-1.5 py-0.2 rounded font-bold shrink-0 select-none uppercase
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
