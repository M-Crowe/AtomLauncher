import { useEffect, useState, useMemo } from 'react';
import DownloadIcon from '../assets/download.svg?react';
import CloseIcon from '../assets/close.svg?react';
import type {
  ManifestVersionEntry,
  VersionManifest,
  VersionInstallStatus,
  IntegrityReport,
} from '../types/downloader';
import {
  fetchVersionManifest,
  fetchVersionDetail,
  resolveVersionInstallPlan,
  executeFullVersionInstall,
  inferVersionJava,
} from '../utils/downloadService';
import { loadLauncherSettings } from '../utils/settingsStorage';

interface VersionDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstalled?: (versionId: string) => void;
}

export function VersionDownloadModal({ isOpen, onClose, onInstalled }: VersionDownloadModalProps) {
  const [manifest, setManifest] = useState<VersionManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(false);
  const [manifestError, setManifestError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'release' | 'snapshot'>('release');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<ManifestVersionEntry | null>(null);
  const [requiredJava, setRequiredJava] = useState<number | null>(null);

  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);

  const [installStatus, setInstallStatus] = useState<VersionInstallStatus>({
    phase: 'idle',
    currentStepText: '',
    progressPercent: 0,
    totalItems: 0,
    completedItems: 0,
  });

  const settings = loadLauncherSettings();
  const downloadSource = settings.downloadSource || 'bmclapi';

  useEffect(() => {
    if (!isOpen) return;

    setLoadingManifest(true);
    setManifestError(null);
    fetchVersionManifest(downloadSource)
      .then((data) => {
        setManifest(data);
        if (data.versions.length > 0) {
          const defaultSelect =
            data.versions.find((v) => v.id === data.latest.release) || data.versions[0];
          setSelectedVersion(defaultSelect);
        }
      })
      .catch((err) => {
        setManifestError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoadingManifest(false);
      });
  }, [isOpen, downloadSource]);

  // 当选择不同版本时，重置完整性与安装状态，并推断所需 Java 版本
  useEffect(() => {
    setIntegrityReport(null);
    if (selectedVersion) {
      inferVersionJava(selectedVersion.id).then((j) => setRequiredJava(j));
    } else {
      setRequiredJava(null);
    }
    if (installStatus.phase === 'completed' || installStatus.phase === 'error') {
      setInstallStatus({
        phase: 'idle',
        currentStepText: '',
        progressPercent: 0,
        totalItems: 0,
        completedItems: 0,
      });
    }
  }, [selectedVersion?.id]);

  // 键盘快捷键 Escape 支持
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const isBusy =
          installStatus.phase === 'details' ||
          installStatus.phase === 'client_jar' ||
          installStatus.phase === 'libraries' ||
          installStatus.phase === 'assets';
        if (!isBusy) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, installStatus.phase]);

  const filteredVersions = useMemo(() => {
    if (!manifest) return [];
    return manifest.versions.filter((v) => {
      const matchesType =
        filterType === 'all' ? true : filterType === 'release' ? v.type === 'release' : v.type === 'snapshot';
      const matchesQuery = searchQuery.trim() === '' || v.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [manifest, filterType, searchQuery]);

  const handleCheckIntegrity = async () => {
    if (!selectedVersion) return;
    setCheckingIntegrity(true);
    try {
      let detail: Record<string, unknown> | undefined;
      try {
        detail = await fetchVersionDetail(selectedVersion.url, downloadSource);
      } catch {
        // 离线环境或网络异常时优雅回退
      }
      const report = await resolveVersionInstallPlan(
        settings.gameDir,
        selectedVersion.id,
        detail,
        downloadSource
      );
      setIntegrityReport(report);
    } catch (err) {
      console.warn('检查完整性失败:', err);
    } finally {
      setCheckingIntegrity(false);
    }
  };

  const handleStartInstall = async () => {
    if (!selectedVersion) return;

    const isSuccess = await executeFullVersionInstall(
      settings.gameDir,
      selectedVersion.id,
      selectedVersion.url,
      (status) => setInstallStatus(status),
      downloadSource
    );

    if (isSuccess) {
      onInstalled?.(selectedVersion.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="版本下载与安装管理器"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
    >
      <div
        className="
          w-full max-w-[860px] h-[580px]
          bg-surface-card
          ring-3 ring-border-hard
          shadow-[6px_6px_0_0_#1F1F1F]
          flex flex-col
          overflow-hidden
        "
      >
        {/* 顶部标题栏 */}
        <div
          className="
            flex items-center justify-between px-5 py-3
            bg-stone-10 ring-b-2 ring-border-hard
            shrink-0
          "
        >
          <div className="flex items-center gap-3">
            <DownloadIcon className="w-5 h-5 text-btn-primary-bg" />
            <h2 className="font-fusion text-base text-stone-100 font-bold">
              版本下载与安装引擎 (DOWNLOADER & INSTALLER)
            </h2>
            <span
              className="
                font-fusion text-[10px] px-2 py-0.5 rounded
                bg-grass-80 text-white font-bold
              "
            >
              源: {downloadSource === 'bmclapi' ? 'BMCLAPI 极速源' : downloadSource === 'mojang' ? 'Mojang 官方源' : 'MCBBS 镜像源'}
            </span>
          </div>
          <button
            type="button"
            data-testid="close-download-modal-button"
            onClick={onClose}
            aria-label="关闭下载窗口"
            className="
              p-1 text-stone-60 hover:text-stone-100
              hover:bg-dirt-20 ring-1 ring-transparent hover:ring-border-hard
              cursor-pointer transition-colors
            "
          >
            <CloseIcon className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* 主体工作区: 左侧版本列表 + 右侧安装详情 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧栏: 搜索与版本清单 (宽 340px) */}
          <div
            className="
              w-[340px] h-full
              border-r-2 border-surface-slot
              flex flex-col
              bg-stone-10/40
              shrink-0
            "
          >
            {/* 过滤切换与搜索 */}
            <div className="p-3 border-b border-surface-slot flex flex-col gap-2">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'release', label: '正式版' },
                    { id: 'snapshot', label: '快照版' },
                    { id: 'all', label: '全部' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterType(tab.id)}
                    className={`
                      flex-1 py-1 font-fusion text-xs text-center cursor-pointer transition-colors
                      ring-1 ring-inset ring-surface-slot
                      ${filterType === tab.id ? 'bg-grass-80 text-white font-bold' : 'bg-surface-card text-stone-60 hover:text-stone-100'}
                    `}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="搜索版本号 (如 1.20, 24w)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
                  w-full px-2 py-1 font-fusion text-xs
                  bg-surface-card ring-1 ring-inset ring-surface-slot
                  text-stone-100 placeholder-stone-60
                  focus:outline-none focus:ring-2 focus:ring-grass-80
                "
              />
            </div>

            {/* 版本列表项 */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-2 flex flex-col gap-1.5">
              {loadingManifest ? (
                <div className="p-6 text-center font-fusion text-xs text-stone-60">
                  正在同步版本清单数据...
                </div>
              ) : manifestError ? (
                <div className="p-4 text-center font-fusion text-xs text-redstone-60">
                  清单获取失败: {manifestError}
                </div>
              ) : filteredVersions.length === 0 ? (
                <div className="p-6 text-center font-fusion text-xs text-stone-60">
                  无符合条件的版本
                </div>
              ) : (
                filteredVersions.map((v) => {
                  const isSelected = selectedVersion?.id === v.id;
                  const isLatestRelease = manifest?.latest.release === v.id;
                  const isLatestSnapshot = manifest?.latest.snapshot === v.id;

                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVersion(v)}
                      className={`
                        p-2.5 ring-1 ring-inset ring-surface-slot cursor-pointer
                        transition-all flex flex-col gap-1
                        ${isSelected ? 'bg-grass-80/15 ring-2 ring-grass-80' : 'bg-surface-card hover:bg-stone-10'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-fusion text-xs font-bold text-stone-100">
                          {v.id}
                        </span>
                        <div className="flex items-center gap-1">
                          {isLatestRelease && (
                            <span className="font-fusion text-[9px] px-1 py-0.2 bg-[#2E5E1C] text-white rounded">
                              最新正式版
                            </span>
                          )}
                          {isLatestSnapshot && (
                            <span className="font-fusion text-[9px] px-1 py-0.2 bg-stone-60 text-white rounded">
                              最新快照
                            </span>
                          )}
                          <span className="font-fusion text-[9px] text-stone-60 uppercase">
                            {v.type}
                          </span>
                        </div>
                      </div>
                      <span className="font-fusion text-[10px] text-stone-60">
                        发布时间: {v.releaseTime ? v.releaseTime.slice(0, 10) : '未知'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 右侧栏: 详细信息与安装动作面板 */}
          <div className="flex-1 flex flex-col justify-between p-5 bg-surface-card">
            {selectedVersion ? (
              <div className="flex flex-col gap-4">
                {/* 版本摘要卡片 */}
                <div className="p-4 bg-stone-10 ring-2 ring-surface-slot flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-fusion text-lg font-bold text-stone-100">
                        Minecraft {selectedVersion.id}
                      </h3>
                      <p className="font-fusion text-xs text-stone-60">
                        版本分类: {selectedVersion.type} · 发布时间: {selectedVersion.releaseTime}
                      </p>
                    </div>
                    <span className="font-fusion text-xs px-2.5 py-1 bg-grass-80 text-white font-bold">
                      就绪
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-surface-slot flex flex-col gap-1 text-[11px] font-fusion text-stone-60">
                    <div>目标游戏目录: <span className="text-stone-100 font-mono">{settings.gameDir}</span></div>
                    <div>推荐运行环境: <span className="text-grass-80 font-mono font-bold">{requiredJava ? `Java ${requiredJava}` : 'Java 自动适配'}</span></div>
                    <div>下载镜像通道: <span className="text-grass-80 font-bold">{downloadSource === 'bmclapi' ? 'BMCLAPI 国内加速' : downloadSource === 'mcbbs' ? 'MCBBS 镜像加速' : 'Mojang 官方直连'}</span></div>
                  </div>
                </div>

                {/* 完整性校验与缺失依赖检测区域 */}
                <div className="p-4 bg-stone-10/50 ring-1 ring-surface-slot flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-fusion text-xs font-bold text-stone-100">
                      本地完整性与缺失文件评估
                    </span>
                    <button
                      type="button"
                      disabled={checkingIntegrity}
                      onClick={handleCheckIntegrity}
                      className="
                        px-2.5 py-1 font-fusion text-[11px]
                        bg-surface-card ring-1 ring-border-hard hover:bg-stone-10
                        text-stone-100 cursor-pointer disabled:opacity-50
                      "
                    >
                      {checkingIntegrity ? '评估中...' : '检查本地状态'}
                    </button>
                  </div>

                  {integrityReport ? (
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <div className="p-2 bg-surface-card ring-1 ring-surface-slot flex flex-col gap-0.5">
                        <span className="font-fusion text-[10px] text-stone-60">核心客户端 JAR</span>
                        <span className={`font-fusion text-xs font-bold ${integrityReport.missingVersionJar ? 'text-redstone-60' : 'text-grass-80'}`}>
                          {integrityReport.missingVersionJar ? '需下载 (缺失)' : '已就绪'}
                        </span>
                      </div>
                      <div className="p-2 bg-surface-card ring-1 ring-surface-slot flex flex-col gap-0.5">
                        <span className="font-fusion text-[10px] text-stone-60">缺失运行库</span>
                        <span className={`font-fusion text-xs font-bold ${integrityReport.missingLibraries.length > 0 ? 'text-stone-100' : 'text-grass-80'}`}>
                          {integrityReport.missingLibraries.length} 个库项
                        </span>
                      </div>
                      <div className="p-2 bg-surface-card ring-1 ring-surface-slot flex flex-col gap-0.5">
                        <span className="font-fusion text-[10px] text-stone-60">缺失资源索引/对象</span>
                        <span className={`font-fusion text-xs font-bold ${integrityReport.missingAssets.length > 0 ? 'text-stone-100' : 'text-grass-80'}`}>
                          {integrityReport.missingAssets.length} 项资源
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="font-fusion text-[11px] text-stone-60">
                      点击“检查本地状态”以分析当前游戏目录下是否有完整依赖
                    </span>
                  )}
                </div>

                {/* 动态进度展示条 */}
                {installStatus.phase !== 'idle' && (
                  <div className="p-4 bg-stone-10 ring-2 ring-surface-slot flex flex-col gap-2">
                    <div className="flex items-center justify-between font-fusion text-xs">
                      <span className="text-stone-100 font-bold">{installStatus.currentStepText}</span>
                      <span className="text-grass-80 font-bold">{installStatus.progressPercent}%</span>
                    </div>

                    <div className="w-full h-3 bg-stone-60/30 ring-1 ring-border-hard overflow-hidden">
                      <div
                        className="h-full bg-grass-80 transition-all duration-300"
                        style={{ width: `${installStatus.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center font-fusion text-xs text-stone-60">
                请在左侧选择需要安装的 Minecraft 版本
              </div>
            )}

            {/* 底部按钮栏 */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-slot">
              <button
                type="button"
                onClick={onClose}
                className="
                  px-4 py-2 font-fusion text-xs
                  bg-surface-card ring-2 ring-border-hard
                  text-stone-100 hover:bg-stone-10 cursor-pointer
                "
              >
                关闭
              </button>

              <button
                type="button"
                data-testid="install-version-confirm-button"
                disabled={
                  !selectedVersion ||
                  (installStatus.phase !== 'idle' &&
                    installStatus.phase !== 'completed' &&
                    installStatus.phase !== 'error')
                }
                onClick={handleStartInstall}
                className="
                  px-6 py-2 font-fusion text-xs font-bold
                  bg-grass-80 text-white ring-2 ring-border-hard
                  hover:bg-[#2E5E1C] cursor-pointer disabled:opacity-50
                  shadow-[2px_2px_0_0_#1F1F1F] active:translate-x-0.5 active:translate-y-0.5
                "
              >
                {installStatus.phase === 'completed'
                  ? '重新安装'
                  : installStatus.phase === 'details' ||
                    installStatus.phase === 'client_jar' ||
                    installStatus.phase === 'libraries' ||
                    installStatus.phase === 'assets'
                  ? '正在安装...'
                  : '立即一键下载与安装'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
