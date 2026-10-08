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

  const getFilePercent = (file: DownloadFileItem) => {
    if (file.status === 'completed') return 100;
    if (file.size > 0 && file.downloaded > 0) {
      return Math.min(100, Math.floor((file.downloaded / file.size) * 100));
    }
    return 0;
  };

  return (
    <div
      ref={containerRef}
      data-testid="virtual-file-list"
      onScroll={handleScroll}
      style={{ height: `${height}px` }}
      className="w-full overflow-y-auto relative bg-surface-card border-2 border-surface-slot rounded select-none no-scrollbar shadow-inner"
    >
      {totalCount === 0 ? (
        <div className="flex items-center justify-center h-full text-stone-50 font-fusion text-xs">
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
              const pathLayout = estimatePathLayout(file.path, 420, 16);
              const filePercent = getFilePercent(file);

              return (
                <div
                  key={file.id}
                  data-testid={`virtual-file-item-${absoluteIndex}`}
                  data-line-count={pathLayout.lineCount}
                  onClick={() => onItemClick?.(file)}
                  style={{ height: `${itemHeight}px` }}
                  className={`
                    flex items-center justify-between px-3.5
                    border-b border-surface-slot/40
                    hover:bg-dirt-10/50 transition-colors
                    cursor-pointer
                    ${file.status === 'completed' ? 'opacity-95' : 'opacity-100'}
                  `}
                >
                  {/* 左侧：仅显示下载的文件名称与路径提示，彻底移除“资源/核心”标签 */}
                  <div className="flex items-center gap-2 truncate mr-3 min-w-0 flex-1">
                    <span
                      title={file.path}
                      className="font-fusion text-xs font-medium text-stone-90 truncate"
                    >
                      {file.name}
                    </span>
                  </div>

                  {/* 右侧：单文件进度条、主进度百分比与状态 */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* 单文件下载进度条 */}
                    <div className="w-24 sm:w-36 h-1.5 bg-surface-slot/40 rounded-full overflow-hidden shrink-0">
                      <div
                        className={`h-full transition-all duration-150 rounded-full ${
                          file.status === 'completed'
                            ? 'bg-grass-80'
                            : file.status === 'error'
                            ? 'bg-rose-500'
                            : 'bg-gradient-to-r from-grass-80 to-grass-60'
                        }`}
                        style={{ width: `${filePercent}%` }}
                      />
                    </div>

                    {/* 主显示下载进度百分比 */}
                    <span
                      className={`font-mono text-xs font-bold w-12 text-right shrink-0 ${
                        file.status === 'completed'
                          ? 'text-grass-80'
                          : file.status === 'downloading'
                          ? 'text-amber-700'
                          : 'text-stone-70'
                      }`}
                    >
                      {filePercent}%
                    </span>

                    {/* 文件大小与实时状态 */}
                    <span className="text-[10px] font-mono text-stone-60 shrink-0 w-16 text-right truncate">
                      {file.status === 'completed'
                        ? '已完成'
                        : file.status === 'downloading'
                        ? (file.speed || '下载中')
                        : formatSize(file.size)}
                    </span>
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
