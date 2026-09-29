import React, { useState, useEffect, useRef } from 'react';
import type { JavaRuntime, LauncherSettings, DownloadSource } from '../types/settings';
import {
  DEFAULT_SETTINGS,
  DEFAULT_JAVA_RUNTIMES,
  MEMORY_PRESETS,
  RESOLUTION_PRESETS,
  JVM_ARG_PRESETS,
  loadLauncherSettings,
  saveLauncherSettings,
  scanSystemJavaRuntimes,
  measureDownloadSourceLatency,
} from '../utils/settingsStorage';
import { getAtomDirectory, setAtomDirectory, pickFolder, pickFile } from '../utils/initService';
import { VersionDownloadModal } from './VersionDownloadModal';

import {
  type SettingsCategory,
  getActiveCategory,
  setActiveCategory,
  resetActiveCategory,
  useSettingsCategory,
} from '../utils/settingsCategory';

export type { SettingsCategory };
export { getActiveCategory, setActiveCategory, resetActiveCategory, useSettingsCategory };

export interface SettingsCategoryItem {
  id: SettingsCategory;
  label: string;
  subLabel: string;
  desc: string;
}

export const SETTINGS_CATEGORIES: SettingsCategoryItem[] = [
  {
    id: 'java',
    label: 'Java 运行环境',
    subLabel: '运行环境与内存',
    desc: 'JDK 运行时选择、扫描与内存分配',
  },
  {
    id: 'game',
    label: 'JVM 与游戏参数',
    subLabel: '游戏与参数',
    desc: '游戏主目录、版本隔离与多目录扫描',
  },
  {
    id: 'download',
    label: '下载源与网络',
    subLabel: '下载与网络',
    desc: '极速下载源选择与并发线程数',
  },
  {
    id: 'launcher',
    label: '启动器偏好',
    subLabel: '偏好与视觉',
    desc: '启动动作、展台动效与系统设置',
  },
];

// 跨组件保存与恢复事件订阅
let globalSaveHandler: (() => void) | null = null;
let globalRestoreHandler: (() => void) | null = null;

export function triggerSaveSettings(): void {
  if (globalSaveHandler) {
    globalSaveHandler();
  } else {
    const s = loadLauncherSettings();
    saveLauncherSettings(s);
  }
}

export function triggerRestoreDefaults(): void {
  if (globalRestoreHandler) {
    globalRestoreHandler();
  } else {
    saveLauncherSettings({ ...DEFAULT_SETTINGS });
  }
}

/**
 * 右侧栏设置分类导航组件 (277px 联动侧边栏)
 */
