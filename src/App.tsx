import "./App.css";
import { getCurrentWindow } from '@tauri-apps/api/window';
import closeIcon from "./assets/close.svg";
import minimizeIcon from "./assets/minimize.svg";


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
          className="flex h-6 w-6 items-center justify-center"
          onClick={() => currentWindow.minimize()}
        >
          <img src={minimizeIcon} alt="" className="h-6 w-6" />
        </button>

        <button
          type="button"
          aria-label="关闭"
          className="flex h-6 w-6 items-center justify-center"
          onClick={() => currentWindow.close()}
        >
          <img src={closeIcon} alt="" className="h-6 w-6" />
        </button>
      </div>
    </main>
  );
}

export default App;