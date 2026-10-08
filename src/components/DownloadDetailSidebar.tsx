import type { ManifestVersionEntry, DownloadTaskState } from '../types/downloader';
import type { MinecraftVersionInfo } from '../types/launcher';
import { inferVersionJava } from '../utils/downloadService';

interface DownloadDetailSidebarProps {
  version: ManifestVersionEntry | null;
  installedVersions: MinecraftVersionInfo[];
  onTriggerDownload: () => void;
  downloadTask?: DownloadTaskState;
}

export const DownloadDetailSidebar: React.FC<DownloadDetailSidebarProps> = ({
  version,
  installedVersions,
  onTriggerDownload,
  downloadTask,
}) => {
  const [recommendedJava, setRecommendedJava] = useState<number | null>(null);

  const isInstalled = version
    ? installedVersions.some((iv) => iv.id === version.id)
    : false;

  useEffect(() => {
    if (version) {
      inferVersionJava(version.id).then((j) => setRecommendedJava(j));
    } else {
      setRecommendedJava(null);
    }
  }, [version?.id]);

  if (!version) {
    return (
      <div
        data-testid="download-detail-sidebar"
        className="flex flex-col items-center justify-center h-full p-5 text-stone-60 font-fusion text-xs text-center"
      >
        <span>请在左侧选择版本以查看详情</span>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      data-testid="download-detail-sidebar"
      className="flex flex-col justify-between h-full w-full p-4 font-fusion select-none overflow-y-auto no-scrollbar bg-surface-card text-stone-100"
    >
      <div className="flex flex-col gap-3.5">
        {/* 顶部标题与状态标签 */}
        <div className="flex items-center justify-between border-b-2 border-surface-slot/40 pb-3">
          <div className="flex flex-col">
            <span className="text-[11px] text-stone-60 font-bold uppercase tracking-wider">
              版本详细信息
            </span>
            <h3 className="text-lg font-bold text-stone-100 mt-0.5 truncate">
              {version.id}
            </h3>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
              isInstalled
                ? 'bg-grass-80/15 text-grass-80 ring-1 ring-grass-80/50'
                : 'bg-dirt-20/40 text-stone-80 ring-1 ring-surface-slot/30'
            }`}
          >
            {isInstalled ? '本地已就绪' : '未下载'}
          </span>
        </div>

        {/* 详细参数属性卡片 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between p-2 rounded bg-white/85 ring-1 ring-surface-slot/30 shadow-[1px_1px_0_0_rgba(0,0,0,0.04)]">
            <span className="text-xs text-stone-60">版本类型</span>
            <span className="text-xs text-stone-100 font-bold">
              {version.type === 'release'
                ? '正式发布版 (Release)'
                : version.type === 'snapshot'
                ? '官方快照版 (Snapshot)'
                : '历史远古版 (Historical)'}
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-white/85 ring-1 ring-surface-slot/30 shadow-[1px_1px_0_0_rgba(0,0,0,0.04)]">
            <span className="text-xs text-stone-60">发布时间</span>
            <span className="text-xs text-stone-100 font-mono">
              {formatDate(version.releaseTime || version.time)}
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-white/85 ring-1 ring-surface-slot/30 shadow-[1px_1px_0_0_rgba(0,0,0,0.04)]">
            <span className="text-xs text-stone-60">推荐 Java 环境</span>
            <span className="text-xs text-grass-80 font-bold font-mono">
              {recommendedJava ? `Java ${recommendedJava}+ (推荐)` : '正在分析...'}
            </span>
          </div>

          {/* 资源预估板块 */}
          <div className="flex flex-col p-2.5 rounded bg-white/85 ring-1 ring-surface-slot/30 shadow-[1px_1px_0_0_rgba(0,0,0,0.04)] gap-1.5">
            <span className="text-[11px] text-stone-80 font-bold">资源占用预估</span>
            <div className="flex items-center justify-between text-[11px] text-stone-80">
              <span>Client 核心客户端</span>
              <span className="font-mono text-stone-60">~26.2 MB</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-80">
              <span>依赖运行库 (Libraries)</span>
              <span className="font-mono text-stone-60">~50 MB</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-80">
              <span>静态资源索引 (Assets)</span>
              <span className="font-mono text-stone-60">~680 MB</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-grass-80 font-bold pt-1 border-t border-surface-slot/30">
              <span>预计磁盘空间</span>
              <span className="font-mono">~750 MB</span>
            </div>
          </div>

          {/* SHA-1 完整性校验 */}
          <div className="flex flex-col p-2 rounded bg-white/85 ring-1 ring-surface-slot/30 shadow-[1px_1px_0_0_rgba(0,0,0,0.04)] gap-0.5">
            <span className="text-[10px] text-stone-60">元数据 SHA-1 校验码</span>
            <span className="text-[10px] font-mono text-stone-80 truncate" title={version.sha1}>
              {version.sha1 || '官方清单自动签名验证'}
            </span>
          </div>
        </div>
      </div>

      {/* 底部引导区域 */}
      <div className="pt-2 border-t-2 border-surface-slot/40 text-center flex flex-col items-center gap-1.5">
        {isInstalled ? (
          <span className="text-[11px] text-grass-80 font-bold">
            该版本已在本地安装，可直接启动游戏
          </span>
        ) : downloadTask?.status === 'downloading' ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] text-amber-700 font-bold animate-pulse">
              该版本正在高速下载中 ({downloadTask.progressPercent}%)
            </span>
            <span className="text-[10px] text-stone-60 font-mono">
              实时速度: {downloadTask.speedMBs > 0 ? `${downloadTask.speedMBs.toFixed(1)} MB/s` : '--'}
            </span>
          </div>
        ) : downloadTask?.status === 'paused' ? (
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] text-stone-70 font-bold">
              该版本已暂停 ({downloadTask.progressPercent}%)
            </span>
            <button
              type="button"
              data-testid="sidebar-download-button"
              onClick={onTriggerDownload}
              className="px-4 py-1.5 bg-stone-700 hover:bg-stone-600 active:bg-stone-800 text-white text-xs rounded font-fusion font-bold cursor-pointer transition-colors shadow-sm"
            >
              继续下载此版本
            </button>
          </div>
        ) : (
          <>
            <span className="text-[11px] text-stone-60">
              点击右下角绿色按钮或直接触发安装
            </span>
            <button
              type="button"
              data-testid="sidebar-download-button"
              onClick={onTriggerDownload}
              className="px-4 py-1.5 bg-grass-80 hover:bg-grass-60 active:bg-grass-100 text-white text-xs rounded font-fusion font-bold cursor-pointer transition-colors shadow-[2px_2px_0_0_#1B3B11]"
            >
              一键下载此版本
            </button>
          </>
        )}
      </div>
    </div>
  );
};
