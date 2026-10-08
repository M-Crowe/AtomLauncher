import { getCurrentWindow } from "@tauri-apps/api/window";
import CloseIcon from "../assets/close.svg?react";
import MinimizeIcon from "../assets/minimize.svg?react";

const currentWindow = getCurrentWindow();

export default function WindowControls() {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="最小化"
        className="flex h-6 w-6 items-center justify-center hover:bg-[#282B30]/5"
        onClick={() => currentWindow.minimize()}
      >
        <MinimizeIcon className="h-6 w-6" />
      </button>

      <button
        type="button"
        aria-label="关闭"
        className="flex h-6 w-6 items-center justify-center text-dirt-80 transition-colors hover:bg-redstone-40 hover:text-stone-10 hover:shadow-[inset_2px_-1px_0_0_var(--color-redstone-60)]"
        onClick={() => currentWindow.close()}
      >
        <CloseIcon className="h-6 w-6 fill-current" />
      </button>
    </div>
  );
}