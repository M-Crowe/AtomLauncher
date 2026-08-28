import "./App.css";
import { getCurrentWindow } from '@tauri-apps/api/window';
import CloseIcon from "./assets/close.svg?react";
import MinimizeIcon from "./assets/minimize.svg?react";


const currentWindow = getCurrentWindow();

function App() {
  return (
    <main 
      data-tauri-drag-region 
      className="h-screen w-screen bg-surface-app-bg flex p-9 items-center justify-center overflow-hidden"
      >

      <div className=" w-full h-full bg-surface-card ring-4 ring-inset ring-border-hard">
      </div>

      <div className="absolute top-2 right-9 flex gap-2">
        <button
          type="button"
          aria-label="最小化"
          className="flex h-6 w-6 items-center justify-center hover:bg-[#282B30]/5"
          onClick={() => currentWindow.minimize()}
        >
          <MinimizeIcon />
        </button>

        <button
          type="button"
          aria-label="关闭"
          className="flex h-6 w-6 items-center justify-center transition-all text-dirt-80 hover:text-stone-10 hover:bg-redstone-40  hover:shadow-[inset_2px_-1px_0_0_var(--color-redstone-60)]"
          onClick={() => currentWindow.close()}
        >
          <CloseIcon className="h-6 w-6 fill-current text-dirt-80 transition-colors   hover:text-stone-10"  />
        </button>
      </div>
    </main>
  );
}

export default App;