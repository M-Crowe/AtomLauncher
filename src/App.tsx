import { useState } from "react";
import "./App.css";
import WindowControls from "./components/WindowControls";
import BottomNav, { type NavValue } from "./components/BottomNav";
import CreeperCanvas from "./components/CreeperCanvas";
import { SettingsView, SettingsSidebar } from "./components/SettingsView";
import { ToolsView } from "./components/ToolsView";

function App() {
  const [currentTab, setCurrentTab] = useState<NavValue>("home");

  return (
    <main
      className="flex h-screen w-screen items-center justify-center overflow-hidden bg-surface-app-bg p-9 select-none"
      data-tauri-drag-region
    >
      <div
        className="
        bg-surface-card ring-4 ring-inset ring-border-hard
        grid h-full w-full 
        grid-cols-[minmax(0,1fr)_277px]
        grid-rows-[70px_minmax(0,1fr)_78px]
        px-5
        "
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center">
          <h1 className="text-[32px] font-fusion">
            <span className="text-btn-primary-bg">ATOM</span>
            <span className="text-dirt-80"> LAUNCHER</span>
          </h1>
        </div>
        <div></div>

        {/* 主内容视图区域 (根据底部导航受控状态切换，具备平滑自然的展开/拉伸过渡动效) */}
        <div className="h-full w-full border-10 border-grass-80 rounded overflow-hidden transition-all duration-300 ease-out">
          {currentTab === "home" && <CreeperCanvas />}
          {currentTab === "settings" && <SettingsView />}
          {currentTab === "tools" && (
            <ToolsView
              pluginDir={"D:/tauri-apps/AtomLauncher/atom-launcher/src/my-demo"}
              entryJs="ui/index.js"
            />
          )}
        </div>

        {/* 右侧栏 (277px)：联动切换 (最近实例列表 <-> 设置分类选项) */}
        <div
          className="
          relative h-full w-full
          ring-2 ring-inset ring-surface-slot 
          shadow-[4px_2px_0_0_var(--color-redstone-100)]
          overflow-hidden bg-surface-card
          "
        >
          {/* 最近实例列表 */}
          <div
            aria-hidden={currentTab === "settings"}
            inert={currentTab === "settings" ? true : undefined}
            className={`
              absolute inset-0 h-full w-full
              grid grid-cols-[minmax(0,1fr)] grid-rows-[0.75fr_repeat(4,minmax(0,1fr))]
              transition-all duration-300 ease-out
              ${currentTab === "settings"
                ? "opacity-0 pointer-events-none translate-x-4"
                : "opacity-100 translate-x-0"
              }
            `}
          >
            <div
              className="
              flex items-end justify-start p-5
              ring-2 ring-inset ring-surface-slot
              "
            >
              <h2 className="text-[16px] font-fusion text-btn-primary-active">最近实例列表</h2>
            </div>

            {/* 实例项 1 */}
            <div className="flex items-center justify-between px-4 py-2 ring-1 ring-inset ring-surface-slot hover:bg-dirt-20/20 transition-colors cursor-pointer">
              <div className="flex flex-col">
                <span className="font-fusion text-xs text-stone-100 font-bold">1.20.4 原版纯净生存</span>
                <span className="font-fusion text-[10px] text-stone-60">上次运行：今天 14:22</span>
              </div>
              <span className="font-fusion text-[10px] px-1.5 py-0.5 bg-grass-80 text-white rounded">已同步</span>
            </div>

            {/* 实例项 2 */}
            <div className="flex items-center justify-between px-4 py-2 ring-1 ring-inset ring-surface-slot hover:bg-dirt-20/20 transition-colors cursor-pointer">
              <div className="flex flex-col">
                <span className="font-fusion text-xs text-stone-100 font-bold">1.21.1 试验性新特性</span>
                <span className="font-fusion text-[10px] text-stone-60">Fabric · 12个模组</span>
              </div>
              <span className="font-fusion text-[10px] px-1.5 py-0.5 bg-stone-60 text-white rounded">未运行</span>
            </div>

            {/* 实例项 3 */}
            <div className="flex items-center justify-between px-4 py-2 ring-1 ring-inset ring-surface-slot hover:bg-dirt-20/20 transition-colors cursor-pointer">
              <div className="flex flex-col">
                <span className="font-fusion text-xs text-stone-100 font-bold">1.16.5 机械动力工业</span>
                <span className="font-fusion text-[10px] text-stone-60">Forge · 48个模组</span>
              </div>
              <span className="font-fusion text-[10px] px-1.5 py-0.5 bg-stone-60 text-white rounded">未运行</span>
            </div>

            {/* 实例项 4 */}
            <div className="flex items-center justify-between px-4 py-2 ring-1 ring-inset ring-surface-slot hover:bg-dirt-20/20 transition-colors cursor-pointer">
              <div className="flex flex-col">
                <span className="font-fusion text-xs text-stone-100 font-bold">+ 创建新游戏实例...</span>
                <span className="font-fusion text-[10px] text-btn-primary-active">支持多版本隔离</span>
              </div>
              <span className="font-fusion text-sm text-btn-primary-active">➔</span>
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
        </div>

        {/* 底部受控导航栏 */}
        <div className="h-full w-full ring-inset ring-3 ring-border-hard">
          <BottomNav activeTab={currentTab} onChange={setCurrentTab} />
        </div>

        {/* 底部栏右侧占位 */}
        <div></div>
      </div>

      <WindowControls />
    </main>
  );
}

export default App;