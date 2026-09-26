# Adversarial Reviewer Handoff Report: AtomLauncher 设置中心布局与视觉排版重构 (Round 2)

> [!WARNING] **Skepticism Disclaimer**
> 经过第二轮深度对抗性审查与压力测试，全量 40 个自动化测试套件及 TypeScript 严格编译生产构建（`tsc && vite build`）均已 100% 零报错通过；已成功揪出并修复：异步 Java 扫描卸载内存泄漏、隐藏侧边栏 Tab 键焦点捕获与 ARIA 穿透、TabList 缺失垂直语义与横向方向键、保存零像素非法分辨率、存储层负数超界数据防御缺失、Reduced Motion 动效降级缺失及分类状态模块化解耦等 7 项实质缺陷。

---

## 1. What the prior attempt got wrong

### Issue 1: 异步 Java 扫描未做组件卸载守卫导致内存泄漏与状态更新告警
- **Input**: 用户点击“重新扫描环境”（`handleScanJava`）执行 600ms 异步 JDK 探测，在探测完成前（如 t=200ms）点击底部导航切换到“首页”或其他页面。
- **Expected**: `SettingsView` 卸载后应取消/忽略后续异步回调，不触发已卸载组件的 `setState` 与长期挂起的定时器。
- **Actual**: `scanSystemJavaRuntimes` 在组件卸载后如期 resolve，继续依次调用 `setRuntimes`、`setScanMessage`、`showToast`、`setIsScanning`，并在 `finally` 中设置了 4000ms 的全局 setTimeout，触发 React unmounted state update 内存泄漏与控制台警告。
- **Root Cause**: `handleScanJava` 缺乏 `isMountedRef` 挂载生命周期守卫；卸载 cleanup 仅清除了卸载前已存在的定时器，无法清理异步 promise resolve 后新建的定时器。
- **Fix**: 引入 `isMountedRef`（在 mount 时置 `true`，unmount 时置 `false`），并在 `handleScanJava`、`showToast` 和 `handleTestPing` 的所有异步和延时回调中增加 `if (!isMountedRef.current) return;` 守卫。

### Issue 2: 侧边栏面板切换时隐藏区域依然被 Tab 键捕获且 ARIA 未隔离
- **Input**: 用户位于“首页”或“工具”页面，使用键盘 `Tab` 键向后导航，或使用屏幕阅读器浏览页面结构。
- **Expected**: 不可见的“设置分类侧边栏”及其内部的 4 个分类 Tab、`[ 保存配置 ]` 与 `恢复默认` 按钮不应出现在焦点序列中，不被辅助工具感知。
- **Actual**: CSS 的 `opacity-0 pointer-events-none` 仅能阻止鼠标点击，无法移除键盘 Tab 键焦点索引与无障碍辅助树，键盘用户可在不可见面板上 Tab 聚焦并意外按回车触发；反之在“设置”页，“最近实例列表”的 4 个实例项同样存在焦点泄漏。
- **Root Cause**: 未利用现代 HTML5/React 19 的 `inert` 属性及 `aria-hidden` 属性对条件失活面板进行焦点与辅助树隔离。
- **Fix**: 在 `App.tsx` 中为最近实例容器添加 `aria-hidden={currentTab === "settings"}` 与 `inert={currentTab === "settings" ? true : undefined}`，为设置分类容器添加 `aria-hidden={currentTab !== "settings"}` 与 `inert={currentTab !== "settings" ? true : undefined}`。

### Issue 3: 侧边栏缺少 `aria-orientation="vertical"` 与横向方向键导航支持
- **Input**: 辅助设备访问设置侧边栏 `role="tablist"`，或用户使用 `ArrowRight` / `ArrowLeft` 方向键切换 Tab。
- **Expected**: 根据 WAI-ARIA 规范，垂直排列的 TabList 必须显式声明 `aria-orientation="vertical"`，且键盘交互应同时支持双向方向键（Down/Right 下一个，Up/Left 上一个）。
- **Actual**: TabList 未声明 `aria-orientation="vertical"`（导致辅助设备默认按水平 Tab 处理），且 `handleTabKeyDown` 仅处理了 `ArrowDown`/`ArrowUp`，忽略了 `ArrowRight`/`ArrowLeft`。
- **Root Cause**: WAI-ARIA 规范与键盘导航健壮性实现不完整。
- **Fix**: 为 `role="tablist"` 补充 `aria-orientation="vertical"`；在 `handleTabKeyDown` 中将 `ArrowDown` 扩展为 `ArrowDown || ArrowRight`，`ArrowUp` 扩展为 `ArrowUp || ArrowLeft`。

