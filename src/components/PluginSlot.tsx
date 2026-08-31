import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PluginSlotProps {
  pluginDir: string;
  entryJs: string;
  className?: string;
}

export const PluginSlot: React.FC<PluginSlotProps> = ({
  pluginDir,
  entryJs,
  className = "w-full h-full flex-1 overflow-hidden box-border"
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPlugin() {
      if (!containerRef.current) return;
      setErrorMsg(null);

      try {
        // 1. 规范化路径（统一转为正斜杠 /）
        const normalizedDir = pluginDir.replace(/\\/g, '/').replace(/\/$/, '');
        const normalizedEntry = entryJs.replace(/\\/g, '/').replace(/^\//, '');
        const fullJsPath = `${normalizedDir}/${normalizedEntry}`;

        // 2. 💡 关键修改：用 invoke 替代 fetch，直接让 Rust 读取文件文本
        const jsText = await invoke<string>('read_plugin_file', { path: fullJsPath });

        // 3. 将 JS 文本转换为 Blob URL 动态导入为 ES Module
        const blob = new Blob([jsText], { type: 'text/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        const pluginModule = await import(/* @vite-ignore */ blobUrl);
        URL.revokeObjectURL(blobUrl); // 释放内存

        const plugin = pluginModule.default;

        if (isMounted && plugin && typeof plugin.mount === 'function') {
          console.log("✅ 插件 UI 成功挂载！");
          await plugin.mount(containerRef.current, { pluginDir: normalizedDir, invoke });
        } else {
          throw new Error("插件 ui/index.js 没有导出包含 mount 方法的 default 对象");
        }
      } catch (err: any) {
        console.error("❌ 动态加载插件 UI 失败:", err);
        if (isMounted) {
          setErrorMsg(typeof err === 'string' ? err : err.message || String(err));
        }
      }
    }

    loadPlugin();
  }, [pluginDir, entryJs]);

  if (errorMsg) {
    return (
      <div className="p-4 bg-red-900/40 border border-red-500 rounded text-red-200 text-sm font-mono">
        ❌ 插件 UI 加载失败: {errorMsg}
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
};