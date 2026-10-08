import React from 'react';
import { PluginSlot } from './PluginSlot';

interface ToolsViewProps {
  pluginDir?: string;
  entryJs?: string;
}

export const ToolsView: React.FC<ToolsViewProps> = ({
  pluginDir = "src/my-demo",
  entryJs = "ui/index.js",
}) => {
  return (
    <div className="w-full h-full flex flex-col bg-surface-card overflow-hidden">
      {/* 顶部工具栏标题 */}
      <div className="px-5 py-3 border-b-2 border-surface-slot bg-dirt-20/25 flex items-center justify-between shrink-0 font-fusion">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-bold text-btn-primary-active">WASM 插件与扩展工具箱</h2>
          <span className="text-[10px] px-2 py-0.5 bg-grass-80 text-white rounded">WebAssembly 沙箱</span>
        </div>
        <div className="text-xs text-text-muted">
          入口：{entryJs}
        </div>
      </div>

      {/* 原生插件插槽展示区 */}
      <div className="flex-1 overflow-hidden p-3 flex flex-col">
        <PluginSlot 
          pluginDir={pluginDir} 
          entryJs={entryJs} 
        />
      </div>
    </div>
  );
};

export default ToolsView;