### Issue 4: 清空分辨率输入框直接点击保存导致 0 像素非法尺寸入库
- **Input**: 用户将 `windowWidth` 或 `windowHeight` 清空（值为 0 或 NaN），未触发 blur 事件而是直接点击右侧栏 `[ 保存配置 ]`。
- **Expected**: 保存逻辑对数值边界进行防御清洗，防止 0x0 等损坏的分辨率被持久化。
- **Actual**: `globalSaveHandler` 直接将当前 state 写入 `saveLauncherSettings`，导致 `{ windowWidth: 0, windowHeight: 0 }` 被持久化保存，下次启动时窗口损坏。
- **Root Cause**: `globalSaveHandler` 缺失输入值边界校验与自动兜底清洗。
- **Fix**: 在 `globalSaveHandler` 保存前对 `windowWidth`（最低 320，默认 854）、`windowHeight`（最低 240，默认 480）、`allocatedMemory`（最低 1024）与 `minMemory`（确保 `<= allocatedMemory`）进行清洗再写入 storage。

### Issue 5: `loadLauncherSettings` 与 `saveLauncherSettings` 缺乏负数/超界数据防御
- **Input**: `localStorage` 中被外部写入或损坏为 `{ windowWidth: -1920, windowHeight: 0, allocatedMemory: 128, downloadThreads: -8 }`。
- **Expected**: 存储加载与保存函数能自动清洗非法负数与超界数值，回退到安全默认区间。
- **Actual**: `loadLauncherSettings` 直接执行 `{ ...DEFAULT_SETTINGS, ...parsed }`，全盘接受负数和 0，直接传入 UI 造成滑块和输入框异常。
- **Root Cause**: 存储层仅做了 `autoClose` 字段的兼容性映射，未对数值型关键字段进行上下限校验。
- **Fix**: 在 `loadLauncherSettings` 与 `saveLauncherSettings` 中显式约束 `windowWidth >= 320`、`windowHeight >= 240`、`allocatedMemory >= 1024`、`downloadThreads` 在 2~64 线程区间。

### Issue 6: 缺失 `prefers-reduced-motion` 动效无障碍偏好降级
- **Input**: 系统开启“减少动态效果（Reduce motion）”无障碍设置的用户进入设置界面。
- **Expected**: 入场关键帧动画（`.animate-view-expand` 与 `.animate-tabpanel-in`）即时完成，避免引发前庭神经不适。
- **Actual**: 无论用户 OS 设置如何，始终强制执行 0.3s 的缩放与位移动画。
- **Root Cause**: `src/App.css` 缺少 `@media (prefers-reduced-motion: reduce)` 规则。
- **Fix**: 在 `src/App.css` 底部添加 `@media (prefers-reduced-motion: reduce)`，将相关动画耗时覆盖为 `0.01ms !important`。

### Issue 7: 分类状态逻辑与 JSX 组件紧密耦合，无法独立进行无头单元测试
- **Input**: Node 测试环境直接导入分类状态管理函数以进行订阅生命周期与切换测试。
- **Expected**: 能够独立进行状态读写、重置与监听器触发测试。
- **Actual**: 分类状态内嵌在 `SettingsView.tsx` 中，Node 原生 ESM 无法直接加载未编译 JSX 文件，抛出 `ERR_UNKNOWN_FILE_EXTENSION`。
- **Root Cause**: 状态钩子与 UI 视图耦合在单一 `.tsx` 文件中。
- **Fix**: 抽离 `src/utils/settingsCategory.ts`（包含 `getActiveCategory`、`setActiveCategory`、`resetActiveCategory`、`useSettingsCategory`），在 `SettingsView.tsx` 中透明 re-export，既保证原有调用代码完全兼容，又让测试套件可直接进行 ESM 单元测试。

