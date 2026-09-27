import React, { useState, useEffect } from 'react';
import type { LauncherInitState } from '../types/init';
import type { JavaRuntime } from '../types/settings';
import {
  getLauncherInitState,
  saveInitConfiguration,
  pickFolder,
  pickFile,
} from '../utils/initService';
import {
  scanSystemJavaRuntimes,
  loadLauncherSettings,
  saveLauncherSettings,
} from '../utils/settingsStorage';
import { scanMinecraftVersions } from '../utils/launcherService';
import { startDeviceCodeLogin, pollDeviceCodeLogin } from '../utils/accountService';

interface InitWizardProps {
  onComplete: () => void;
}

export const InitWizard: React.FC<InitWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [atomDir, setAtomDir] = useState<string>('');
  const [defaultAtomDir, setDefaultAtomDir] = useState<string>('');
  const [gameDir, setGameDir] = useState<string>('');
  const [accountType, setAccountType] = useState<'offline' | 'microsoft' | 'skip'>('offline');
  const [offlineName, setOfflineName] = useState<string>('Steve');

  // Microsoft OAuth2 State
  const [msUserCode, setMsUserCode] = useState<string>('');
  const [msVerifyUri, setMsVerifyUri] = useState<string>('');
  const [msStatusText, setMsStatusText] = useState<string>('');
  const [isMsPolling, setIsMsPolling] = useState<boolean>(false);

  // Game Versions count
  const [scannedVersionCount, setScannedVersionCount] = useState<number | null>(null);
  const [isScanningVersions, setIsScanningVersions] = useState<boolean>(false);

  // Java Scanning State (Silent background)
  const [javaRuntimes, setJavaRuntimes] = useState<JavaRuntime[]>([]);
  const [selectedJavaId, setSelectedJavaId] = useState<string>('');
  const [customJavaPath, setCustomJavaPath] = useState<string>('');
  const [useCustomJava, setUseCustomJava] = useState<boolean>(false);
  const [isJavaScanning, setIsJavaScanning] = useState<boolean>(true);

  // Load initial state and trigger silent Java scan on mount
  useEffect(() => {
    let isCancelled = false;

    async function initialize() {
      try {
        const initState: LauncherInitState = await getLauncherInitState();
        if (!isCancelled) {
          setAtomDir(initState.atom_dir || initState.default_atom_dir);
          setDefaultAtomDir(initState.default_atom_dir);
          setGameDir(initState.default_minecraft_dir);
        }
      } catch (err) {
        console.warn('Failed to load init state:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }

      // Silent Java scanning in background
      try {
        const runtimes = await scanSystemJavaRuntimes();
        if (!isCancelled && Array.isArray(runtimes) && runtimes.length > 0) {
          const sorted = [...runtimes].sort((a, b) => b.majorVersion - a.majorVersion);
          setJavaRuntimes(sorted);
          // Pick best Java: prioritize 25, 21, then 17, or top element
          const bestJava =
            sorted.find((r) => r.majorVersion === 25) ||
            sorted.find((r) => r.majorVersion === 21) ||
            sorted.find((r) => r.majorVersion === 17) ||
            sorted[0];
          setSelectedJavaId(bestJava.id);
        }
      } catch (err) {
        console.warn('Silent Java scan error:', err);
      } finally {
        if (!isCancelled) setIsJavaScanning(false);
      }
    }

    initialize();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Update scanned versions when gameDir changes
  useEffect(() => {
    if (!gameDir) return;
    let isCancelled = false;
    setIsScanningVersions(true);

    scanMinecraftVersions({
      gameDir,
      scanSystemDirs: false,
      customDirs: [],
    })
      .then((versions) => {
        if (!isCancelled) {
          setScannedVersionCount(versions.length);
        }
      })
      .catch(() => {
        if (!isCancelled) setScannedVersionCount(0);
      })
      .finally(() => {
        if (!isCancelled) setIsScanningVersions(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [gameDir]);

  // Browse Atom directory
  const handleBrowseAtomDir = async () => {
    const selected = await pickFolder(atomDir || defaultAtomDir);
    if (selected) {
      setAtomDir(selected);
    }
  };

  // Browse Game directory
  const handleBrowseGameDir = async () => {
    const selected = await pickFolder(gameDir);
    if (selected) {
      setGameDir(selected);
    }
  };

  // Start Microsoft Device Code Login
  const handleStartMsLogin = async () => {
    setIsMsPolling(true);
    setMsStatusText('正在请求微软授权码...');
    try {
      const data = await startDeviceCodeLogin();
      setMsUserCode(data.userCode);
      setMsVerifyUri(data.verificationUri);
      setMsStatusText(`请前往浏览器输入代码: ${data.userCode}`);

      // Auto poll
      const pollRes = await pollDeviceCodeLogin(data.deviceCode);
      if (pollRes.status === 'success') {
        setMsStatusText('✅ 微软正版账号验证成功！');
        setAccountType('microsoft');
      } else {
        setMsStatusText(`登录未完成: ${pollRes.message || '已超时'}`);
      }
    } catch (err) {
      setMsStatusText(`请求授权失败: ${String(err)}`);
    } finally {
      setIsMsPolling(false);
    }
  };

  // Complete Initialization
  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const effectiveAtomDir = atomDir.trim() || defaultAtomDir;
      const effectiveGameDir = gameDir.trim() || 'C:\\Users\\Default\\AppData\\Roaming\\.minecraft';
      const effectiveOfflineName = accountType === 'offline' ? (offlineName.trim() || 'Steve').slice(0, 16) : null;
      const activeRuntime = javaRuntimes.find((r) => r.id === selectedJavaId) || javaRuntimes[0];
      const effectiveJavaPath = useCustomJava ? (customJavaPath.trim() || null) : (activeRuntime?.path || null);

      const effectiveJavaId = useCustomJava ? '' : (selectedJavaId || 'auto');

      await saveInitConfiguration({
        atom_dir: effectiveAtomDir,
        game_dir: effectiveGameDir,
        selected_java_id: effectiveJavaId,
        java_path: effectiveJavaPath,
        custom_java_path: useCustomJava ? customJavaPath.trim() : null,
        offline_username: effectiveOfflineName,
        memory_mb: 4096,
      });

      // Synchronize frontend launcher settings immediately
      const current = loadLauncherSettings();
      saveLauncherSettings({
        ...current,
        gameDir: effectiveGameDir,
        selectedJavaId: effectiveJavaId,
        customJavaPath: useCustomJava ? customJavaPath.trim() : '',
        useCustomJava,
      });

      onComplete();
    } catch (err) {
      console.error('Failed to complete initialization:', err);
      alert(`初始化保存失败: ${String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-app-bg font-fusion text-white text-sm">
        <div className="flex flex-col items-center gap-3 p-6 bg-surface-card ring-4 ring-border-hard">
          <div className="animate-spin text-2xl">⏳</div>
          <span>正在检测启动器环境与配置...</span>
        </div>
      </div>
    );
  }

  const isDefaultAtom = atomDir === defaultAtomDir;

  return (
    <div
      data-testid="init-wizard"
      className="flex h-screen w-screen items-center justify-center overflow-hidden bg-surface-app-bg p-8 select-none font-fusion"
    >
      <div className="w-[740px] max-w-full bg-surface-card ring-4 ring-inset ring-border-hard shadow-[6px_6px_0_0_var(--color-stone-100)] flex flex-col overflow-hidden">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 bg-dirt-10/40 border-b-2 border-surface-slot shrink-0">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-wider">
              <span className="text-btn-primary-bg">ATOM</span>
              <span className="text-dirt-80"> LAUNCHER</span>
              <span className="text-stone-60 text-xs ml-2">// 初始配置向导</span>
            </h1>
            <p className="text-[11px] text-stone-60 mt-0.5">首次启动引导 · 绿色便携数据存储与环境自动优选</p>
          </div>
          {/* 步骤胶囊 */}
          <div className="flex items-center gap-1.5 text-xs">
            {[
              { num: 1, label: '数据存储' },
              { num: 2, label: '游戏角色' },
              { num: 3, label: '游戏目录' },
              { num: 4, label: 'Java 确认' },
            ].map((s) => (
              <div
                key={s.num}
                className={`px-2.5 py-1 flex items-center gap-1 ring-1 ring-border-hard ${
                  step === s.num
                    ? 'bg-btn-primary-bg text-white font-bold ring-grass-80 shadow-inner'
                    : step > s.num
                    ? 'bg-grass-80 text-white'
                    : 'bg-stone-10 text-stone-60'
                }`}
              >
                <span>{s.num}.</span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 向导内容主体 */}
        <div className="p-6 flex-1 min-h-[360px] flex flex-col justify-between overflow-y-auto">
          {/* ==================================================== */}
          {/* 步骤 1: .atom 数据存储目录 */}
          {/* ==================================================== */}
          {step === 1 && (
            <div data-testid="init-step-1" className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-dirt-40/40">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📁</span>
                  <span className="font-bold text-btn-primary-active text-sm">第一步：配置文件与启动器数据存储位置 (.atom)</span>
                </div>
                {isDefaultAtom && (
                  <span className="text-[10px] px-2 py-0.5 bg-grass-80 text-white rounded">
                    [推荐 便携免安装模式]
                  </span>
                )}
              </div>

              <div className="p-3 bg-dirt-20/25 ring-1 ring-surface-slot text-xs text-stone-80 leading-relaxed">
                Atom Launcher 采用现代化绿色便携存储架构。有关启动器的配置 (<code className="font-mono text-stone-100">config.json</code>)、账号凭据 (<code className="font-mono text-stone-100">accounts.json</code>)、日志及扩展插件，默认全部保存在可执行文件同级目录的 <code className="font-mono text-btn-primary-active">.atom</code> 文件夹下，真正做到解压即用、无残留。
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-stone-100">当前选定的 .atom 数据存储目录：</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    data-testid="init-atom-dir-input"
                    value={atomDir}
                    onChange={(e) => setAtomDir(e.target.value)}
                    placeholder="例如: D:\AtomLauncher\.atom"
                    className="flex-1 bg-stone-10 px-3 py-2 ring-1 ring-border-hard text-xs text-stone-100 font-mono outline-none"
                  />
                  <button
                    type="button"
                    data-testid="init-atom-browse-btn"
                    onClick={handleBrowseAtomDir}
                    className="px-4 py-2 bg-btn-primary-bg text-white hover:bg-btn-primary-hover active:bg-btn-primary-active ring-2 ring-inset ring-border-hard cursor-pointer text-xs"
                  >
                    浏览选择
                  </button>
                  {!isDefaultAtom && (
                    <button
                      type="button"
                      onClick={() => setAtomDir(defaultAtomDir)}
                      className="px-3 py-2 bg-stone-60 text-white hover:bg-stone-80 ring-1 ring-border-hard cursor-pointer text-xs"
                      title="重置为可执行文件同级目录"
                    >
                      恢复默认
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-stone-60">
                  {isDefaultAtom
                    ? '✔ 当前为可执行文件同级推荐目录，可直接拷至移动硬盘或 U 盘随身携带。'
                    : '⚡ 您已指定自定义存储路径，启动器将通过指针文件自动重定向。'}
                </span>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* 步骤 2: 登录或创建角色 */}
          {/* ==================================================== */}
          {step === 2 && (
            <div data-testid="init-step-2" className="flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-dirt-40/40">
                <span className="text-lg">👤</span>
                <span className="font-bold text-btn-primary-active text-sm">第二步：登录或创建游戏角色</span>
              </div>

              {/* 账号模式切换卡片 */}
              <div className="grid grid-cols-3 gap-3">
                <div
                  onClick={() => setAccountType('offline')}
                  className={`p-3 ring-1 cursor-pointer flex flex-col gap-1 transition-colors ${
                    accountType === 'offline'
                      ? 'bg-stone-10 ring-2 ring-grass-60 shadow-[2px_2px_0_0_rgba(46,94,28,0.4)]'
                      : 'bg-stone-10/60 ring-border-hard/40 hover:bg-stone-10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-100 text-xs">⚡ 快速离线角色</span>
                    <input
                      type="radio"
                      checked={accountType === 'offline'}
                      onChange={() => setAccountType('offline')}
                      className="accent-grass-60"
                    />
                  </div>
                  <span className="text-[10px] text-stone-60">无需联网验证，输入昵称即可秒开游戏</span>
                </div>

                <div
                  onClick={() => setAccountType('microsoft')}
                  className={`p-3 ring-1 cursor-pointer flex flex-col gap-1 transition-colors ${
                    accountType === 'microsoft'
                      ? 'bg-stone-10 ring-2 ring-grass-60 shadow-[2px_2px_0_0_rgba(46,94,28,0.4)]'
                      : 'bg-stone-10/60 ring-border-hard/40 hover:bg-stone-10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-100 text-xs">🛡️ 微软正版账号</span>
                    <input
                      type="radio"
                      checked={accountType === 'microsoft'}
                      onChange={() => setAccountType('microsoft')}
                      className="accent-grass-60"
                    />
                  </div>
                  <span className="text-[10px] text-stone-60">官方安全验证，支持多人服务器与皮肤</span>
                </div>

                <div
                  onClick={() => setAccountType('skip')}
                  className={`p-3 ring-1 cursor-pointer flex flex-col gap-1 transition-colors ${
                    accountType === 'skip'
                      ? 'bg-stone-10 ring-2 ring-grass-60 shadow-[2px_2px_0_0_rgba(46,94,28,0.4)]'
                      : 'bg-stone-10/60 ring-border-hard/40 hover:bg-stone-10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-100 text-xs">⏩ 稍后配置 / 游客</span>
                    <input
                      type="radio"
                      checked={accountType === 'skip'}
                      onChange={() => setAccountType('skip')}
                      className="accent-grass-60"
                    />
                  </div>
                  <span className="text-[10px] text-stone-60">使用默认 Steve 游客身份直接跳过</span>
                </div>
              </div>

              {/* 离线账号详情输入 */}
              {accountType === 'offline' && (
                <div className="flex flex-col gap-2 p-3 bg-dirt-20/25 ring-1 ring-surface-slot">
                  <span className="text-xs font-bold text-stone-100">输入离线玩家昵称 (支持中英文、数字)：</span>
                  <input
                    type="text"
                    data-testid="init-offline-name-input"
                    value={offlineName}
                    onChange={(e) => setOfflineName(e.target.value)}
                    placeholder="输入游戏名称，例如: Steve"
                    className="bg-stone-10 px-3 py-2 ring-1 ring-border-hard text-xs text-stone-100 font-mono outline-none max-w-sm"
                  />
                  <span className="text-[10px] text-stone-60">
                    该账号将直接保存至 <code className="font-mono text-stone-100">.atom/accounts.json</code>。
                  </span>
                </div>
              )}

              {/* 微软账号登录流程 */}
              {accountType === 'microsoft' && (
                <div className="flex flex-col gap-2.5 p-3 bg-dirt-20/25 ring-1 ring-surface-slot">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-100">微软设备代码验证流 (OAuth2 Device Code)：</span>
                    <button
                      type="button"
                      data-testid="init-ms-login-btn"
                      onClick={handleStartMsLogin}
                      disabled={isMsPolling}
                      className="px-3 py-1 bg-btn-primary-bg text-white hover:bg-btn-primary-hover active:bg-btn-primary-active ring-1 ring-border-hard cursor-pointer text-xs disabled:opacity-50"
                    >
                      {isMsPolling ? '⏳ 验证中...' : '🔑 获取登录代码'}
                    </button>
                  </div>

                  {msUserCode && (
                    <div className="flex flex-col gap-1.5 p-3 bg-stone-10 ring-1 ring-border-hard">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-60">请复制登录验证码:</span>
                        <span className="text-base font-mono font-bold text-btn-primary-active px-2 py-0.5 bg-dirt-20/60 ring-1 ring-border-hard">
                          {msUserCode}
                        </span>
                      </div>
                      <a
                        href={msVerifyUri || 'https://www.microsoft.com/devicelogin'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-grass-80 underline hover:text-grass-60"
                      >
                        👉 前往微软官方登录页面 ({msVerifyUri || 'microsoft.com/devicelogin'})
                      </a>
                    </div>
                  )}

                  {msStatusText && (
                    <div className="text-[11px] text-stone-80 font-mono">{msStatusText}</div>
                  )}
                </div>
              )}

              {accountType === 'skip' && (
                <div className="p-3 bg-dirt-20/25 ring-1 ring-surface-slot text-xs text-stone-60">
                  将自动以预设角色 <span className="text-stone-100 font-bold">Steve</span> 进入启动器。稍后随时可在启动器右上角切换或添加正版账号。
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* 步骤 3: 游戏安装目录 */}
          {/* ==================================================== */}
          {step === 3 && (
            <div data-testid="init-step-3" className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-dirt-40/40">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎮</span>
                  <span className="font-bold text-btn-primary-active text-sm">第三步：选择 Minecraft 游戏安装目录 (.minecraft)</span>
                </div>
                {scannedVersionCount !== null && (
                  <span className="text-[10px] px-2 py-0.5 bg-grass-80 text-white rounded">
                    {scannedVersionCount > 0 ? `✔ 已发现 ${scannedVersionCount} 个本地版本` : '新目录 (无现有版本)'}
                  </span>
                )}
              </div>

              <div className="p-3 bg-dirt-20/25 ring-1 ring-surface-slot text-xs text-stone-80 leading-relaxed">
                指定 Minecraft 版本的存放目录。启动器将自动探测该目录下的 <code className="font-mono text-stone-100">versions</code> 文件夹，并读取现有的原版、Forge、Fabric 与 NeoForge 游戏实例。
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-stone-100">.minecraft 目录路径：</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    data-testid="init-game-dir-input"
                    value={gameDir}
                    onChange={(e) => setGameDir(e.target.value)}
                    placeholder="例如: C:\Users\YourName\AppData\Roaming\.minecraft"
                    className="flex-1 bg-stone-10 px-3 py-2 ring-1 ring-border-hard text-xs text-stone-100 font-mono outline-none"
                  />
                  <button
                    type="button"
                    data-testid="init-game-browse-btn"
                    onClick={handleBrowseGameDir}
                    className="px-4 py-2 bg-btn-primary-bg text-white hover:bg-btn-primary-hover active:bg-btn-primary-active ring-2 ring-inset ring-border-hard cursor-pointer text-xs"
                  >
                    浏览选择
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-stone-60">
                  {isScanningVersions ? (
                    <span>⏳ 正在扫描该目录下的 Minecraft 版本库...</span>
                  ) : scannedVersionCount !== null && scannedVersionCount > 0 ? (
                    <span className="text-grass-80 font-bold">
                      ✔ 成功检索到 {scannedVersionCount} 个游戏版本，初始化完成后将直接展示在实例列表中。
                    </span>
                  ) : (
                    <span>未在该目录下找到已下载的游戏版本，初始化后可直接在下载中心极速安装。</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* 步骤 4: Java 确认 */}
          {/* ==================================================== */}
          {step === 4 && (
            <div data-testid="init-step-4" className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-dirt-40/40">
                <div className="flex items-center gap-2">
                  <span className="text-lg">☕</span>
                  <span className="font-bold text-btn-primary-active text-sm">第四步：确认 Java 运行环境 (静默扫描优选结果)</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-grass-80 text-white rounded">
                  {isJavaScanning ? '⚡ 扫描中' : javaRuntimes.length > 0 ? '⚡ 自动推荐就绪' : '⚠ 未检测到 Java'}
                </span>
              </div>

              {javaRuntimes.length > 0 ? (
                <>
                  <div className="p-3 bg-dirt-20/25 ring-1 ring-surface-slot text-xs text-stone-80 leading-relaxed">
                    已在系统中成功扫描到 <span className="text-btn-primary-active font-bold font-mono">{javaRuntimes.length}</span> 个 Java 运行时。
                    启动器支持全自动智能适配机制：在启动不同版本的 Minecraft 时（如 26.3 调度 Java 25，1.20.5+ 调度 Java 21，1.18~1.20 调度 Java 17，1.12 调度 Java 8），将自动选择最适配的 Java，您无需手动频繁切换。
                  </div>

                  {/* 扫描到的 Java 列表展示 */}
                  <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                    {javaRuntimes.map((runtime, idx) => {
                      const isSelected = !useCustomJava && selectedJavaId === runtime.id;
                      const isTopRecommended = idx === 0 || runtime.majorVersion === 25 || runtime.majorVersion === 21;
                      return (
                        <div
                          key={runtime.id}
                          onClick={() => {
                            setSelectedJavaId(runtime.id);
                            setUseCustomJava(false);
                          }}
                          className={`p-2.5 ring-1 cursor-pointer transition-colors flex flex-col gap-1 ${
                            isSelected
                              ? 'bg-stone-10 ring-2 ring-grass-60 shadow-[2px_2px_0_0_rgba(46,94,28,0.4)]'
                              : 'bg-stone-10/60 ring-border-hard/40 hover:bg-stone-10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="init-java-choice"
                                checked={isSelected}
                                onChange={() => {}}
                                className="accent-grass-60"
                              />
                              <span className="font-bold text-stone-100 text-xs">{runtime.name}</span>
                              {isTopRecommended && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-grass-80 text-white rounded font-bold">
                                  ⚡ 智能推荐
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-grass-80 font-bold">{runtime.recommendedFor}</span>
                          </div>
                          <div className="text-[10px] text-stone-60 font-mono truncate pl-5">{runtime.path}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* 未扫描到 Java 时的指引与下载建议 */
                <div className="flex flex-col gap-3 p-3.5 bg-dirt-20/40 ring-2 ring-[#B8860B] border-l-4 border-[#FF8C00]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚠</span>
                      <span className="font-bold text-btn-primary-active text-xs">未检测到已安装的 Java (JDK)</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setIsJavaScanning(true);
                        try {
                          const res = await scanSystemJavaRuntimes();
                          if (res.length > 0) {
                            setJavaRuntimes(res);
                            const best = res.find((r) => r.majorVersion === 25) || res.find((r) => r.majorVersion === 21) || res[0];
                            setSelectedJavaId(best.id);
                          }
                        } finally {
                          setIsJavaScanning(false);
                        }
                      }}
                      className="px-2.5 py-1 bg-btn-primary-bg hover:bg-btn-primary-hover text-white text-[11px] font-bold ring-1 ring-border-hard cursor-pointer"
                    >
                      🔄 重新扫描
                    </button>
                  </div>
                  <div className="text-xs text-stone-80 leading-relaxed">
                    Minecraft 是基于 Java 开发的游戏，运行游戏必须安装 Java 运行环境。建议您前往官方安全下载源安装对应版本的 JDK：
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href="https://adoptium.net/temurin/releases/?version=21"
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-stone-10 ring-1 ring-border-hard hover:ring-grass-60 text-xs flex flex-col gap-0.5 text-stone-100 no-underline"
                    >
                      <span className="font-bold text-btn-primary-active">📥 Adoptium JDK 21 (推荐)</span>
                      <span className="text-[10px] text-stone-60">支持 1.20.5+ 及 1.21+ 现代正式版</span>
                    </a>
                    <a
                      href="https://adoptium.net/temurin/releases/?version=25"
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-stone-10 ring-1 ring-border-hard hover:ring-grass-60 text-xs flex flex-col gap-0.5 text-stone-100 no-underline"
                    >
                      <span className="font-bold text-btn-primary-active">📥 Adoptium JDK 25 (快照)</span>
                      <span className="text-[10px] text-stone-60">支持 26.3+ 最新快照与实验特性</span>
                    </a>
                    <a
                      href="https://adoptium.net/temurin/releases/?version=17"
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-stone-10 ring-1 ring-border-hard hover:ring-grass-60 text-xs flex flex-col gap-0.5 text-stone-100 no-underline"
                    >
                      <span className="font-bold text-btn-primary-active">📥 Adoptium JDK 17</span>
                      <span className="text-[10px] text-stone-60">支持 1.18 ~ 1.20.4 中期版本</span>
                    </a>
                    <a
                      href="https://adoptium.net/temurin/releases/?version=8"
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-stone-10 ring-1 ring-border-hard hover:ring-grass-60 text-xs flex flex-col gap-0.5 text-stone-100 no-underline"
                    >
                      <span className="font-bold text-btn-primary-active">📥 Adoptium JDK 8</span>
                      <span className="text-[10px] text-stone-60">支持 1.12.2 等旧版经典大型模组</span>
                    </a>
                  </div>
                </div>
              )}

              {/* 手动指定便携 Java 路径 */}
              <div className="pt-2 border-t border-dirt-40/30 flex flex-col gap-1.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-stone-100">
                  <input
                    type="radio"
                    name="init-java-choice"
                    checked={useCustomJava}
                    onChange={() => setUseCustomJava(true)}
                    className="accent-grass-60"
                  />
                  <span>手动指定自定义 Java 路径 (适用于便携版或免安装 JDK)</span>
                </label>
                {useCustomJava && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      data-testid="init-custom-java-input"
                      value={customJavaPath}
                      onChange={(e) => setCustomJavaPath(e.target.value)}
                      placeholder="例如: C:\Java\jdk-25\bin\javaw.exe"
                      className="flex-1 bg-stone-10 px-3 py-1.5 ring-1 ring-border-hard text-xs text-stone-100 font-mono outline-none"
                    />
                    <button
                      type="button"
                      data-testid="init-custom-java-browse-btn"
                      onClick={async () => {
                        const file = await pickFile('Java 可执行文件', 'javaw.exe;java.exe', customJavaPath);
                        if (file) {
                          setCustomJavaPath(file);
                        } else {
                          const folder = await pickFolder(customJavaPath);
                          if (folder) {
                            setCustomJavaPath(`${folder}\\bin\\javaw.exe`);
                          }
                        }
                      }}
                      className="px-3 py-1.5 bg-btn-primary-bg text-white hover:bg-btn-primary-hover active:bg-btn-primary-active ring-1 ring-border-hard cursor-pointer text-xs"
                    >
                      浏览选择
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部向导控制条 */}
        <div className="flex items-center justify-between px-6 py-4 bg-dirt-10/40 border-t-2 border-surface-slot shrink-0">
          <div>
            {step > 1 && (
              <button
                type="button"
                data-testid="init-prev-btn"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="px-4 py-1.5 bg-stone-60 hover:bg-stone-80 text-white text-xs ring-2 ring-inset ring-border-hard shadow-[0px_2px_0_0_var(--color-stone-100)] cursor-pointer"
              >
                ◀ 上一步
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step < 4 ? (
              <button
                type="button"
                data-testid="init-next-btn"
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                className="px-5 py-1.5 bg-btn-primary-bg hover:bg-btn-primary-hover active:bg-btn-primary-active text-white text-xs font-bold ring-2 ring-inset ring-border-hard shadow-[0px_2px_0_0_var(--color-stone-100)] cursor-pointer"
              >
                下一步 ▶
              </button>
            ) : (
              <button
                type="button"
                data-testid="init-complete-btn"
                onClick={handleComplete}
                disabled={isSubmitting}
                className="px-6 py-2 bg-grass-80 hover:bg-grass-60 active:bg-grass-100 text-white text-sm font-bold ring-2 ring-inset ring-border-hard shadow-[0px_2px_0_0_var(--color-stone-100)] cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <span>🚀</span>
                <span>{isSubmitting ? '保存初始化中...' : '完成初始化并进入启动器'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitWizard;
