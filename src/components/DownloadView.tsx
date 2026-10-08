import React, { useState, useEffect, useMemo } from 'react';
import type {
  DownloadSource,
  ManifestVersionEntry,
  VersionManifest,
  DownloadCategoryFilter,
  DownloadTaskState,
} from '../types/downloader';
import type { MinecraftVersionInfo } from '../types/launcher';
import { fetchVersionManifest } from '../utils/downloadService';

interface DownloadViewProps {
  selectedVersion: ManifestVersionEntry | null;
  onSelectVersion: (version: ManifestVersionEntry) => void;
  installedVersions: MinecraftVersionInfo[];
  downloadSource: DownloadSource;
  downloadTasks?: DownloadTaskState[];
  onChangeDownloadSource: (source: DownloadSource) => void;
}

export const DownloadView: React.FC<DownloadViewProps> = ({
  selectedVersion,
  onSelectVersion,
  installedVersions,
  downloadSource,
  downloadTasks,
  onChangeDownloadSource,
}) => {
  const [manifest, setManifest] = useState<VersionManifest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DownloadCategoryFilter>('release');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchVersionManifest(downloadSource)
      .then((data) => {
        if (cancelled) return;
        setManifest(data);
        if (data.versions.length > 0 && !selectedVersion) {
          const defaultRelease =
            data.versions.find((v) => v.id === data.latest.release) || data.versions[0];
          onSelectVersion(defaultRelease);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [downloadSource]);

  const filteredVersions = useMemo(() => {
    if (!manifest) return [];
    const q = searchQuery.trim().toLowerCase();

    return manifest.versions.filter((v) => {
      // Category filter
      let matchCat = true;
      if (categoryFilter === 'release') {
        matchCat = v.type === 'release';
      } else if (categoryFilter === 'snapshot') {
        matchCat = v.type === 'snapshot';
      } else if (categoryFilter === 'historical') {
        matchCat = v.type === 'old_beta' || v.type === 'old_alpha' || v.type.includes('old');
      }

      // Search query
      const matchSearch = !q || v.id.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [manifest, categoryFilter, searchQuery]);

  const isVersionInstalled = (versionId: string) => {
    return installedVersions.some((iv) => iv.id === versionId);
  };

  const getCategoryBadge = (type: string) => {
    switch (type) {
      case 'release':
        return <span className="px-1.5 py-0.5 text-[10px] font-fusion bg-grass-80 text-white rounded shrink-0">正式版</span>;
      case 'snapshot':
        return <span className="px-1.5 py-0.5 text-[10px] font-fusion bg-amber-700 text-white rounded shrink-0">快照版</span>;
      case 'old_beta':
      case 'old_alpha':
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-fusion bg-dirt-60 text-white rounded shrink-0">历史版</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      data-testid="download-view"
      className="flex flex-col h-full w-full bg-surface-card text-stone-100 font-fusion select-none overflow-hidden"
    >
      {/* 顶部搜索与分类过滤工具栏 */}
      <div className="flex flex-col gap-2.5 p-3.5 bg-dirt-10 border-b-2 border-surface-slot shrink-0">
        <div className="flex items-center justify-between gap-3">
          {/* 版本搜索框 */}
          <div className="flex-1 flex items-center bg-white/90 ring-1 ring-surface-slot/40 rounded px-3 py-1.5 focus-within:ring-2 focus-within:ring-grass-80">
            <svg
              className="w-4 h-4 fill-stone-60 mr-2 shrink-0"
              viewBox="0 0 24 24"
            >
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input
              type="text"
              data-testid="version-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索 Minecraft 版本号 (如 1.20.4, 1.21, 24w33a)..."
              className="w-full bg-transparent font-fusion text-xs text-stone-100 placeholder-stone-60 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-stone-60 hover:text-stone-100 font-fusion text-xs px-1 cursor-pointer"
              >
                清空
              </button>
            )}
          </div>

          {/* 快速镜像源切换 */}
          <div className="flex items-center gap-1 bg-white/90 p-1 rounded ring-1 ring-surface-slot/40 shrink-0">
            <span className="font-fusion text-[11px] text-stone-60 px-1">下载源:</span>
            {(
              [
                { id: 'bmclapi', label: 'BMCLAPI' },
                { id: 'mcbbs', label: 'MCBBS' },
                { id: 'mojang', label: '官方源' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                data-testid={`mirror-${s.id}`}
                onClick={() => onChangeDownloadSource(s.id)}
                className={`
                  px-2 py-0.5 font-fusion text-[11px] rounded transition-colors cursor-pointer
                  ${
                    downloadSource === s.id
                      ? 'bg-grass-80 text-white font-bold shadow-[1px_1px_0_0_#1B3B11]'
                      : 'text-stone-80 hover:text-stone-100 hover:bg-dirt-20/40'
                  }
                `}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 分类标签切换 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'all', label: '全部' },
                { id: 'release', label: '正式版' },
                { id: 'snapshot', label: '快照版' },
                { id: 'historical', label: '历史版' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`filter-${tab.id}`}
                onClick={() => setCategoryFilter(tab.id)}
                className={`
                  px-3 py-1 font-fusion text-xs rounded transition-colors cursor-pointer
                  ${
                    categoryFilter === tab.id
                      ? 'bg-grass-80 text-white font-bold ring-1 ring-grass-100 shadow-[1px_1px_0_0_#1B3B11]'
                      : 'bg-white/85 text-stone-80 ring-1 ring-surface-slot/30 hover:bg-white hover:text-stone-100'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="font-fusion text-[11px] text-stone-60">
            共找到 {filteredVersions.length} 个版本
          </span>
        </div>
      </div>

      {/* 版本列表展示区域 */}
      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-stone-60 font-fusion text-xs">
            <svg className="animate-spin w-5 h-5 text-grass-80" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span>正在连接镜像源拉取版本清单...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-redstone-60 font-fusion text-xs">
            <span>拉取版本失败: {error}</span>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchVersionManifest(downloadSource)
                  .then((d) => setManifest(d))
                  .finally(() => setLoading(false));
              }}
              className="px-3 py-1 bg-grass-80 hover:bg-grass-60 text-white rounded font-fusion text-xs cursor-pointer shadow-[1px_1px_0_0_#1B3B11]"
            >
              重试
            </button>
          </div>
        ) : filteredVersions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-stone-60 font-fusion text-xs">
            <span>未找到匹配的 Minecraft 版本</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3 py-1 bg-white ring-1 ring-surface-slot/40 text-stone-80 hover:text-stone-100 rounded cursor-pointer"
              >
                清空搜索条件
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredVersions.map((v) => {
              const isSelected = selectedVersion?.id === v.id;
              const installed = isVersionInstalled(v.id);
              const task = downloadTasks?.find((t) => t.versionId === v.id);
              const isDownloading = task?.status === 'downloading';
              const isPaused = task?.status === 'paused';

              return (
                <div
                  key={v.id}
                  role="button"
                  tabIndex={0}
                  data-testid={`version-card-${v.id}`}
                  onClick={() => onSelectVersion(v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectVersion(v);
                    }
                  }}
                  className={`
                    flex items-center justify-between p-3 rounded
                    ring-1 transition-all cursor-pointer
                    ${
                      isSelected
                        ? 'bg-stone-10 ring-2 ring-grass-80 shadow-[2px_2px_0_0_#2E5E1C]'
                        : 'bg-white/85 ring-surface-slot/30 hover:bg-white hover:ring-surface-slot/60 shadow-[1px_1px_0_0_rgba(0,0,0,0.06)]'
                    }
                  `}
                >
                  <div className="flex flex-col gap-1 truncate min-w-0 mr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-fusion font-bold text-sm text-stone-100">
                        {v.id}
                      </span>
                      {getCategoryBadge(v.type)}
                    </div>
                    <span className="font-fusion text-[10px] text-stone-60 truncate">
                      发布日期: {formatDate(v.releaseTime || v.time)}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`font-fusion text-[10px] px-2 py-0.5 rounded ${
                        installed
                          ? 'bg-grass-80/15 text-grass-80 ring-1 ring-grass-80/50 font-bold'
                          : isDownloading
                          ? 'bg-amber-600 text-white font-bold animate-pulse'
                          : isPaused
                          ? 'bg-stone-60 text-white font-bold'
                          : 'bg-dirt-20/40 text-stone-80 ring-1 ring-surface-slot/30'
                      }`}
                    >
                      {installed
                        ? '本地已安装'
                        : isDownloading
                        ? `下载中 ${task?.progressPercent}%`
                        : isPaused
                        ? `已暂停 ${task?.progressPercent}%`
                        : '未安装'}
                    </span>
                    {isSelected && (
                      <span className="font-fusion text-[10px] text-grass-80 font-bold">
                        当前选中
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
