import React, { useState } from 'react';

export const SettingsView: React.FC = () => {
  const [allocatedMemory, setAllocatedMemory] = useState(4096);
  const [autoClose, setAutoClose] = useState(false);
  const [creeperEffects, setCreeperEffects] = useState(true);

  return (
    <div className="w-full h-full flex flex-col bg-surface-card overflow-y-auto p-5 select-none font-fusion">
      {/* 顶部标题 */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-surface-slot shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚙️</span>
          <h2 className="text-[18px] text-btn-primary-active font-bold">启动器设置中心</h2>
        </div>
        <span className="text-[11px] px-2 py-0.5 bg-grass-80 text-white rounded ring-1 ring-border-hard">
          像素风格配置
        </span>
      </div>

      <div className="flex-1 py-4 flex flex-col gap-4 text-xs text-dirt-80">
        {/* 运行环境设置 */}
        <div className="p-3 bg-dirt-20/25 ring-2 ring-inset ring-surface-slot flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-btn-primary-active">☕ Java 运行环境 (Runtime)</span>
            <span className="text-[10px] text-stone-60">自动推荐</span>
          </div>

          <div className="flex gap-2 items-center">
            <div className="flex-1 bg-stone-10 px-3 py-1.5 ring-1 ring-inset ring-border-hard text-[11px] truncate text-stone-100 font-mono">
              C:\Program Files\Java\jdk-21\bin\javaw.exe
            </div>
            <button
              type="button"
              className="px-3 py-1 bg-btn-primary-bg text-white hover:bg-btn-primary-hover active:bg-btn-primary-active ring-2 ring-inset ring-border-hard shadow-[0px_2px_0_0_var(--color-stone-100)] cursor-pointer"
            >
              浏览
            </button>
          </div>

          {/* 内存分配调节 */}
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span>最大内存分配 (JVM Xmx):</span>
              <span className="font-bold text-btn-primary-active px-2 py-0.5 bg-stone-10 ring-1 ring-border-hard">
                {allocatedMemory} MB ({Math.round((allocatedMemory / 1024) * 10) / 10} GB)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-stone-60">1024 MB</span>
              <input
                type="range"
                min={1024}
                max={16384}
                step={512}
                value={allocatedMemory}
                onChange={(e) => setAllocatedMemory(Number(e.target.value))}
                className="flex-1 accent-grass-60 cursor-pointer h-2 bg-stone-40 rounded"
              />
              <span className="text-[10px] text-stone-60">16 GB</span>
            </div>
          </div>
        </div>

        {/* 启动与视觉配置 */}
        <div className="p-3 bg-dirt-20/25 ring-2 ring-inset ring-surface-slot flex flex-col gap-2.5">
          <div className="font-bold text-btn-primary-active">🎨 显示与交互体验</div>

          <label className="flex items-center justify-between cursor-pointer py-1">
            <span>启动游戏后自动最小化启动器窗口</span>
            <input
              type="checkbox"
              checked={autoClose}
              onChange={(e) => setAutoClose(e.target.checked)}
              className="h-4 w-4 accent-grass-60 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer py-1">
            <span>首页苦力怕展台与 Pretext 排版动态动效</span>
            <input
              type="checkbox"
              checked={creeperEffects}
              onChange={(e) => setCreeperEffects(e.target.checked)}
              className="h-4 w-4 accent-grass-60 cursor-pointer"
            />
          </label>

          <div className="flex items-center justify-between py-1">
            <span>界面缩放比例 (UI Scale)</span>
            <span className="text-[11px] text-stone-60 bg-stone-10 px-2 py-0.5 ring-1 ring-border-hard">
              点对点像素 (100%)
            </span>
          </div>
        </div>

        {/* 系统信息卡片 */}
        <div className="p-3 bg-dirt-20/15 ring-1 ring-inset ring-surface-slot flex flex-col gap-1 text-[11px] text-stone-60">
          <div className="text-dirt-80 font-bold mb-0.5">ℹ️ 关于 AtomLauncher</div>
          <div>版本：0.1.0-alpha</div>
          <div>架构：Tauri 2.0 + React 19 + WebAssembly (Wasm)</div>
          <div>文字排版引擎：@chenglou/pretext (零 DOM 重排)</div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
