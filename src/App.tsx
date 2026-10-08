import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import WindowControls from "./components/WindowControls";
import BottomNav, { type NavValue } from "./components/BottomNav";
import CreeperCanvas from "./components/CreeperCanvas";
import { SettingsView, SettingsSidebar } from "./components/SettingsView";
import { ToolsView } from "./components/ToolsView";
import { LaunchButtonGroup } from "./components/LaunchButtonGroup";
import { LogView } from "./components/LogView";
import { AccountCard } from "./components/AccountCard";
import { AccountModal } from "./components/AccountModal";
import { InitWizard } from "./components/InitWizard";
import { VersionDownloadModal } from "./components/VersionDownloadModal";
import { DownloadView } from "./components/DownloadView";
import { DownloadDetailSidebar } from "./components/DownloadDetailSidebar";
import { DownloadStatusBar } from "./components/DownloadStatusBar";
import { DownloadManagerWorkbench } from "./components/DownloadManagerWorkbench";
import type { Account } from "./types/account";
import { getActiveAccount, onAccountsChange } from "./utils/accountService";
import type { LaunchState, LogEntry, MinecraftVersionInfo } from "./types/launcher";
import type { DownloadSource, ManifestVersionEntry, DownloadTaskState } from "./types/downloader";
import { downloadManager } from "./utils/downloadManager";
import { transformDownloadUrl } from "./utils/downloadService";
import {
  killMinecraftInstance,
  launchMinecraft,
  listenMinecraftExit,
  listenMinecraftLog,
  listenMinecraftStarted,
  scanMinecraftVersions,
} from "./utils/launcherService";
import {
  getEffectiveJavaPath,
  loadLauncherSettings,
  saveLauncherSettings,
  syncLauncherSettingsFromConfig,
  onSettingsChange,
  scanSystemJavaRuntimes,
} from "./utils/settingsStorage";
import { getLauncherInitState } from "./utils/initService";
import type { LauncherSettings, JavaRuntime } from "./types/settings";

