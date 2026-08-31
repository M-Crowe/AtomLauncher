import "./App.css";
import WindowControls from "./components/WindowControls";
import BottomNav from "./components/BottomNav";
import { PluginSlot } from './components/PluginSlot';

function App() {
  return (
    <main className="flex h-screen w-screen items-center justify-center overflow-hidden bg-surface-app-bg p-9" data-tauri-drag-region>
      <div 
      className="
    bg-surface-card ring-4 ring-inset ring-border-hard
      grid h-full w-full 
      grid-cols-[minmax(0,1fr)_277px]
      grid-rows-[70px_minmax(0,1fr)_78px]
      px-5
      " 
      >
        {/*标题栏*/}
        <div className="flex items-center">
          <h1 className="text-[32px] font-fusion">
            <span className="text-btn-primary-bg">ATOM</span>
            <span className="text-dirt-80"> LAUNCHER</span>
          </h1>
        </div>
        <div ></div>
        {/*主要内容*/}
        <div className="h-full w-full border-10 border-grass-80 rounded">
          <PluginSlot 
          pluginDir={"D:/tauri-apps/AtomLauncher/atom-launcher/src/my-demo"} 
          entryJs="ui/index.js" 
          />

        </div>
        {/*右侧栏*/}
        <div className="
          grid h-full w-full
          grid-cols-[minmax(0,1fr)]
          grid-rows-[0.75fr_repeat(4,minmax(0,1fr))]
          ring-2 ring-inset ring-surface-slot 
          shadow-[4px_2px_0_0_var(--color-redstone-100)]
        "
        >
          <div className="
          flex items-end justify-start p-5
          ring-2 ring-inset ring-surface-slot
          "
          >
            <h2 className="text-[16px] font-fusion text-btn-primary-active">最近实例列表</h2>
          </div>
        </div>


        {/*底部栏navbar*/}
        <div className="h-full w-full ring-inset ring-3 ring-border-hard">
          <BottomNav />
        </div>

        {/*底部栏右侧*/}
        <div ></div>
      </div>

      <WindowControls />
    </main>
  );
}

export default App;