---

## 2. What I changed

1. **`src/utils/settingsCategory.ts`** (新建):
   - 提取分类状态管理核心逻辑，实现分类切换、事件订阅与 `resetActiveCategory` 重置接口。
2. **`src/components/SettingsView.tsx`**:
   - Re-export `settingsCategory.ts` 的全部类型与方法，保留 `SETTINGS_CATEGORIES` 纯中文分类定义与描述。
   - `SettingsSidebar`: 在 `role="tablist"` 添加 `aria-orientation="vertical"`；`handleTabKeyDown` 增加 `ArrowRight`/`ArrowLeft` 响应。
   - `SettingsView`: 引入 `isMountedRef` 追踪挂载周期，彻底消除 `handleScanJava`、`showToast` 和 `handleTestPing` 的卸载状态更新与定时器泄漏。
   - `globalSaveHandler`: 增加输入数据清洗，防止空值/0 值分辨率被持久化。
3. **`src/utils/settingsStorage.ts`**:
   - `loadLauncherSettings` 与 `saveLauncherSettings` 增加分辨率（>= 320x240）、内存分配（>= 1024MB）与并发线程数（2~64）的上下限防御校验。
4. **`src/App.tsx`**:
   - 在最近实例列表与设置分类侧边栏的容器上分别动态添加 `inert` 与 `aria-hidden`，彻底阻断失活状态下的键盘 Tab 焦点泄漏与屏幕阅读器误读。
5. **`src/App.css`**:
   - 补充 `@media (prefers-reduced-motion: reduce)` 无障碍媒体查询，确保对动画敏感的用户获得即时静态呈现。
6. **`tests/settings_layout_refactor.test.mjs`**:
   - 新增 6 组端到端对抗性单元与集成测试（总测试用例增至 40 个），全覆盖 `inert`/`aria-hidden` 焦点隔离、垂直 TabList 键盘双向键位、`prefers-reduced-motion` 规则、损坏数据存储边界清洗、分类响应式订阅生命周期与 `isMountedRef` 卸载保护。

---

## 3. Verification Record

- **Deep Verification (ran actual tests):**
  - 执行 `npm test`：
    - 运行全部 40 个自动化测试（覆盖 R1 动效与布局、R2 纯文本无 Emoji 视觉净化、R3 对比度与表单参数、无障碍 contracts、防穿透与健壮性边界），**40 passed, 0 failed, 0 skipped**（耗时 ~791ms）。
  - 执行 `npm run build`：
    - 执行 `tsc && vite build`，TypeScript 严格检查与 Vite 生产构建**零报错通过**（43 modules transformed, built in ~3.66s）。
- **Shallow Verification (manual only):**
  - 正则扫描：全量扫描 `SettingsView.tsx` 中 Emoji 与 `#573D26` 灰褐色文字，命中数均为 0。
  - 检查 DOM 属性：验证两个侧边栏容器在 `currentTab === "settings"` 切换时 `inert` 与 `aria-hidden` 状态正确反转。
- **Unverified aspects:**
  - 未在真机真实原生 Tauri Webview 窗口（Rust 编译桌面产物）下进行长时间连续 1000 次标签切换的 GPU 显存监控。

---

## 4. Known Issues
- `Minor Robustness Risk` — 在某些非标准或极端陈旧的浏览器内核中（不支持 HTML5 `inert` 属性的环境），非活动侧边栏仍依赖 `pointer-events-none` 与 `opacity-0` 视觉隐藏；在现代主流浏览器及 Tauri 2.0 Webview（基于现代 Chromium/Edge/WebKit）中均完全原生支持 `inert`。

---

## 5. Remaining risk & next step
- **Next step**: 本轮审查中发现并攻克的 7 项深度安全、交互防穿透、WAI-ARIA 与无障碍缺陷已全部就地修复，测试套件已增补并全绿（40/40 passed），生产构建零报错通过。本任务重构目标已 100% 达成，建议批准合并。
