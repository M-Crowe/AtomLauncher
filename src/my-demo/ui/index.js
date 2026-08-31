export default {
  async mount(container, context) {
    // 直接使用 Tailwind 工具类：w-full（宽满）、h-full（高满）、flex、flex-col、p-4、bg-slate-900 等
    container.innerHTML = `
      <div class="w-full h-full flex flex-col p-4 bg-slate-900 text-slate-100 rounded-lg shadow-md border border-slate-700 box-border">
        <div class="flex items-center justify-between pb-3 border-b border-slate-700">
          <h3 class="font-bold text-lg text-blue-400">🔌 测试插件主视图</h3>
          <span class="text-xs px-2 py-1 bg-green-900 text-green-300 rounded-full">已就绪</span>
        </div>

        <div class="flex-1 my-4 p-4 bg-slate-800 rounded border border-slate-700 flex flex-col justify-center items-center gap-4">
          <button id="test-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-medium rounded-md shadow">
            运行 Wasm 计算 (15 + 27)
          </button>
          <div id="test-result" class="text-xl font-mono text-emerald-400 min-h-[28px]"></div>
        </div>
      </div>
    `;

    const btn = container.querySelector('#test-btn');
    const resultSpan = container.querySelector('#test-result');

    btn.addEventListener('click', async () => {
      try {
        const res = await context.invoke('run_plugin_wasm', {
          pluginDir: context.pluginDir,
          wasmFile: 'main.wasm',
          funcName: 'add',
          a: 15,
          b: 27
        });
        resultSpan.textContent = `= ${res}`;
      } catch (err) {
        resultSpan.textContent = `失败: ${err}`;
      }
    });
  },

  unmount(container) {
    container.innerHTML = '';
  }
};