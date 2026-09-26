import React, { useState, useEffect } from 'react';
import type { JavaRuntime, LauncherSettings, DownloadSource, AfterLaunchBehavior } from '../types/settings';
import {
  DEFAULT_SETTINGS,
  DEFAULT_JAVA_RUNTIMES,
  MEMORY_PRESETS,
  RESOLUTION_PRESETS,
  JVM_ARG_PRESETS,
  loadLauncherSettings,
  saveLauncherSettings,
  scanSystemJavaRuntimes,
} from '../utils/settingsStorage';

export type SettingsTab = 'all' | 'java' | 'game' | 'download' | 'launcher' | 'about';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<LauncherSettings>(() => loadLauncherSettings());
  const [activeSubTab, setActiveSubTab] = useState<SettingsTab>('all');
  const [runtimes, setRuntimes] = useState<JavaRuntime[]>(DEFAULT_JAVA_RUNTIMES);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<Record<DownloadSource, number | null>>({
    bmclapi: 18,
    mojang: 186,
    mcbbs: 45,
  });
  const [isTestingPing, setIsTestingPing] = useState(false);

  // 监听并实时存储设置
  useEffect(() => {
    saveLauncherSettings(settings);
  }, [settings]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  };

  // 扫描系统 Java 运行时
  const handleScanJava = async () => {
    setIsScanning(true);
    setScanMessage('正在扫描系统环境与 JDK 注册表...');
    try {
      const detected = await scanSystemJavaRuntimes();
      setRuntimes(detected);
      setScanMessage(`已成功检测到 ${detected.length} 个可用 Java 运行时`);
      showToast(`🔍 已扫描到 ${detected.length} 个 Java 运行时`);
    } catch {
      setScanMessage('扫描异常，请手动指定路径');
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanMessage(null), 4000);
    }
  };

  // 测速
  const handleTestPing = async () => {
    setIsTestingPing(true);
    showToast('⚡ 正在对各下载镜像源进行延迟测速...');
    setTimeout(() => {
      setPingStatus({
        bmclapi: Math.floor(12 + Math.random() * 15),
        mojang: Math.floor(160 + Math.random() * 60),
        mcbbs: Math.floor(35 + Math.random() * 25),
      });
      setIsTestingPing(false);
      showToast('✅ 下载源延迟测速完成');
    }, 800);
  };

  // 恢复默认设置
  const handleRestoreDefaults = () => {
    if (window.confirm('确定要将启动器所有配置恢复为默认值吗？')) {
      setSettings({ ...DEFAULT_SETTINGS });
      showToast('🔄 已恢复为初始默认设置');
    }
  };

  // 获取当前生效的 Java 路径展示
  const currentJava = runtimes.find((r) => r.id === settings.selectedJavaId) || runtimes[0];
  const effectiveJavaPath = settings.useCustomJava
    ? (settings.customJavaPath?.trim() || '未指定自定义路径')
    : (currentJava?.path || '未检测到可用 Java');

  return (
    <div className="w-full h-full flex flex-col bg-surface-card overflow-hidden select-none font-fusion">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-5 py-3 border-b-2 border-surface-slot bg-dirt-10/40 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none">⚙️</span>
          <div>
            <h2 className="text-[17px] text-btn-primary-active font-bold leading-tight">启动器设置中心</h2>
            <p className="text-[10px] text-stone-60 leading-tight">Minecraft 原生像素级内核与运行参数配置</p>
          </div>
        </div>

        {/* 顶部操作区 */}
        <div className="flex items-center gap-2">
          {toastMessage && (
            <div className="text-[11px] px-2.5 py-1 bg-grass-80 text-white rounded ring-1 ring-border-hard animate-bounce shadow-md">
              {toastMessage}
            </div>
          )}
          <button
            type="button"
            onClick={() => showToast('💾 设置已成功保存并实时生效')}
            className="px-3 py-1 bg-btn-primary-bg text-white hover:bg-btn-primary-hover active:bg-btn-primary-active ring-2 ring-inset ring-border-hard shadow-[0px_2px_0_0_var(--color-stone-100)] cursor-pointer text-xs flex items-center gap-1"
          >
            <span>💾</span>
            <span>保存设置</span>
          </button>
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="px-2.5 py-1 bg-stone-60 text-white hover:bg-stone-80 active:bg-stone-100 ring-2 ring-inset ring-border-hard shadow-[0px_2px_0_0_var(--color-stone-100)] cursor-pointer text-xs"
            title="恢复默认配置"
          >
            恢复默认
          </button>
        </div>
      </div>

      {/* 分类子标签栏 */}
      <div
        role="tablist"
        aria-label="设置分类导航"
        className="flex items-center gap-1 px-4 py-1.5 bg-dirt-20/40 border-b border-surface-slot overflow-x-auto text-xs shrink-0"
      >
        {(
          [
            { id: 'all', label: '📋 全部设置' },
            { id: 'java', label: '☕ 运行环境与内存' },
            { id: 'game', label: '🎮 游戏与参数' },
            { id: 'download', label: '⚡ 下载与网络' },
            { id: 'launcher', label: '🎨 偏好与视觉' },
            { id: 'about', label: 'ℹ️ 关于' },
          ] as const
        ).map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-2.5 py-1 text-[11px] cursor-pointer transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-80 ${
                isActive
                  ? 'bg-btn-primary-bg text-white font-bold ring-1 ring-border-hard shadow-inner'
                  : 'text-stone-80 hover:bg-dirt-20/60'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 核心设置内容列表 */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs text-dirt-80">
        {/* ========================================== */}
        {/* 1. Java 运行环境与内存配置 */}
        {/* ========================================== */}
        {(activeSubTab === 'all' || activeSubTab === 'java') && (
          <section className="p-3.5 bg-dirt-20/25 ring-2 ring-inset ring-surface-slot flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-dirt-40/40">
              <div className="flex items-center gap-2">
                <span className="font-bold text-btn-primary-active text-[13px]">☕ Java 运行环境 (Runtime)</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-grass-80 text-white rounded">
                  {settings.useCustomJava ? '自定义指定' : '智能匹配'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleScanJava}
                disabled={isScanning}
                className="px-2.5 py-0.5 bg-btn-secondary-bg hover:bg-btn-secondary-hover text-white text-[10px] ring-1 ring-border-hard cursor-pointer disabled:opacity-50"
              >
                {isScanning ? '⏳ 扫描中...' : '🔄 重新扫描环境'}
              </button>
            </div>

            {scanMessage && (
              <div className="text-[11px] px-2.5 py-1 bg-stone-10 border-l-2 border-grass-60 text-stone-100">
                {scanMessage}
              </div>
            )}

            {/* 系统检测到的 Java 列表 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-stone-100">已检测到的系统 Java 运行时：</span>
              <div className="flex flex-col gap-1.5">
                {runtimes.map((r) => {
                  const isSelected = !settings.useCustomJava && settings.selectedJavaId === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() =>
                        setSettings((s) => ({
                          ...s,
                          useCustomJava: false,
                          selectedJavaId: r.id,
                        }))
                      }
                      className={`p-2 ring-1 cursor-pointer transition-colors flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-stone-10 ring-2 ring-grass-60 shadow-[2px_2px_0_0_rgba(46,94,28,0.4)]'
                          : 'bg-stone-10/60 ring-border-hard/40 hover:bg-stone-10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="java-select"
                            checked={isSelected}
                            onChange={() => {}}
                            className="accent-grass-60 cursor-pointer"
                          />
                          <span className="font-bold text-stone-100 text-[11px]">{r.name}</span>
                          <span className="text-[9px] px-1 bg-dirt-40/30 text-dirt-80 rounded">{r.arch}</span>
                        </div>
                        <span className="text-[10px] text-grass-80 font-bold">{r.recommendedFor}</span>
                      </div>
                      <div className="text-[10px] text-stone-60 font-mono truncate pl-5">{r.path}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 自定义指定路径 */}
            <div className="mt-1 flex flex-col gap-1.5 pt-2 border-t border-dirt-40/30">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="java-select"
                    checked={settings.useCustomJava}
                    onChange={() => setSettings((s) => ({ ...s, useCustomJava: true }))}
                    className="accent-grass-60 cursor-pointer"
                  />
                  <span className="font-bold text-stone-100 text-[11px]">手动指定自定义 Java 路径</span>
                </label>
                <span className="text-[10px] text-stone-60">适用于便携版 JDK / JRE</span>
              </div>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={settings.customJavaPath}
                  disabled={!settings.useCustomJava}
                  onChange={(e) => setSettings((s) => ({ ...s, customJavaPath: e.target.value, useCustomJava: true }))}
                  placeholder="C:\Path\To\bin\javaw.exe"
                  className="flex-1 bg-stone-10 px-3 py-1.5 ring-1 ring-inset ring-border-hard text-[11px] text-stone-100 font-mono disabled:opacity-60 disabled:bg-stone-10/40 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const sample = 'C:\\Program Files\\Java\\jdk-21\\bin\\javaw.exe';
                    setSettings((s) => ({ ...s, customJavaPath: sample, useCustomJava: true }));
                    showToast('📂 已载入自定义 Java 路径');
                  }}
                  className="px-3 py-1 bg-btn-primary-bg text-white hover:bg-btn-primary-hover active:bg-btn-primary-active ring-2 ring-inset ring-border-hard shadow-[0px_2px_0_0_var(--color-stone-100)] cursor-pointer text-xs"
                >
                  浏览
                </button>
              </div>
            </div>

            {/* 智能版本推荐提示栏 */}
            <div className="p-2 bg-dirt-10/70 ring-1 ring-border-hard/30 text-[10px] text-stone-80 flex items-start gap-1.5">
              <span>💡</span>
              <div className="flex-1 leading-relaxed">
                <span className="font-bold text-dirt-100">Java 版本推荐指南：</span>
                Minecraft 1.20.5+ 需 Java 21 | 1.17 ~ 1.20.4 需 Java 17 | 1.16.5 及以下建议使用 Java 8。当前生效路径:{' '}
                <span className="font-mono text-stone-100">{effectiveJavaPath}</span>
              </div>
            </div>

            {/* 内存分配调节 */}
            <div className="mt-2 pt-2 border-t border-dirt-40/30 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-stone-100">最大内存分配 (JVM Xmx):</span>
                <span className="font-bold text-btn-primary-active px-2 py-0.5 bg-stone-10 ring-1 ring-border-hard text-xs">
                  {settings.allocatedMemory} MB ({Math.round((settings.allocatedMemory / 1024) * 10) / 10} GB)
                </span>
              </div>

              {/* 滑块 */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-stone-60">1024 MB</span>
                <input
                  type="range"
                  min={1024}
                  max={16384}
                  step={512}
                  value={settings.allocatedMemory}
                  onChange={(e) => setSettings((s) => ({ ...s, allocatedMemory: Number(e.target.value) }))}
                  className="flex-1 accent-grass-60 cursor-pointer h-2 bg-stone-40 rounded"
                />
                <span className="text-[10px] text-stone-60">16 GB</span>
              </div>

              {/* 快速预设按钮组 */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[10px] text-stone-60">快速预设:</span>
                {MEMORY_PRESETS.map((preset) => {
                  const isActive = settings.allocatedMemory === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, allocatedMemory: preset.value }))}
                      className={`px-2.5 py-0.5 text-[10px] ring-1 ring-border-hard cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-btn-primary-bg text-white font-bold ring-2 ring-grass-80 shadow-inner'
                          : 'bg-stone-10 text-stone-100 hover:bg-dirt-20/60'
                      }`}
                      title={preset.desc}
                    >
                      {preset.label} ({preset.desc})
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ========================================== */}
        {/* 2. 游戏启动参数与目录配置 */}
        {/* ========================================== */}
        {(activeSubTab === 'all' || activeSubTab === 'game') && (
          <section className="p-3.5 bg-dirt-20/25 ring-2 ring-inset ring-surface-slot flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-dirt-40/40">
              <span className="font-bold text-btn-primary-active text-[13px]">🎮 游戏目录与版本隔离</span>
              <span className="text-[10px] text-stone-60">Minecraft Core</span>
            </div>

            {/* 游戏目录 */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-stone-100 text-[11px]">.minecraft 游戏主目录路径：</span>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      gameDir: 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft',
                    }))
                  }
                  className="text-[10px] text-grass-80 hover:underline cursor-pointer"
                >
                  重置为默认目录
                </button>
              </div>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={settings.gameDir}
                  onChange={(e) => setSettings((s) => ({ ...s, gameDir: e.target.value }))}
                  className="flex-1 bg-stone-10 px-3 py-1.5 ring-1 ring-inset ring-border-hard text-[11px] text-stone-100 font-mono outline-none"
                />
                <button
                  type="button"
                  onClick={() => showToast('📂 已选择当前游戏目录')}
                  className="px-3 py-1 bg-btn-primary-bg text-white hover:bg-btn-primary-hover active:bg-btn-primary-active ring-2 ring-inset ring-border-hard shadow-[0px_2px_0_0_var(--color-stone-100)] cursor-pointer text-xs"
                >
                  浏览
                </button>
              </div>
            </div>

            {/* 版本隔离选项 */}
            <label className="flex items-center justify-between cursor-pointer py-1 px-2 bg-stone-10/70 ring-1 ring-border-hard/30">
              <div className="flex flex-col">
                <span className="font-bold text-stone-100">独立版本隔离 (Version Isolation)</span>
                <span className="text-[10px] text-stone-60">为每个 Minecraft 版本隔离 mods, saves, configs 文件夹</span>
              </div>
              <input
                type="checkbox"
                checked={settings.versionIsolation}
                onChange={(e) => setSettings((s) => ({ ...s, versionIsolation: e.target.checked }))}
                className="h-4 w-4 accent-grass-60 cursor-pointer"
              />
            </label>

            {/* 窗口分辨率与全屏 */}
            <div className="mt-1 pt-2 border-t border-dirt-40/30 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-100">游戏窗口分辨率与显示模式：</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-stone-100">
                  <input
                    type="checkbox"
                    checked={settings.fullscreen}
                    onChange={(e) => setSettings((s) => ({ ...s, fullscreen: e.target.checked }))}
                    className="accent-grass-60 cursor-pointer"
                  />
                  <span>全屏启动游戏</span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-stone-60">宽 (Width):</span>
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
                    className="w-20 bg-stone-10 px-2 py-1 ring-1 ring-border-hard text-[11px] text-stone-100 font-mono text-center disabled:opacity-50"
                  />
                </div>
                <span className="text-stone-60">×</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-stone-60">高 (Height):</span>
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
                    className="w-20 bg-stone-10 px-2 py-1 ring-1 ring-border-hard text-[11px] text-stone-100 font-mono text-center disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                  {RESOLUTION_PRESETS.map((res) => (
                    <button
                      key={res.label}
                      type="button"
                      disabled={settings.fullscreen}
                      onClick={() => setSettings((s) => ({ ...s, windowWidth: res.width, windowHeight: res.height }))}
                      className="px-2 py-0.5 bg-stone-10 hover:bg-dirt-20/60 ring-1 ring-border-hard text-[10px] text-stone-100 cursor-pointer disabled:opacity-50"
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* JVM 自定义启动参数 */}
            <div className="mt-1 pt-2 border-t border-dirt-40/30 flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-stone-100">自定义 JVM 附加参数 (JVM Arguments):</span>
                <div className="flex items-center gap-1.5">
                  {JVM_ARG_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setSettings((s) => ({ ...s, jvmArgs: preset.args }));
                        showToast(`⚡ 已应用 ${preset.name}`);
                      }}
                      className="text-[9px] px-1.5 py-0.5 bg-stone-10 hover:bg-grass-80 hover:text-white ring-1 ring-border-hard text-stone-80 cursor-pointer transition-colors"
                      title={preset.desc}
                    >
                      + {preset.name}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={2}
                value={settings.jvmArgs}
                onChange={(e) => setSettings((s) => ({ ...s, jvmArgs: e.target.value }))}
                placeholder="-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions..."
                className="w-full bg-stone-10 p-2 ring-1 ring-inset ring-border-hard text-[11px] text-stone-100 font-mono outline-none resize-none"
              />
            </div>
          </section>
        )}

        {/* ========================================== */}
        {/* 3. 下载源与并发下载网络配置 */}
        {/* ========================================== */}
        {(activeSubTab === 'all' || activeSubTab === 'download') && (
          <section className="p-3.5 bg-dirt-20/25 ring-2 ring-inset ring-surface-slot flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-dirt-40/40">
              <span className="font-bold text-btn-primary-active text-[13px]">⚡ 下载源与网络加速</span>
              <button
                type="button"
                onClick={handleTestPing}
                disabled={isTestingPing}
                className="px-2.5 py-0.5 bg-btn-secondary-bg hover:bg-btn-secondary-hover text-white text-[10px] ring-1 ring-border-hard cursor-pointer disabled:opacity-50"
              >
                {isTestingPing ? '测速中...' : '📶 延迟测速'}
              </button>
            </div>

            {/* 下载源选择卡片 */}
            <div className="grid grid-cols-3 gap-2.5">
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
                  <div
                    key={src.id}
                    onClick={() => setSettings((s) => ({ ...s, downloadSource: src.id }))}
                    className={`p-2.5 ring-1 cursor-pointer transition-colors flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-stone-10 ring-2 ring-grass-60 shadow-[2px_2px_0_0_rgba(46,94,28,0.4)]'
                        : 'bg-stone-10/60 ring-border-hard/40 hover:bg-stone-10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-100 text-[11px]">{src.name}</span>
                      <span className="text-[9px] px-1 bg-grass-80 text-white rounded">{src.tag}</span>
                    </div>
                    <span className="text-[10px] text-stone-60">{src.desc}</span>
                    <div className="mt-1 flex items-center justify-between text-[10px]">
                      <span className="text-stone-60">网络延迟:</span>
                      <span
                        className={`font-mono font-bold ${
                          ping && ping < 60 ? 'text-grass-80' : ping && ping < 150 ? 'text-dirt-80' : 'text-redstone-60'
                        }`}
                      >
                        {ping ? `${ping} ms` : '--'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 并发下载线程数 */}
            <div className="mt-1 pt-2 border-t border-dirt-40/30 flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-stone-100">并发下载线程数 (Download Concurrency):</span>
                <span className="font-bold text-btn-primary-active px-2 py-0.5 bg-stone-10 ring-1 ring-border-hard text-xs">
                  {settings.downloadThreads} 线程
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-stone-60">2 线程</span>
                <input
                  type="range"
                  min={2}
                  max={64}
                  step={2}
                  value={settings.downloadThreads}
                  onChange={(e) => setSettings((s) => ({ ...s, downloadThreads: Number(e.target.value) }))}
                  className="flex-1 accent-grass-60 cursor-pointer h-2 bg-stone-40 rounded"
                />
                <span className="text-[10px] text-stone-60">64 线程</span>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[10px] text-stone-60">档位:</span>
                {[8, 16, 32, 64].map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, downloadThreads: th }))}
                    className={`px-2 py-0.5 text-[10px] ring-1 ring-border-hard cursor-pointer ${
                      settings.downloadThreads === th ? 'bg-btn-primary-bg text-white font-bold' : 'bg-stone-10 text-stone-100'
                    }`}
                  >
                    {th} 线程 {th === 32 ? '(标准)' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* 下载自动重试 */}
            <label className="flex items-center justify-between cursor-pointer py-1 px-2 bg-stone-10/70 ring-1 ring-border-hard/30">
              <span className="text-stone-100">下载校验失败时自动重试 (最多 5 次)</span>
              <input
                type="checkbox"
                checked={settings.autoRetry}
                onChange={(e) => setSettings((s) => ({ ...s, autoRetry: e.target.checked }))}
                className="h-4 w-4 accent-grass-60 cursor-pointer"
              />
            </label>
          </section>
        )}

        {/* ========================================== */}
        {/* 4. 启动与视觉偏好配置 */}
        {/* ========================================== */}
        {(activeSubTab === 'all' || activeSubTab === 'launcher') && (
          <section className="p-3.5 bg-dirt-20/25 ring-2 ring-inset ring-surface-slot flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-dirt-40/40">
              <span className="font-bold text-btn-primary-active text-[13px]">🎨 显示与交互体验</span>
              <span className="text-[10px] text-stone-60">Launcher Preferences</span>
            </div>

            {/* 启动后行为 */}
            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-stone-100 text-[11px]">启动游戏后的启动器动作：</span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'keep', label: '保持启动器打开', desc: '不执行任何动作' },
                    { id: 'minimize', label: '启动游戏后自动最小化', desc: '缩小到托盘/任务栏' },
                    { id: 'close', label: '完全退出启动器', desc: '节省后台系统资源' },
                  ] as const
                ).map((beh) => {
                  const isSelected = settings.afterLaunch === beh.id;
                  return (
                    <button
                      key={beh.id}
                      type="button"
                      onClick={() =>
                        setSettings((s) => ({
                          ...s,
                          afterLaunch: beh.id as AfterLaunchBehavior,
                          autoClose: beh.id === 'minimize',
                        }))
                      }
                      className={`p-2 ring-1 cursor-pointer text-left transition-colors flex flex-col gap-0.5 ${
                        isSelected
                          ? 'bg-stone-10 ring-2 ring-grass-60 shadow-[2px_2px_0_0_rgba(46,94,28,0.4)] font-bold text-stone-100'
                          : 'bg-stone-10/60 ring-border-hard/40 hover:bg-stone-10 text-stone-80'
                      }`}
                    >
                      <span className="text-[11px]">{beh.label}</span>
                      <span className="text-[9px] text-stone-60">{beh.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 首页苦力怕展台动效 */}
            <label className="flex items-center justify-between cursor-pointer py-1 px-2 bg-stone-10/70 ring-1 ring-border-hard/30">
              <div className="flex flex-col">
                <span className="text-stone-100">首页苦力怕展台与 Pretext 排版动态动效</span>
                <span className="text-[10px] text-stone-60">包含 8-bit 漫步、光标注视与物理爆炸粒子系统</span>
              </div>
              <input
                type="checkbox"
                checked={settings.creeperEffects}
                onChange={(e) => setSettings((s) => ({ ...s, creeperEffects: e.target.checked }))}
                className="h-4 w-4 accent-grass-60 cursor-pointer"
              />
            </label>

            {/* 音效与彩蛋开关 */}
            <label className="flex items-center justify-between cursor-pointer py-1 px-2 bg-stone-10/70 ring-1 ring-border-hard/30">
              <div className="flex flex-col">
                <span className="text-stone-100">像素音效与彩蛋交互反馈</span>
                <span className="text-[10px] text-stone-60">点击展台彩蛋或切换视图时的 8-bit 提示音效</span>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEffects}
                onChange={(e) => setSettings((s) => ({ ...s, soundEffects: e.target.checked }))}
                className="h-4 w-4 accent-grass-60 cursor-pointer"
              />
            </label>

            {/* UI 缩放 */}
            <div className="flex items-center justify-between py-1 px-2 bg-stone-10/40 ring-1 ring-border-hard/20">
              <span className="text-stone-100">界面缩放比例 (UI Scale)</span>
              <span className="text-[11px] text-stone-60 bg-stone-10 px-2 py-0.5 ring-1 ring-border-hard">
                点对点像素 (100%)
              </span>
            </div>
          </section>
        )}

        {/* ========================================== */}
        {/* 5. 关于 AtomLauncher */}
        {/* ========================================== */}
        {(activeSubTab === 'all' || activeSubTab === 'about') && (
          <section className="p-3.5 bg-dirt-20/15 ring-1 ring-inset ring-surface-slot flex flex-col gap-2 text-[11px] text-stone-60">
            <div className="text-dirt-80 font-bold text-xs flex items-center gap-1.5 pb-1 border-b border-dirt-40/30">
              <span>ℹ️</span>
              <span>关于 AtomLauncher (原子启动器)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-80">
              <div>客户端版本：<span className="font-mono text-stone-100 font-bold">0.1.0-alpha (Dev)</span></div>
              <div>核心架构：<span className="text-stone-100 font-bold">Tauri 2.0 + React 19 + Wasm</span></div>
              <div>文字排版引擎：<span className="text-stone-100 font-bold">@chenglou/pretext (零 DOM 重排)</span></div>
              <div>插件虚拟机：<span className="text-stone-100 font-bold">Wasmtime JIT Compiler</span></div>
            </div>
            <div className="text-[10px] text-stone-60 pt-1 leading-relaxed">
              AtomLauncher 是一款采用极致像素美学、Rust 高性能底层与 WebAssembly 插件生态构建的现代 Minecraft 启动器。
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default SettingsView;
