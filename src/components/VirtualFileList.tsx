import React, { useRef, useState, useMemo } from 'react';
import type { DownloadFileItem } from '../types/downloader';
import { estimatePathLayout } from '../utils/pretextPathLayout';

interface VirtualFileListProps {
  files: DownloadFileItem[];
  height?: number;
  itemHeight?: number;
  buffer?: number;
  onItemClick?: (item: DownloadFileItem) => void;
}

export const VirtualFileList: React.FC<VirtualFileListProps> = ({
  files,
  height = 400,
  itemHeight = 44,
  buffer = 4,
  onItemClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalCount = files.length;
  const totalHeight = totalCount * itemHeight;
  const maxScrollTop = Math.max(0, totalHeight - height);

  // Clamp effective scroll top to avoid blank lists when filtered from deep scroll positions
  const effectiveScrollTop = Math.min(scrollTop, maxScrollTop);

  // Virtual windowing calculations: strictly lock rendered DOM nodes to visible range
  const { startIndex, offsetY, visibleFiles } = useMemo(() => {
    const start = Math.max(
      0,
      Math.min(
        totalCount > 0 ? totalCount - 1 : 0,
        Math.floor(effectiveScrollTop / itemHeight) - buffer
      )
    );
    const visibleCount = Math.ceil(height / itemHeight) + buffer * 2;
    const end = Math.min(totalCount, start + visibleCount);
    const offset = start * itemHeight;
    const slice = files.slice(start, end);

    return {
      startIndex: start,
      offsetY: offset,
      visibleFiles: slice,
    };
  }, [effectiveScrollTop, files, totalCount, height, itemHeight, buffer]);

  React.useEffect(() => {
    if (containerRef.current && containerRef.current.scrollTop > maxScrollTop && scrollTop !== maxScrollTop) {
      containerRef.current.scrollTop = maxScrollTop;
      setScrollTop(maxScrollTop);
    }
  }, [maxScrollTop, scrollTop]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(1)} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const getTypeBadge = (type: DownloadFileItem['type']) => {
    switch (type) {
      case 'jar':
        return <span className="px-1.5 py-0.5 text-[10px] font-fusion bg-grass-80 text-white rounded shrink-0">核心</span>;
      case 'json':
        return <span className="px-1.5 py-0.5 text-[10px] font-fusion bg-dirt-80 text-white rounded shrink-0">配置</span>;
      case 'library':
        return <span className="px-1.5 py-0.5 text-[10px] font-fusion bg-[#2a475e] text-sky-200 rounded shrink-0">运行库</span>;
      case 'asset':
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-fusion bg-stone-70 text-stone-200 rounded shrink-0">资源</span>;
    }
  };

  const getStatusBadge = (status: DownloadFileItem['status'], speed?: string) => {
    switch (status) {
      case 'completed':
        return <span className="text-[10px] font-fusion text-emerald-400">已就绪</span>;
      case 'downloading':
        return (
          <span className="text-[10px] font-fusion text-amber-400 animate-pulse">
            下载中 {speed ? `· ${speed}` : ''}
          </span>
        );
      case 'error':
        return <span className="text-[10px] font-fusion text-rose-400">失败</span>;
      case 'pending':
      default:
        return <span className="text-[10px] font-fusion text-stone-500">队列中</span>;
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="virtual-file-list"
      onScroll={handleScroll}
      style={{ height: `${height}px` }}
      className="w-full overflow-y-auto relative bg-[#0e141b]/90 border border-stone-800 rounded select-none no-scrollbar"
    >
      {totalCount === 0 ? (
        <div className="flex items-center justify-center h-full text-stone-500 font-fusion text-xs">
          <span>暂无匹配的文件条目</span>
        </div>
      ) : (
        <div style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}>
          {/* Rendered window slice: always clamped to ~15-20 DOM rows */}
          <div
            data-testid="virtual-slice-container"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${offsetY}px)`,
            }}
          >
            {visibleFiles.map((file, idx) => {
              const absoluteIndex = startIndex + idx;

              // Zero-DOM measurement for long path:
              const pathLayout = estimatePathLayout(file.path, 420, 16);

              return (
                <div
                  key={file.id}
                  data-testid={`virtual-file-item-${absoluteIndex}`}
                  data-line-count={pathLayout.lineCount}
                  onClick={() => onItemClick?.(file)}
                  style={{ height: `${itemHeight}px` }}
                  className={`
                    flex items-center justify-between px-3
                    border-b border-stone-800/80
                    hover:bg-neutral-800/50 transition-colors
                    cursor-pointer
                    ${file.status === 'completed' ? 'opacity-90' : 'opacity-100'}
                  `}
                >
                  <div className="flex items-center gap-2.5 truncate mr-3 min-w-0">
                    {getTypeBadge(file.type)}
                    <div className="flex flex-col truncate min-w-0">
                      <span className="font-fusion text-xs text-stone-200 truncate">
                        {file.name}
                      </span>
                      <span
                        title={file.path}
                        className="text-[10px] font-mono text-stone-400 truncate"
                      >
                        {file.path}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-stone-400">
                      {formatSize(file.size)}
                    </span>
                    {getStatusBadge(file.status, file.speed)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