export const SettingsSidebar: React.FC = () => {
  const [activeCategory, setCategory] = useSettingsCategory();
  const [saveFeedback, setSaveFeedback] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSave = () => {
    triggerSaveSettings();
    setSaveFeedback(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      setSaveFeedback(false);
      saveTimeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % SETTINGS_CATEGORIES.length;
      setCategory(SETTINGS_CATEGORIES[nextIndex].id);
      if (typeof document !== 'undefined') {
        document.getElementById(`settings-tab-${SETTINGS_CATEGORIES[nextIndex].id}`)?.focus();
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + SETTINGS_CATEGORIES.length) % SETTINGS_CATEGORIES.length;
      setCategory(SETTINGS_CATEGORIES[prevIndex].id);
      if (typeof document !== 'undefined') {
        document.getElementById(`settings-tab-${SETTINGS_CATEGORIES[prevIndex].id}`)?.focus();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCategory(SETTINGS_CATEGORIES[0].id);
      if (typeof document !== 'undefined') {
        document.getElementById(`settings-tab-${SETTINGS_CATEGORIES[0].id}`)?.focus();
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      const lastIndex = SETTINGS_CATEGORIES.length - 1;
      setCategory(SETTINGS_CATEGORIES[lastIndex].id);
      if (typeof document !== 'undefined') {
        document.getElementById(`settings-tab-${SETTINGS_CATEGORIES[lastIndex].id}`)?.focus();
      }
    }
  };

  return (
    <aside className="w-full h-full flex flex-col justify-between select-none font-fusion bg-surface-card">
      {/* 顶部标题 (与最近实例列表结构与边框完全对齐，保证顶部边框线严丝合缝) */}
      <div className="flex items-end justify-start p-5 ring-2 ring-inset ring-surface-slot bg-surface-card shrink-0">
        <h2 className="text-[16px] font-fusion text-btn-primary-active">设置选项</h2>
      </div>

      {/* 分类列表 (隐藏原生滚动条，保持滚轮与手势平滑滚动) */}
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="设置分类列表"
        className="flex-1 flex flex-col p-3 gap-2.5 overflow-y-auto no-scrollbar"
      >
        {SETTINGS_CATEGORIES.map((cat, index) => {
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              id={`settings-tab-${cat.id}`}
              role="tab"
              aria-selected={isSelected}
              aria-controls={`settings-panel-${cat.id}`}
              tabIndex={isSelected ? 0 : -1}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`
                w-full text-left p-3 ring-2 transition-all duration-200 cursor-pointer flex flex-col gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5E1C]
                ${isSelected
                  ? 'bg-[#2E5E1C] text-white ring-[#1B3B11] shadow-[3px_3px_0_0_#1B3B11] font-bold'
                  : 'bg-white/80 text-[#1F1F1F] ring-surface-slot/40 hover:bg-dirt-20/40 hover:ring-surface-slot'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-[#1F1F1F]'}`}>
                  {cat.label}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#2E5E1C]/15 text-[#2E5E1C]'
                }`}>
                  {cat.subLabel}
                </span>
              </div>
              <span className={`text-[11px] leading-tight ${isSelected ? 'text-white/85' : 'text-[#2F1F17]'}`}>
                {cat.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* 底部实时状态与恢复默认栏 */}
      <div className="p-3 border-t-2 border-surface-slot bg-dirt-10 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={triggerRestoreDefaults}
          className="px-2.5 py-1.5 bg-[#51555A] hover:bg-[#3D4044] active:bg-[#282B30] text-white text-[11px] ring-1 ring-inset ring-[#1F1F1F] shadow-[1px_1px_0_0_#1F1F1F] cursor-pointer transition-colors"
          title="恢复默认配置"
        >
          恢复默认
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="ml-auto px-4 py-2 bg-[#2E5E1C] hover:bg-[#3D7726] active:bg-[#1B3B11] text-white font-bold text-[12px] ring-2 ring-inset ring-[#1B3B11] shadow-[2px_2px_0_0_#1B3B11] cursor-pointer transition-all active:translate-y-0.5"
          title="保存设置"
          aria-label="保存设置"
        >
          {saveFeedback ? '[ 已实时保存 ]' : '[ 保存配置 ]'}
        </button>
      </div>
    </aside>
  );
};

/**
 * 设置中心主区域表单组件 (无内部嵌套 Tab 栏，100% 展开展示当前选中分类的详细表单)
 */
export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<LauncherSettings>(() => loadLauncherSettings());
  const [activeCategory] = useSettingsCategory();
  const [runtimes, setRuntimes] = useState<JavaRuntime[]>(DEFAULT_JAVA_RUNTIMES);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<Record<DownloadSource, number | null>>({
    bmclapi: null,
    mojang: null,
    mcbbs: null,
  });
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [newCustomDir, setNewCustomDir] = useState('');
  const [isDownloaderModalOpen, setIsDownloaderModalOpen] = useState(false);

  const isMountedRef = useRef(true);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customJavaInputRef = useRef<HTMLInputElement | null>(null);

  // 监听并实时存储设置
  useEffect(() => {
    saveLauncherSettings(settings);
  }, [settings]);

  const showToast = (msg: string) => {
    if (!isMountedRef.current) return;
    setToastMessage(msg);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setToastMessage((current) => (current === msg ? null : current));
        toastTimeoutRef.current = null;
      }
    }, 2800);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  // 注册全局保存与恢复回调
  useEffect(() => {
    globalSaveHandler = () => {
      const sanitized: LauncherSettings = {
        ...settings,
        windowWidth: !settings.windowWidth || settings.windowWidth < 320 ? 854 : settings.windowWidth,
        windowHeight: !settings.windowHeight || settings.windowHeight < 240 ? 480 : settings.windowHeight,
        allocatedMemory: Math.max(1024, settings.allocatedMemory || 4096),
        minMemory: Math.min(settings.minMemory || 1024, settings.allocatedMemory || 4096),
        downloadThreads: Math.max(2, Math.min(64, settings.downloadThreads || 32)),
      };
      setSettings(sanitized);
      saveLauncherSettings(sanitized);
      showToast('配置已成功保存并实时生效');
    };
    globalRestoreHandler = () => {
      const confirmed =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm('确定要将启动器所有配置恢复为默认值吗？')
          : true;
      if (confirmed) {
        setSettings({ ...DEFAULT_SETTINGS });
        saveLauncherSettings({ ...DEFAULT_SETTINGS });
        showToast('已恢复为初始默认设置');
      }
    };
    return () => {
      globalSaveHandler = null;
      globalRestoreHandler = null;
    };
  }, [settings]);

  // 组件挂载时自动扫描本机真实安装的 Java 运行环境
  useEffect(() => {
    let isSubscribed = true;
    scanSystemJavaRuntimes().then((detected) => {
      if (!isSubscribed) return;
      if (detected.length > 0) {
        const sorted = [...detected].sort((a, b) => b.majorVersion - a.majorVersion);
        setRuntimes(sorted);
        setSettings((prev) => {
          // 若已有选择（包括 auto 或有效 ID），予以尊重保留；仅在从未配置时默认使用 auto
          if (prev.selectedJavaId === 'auto' || detected.some((r) => r.id === prev.selectedJavaId)) {
            return prev;
          }
          return {
            ...prev,
            selectedJavaId: prev.selectedJavaId || 'auto',
          };
        });
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, []);

  // 扫描系统 Java 运行时
  const handleScanJava = async () => {
    setIsScanning(true);
    setScanMessage('正在扫描本机系统环境与 JDK 目录...');
    try {
      const detected = await scanSystemJavaRuntimes();
      if (!isMountedRef.current) return;
      if (detected.length > 0) {
        const sorted = [...detected].sort((a, b) => b.majorVersion - a.majorVersion);
        setRuntimes(sorted);
        setScanMessage(`已成功检测到 ${detected.length} 个实际安装的 Java 环境`);
        showToast(`已检测到 ${detected.length} 个 Java 运行时`);
        setSettings((prev) => {
          if (prev.selectedJavaId === 'auto' || detected.some((r) => r.id === prev.selectedJavaId)) {
            return prev;
          }
          return {
            ...prev,
            selectedJavaId: 'auto',
          };
        });
      } else {
        setScanMessage('未在常用路径检测到 Java，请在下方手动指定路径或下载 JDK');
        showToast('未检测到已安装的 Java');
      }
    } catch {
      if (!isMountedRef.current) return;
      setScanMessage('扫描异常，请手动指定路径');
    } finally {
      if (isMountedRef.current) {
        setIsScanning(false);
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setScanMessage(null);
            scanTimeoutRef.current = null;
          }
        }, 4000);
      }
    }
  };

  // 真实测速
  const handleTestPing = async () => {
    setIsTestingPing(true);
    showToast('正在向各镜像源节点发送真实网络测速请求...');
    try {
      const [bmclapi, mojang, mcbbs] = await Promise.all([
        measureDownloadSourceLatency('bmclapi'),
        measureDownloadSourceLatency('mojang'),
        measureDownloadSourceLatency('mcbbs'),
      ]);
      if (!isMountedRef.current) return;
      setPingStatus({ bmclapi, mojang, mcbbs });
      showToast('镜像源真实网络测速完成');
    } catch {
      if (!isMountedRef.current) return;
      showToast('测速网络超时或异常');
    } finally {
      if (isMountedRef.current) {
        setIsTestingPing(false);
      }
    }
  };

  const handleAddCustomDir = () => {
    const trimmed = newCustomDir.trim();
    if (!trimmed) return;
    if (settings.customDirs?.includes(trimmed)) {
      showToast('该路径已存在于列表中');
      return;
    }
    setSettings((s) => ({
      ...s,
      customDirs: [...(s.customDirs || []), trimmed],
    }));
    setNewCustomDir('');
    showToast('已添加自定义 .minecraft 目录');
  };

  const handleRemoveCustomDir = (dirToRemove: string) => {
    setSettings((s) => ({
      ...s,
      customDirs: (s.customDirs || []).filter((d) => d !== dirToRemove),
    }));
    showToast('已移除该目录');
  };

  const [atomDir, setAtomDir] = useState<string>('');
  useEffect(() => {
    getAtomDirectory().then((dir) => setAtomDir(dir)).catch(() => {});
  }, []);

  const handleBrowseAtomDir = async () => {
    const picked = await pickFolder(atomDir);
    if (picked && picked !== atomDir) {
      const updated = await setAtomDirectory(picked);
      setAtomDir(updated);
      showToast('已更新并迁移 .atom 存储位置');
    }
  };

  const handleResetAtomDir = async () => {
    const updated = await setAtomDirectory('');
    setAtomDir(updated);
    showToast('已恢复为默认便携 .atom 目录');
  };

  const handleBrowseGameDir = async () => {
    const picked = await pickFolder(settings.gameDir);
    if (picked) {
      setSettings((s) => ({ ...s, gameDir: picked }));
      showToast('已更新游戏主目录');
    }
  };

  const handleBrowseCustomJava = async () => {
    const picked = await pickFile('选择 Java 可执行文件 (javaw.exe)', 'javaw.exe;java.exe;*.exe');
    if (picked) {
      setSettings((s) => ({ ...s, customJavaPath: picked, useCustomJava: true }));
      showToast('已选择 Java 执行程序');
    }
  };

  const handleBrowseCustomDir = async () => {
    const picked = await pickFolder();
    if (picked) {
      if (!settings.customDirs?.includes(picked)) {
        setSettings((s) => ({ ...s, customDirs: [...(s.customDirs || []), picked] }));
        showToast('已添加自定义扫描目录');
      }
    }
  };

  // 获取当前生效的 Java 路径展示
  const currentJava = runtimes.find((r) => r.id === settings.selectedJavaId) || runtimes[0];
  const effectiveJavaPath = settings.useCustomJava
    ? (settings.customJavaPath?.trim() || '未指定自定义路径')
    : (currentJava?.path || '未检测到可用 Java');

  return (
    <div
      role="region"
      aria-label="启动器设置中心"
      className="relative w-full h-full flex flex-col bg-surface-card overflow-hidden select-none font-fusion transition-all duration-300 ease-out animate-view-expand"
    >
      {/* 浮动提示通知 */}
      {toastMessage && (
        <div className="absolute top-4 right-5 z-50 text-[12px] px-3.5 py-1.5 bg-[#2E5E1C] text-white font-bold rounded ring-2 ring-[#1B3B11] shadow-[2px_2px_0_0_#1B3B11] animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* 表单主滚动区 (100% 展开，无嵌套 Tab 栏，隐藏滚动条，充足呼吸感) */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 flex flex-col gap-6 text-[13px] text-[#1F1F1F]">
        {/* ========================================== */}
        {/* 1. Java 运行环境与内存配置 */}
        {/* ========================================== */}
        {activeCategory === 'java' && (
          <div
            id="settings-panel-java"
            role="tabpanel"
            aria-labelledby="settings-tab-java"
            className="flex flex-col gap-6 transition-all duration-200 ease-out animate-tabpanel-in"
          >
            {/* Java 运行时卡片 */}
            <section className="p-5 bg-white/70 ring-2 ring-inset ring-surface-slot flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b-2 border-dirt-40/40">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-bold text-[#1F1F1F] text-[14px]">Java 运行环境 (Runtime)</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-[#2E5E1C] text-white font-bold rounded">
                    {settings.useCustomJava ? '自定义指定' : '智能匹配'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleScanJava}
                  disabled={isScanning}
                  className="px-3 py-1 bg-[#4A3B32] hover:bg-[#382B24] active:bg-[#2F1F17] text-white text-[11px] font-bold ring-1 ring-[#1F1F1F] shadow-[1px_1px_0_0_#1F1F1F] cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {isScanning ? '扫描中...' : '重新扫描环境'}
                </button>
              </div>

              {scanMessage && (
                <div className="text-[12px] px-3 py-2 bg-stone-10 border-l-4 border-[#2E5E1C] text-[#1F1F1F] font-medium">
                  {scanMessage}
                </div>
              )}

              {/* 系统检测到的 Java 运行时列表 */}
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-bold text-[#1F1F1F]">已检测到的系统 Java 运行时：</span>
                {runtimes.length === 0 ? (
                  <div className="p-3 bg-dirt-10 text-[12px] text-[#2F1F1F] ring-1 ring-border-hard/30">
                    未在常用系统路径检测到 Java 运行环境，请点击下方「手动指定自定义 Java 路径」或安装 JDK。
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* 智能自动匹配项 (SCL 模式) */}
                    {(() => {
                      const isAutoSelected = !settings.useCustomJava && (settings.selectedJavaId === 'auto' || !settings.selectedJavaId);
                      const selectAuto = () => {
                        setSettings((s) => {
                          const next = { ...s, useCustomJava: false, selectedJavaId: 'auto' };
                          saveLauncherSettings(next);
                          return next;
                        });
                        showToast('已开启 Java 智能自动适配 (推荐)');
                      };
                      return (
                        <div
                          onClick={selectAuto}
                          className={`p-3 ring-2 cursor-pointer transition-all flex flex-col gap-1 ${
                            isAutoSelected
                              ? 'bg-stone-10 ring-[#2E5E1C] shadow-[2px_2px_0_0_#2E5E1C]'
                              : 'bg-stone-10/70 ring-surface-slot/30 hover:bg-stone-10 hover:ring-surface-slot/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="radio"
                                name="java-select"
                                checked={isAutoSelected}
                                onChange={selectAuto}
                                className="accent-[#2E5E1C] cursor-pointer h-4 w-4"
                              />
                              <span className="font-bold text-[#1F1F1F] text-[13px]">智能自动匹配 (全版本自适应)</span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-[#2E5E1C] text-white rounded font-mono font-bold">
                                推荐
                              </span>
                            </div>
                            <span className="text-[11px] text-[#2E5E1C] font-bold">按 Minecraft 版本自适应</span>
                          </div>
                          <div className="text-[11px] text-[#2F1F17] pl-6">
                            自动根据所启动游戏需求匹配 Java（26.3 调度 Java 25，1.20.5+ 调度 Java 21，1.18~1.20.4 调度 Java 17，1.12 调度 Java 8）
                          </div>
                        </div>
                      );
                    })()}

                    {/* 具体 Java 运行时列表 */}
                    {runtimes.map((r) => {
                      const isSelected = !settings.useCustomJava && settings.selectedJavaId === r.id;
                      const selectJava = () => {
                        setSettings((s) => {
                          const next = {
                            ...s,
                            useCustomJava: false,
                            selectedJavaId: r.id,
                          };
                          saveLauncherSettings(next);
                          return next;
                        });
                        showToast(`已选择 Java 环境: ${r.name}`);
                      };
                      return (
                        <div
                          key={r.id}
                          onClick={selectJava}
                          className={`p-3 ring-2 cursor-pointer transition-all flex flex-col gap-1 ${
                            isSelected
                              ? 'bg-stone-10 ring-[#2E5E1C] shadow-[2px_2px_0_0_#2E5E1C]'
                              : 'bg-stone-10/70 ring-surface-slot/30 hover:bg-stone-10 hover:ring-surface-slot/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="radio"
                                name="java-select"
                                checked={isSelected}
                                onChange={selectJava}
                                className="accent-[#2E5E1C] cursor-pointer h-4 w-4"
                              />
                              <span className="font-bold text-[#1F1F1F] text-[13px]">{r.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-dirt-40/30 text-[#2F1F17] rounded font-mono font-bold">
                                {r.arch}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#2E5E1C] font-bold">{r.recommendedFor}</span>
                          </div>
                          <div className="text-[11px] text-[#2F1F17] font-mono truncate pl-6">{r.path}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 手动指定自定义 Java 路径 */}
              <div className="mt-1 flex flex-col gap-2 pt-3 border-t border-dirt-40/30">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="java-select"
                      checked={settings.useCustomJava}
                      onChange={() => setSettings((s) => ({ ...s, useCustomJava: true }))}
                      className="accent-[#2E5E1C] cursor-pointer h-4 w-4"
                    />
                    <span className="font-bold text-[#1F1F1F] text-[13px]">手动指定自定义 Java 路径</span>
                  </label>
                  <span className="text-[11px] text-[#2F1F17]">适用于便携版 JDK / JRE</span>
                </div>

                <div className="flex gap-2.5 items-center">
                  <input
                    ref={customJavaInputRef}
                    type="text"
                    value={settings.customJavaPath}
                    disabled={!settings.useCustomJava}
                    onChange={(e) => setSettings((s) => ({ ...s, customJavaPath: e.target.value, useCustomJava: true }))}
                    placeholder="请输入或粘贴 javaw.exe 完整路径 (如 C:\...\bin\javaw.exe)"
                    className="flex-1 bg-white px-3 py-2 ring-1 ring-inset ring-[#A8988A] focus:ring-2 focus:ring-[#2E5E1C] text-[12px] text-[#1F1F1F] font-mono disabled:opacity-60 disabled:bg-stone-10/50 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSettings((s) => ({ ...s, useCustomJava: true }));
                      if (customJavaInputRef.current) {
                        customJavaInputRef.current.focus();
                      }
                      showToast('请直接输入或粘贴本机 Java 程序的完整文件路径');
                    }}
                    className="px-3.5 py-2 bg-[#2E5E1C] hover:bg-[#3D7726] active:bg-[#1B3B11] text-white text-[12px] font-bold ring-2 ring-inset ring-[#1B3B11] shadow-[1px_1px_0_0_#1B3B11] cursor-pointer transition-colors"
                  >
                    指定路径
                  </button>
                  <button
                    type="button"
                    data-testid="settings-custom-java-browse-button"
                    onClick={handleBrowseCustomJava}
                    className="px-3.5 py-2 bg-stone-20 hover:bg-stone-30 text-[#1F1F1F] text-[12px] font-bold ring-1 ring-inset ring-[#A8988A] cursor-pointer transition-colors"
                  >
                    浏览
                  </button>
                </div>
              </div>

              {/* Java 版本推荐指南 */}
              <div className="p-3 bg-dirt-10 ring-1 ring-border-hard/30 text-[11px] text-[#2F1F17] flex items-start gap-2">
                <div className="flex-1 leading-relaxed">
                  <span className="font-bold text-[#1F1F1F]">Java 版本推荐指南：</span>
                  Minecraft 1.20.5+ 需 Java 21 | 1.17 ~ 1.20.4 需 Java 17 | 1.16.5 及以下建议使用 Java 8。当前生效路径:{' '}
                  <span className="font-mono text-[#1F1F1F] font-bold">{effectiveJavaPath}</span>
                </div>
              </div>
            </section>

            {/* 最大内存分配卡片 */}
            <section className="p-5 bg-white/70 ring-2 ring-inset ring-surface-slot flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-center pb-2 border-b-2 border-dirt-40/40">
                <span className="font-bold text-[#1F1F1F] text-[14px]">最大内存分配 (JVM Xmx)</span>
                <span className="font-bold text-white px-2.5 py-1 bg-[#2E5E1C] ring-1 ring-[#1B3B11] text-[12px]">
                  {settings.allocatedMemory} MB ({Math.round((settings.allocatedMemory / 1024) * 10) / 10} GB)
                </span>
              </div>

              {/* 滑块 */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-[#2F1F17] font-mono font-bold">1024 MB</span>
                <input
                  type="range"
                  min={1024}
                  max={16384}
                  step={512}
                  value={settings.allocatedMemory}
                  onChange={(e) => setSettings((s) => ({ ...s, allocatedMemory: Number(e.target.value) }))}
                  className="flex-1 accent-[#2E5E1C] cursor-pointer h-2.5 bg-stone-40 rounded"
                />
                <span className="text-[11px] text-[#2F1F17] font-mono font-bold">16 GB</span>
              </div>

              {/* 快速预设按钮组 */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[12px] font-bold text-[#1F1F1F]">快速预设:</span>
                {MEMORY_PRESETS.map((preset) => {
                  const isActive = settings.allocatedMemory === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, allocatedMemory: preset.value }))}
                      className={`px-3 py-1 text-[11px] ring-1 ring-border-hard cursor-pointer transition-colors font-medium ${
                        isActive
                          ? 'bg-[#2E5E1C] text-white font-bold ring-2 ring-[#1B3B11] shadow-inner'
                          : 'bg-white text-[#1F1F1F] hover:bg-dirt-20/60'
                      }`}
                      title={preset.desc}
                    >
                      {preset.label} ({preset.desc})
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ========================================== */}
        {/* 2. JVM 游戏目录与参数配置 */}
        {/* ========================================== */}
        {activeCategory === 'game' && (
          <div
            id="settings-panel-game"
            role="tabpanel"
            aria-labelledby="settings-tab-game"
            className="flex flex-col gap-6 transition-all duration-200 ease-out animate-tabpanel-in"
          >
            {/* 游戏目录与版本隔离 */}
            <section className="p-5 bg-white/70 ring-2 ring-inset ring-surface-slot flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b-2 border-dirt-40/40">
                <h3 className="font-bold text-[#1F1F1F] text-[14px]">游戏目录与版本隔离</h3>
                <span className="text-[11px] text-[#2F1F17]">核心存储配置</span>
              </div>

              {/* 游戏目录 */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#1F1F1F] text-[12px]">.minecraft 游戏主目录路径：</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        gameDir: DEFAULT_SETTINGS.gameDir,
                      }))
                    }
                    className="text-[11px] text-[#2E5E1C] font-bold hover:underline cursor-pointer"
                  >
                    重置为默认目录
                  </button>
                </div>

                <div className="flex gap-2.5 items-center">
                  <input
                    type="text"
                    value={settings.gameDir}
                    onChange={(e) => setSettings((s) => ({ ...s, gameDir: e.target.value }))}
                    className="flex-1 bg-white px-3 py-2 ring-1 ring-inset ring-[#A8988A] focus:ring-2 focus:ring-[#2E5E1C] text-[12px] text-[#1F1F1F] font-mono outline-none"
                  />
                  <button
                    type="button"
                    data-testid="settings-game-dir-browse-button"
                    onClick={handleBrowseGameDir}
                    className="px-3.5 py-2 bg-[#2E5E1C] hover:bg-[#3D7726] active:bg-[#1B3B11] text-white text-[12px] font-bold ring-2 ring-inset ring-[#1B3B11] shadow-[1px_1px_0_0_#1B3B11] cursor-pointer transition-colors"
                  >
                    浏览
                  </button>
                </div>
              </div>

              {/* 版本隔离选项 */}
              <label className="flex items-center justify-between cursor-pointer py-2.5 px-3 bg-dirt-10 ring-1 ring-border-hard/30">
                <div className="flex flex-col">
                  <span className="font-bold text-[#1F1F1F] text-[13px]">独立版本隔离 (Version Isolation)</span>
                  <span className="text-[11px] text-[#2F1F17]">为每个 Minecraft 版本隔离 mods, saves, configs 文件夹</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.versionIsolation}
                  onChange={(e) => setSettings((s) => ({ ...s, versionIsolation: e.target.checked }))}
                  className="h-4.5 w-4.5 accent-[#2E5E1C] cursor-pointer"
                />
              </label>

              {/* 全局常用目录扫描开关 */}
              <label className="flex items-center justify-between cursor-pointer py-2.5 px-3 bg-dirt-10 ring-1 ring-border-hard/30">
                <div className="flex flex-col">
                  <span className="font-bold text-[#1F1F1F] text-[13px]">扫描系统其他常用 .minecraft 目录</span>
                  <span className="text-[11px] text-[#2F1F17]">自动发现官方启动器与标准安装路径下的游戏版本</span>
                </div>
                <input
                  type="checkbox"
                  data-testid="scan-system-dirs-toggle"
                  checked={settings.scanSystemDirs}
                  onChange={(e) => setSettings((s) => ({ ...s, scanSystemDirs: e.target.checked }))}
                  className="h-4.5 w-4.5 accent-[#2E5E1C] cursor-pointer"
                />
              </label>

              {/* 用户自定义额外扫描目录 */}
              <div className="flex flex-col gap-2 pt-2 border-t border-dirt-40/30">
                <span className="font-bold text-[#1F1F1F] text-[12px]">自定义 .minecraft 目录扫描列表：</span>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newCustomDir}
                    onChange={(e) => setNewCustomDir(e.target.value)}
                    placeholder="输入其他 .minecraft 文件夹绝对路径..."
                    className="flex-1 bg-white px-3 py-1.5 ring-1 ring-inset ring-[#A8988A] focus:ring-2 focus:ring-[#2E5E1C] text-[12px] text-[#1F1F1F] font-mono outline-none"
                  />
                  <button
                    type="button"
                    data-testid="add-custom-dir-button"
                    onClick={handleAddCustomDir}
                    className="px-3 py-1.5 bg-[#2E5E1C] hover:bg-[#3D7726] text-white text-[11px] font-bold ring-1 ring-[#1B3B11] cursor-pointer"
                  >
                    添加目录
                  </button>
                  <button
                    type="button"
                    data-testid="browse-custom-dir-button"
                    onClick={handleBrowseCustomDir}
                    className="px-3 py-1.5 bg-stone-20 hover:bg-stone-30 text-[#1F1F1F] text-[11px] font-bold ring-1 ring-[#A8988A] cursor-pointer"
                  >
                    浏览
                  </button>
                </div>

                {settings.customDirs && settings.customDirs.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    {settings.customDirs.map((d) => (
                      <div
                        key={d}
                        className="flex items-center justify-between px-3 py-1.5 bg-stone-10 ring-1 ring-border-hard/30 text-xs font-mono"
                      >
                        <span className="truncate flex-1 text-[#1F1F1F]">{d}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomDir(d)}
                          className="ml-2 text-red-600 hover:text-red-800 font-bold cursor-pointer text-xs"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 游戏窗口分辨率与显示模式 */}
            <section className="p-5 bg-white/70 ring-2 ring-inset ring-surface-slot flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b-2 border-dirt-40/40">
                <h3 className="font-bold text-[#1F1F1F] text-[14px]">游戏窗口分辨率与显示模式</h3>
                <label className="flex items-center gap-2 cursor-pointer text-[12px] font-bold text-[#1F1F1F]">
                  <input
                    type="checkbox"
                    checked={settings.fullscreen}
                    onChange={(e) => setSettings((s) => ({ ...s, fullscreen: e.target.checked }))}
                    className="accent-[#2E5E1C] cursor-pointer h-4 w-4"
                  />
                  <span>全屏启动游戏</span>
                </label>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-[#1F1F1F]">宽 (Width):</span>
                  <input
                    type="number"
                    value={settings.windowWidth === 0 ? '' : settings.windowWidth}
                    disabled={settings.fullscreen}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                      setSettings((s) => ({ ...s, windowWidth: isNaN(val) ? 0 : val }));
                    }}
                    onBlur={() => {
                      if (!settings.windowWidth || settings.windowWidth < 320) {
                        setSettings((s) => ({ ...s, windowWidth: 854 }));
                      }
                    }}
                    className="w-24 bg-white px-2.5 py-1.5 ring-1 ring-[#A8988A] focus:ring-2 focus:ring-[#2E5E1C] text-[12px] text-[#1F1F1F] font-mono text-center disabled:opacity-50 outline-none"
                  />
                </div>
                <span className="text-[#2F1F17] font-bold">×</span>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-[#1F1F1F]">高 (Height):</span>
                  <input
                    type="number"
                    value={settings.windowHeight === 0 ? '' : settings.windowHeight}
                    disabled={settings.fullscreen}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                      setSettings((s) => ({ ...s, windowHeight: isNaN(val) ? 0 : val }));
                    }}
                    onBlur={() => {
                      if (!settings.windowHeight || settings.windowHeight < 240) {
                        setSettings((s) => ({ ...s, windowHeight: 480 }));
                      }
                    }}
                    className="w-24 bg-white px-2.5 py-1.5 ring-1 ring-[#A8988A] focus:ring-2 focus:ring-[#2E5E1C] text-[12px] text-[#1F1F1F] font-mono text-center disabled:opacity-50 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  <span className="text-[12px] font-bold text-[#1F1F1F]">快速预设:</span>
                  {RESOLUTION_PRESETS.map((res) => (
                    <button
                      key={res.label}
                      type="button"
                      disabled={settings.fullscreen}
                      onClick={() => setSettings((s) => ({ ...s, windowWidth: res.width, windowHeight: res.height }))}
                      className="px-2.5 py-1 bg-white hover:bg-dirt-20/60 ring-1 ring-border-hard text-[11px] text-[#1F1F1F] font-medium cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* 自定义 JVM 附加参数 */}
            <section className="p-5 bg-white/70 ring-2 ring-inset ring-surface-slot flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-center pb-2 border-b-2 border-dirt-40/40">
                <h3 className="font-bold text-[#1F1F1F] text-[14px]">自定义 JVM 附加参数 (JVM Arguments)</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {JVM_ARG_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setSettings((s) => ({ ...s, jvmArgs: preset.args }));
                        showToast(`已应用 ${preset.name}`);
                      }}
                      className="text-[11px] px-2.5 py-1 bg-white hover:bg-[#2E5E1C] hover:text-white ring-1 ring-border-hard text-[#1F1F1F] font-medium cursor-pointer transition-colors"
                      title={preset.desc}
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={3}
                value={settings.jvmArgs}
                onChange={(e) => setSettings((s) => ({ ...s, jvmArgs: e.target.value }))}
                placeholder="-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions..."
                className="w-full bg-white p-3 ring-1 ring-inset ring-[#A8988A] focus:ring-2 focus:ring-[#2E5E1C] text-[12px] text-[#1F1F1F] font-mono outline-none resize-none leading-relaxed"
              />
            </section>
          </div>
        )}

        {/* ========================================== */}
        {/* 3. 下载源与网络加速配置 */}
        {/* ========================================== */}
        {activeCategory === 'download' && (
          <div
            id="settings-panel-download"
            role="tabpanel"
            aria-labelledby="settings-tab-download"
            className="flex flex-col gap-6 transition-all duration-200 ease-out animate-tabpanel-in"
          >
            {/* 下载源与网络加速 */}
            <section className="p-5 bg-white/70 ring-2 ring-inset ring-surface-slot flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b-2 border-dirt-40/40">
                <h3 className="font-bold text-[#1F1F1F] text-[14px]">下载源与网络加速</h3>
                <button
                  type="button"
                  onClick={handleTestPing}
                  disabled={isTestingPing}
                  className="px-3 py-1 bg-[#4A3B32] hover:bg-[#382B24] active:bg-[#2F1F17] text-white text-[11px] font-bold ring-1 ring-[#1F1F1F] shadow-[1px_1px_0_0_#1F1F1F] cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {isTestingPing ? '测速中...' : '延迟测速'}
                </button>
              </div>

              {/* 下载源卡片 */}
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    {
                      id: 'bmclapi',
                      name: 'BMCLAPI 极速源',
                      desc: '国内 CDN 节点加速 (推荐)',
                      tag: '推荐',
                    },
                    {
                      id: 'mojang',
                      name: 'Mojang 官方源',
                      desc: '官方直接同步通道',
                      tag: '官方',
                    },
                    {
                      id: 'mcbbs',
                      name: 'MCBBS 镜像源',
                      desc: '备用镜像备份线路',
                      tag: '镜像',
                    },
                  ] as const
                ).map((src) => {
                  const isSelected = settings.downloadSource === src.id;
                  const ping = pingStatus[src.id];
                  return (
                    <button
                      type="button"
                      key={src.id}
                      onClick={() => setSettings((s) => ({ ...s, downloadSource: src.id }))}
                      className={`p-3.5 ring-2 cursor-pointer text-left transition-all flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-stone-10 ring-[#2E5E1C] shadow-[2px_2px_0_0_#2E5E1C]'
                          : 'bg-stone-10/70 ring-surface-slot/30 hover:bg-stone-10 hover:ring-surface-slot/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1F1F1F] text-[13px]">{src.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#2E5E1C] text-white font-bold rounded">
                          {src.tag}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#2F1F17]">{src.desc}</span>
                      <div className="mt-1 flex items-center justify-between text-[11px] pt-1 border-t border-dirt-40/20">
                        <span className="text-[#2F1F17]">网络延迟:</span>
                        <span
                          className={`font-mono font-bold ${
                            ping && ping < 60 ? 'text-[#2E5E1C]' : ping && ping < 150 ? 'text-[#2F1F17]' : 'text-redstone-60'
                          }`}
                        >
                          {ping ? `${ping} ms` : '--'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-dirt-40/30 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-[#1F1F1F] text-[12px]">版本下载引擎与依赖补全</span>
                  <span className="text-[11px] text-[#2F1F17]">使用当前镜像源快速下载并安装 Minecraft 官方及快照版本</span>
                </div>
                <button
                  type="button"
                  data-testid="settings-open-downloader-button"
                  onClick={() => setIsDownloaderModalOpen(true)}
                  className="px-3.5 py-1.5 bg-[#2E5E1C] hover:bg-[#1B3B11] text-white font-bold text-[12px] ring-1 ring-[#1B3B11] shadow-[2px_2px_0_0_#1B3B11] cursor-pointer"
                >
                  打开版本下载器
                </button>
              </div>
            </section>

            {/* 并发下载线程数与自动重试 */}
            <section className="p-5 bg-white/70 ring-2 ring-inset ring-surface-slot flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-center pb-2 border-b-2 border-dirt-40/40">
                <span className="font-bold text-[#1F1F1F] text-[14px]">并发下载线程数 (Download Concurrency)</span>
                <span className="font-bold text-white px-2.5 py-1 bg-[#2E5E1C] ring-1 ring-[#1B3B11] text-[12px]">
                  {settings.downloadThreads} 线程
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-[#2F1F17] font-mono font-bold">2 线程</span>
                <input
                  type="range"
                  min={2}
                  max={64}
                  step={2}
                  value={settings.downloadThreads}
                  onChange={(e) => setSettings((s) => ({ ...s, downloadThreads: Number(e.target.value) }))}
                  className="flex-1 accent-[#2E5E1C] cursor-pointer h-2.5 bg-stone-40 rounded"
                />
                <span className="text-[11px] text-[#2F1F17] font-mono font-bold">64 线程</span>
              </div>

              <label className="flex items-center justify-between cursor-pointer py-2 px-3 bg-dirt-10 ring-1 ring-border-hard/30 mt-2">
                <div className="flex flex-col">
                  <span className="font-bold text-[#1F1F1F] text-[13px]">下载校验失败时自动重试</span>
                  <span className="text-[11px] text-[#2F1F17]">针对资源包与依赖库损坏自动切换备用镜像</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoRetry}
                  onChange={(e) => setSettings((s) => ({ ...s, autoRetry: e.target.checked }))}
                  className="h-4.5 w-4.5 accent-[#2E5E1C] cursor-pointer"
                />
              </label>
            </section>
          </div>
        )}

        {/* ========================================== */}
        {/* 4. 启动器偏好与 UI 配置 */}
        {/* ========================================== */}
        {activeCategory === 'launcher' && (
          <div
            id="settings-panel-launcher"
            role="tabpanel"
            aria-labelledby="settings-tab-launcher"
            className="flex flex-col gap-6 transition-all duration-200 ease-out animate-tabpanel-in"
          >
            {/* 启动后行为 */}
            <section className="p-5 bg-white/70 ring-2 ring-inset ring-surface-slot flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b-2 border-dirt-40/40">
                <h3 className="font-bold text-[#1F1F1F] text-[14px]">启动游戏后启动器行为</h3>
                <span className="text-[11px] text-[#2F1F17]">进程生命周期偏好</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    {
                      id: 'keep',
                      name: '保持窗口开启',
                      desc: '启动后保留启动器主窗口',
                    },
                    {
                      id: 'minimize',
                      name: '启动游戏后自动最小化',
                      desc: '进入游戏后最小化到托盘/任务栏',
                    },
                    {
                      id: 'close',
                      name: '启动游戏后完全退出',
                      desc: '启动成功后自动关闭启动器进程',
                    },
                  ] as const
                ).map((item) => {
                  const isSelected = settings.afterLaunch === item.id;
                  return (
                    <label
                      key={item.id}
                      className={`p-3.5 ring-2 cursor-pointer transition-all flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-stone-10 ring-[#2E5E1C] shadow-[2px_2px_0_0_#2E5E1C]'
                          : 'bg-stone-10/70 ring-surface-slot/30 hover:bg-stone-10 hover:ring-surface-slot/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="after-launch"
                          checked={isSelected}
                          onChange={() => setSettings((s) => ({ ...s, afterLaunch: item.id }))}
                          className="accent-[#2E5E1C] cursor-pointer h-4 w-4"
                        />
                        <span className="font-bold text-[#1F1F1F] text-[13px]">{item.name}</span>
                      </div>
                      <span className="text-[11px] text-[#2F1F17] pl-6">{item.desc}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* 视觉展台与音效 */}
            <section className="p-5 bg-white/70 ring-2 ring-inset ring-surface-slot flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b-2 border-dirt-40/40">
                <h3 className="font-bold text-[#1F1F1F] text-[14px]">视觉展台与音效动效</h3>
                <span className="text-[11px] text-[#2F1F17]">交互反馈偏好</span>
              </div>

              <div className="flex flex-col gap-2.5">
                <label className="flex items-center justify-between cursor-pointer py-2 px-3 bg-dirt-10 ring-1 ring-border-hard/30">
                  <div className="flex flex-col">
                    <span className="font-bold text-[#1F1F1F] text-[13px]">首页苦力怕展台与 Pretext 排版动态动效</span>
                    <span className="text-[11px] text-[#2F1F17]">关闭可进一步降低空闲 GPU 与 Canvas 渲染负载</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.creeperEffects}
                    onChange={(e) => setSettings((s) => ({ ...s, creeperEffects: e.target.checked }))}
                    className="h-4.5 w-4.5 accent-[#2E5E1C] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-2 px-3 bg-dirt-10 ring-1 ring-border-hard/30">
                  <div className="flex flex-col">
                    <span className="font-bold text-[#1F1F1F] text-[13px]">界面交互像素音效</span>
                    <span className="text-[11px] text-[#2F1F17]">按钮点击与状态切换触发 Minecraft 原生音效反馈</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.soundEffects}
                    onChange={(e) => setSettings((s) => ({ ...s, soundEffects: e.target.checked }))}
                    className="h-4.5 w-4.5 accent-[#2E5E1C] cursor-pointer"
                  />
                </label>
              </div>
            </section>

            {/* .atom 数据目录配置 */}
            <section className="p-5 bg-white/70 ring-2 ring-inset ring-surface-slot flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b-2 border-dirt-40/40">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#1F1F1F] text-[14px]">.atom 启动器核心数据目录</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-[#2E5E1C] text-white font-bold rounded">
                    绿色便携
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="settings-atom-reset-button"
                  onClick={handleResetAtomDir}
                  className="text-[11px] text-[#2E5E1C] font-bold hover:underline cursor-pointer"
                >
                  恢复便携默认目录
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2.5 items-center">
                  <input
                    type="text"
                    data-testid="settings-atom-dir-input"
                    value={atomDir}
                    onChange={(e) => setAtomDir(e.target.value)}
                    onBlur={async () => {
                      if (atomDir.trim()) {
                        const updated = await setAtomDirectory(atomDir.trim());
                        setAtomDir(updated);
                        showToast('已更新 .atom 存储位置');
                      }
                    }}
                    className="flex-1 bg-white px-3 py-2 ring-1 ring-inset ring-[#A8988A] focus:ring-2 focus:ring-[#2E5E1C] text-[12px] text-[#1F1F1F] font-mono outline-none"
                  />
                  <button
                    type="button"
                    data-testid="settings-atom-browse-button"
                    onClick={handleBrowseAtomDir}
                    className="px-3.5 py-2 bg-[#2E5E1C] hover:bg-[#3D7726] active:bg-[#1B3B11] text-white text-[12px] font-bold ring-2 ring-inset ring-[#1B3B11] shadow-[1px_1px_0_0_#1B3B11] cursor-pointer"
                  >
                    浏览
                  </button>
                </div>
                <span className="text-[11px] text-[#2F1F17]">
                  存储 config.json、accounts.json、logs/ 及 plugins/。修改后将写入 .atom_path 指针文件进行实时重定向。
                </span>
              </div>
            </section>
          </div>
        )}
      </div>

      <VersionDownloadModal
        isOpen={isDownloaderModalOpen}
        onClose={() => setIsDownloaderModalOpen(false)}
      />
    </div>
  );
};
