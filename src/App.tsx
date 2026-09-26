import { useState, useEffect } from "react";
import "./App.css";
import WindowControls from "./components/WindowControls";
import BottomNav, { type NavValue } from "./components/BottomNav";
import CreeperCanvas from "./components/CreeperCanvas";
import { SettingsView, SettingsSidebar } from "./components/SettingsView";
import { ToolsView } from "./components/ToolsView";
import { scanMinecraftInstances, type MinecraftInstance } from "./utils/settingsStorage";

function App() {
  const [currentTab, setCurrentTab] = useState<NavValue>("home");
  const [instances, setInstances] = useState<MinecraftInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    setLoadingInstances(true);
    scanMinecraftInstances().then((list) => {
      if (!isSubscribed) return;
      setInstances(list);
      setLoadingInstances(false);
    });
    return () => {
      isSubscribed = false;
    };
  }, [currentTab]);

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
              absolute inset-0 h-full w-full flex flex-col justify-between
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

            {/* 真实实例列表 */}
            <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar">
              {loadingInstances && instances.length === 0 ? (
                <div className="p-4 text-[11px] text-stone-60 font-fusion">正在检索游戏实例...</div>
              ) : instances.length === 0 ? (
                <div className="p-4 text-[11px] text-stone-60 font-fusion leading-relaxed">
                  .minecraft 目录下暂未发现已安装版本，点击下方按钮开始下载安装。
                </div>
              ) : (
                instances.slice(0, 4).map((inst) => (
                  <div
                    key={inst.id}
                    className="flex items-center justify-between px-4 py-2.5 ring-1 ring-inset ring-surface-slot hover:bg-dirt-20/20 transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-fusion text-xs text-stone-100 font-bold truncate">
                        {inst.version}
                      </span>
                      <span className="font-fusion text-[10px] text-stone-60 truncate">
                        {inst.loaderType} {inst.modCount > 0 ? `· ${inst.modCount} 个模组` : '· 原版纯净'}
                      </span>
                    </div>
                    <span className="font-fusion text-[10px] px-1.5 py-0.5 bg-grass-80 text-white rounded shrink-0">
                      就绪
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* 创建/导入实例 */}
            <div className="flex items-center justify-between px-4 py-3 ring-1 ring-inset ring-surface-slot hover:bg-dirt-20/20 transition-colors cursor-pointer shrink-0">
              <div className="flex flex-col">
                <span className="font-fusion text-xs text-stone-100 font-bold">+ 安装新游戏版本...</span>
                <span className="font-fusion text-[10px] text-btn-primary-active">支持官方与第三方源</span>
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