function App() {
  const [currentTab, setCurrentTab] = useState<NavValue>("home");
  const [launchState, setLaunchState] = useState<LaunchState>("idle");
  const [runningPid, setRunningPid] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLogViewOpen, setIsLogViewOpen] = useState(false);
  const [isDownloadManagerOpen, setIsDownloadManagerOpen] = useState(false);
  const [versions, setVersions] = useState<MinecraftVersionInfo[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("1.20.4");
  const [selectedManifestVersion, setSelectedManifestVersion] = useState<ManifestVersionEntry | null>(null);
  const [downloadSource, setDownloadSource] = useState<DownloadSource>(loadLauncherSettings().downloadSource || 'bmclapi');
  const [downloadTask, setDownloadTask] = useState<DownloadTaskState>(downloadManager.getState());
  const [downloadTasks, setDownloadTasks] = useState<DownloadTaskState[]>(downloadManager.getTasks());
  const [javaRuntimes, setJavaRuntimes] = useState<JavaRuntime[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);

  // Check launcher initialization state and synchronize settings
  useEffect(() => {
    getLauncherInitState()
      .then((res) => {
        setIsInitialized(res.initialized);
        if (res.config && typeof res.config === 'object') {
          syncLauncherSettingsFromConfig(res.config as Record<string, unknown>);
          refreshVersions();
        } else if (res.default_minecraft_dir) {
          const current = loadLauncherSettings();
          if (!current.gameDir || current.gameDir.includes('Default')) {
            saveLauncherSettings({ ...current, gameDir: res.default_minecraft_dir });
          }
        }
      })
      .catch(() => {
        setIsInitialized(true);
      });
  }, []);

  // Load and subscribe to active account
  useEffect(() => {
    getActiveAccount().then((acc) => {
      if (acc) setActiveAccount(acc);
    });
    const unsub = onAccountsChange((accounts) => {
      const active = accounts.find((a) => a.isActive);
      if (active) setActiveAccount(active);
    });
    return unsub;
  }, []);

  // Scan Java environments on mount
  useEffect(() => {
    scanSystemJavaRuntimes().then((runtimes) => {
      if (Array.isArray(runtimes) && runtimes.length > 0) {
        setJavaRuntimes(runtimes);
      }
    });
  }, []);

  // Load settings and scan versions on initial load, tab switch, or settings change
  const refreshVersions = (customSettings?: LauncherSettings) => {
    const s = customSettings || loadLauncherSettings();
    if (s.selectedVersionId) {
      setSelectedVersionId(s.selectedVersionId);
    }
    scanMinecraftVersions({
      gameDir: s.gameDir,
      scanSystemDirs: s.scanSystemDirs,
      customDirs: s.customDirs || [],
    }).then((scanned) => {
      setVersions(scanned);
      if (scanned.length > 0 && !scanned.some((v) => v.id === s.selectedVersionId)) {
        setSelectedVersionId(scanned[0].id);
      }
    });
  };

  useEffect(() => {
    refreshVersions();
  }, [currentTab]);

  useEffect(() => {
    const unsubscribe = onSettingsChange((newSettings) => {
      refreshVersions(newSettings);
    });
    return unsubscribe;
  }, []);

  // Setup Tauri event listeners for real-time streaming with strict lifecycle cleanup
  useEffect(() => {
    let isCancelled = false;
    let unlistenLog: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let unlistenStarted: (() => void) | undefined;

    let pendingLogs: LogEntry[] = [];
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;

    const flushLogs = () => {
      if (pendingLogs.length === 0) return;
      const batch = pendingLogs;
      pendingLogs = [];
      flushTimeout = null;
      setLogs((prev) => {
        const combined = [...prev, ...batch];
        return combined.length > 2000 ? combined.slice(-2000) : combined;
      });
    };

    listenMinecraftLog((payload) => {
      pendingLogs.push({
        id: `${Date.now()}-${Math.random()}`,
        pid: payload.pid,
        line: payload.line,
        level: payload.level,
        timestamp: payload.timestamp,
        isError: payload.isError,
      });

      if (!flushTimeout) {
        flushTimeout = setTimeout(flushLogs, 80);
      }
    }).then((unlisten) => {
      if (isCancelled) {
        unlisten();
      } else {
        unlistenLog = unlisten;
      }
    });

    listenMinecraftExit((payload) => {
      flushLogs();
      setRunningPid(null);
      setLaunchState(payload.success ? "exited" : "crashed");
    }).then((unlisten) => {
      if (isCancelled) {
        unlisten();
      } else {
        unlistenExit = unlisten;
      }
    });

    listenMinecraftStarted((payload) => {
      setRunningPid(payload.pid);
      setLaunchState("running");
    }).then((unlisten) => {
      if (isCancelled) {
        unlisten();
      } else {
        unlistenStarted = unlisten;
      }
    });

    return () => {
      isCancelled = true;
      if (flushTimeout) {
        clearTimeout(flushTimeout);
      }
      flushLogs();
      unlistenLog?.();
      unlistenExit?.();
      unlistenStarted?.();
    };
  }, []);

  useEffect(() => {
    const unsub = downloadManager.subscribe((st, allTasks) => {
      setDownloadTask(st);
      setDownloadTasks(allTasks);
    });
    return unsub;
  }, []);

  const handleStartDownload = (targetVersionId?: string, targetVersionUrl?: string) => {
    const s = loadLauncherSettings();
    const effectiveSource = downloadSource || s.downloadSource || 'bmclapi';
    const effectiveId =
      targetVersionId ||
      (currentTab === "download" && selectedManifestVersion
        ? selectedManifestVersion.id
        : selectedVersionId);
    const effectiveUrl =
      targetVersionUrl ||
      (currentTab === "download" && selectedManifestVersion && selectedManifestVersion.id === effectiveId
        ? selectedManifestVersion.url
        : transformDownloadUrl(
            `https://piston-meta.mojang.com/v1/packages/${effectiveId}/${effectiveId}.json`,
            effectiveSource
          ));

    downloadManager.startDownload(
      effectiveId,
      effectiveUrl,
      s.gameDir,
      (success) => {
        if (success) {
          refreshVersions();
          setSelectedVersionId(effectiveId);
        }
      }
    );
  };

  const activeTargetVersionId =
    currentTab === "download"
      ? (selectedManifestVersion?.id || selectedVersionId)
      : selectedVersionId;
  const isTargetInstalled = versions.some((v) => v.id === activeTargetVersionId);
  const isDownloadMode = currentTab === "download" || !isTargetInstalled;

  const targetTask = downloadTasks.find((t) => t.versionId === activeTargetVersionId);
  const isTargetDownloading = targetTask?.status === "downloading";
  const isTargetPaused = targetTask?.status === "paused";
  const targetProgress = targetTask?.progressPercent || 0;

  const handleLaunch = async () => {
    setLaunchState("checking");
    const s = loadLauncherSettings();
    const javaPath = getEffectiveJavaPath(s, javaRuntimes);
    const selectedVersion = versions.find((v) => v.id === selectedVersionId);
    const targetGameDir = selectedVersion?.sourcePath || s.gameDir;

    // Append launch attempt log
    const now = new Date().toTimeString().split(" ")[0];
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        pid: 0,
        line: `[AtomLauncher] 准备启动实例: ${selectedVersionId} (检查环境与内存)...`,
        level: "INFO",
        timestamp: now,
        isError: false,
      },
    ]);

    setLaunchState("launching");
    try {
      const userType = activeAccount?.accountType === "microsoft" ? "msa" : "mojang";
      const xuid = activeAccount?.xuid || "0";
      const username = activeAccount?.name || "Player";
      const uuid = activeAccount?.uuid || "00000000-0000-0000-0000-000000000000";
      const accessToken = activeAccount?.accessToken || "00000000000000000000000000000000";

      const result = await launchMinecraft({
        versionId: selectedVersionId,
        gameDir: targetGameDir,
        javaPath,
        allocatedMemoryMb: s.allocatedMemory,
        minMemoryMb: s.minMemory,
        jvmArgs: s.jvmArgs,
        fullscreen: s.fullscreen,
        windowWidth: s.windowWidth,
        windowHeight: s.windowHeight,
        versionIsolation: s.versionIsolation,
        username,
        uuid,
        accessToken,
        userType,
        xuid,
      });

      setRunningPid(result.pid);
      setLaunchState("running");
    } catch (err) {
      console.error("Launch error:", err);
      setLaunchState("crashed");
      setLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          pid: 0,
          line: `[AtomLauncher 错误] 启动失败: ${String(err)}`,
          level: "ERROR",
          timestamp: now,
          isError: true,
        },
      ]);
    }
  };

  const handleKill = async () => {
    if (runningPid) {
      await killMinecraftInstance(runningPid);
      setRunningPid(null);
      setLaunchState("exited");
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  if (isInitialized === false) {
    return (
      <main className="flex h-screen w-screen items-center justify-center overflow-hidden bg-surface-app-bg select-none">
        <InitWizard
          onComplete={() => {
            setIsInitialized(true);
            getActiveAccount().then((acc) => {
              if (acc) setActiveAccount(acc);
            });
            refreshVersions();
          }}
        />
        <WindowControls />
      </main>
    );
  }

  return (
    <main
      className="grid grid-rows-[36px_minmax(0,1fr)_36px] h-screen w-screen px-9 bg-surface-app-bg select-none overflow-hidden relative"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          getCurrentWindow().startDragging();
        }
      }}
    >
      {/* 顶部标题栏 / 窗口控制区 (高度 36px，居中垂直对齐，与卡片 36px 边距完全对称) */}
      <div
        data-tauri-drag-region
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            getCurrentWindow().startDragging();
          }
        }}
        className="w-full h-full flex items-center justify-end relative select-none"
      >
        <WindowControls />
      </div>

      {/* 主卡片容器 (独占中间完整网格空间) */}
      <div
        className="
        bg-surface-card ring-4 ring-inset ring-border-hard
        h-full w-full
        relative
        overflow-hidden
        "
      >
        {/* 滑动轨道：主界面与日志/下载管理器界面左右平滑拉伸滑动切换 */}
        <div
          className="w-full h-full flex transition-transform duration-300 ease-in-out"
          style={{
            transform: isLogViewOpen
              ? 'translateX(-100%)'
              : 'translateX(0%)' /* translateX(-200%) -translate-x-[200%] */,
          }}
        >
          {/* 面板 1: 主启动器界面 */}
          <div
            className="
            min-w-full w-full h-full
            grid
            grid-cols-[minmax(0,1fr)_277px]
            grid-rows-[70px_minmax(0,1fr)_78px]
            px-5
            relative
            "
          >
            {/* 顶部标题栏 */}
            <div className="flex items-center">
              <h1 className="text-[32px] font-fusion">
                <span className="text-btn-primary-bg">ATOM</span>
                <span className="text-dirt-80"> LAUNCHER</span>
              </h1>
            </div>
            {/* 右上角账户卡片 (网格第1行第2列 277px 顶部区域) */}
            <div className="h-full w-full flex items-center justify-end">
              <AccountCard
                account={activeAccount}
                onClick={() => setIsAccountModalOpen(true)}
              />
            </div>

            {/* 主内容视图区域 (三页面受控视图) */}
            <div className="h-full w-full border-10 border-grass-80 rounded overflow-hidden relative">
              {currentTab === "home" && <CreeperCanvas />}
              {currentTab === "download" && (
                <DownloadView
                  selectedVersion={selectedManifestVersion}
                  onSelectVersion={(v) => setSelectedManifestVersion(v)}
                  installedVersions={versions}
                  downloadSource={downloadSource}
                  downloadTasks={downloadTasks}
                  onChangeDownloadSource={(src) => {
                    setDownloadSource(src);
                    const current = loadLauncherSettings();
                    saveLauncherSettings({ ...current, downloadSource: src });
                  }}
                />
              )}
              {currentTab === "settings" && <SettingsView />}
              {currentTab === "tools" && (
                <ToolsView
                  pluginDir="src/my-demo"
                  entryJs="ui/index.js"
                />
              )}
            </div>

            {/* 右侧栏 (277px)：联动切换 (实例列表 <-> 设置分类选项 <-> 下载详情选项) */}
            <div
              className="
              relative h-full w-full
              ring-2 ring-inset ring-surface-slot
              shadow-[4px_2px_0_0_var(--color-redstone-100)]
              overflow-hidden bg-surface-card
              "
            >
              {/* 实例列表 (纯净全量展示，移除底部冗余按钮，支持平滑滚动) */}
              <div
                aria-hidden={currentTab === "settings"}
                inert={currentTab === "settings" ? true : undefined}
                className={`
                  absolute inset-0 h-full w-full flex flex-col justify-between
                  transition-all duration-300 ease-out
                  ${currentTab === "settings" || currentTab === "download"
                    ? "opacity-0 pointer-events-none translate-x-4"
                    : "opacity-100 translate-x-0"
                  }
                `}
              >
                <div
                  className="
                  flex items-end justify-between p-5
                  ring-2 ring-inset ring-surface-slot
                  shrink-0
                  "
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-[16px] font-fusion text-btn-primary-active">实例列表</h2>
                    <button
                      type="button"
                      data-testid="open-download-modal-button"
                      onClick={() => setIsDownloadModalOpen(true)}
                      className="px-1.5 py-0.5 text-[10px] font-fusion bg-grass-80 hover:bg-[#2E5E1C] text-white rounded cursor-pointer transition-colors"
                      title="下载新版本"
                    >
                      下载
                    </button>
                  </div>
                  <span className="text-[10px] font-fusion text-stone-60">
                    {versions.length} 个可用
                  </span>
                </div>

                {/* 渲染扫描到的真实版本列表 (全量无截断) */}
                <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
                  {versions.length > 0 ? (
                    versions.map((v) => {
                      const isSelected = selectedVersionId === v.id;
                      return (
                        <div
                          key={`${v.sourcePath || ""}:${v.id}`}
                          data-testid={`instance-item-${v.id}`}
                          onClick={() => setSelectedVersionId(v.id)}
                          className={`flex items-center justify-between px-4 py-2.5 ring-1 ring-inset ring-surface-slot transition-colors cursor-pointer shrink-0 ${
                            isSelected ? "bg-dirt-20/40 ring-2 ring-grass-80" : "hover:bg-dirt-20/20"
                          }`}
                        >
                          <div className="flex flex-col truncate pr-2">
                            <span className="font-fusion text-xs text-stone-100 font-bold truncate">
                              {v.id} {v.loaderType !== "vanilla" ? `· ${v.loaderType}` : "原版纯净"}
                            </span>
                            <span className="font-fusion text-[10px] text-stone-60 truncate">
                              来源：{v.sourceLabel} · {v.lastModified || "已同步"}
                            </span>
                          </div>
                          <span
                            className={`font-fusion text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 ${
                              isSelected
                                ? "bg-grass-80 text-white font-bold"
                                : "bg-stone-60 text-white"
                            }`}
                          >
                            {isSelected ? "已选中" : "已就绪"}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 gap-2 text-stone-60 font-fusion text-[11px] text-center">
                      <span>未扫描到本地游戏版本</span>
                      <button
                        type="button"
                        data-testid="empty-download-button"
                        onClick={() => setIsDownloadModalOpen(true)}
                        className="px-3 py-1 font-fusion text-xs bg-grass-80 hover:bg-[#2E5E1C] text-white rounded cursor-pointer transition-colors shadow-[1px_1px_0_0_#1F1F1F]"
                      >
                        立即下载 Minecraft
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 设置分类侧边栏 */}
              <div
                aria-hidden={currentTab !== "settings"}
                inert={currentTab !== "settings" ? true : undefined}
                className={`
                  absolute inset-0 h-full w-full
                  transition-all duration-300 ease-out
                  ${currentTab === "settings"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 pointer-events-none -translate-x-4"
                  }
                `}
              >
                <SettingsSidebar />
              </div>

              {/* 下载详情侧边栏 */}
              <div
                aria-hidden={currentTab !== "download"}
                inert={currentTab !== "download" ? true : undefined}
                className={`
                  absolute inset-0 h-full w-full
                  transition-all duration-300 ease-out
                  ${currentTab === "download"
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 pointer-events-none translate-x-4"
                  }
                `}
              >
                <DownloadDetailSidebar
                  version={selectedManifestVersion}
                  installedVersions={versions}
                  downloadTask={targetTask}
                  onTriggerDownload={() => handleStartDownload(activeTargetVersionId)}
                />
              </div>
            </div>

            {/* 底部受控导航栏 */}
            <div className="h-full w-full ring-inset ring-3 ring-border-hard flex items-center justify-between relative">
              <div className="flex-1 h-full">
                <BottomNav activeTab={currentTab} onChange={setCurrentTab} />
              </div>
            </div>

            {/* 底部栏右侧：双分块启动按钮组 (图三位置，网格第二列第三行 277px 区域) */}
            <div className="h-full w-full">
              <LaunchButtonGroup
                state={launchState}
                selectedVersion={activeTargetVersionId}
                onLaunch={handleLaunch}
                onKill={handleKill}
                onOpenSettings={() => setCurrentTab("settings")}
                isDownloadMode={isDownloadMode}
                isDownloading={isTargetDownloading}
                downloadProgress={targetProgress}
                isDownloadPaused={isTargetPaused}
                activeDownloadingVersion={targetTask?.versionId || activeTargetVersionId}
                onResumeDownload={() => downloadManager.resumeDownload(activeTargetVersionId)}
                onDownload={() => handleStartDownload(activeTargetVersionId)}
              />
            </div>
          </div>

          {/* 面板 2: 独立现代全屏日志工作台 (点击后向左滑动进入) */}
          <div className="min-w-full w-full h-full bg-[#0d1117] flex flex-col">
            <LogView
              logs={logs}
              launchState={launchState}
              pid={runningPid}
              selectedVersion={selectedVersionId}
              onBack={() => setIsLogViewOpen(false)}
              onKill={handleKill}
              onClear={handleClearLogs}
            />
          </div>

        </div>

        {/* 面板 3: 独立下载管理器工作台 (从下往上滑出展开动画) */}
        <div
          className={`
            absolute inset-0 z-30 w-full h-full bg-surface-card flex flex-col
            transition-transform duration-300 ease-out
            ${isDownloadManagerOpen ? "translate-y-0" : "translate-y-full pointer-events-none"}
          `}
        >
          <DownloadManagerWorkbench
            task={downloadTask}
            tasks={downloadTasks}
            onBack={() => setIsDownloadManagerOpen(false)}
            onPause={(vId) => downloadManager.pauseDownload(vId)}
            onResume={(vId) => downloadManager.resumeDownload(vId)}
            onCancel={(vId) => downloadManager.cancelDownload(vId)}
            onRemove={(vId) => downloadManager.removeTask(vId)}
          />
        </div>
      </div>

      {/* 底部状态区域：网格第三行，居中常驻下载管理，无多余外框，左侧放置实时日志 */}
      <div
        className="w-full h-full flex items-center justify-between relative px-1 select-none"
      >
        {/* 中间下载条 (order-2 视觉居中，进入工作台后依然常驻显示，支持点击底栏切换/收起工作台) */}
        <div className="flex items-center justify-center flex-1 order-2 h-full" data-tauri-drag-region="false">
          {/* !isDownloadManagerOpen && ( */}
          <DownloadStatusBar
            // <SteamDownloadBar
            task={downloadTask}
            tasks={downloadTasks}
            onClick={() => {
              setIsLogViewOpen(false);
              setIsDownloadManagerOpen((prev) => !prev);
            }}
          />
        </div>

        {/* 左侧实时日志 (order-1 视觉在左) */}
        <div className="flex items-center min-w-[140px] order-1 h-full" data-tauri-drag-region="false">
          {(runningPid || logs.length > 0 || launchState === "running" || launchState === "launching" || launchState === "crashed") && (
            <button
              type="button"
              data-testid="bottom-log-status-button"
              onClick={() => {
                setIsDownloadManagerOpen(false);
                setIsLogViewOpen(!isLogViewOpen);
              }}
              className="
                flex items-center gap-2 px-3 py-1
                rounded-full bg-neutral-900/90 hover:bg-neutral-800 active:bg-black
                text-white font-sans text-xs font-medium tracking-wide
                border border-white/15 shadow-sm
                cursor-pointer select-none transition-all duration-150
                active:scale-95
              "
            >
              <span className="relative flex h-2 w-2">
                {launchState === "running" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    launchState === "running"
                      ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                      : launchState === "launching"
                      ? "bg-amber-400 animate-pulse"
                      : launchState === "crashed"
                      ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                      : "bg-slate-400"
                  }`}
                />
              </span>
              <span>
                {isLogViewOpen
                  ? "返回启动器"
                  : runningPid
                  ? `实时日志 (PID: ${runningPid})`
                  : "查看实时日志"}
              </span>
            </button>
          )}
        </div>

        {/* 右侧平衡占位 */}
        <div
          data-tauri-drag-region
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              getCurrentWindow().startDragging();
            }
          }}
          className="min-w-[140px] order-3 h-full"
        />
      </div>

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onAccountSwitched={(acc) => setActiveAccount(acc)}
      />

      <VersionDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        onInstalled={(vId) => {
          refreshVersions();
          setSelectedVersionId(vId);
        }}
      />
    </main>
  );
}

export default App;
