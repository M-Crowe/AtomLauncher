# Adversarial Reviewer Handoff Report: AtomLauncher 设置中心布局与视觉排版重构 (Round 3)

> [!WARNING] **Skepticism Disclaimer**
> 经过第三轮深度对抗性审查与压力测试，全量 45 个自动化测试套件及 TypeScript 严格编译生产构建（`tsc && vite build`）均已 100% 零报错通过；本轮成功揪出并彻底修复：下载源卡片缺失语义化按钮导致键盘不可达、Java 运行时存在死 onChange 空函数、存储层反序列化倒挂内存（`minMemory > allocatedMemory`）与非法枚举校验缺失、无 DOM 环境下 `document` 引用崩溃风险、通知浮窗 `.animate-bounce` 逃逸 `prefers-reduced-motion` 动效降级，以及分类状态机非法字符串越界等 6 项深层交互与健壮性缺陷。

---

## 1. What the prior attempt got wrong

### Issue 1: 下载源卡片缺乏语义化 interactive role，导致键盘 Tab 完全跳过无法交互
- **Input**: 键盘或屏幕阅读器用户在“下载源与网络加速”面板中通过 `Tab` 键向后导航。
- **Expected**: 用户能够通过 `Tab` 键聚焦各个下载源（BMCLAPI、Mojang、MCBBS），并通过 `Enter` 或 `Space` 选中生效。
- **Actual**: 卡片由纯 `<div>` 结合 `onClick` 构建，缺失 `tabIndex`、语义化 role 与键盘事件监听。键盘焦点直接跳过该区域，无障碍用户完全无法查看与切换镜像源。
- **Root Cause**: 误用非语义化 `div` 承载点击交互，违背了 WAI-ARIA 与 Web 语义交互规范（同文件第四分类的 afterLaunch 按钮却正确使用了 `<button>`）。
- **Fix**: 将下载源容器替换为 `<button type="button" ... text-left>`，保留完备视觉排版的同时赋予其原生键盘 Tab 聚焦与回车/空格激活能力。

### Issue 2: Java 运行时单选输入包含死 `onChange` 空函数，父级 `div` 拦截导致无障碍交互受阻
- **Input**: 键盘用户导航至系统 Java 运行时单选框按空格键切换，或屏幕阅读器辅助勾选。
- **Expected**: 对应的 Java 运行时单选框被勾选并驱动状态更新。
- **Actual**: 单选输入配置了 `onChange={() => {}}`（仅为抑制 React 警告的空操作），勾选逻辑挂载在父级 `div` 的 `onClick` 上，键盘单选操作无法触发父级点击事件。
- **Root Cause**: 缺乏语义化 `<label>` 绑定，单选框本身无实际事件处理函数。
- **Fix**: 将卡片容器重构为 `<label>`，并将状态更新函数 `selectJava` 直接绑定在 `<input type="radio" onChange={selectJava} />` 上，确保键盘与鼠标交互双向顺畅。

### Issue 3: 存储层加载反序列化未校验倒挂内存与非法字符串枚举
- **Input**: 用户 `localStorage` 损坏或被外部写入倒挂内存 `{ allocatedMemory: 2048, minMemory: 8192 }` 或非法源 `{ downloadSource: 'malicious_node', afterLaunch: 'kill' }`。
- **Expected**: `loadLauncherSettings` 进行防御式边界裁剪（`minMemory <= allocatedMemory`），非预设枚举回退至默认常量。
- **Actual**: 前序实现仅在 `saveLauncherSettings` 中进行了部分数值约束，`loadLauncherSettings` 直接执行 `{ ...DEFAULT_SETTINGS, ...parsed }`，倒挂内存入库可直接导致 JVM 参数拼接出 `-Xms8192M -Xmx2048M` 导致游戏启动即崩溃；非法源导致界面单选全部处于未激活失活状态。
- **Root Cause**: 存储反序列化防线存在不对称漏洞。
- **Fix**: 在 `loadLauncherSettings` 与 `saveLauncherSettings` 中均加入 `VALID_DOWNLOAD_SOURCES`、`VALID_AFTER_LAUNCH` 枚举校验，并强制执行 `minMemory = Math.min(parsed.minMemory, allocatedMemory)`。

### Issue 4: `SettingsSidebar` 的 `handleTabKeyDown` 缺失 `typeof document !== 'undefined'` 守卫
- **Input**: 在 Node.js、JSDOM 单元测试或 SSR 运行时直接调用键盘导航事件处理。
- **Expected**: 状态机安全转移，不抛出环境未定义错误。
- **Actual**: 代码硬编码调用 `document.getElementById(...).focus()`，在无 DOM 全局变量环境下触发 `ReferenceError: document is not defined`。
- **Root Cause**: 缺少环境防御检查。
- **Fix**: 为所有 `document.getElementById` 调用添加 `if (typeof document !== 'undefined')` 防御守卫。

### Issue 5: 保存提示浮层 `.animate-bounce` 逃逸 `prefers-reduced-motion` 无障碍降级
- **Input**: 系统开启“减少动态效果（Reduce motion）”的前庭神经敏感用户点击保存配置。
- **Expected**: 界面所有关键帧动效即时呈现，禁止任何持续循环跳跃动画。
- **Actual**: 浮动提示通知挂载了 Tailwind 原生 `.animate-bounce`，在 `@media (prefers-reduced-motion: reduce)` 中未被重写，在屏幕右上角持续跳跃 2.8 秒。
- **Root Cause**: `src/App.css` 的媒体查询仅覆盖了 `.animate-view-expand` 与 `.animate-tabpanel-in`，漏掉了 `.animate-bounce`。
- **Fix**: 在 `src/App.css` 的 `@media (prefers-reduced-motion: reduce)` 中将 `.animate-bounce` 纳入降级规则（`animation-duration: 0.01ms !important`）。

### Issue 6: 分类状态机 `setActiveCategory` 缺失非法输入防线
- **Input**: 异常代码或外部消息向 `setActiveCategory` 传入非法标识（如 `setActiveCategory('unknown')`）。
- **Expected**: 状态机忽略非法分类，保护当前处于合法分类视图。
- **Actual**: `globalActiveCategory` 被篡改为非法字符串，导致 `SettingsView` 中的所有分类 Panel 均不匹配，主表单区域呈现完全空白。
- **Root Cause**: 缺乏分类白名单合法性校验。
- **Fix**: 引入 `VALID_CATEGORIES: ReadonlySet<SettingsCategory>`，非法输入直接拦截返回。

---

## 2. What I changed

1. **`src/components/SettingsView.tsx`**:
   - `SettingsSidebar`: 在 `handleTabKeyDown` 中增加 `typeof document !== 'undefined'` 环境安全检查。
   - `SettingsView` Java 分类面板: 将 Java 运行时选项由 `<div>` 重构为语义化 `<label>`，将 `<input type="radio">` 上的死 `onChange={() => {}}` 替换为响应式 `onChange={selectJava}`。
   - `SettingsView` 下载源面板: 将下载源卡片由 `<div>` 重构为语义化 `<button type="button" ... text-left>`，全面支持键盘 Tab 聚焦与 Enter/Space 快捷选择。
2. **`src/utils/settingsStorage.ts`**:
   - 补齐 `DownloadSource` 与 `AfterLaunchBehavior` 类型导入。
   - 在 `loadLauncherSettings` 与 `saveLauncherSettings` 中引入 `VALID_DOWNLOAD_SOURCES` 与 `VALID_AFTER_LAUNCH` 枚举校验。
   - 彻底解决 `minMemory > allocatedMemory` 倒挂内存问题，强制裁剪确保 `minMemory <= allocatedMemory`。
3. **`src/utils/settingsCategory.ts`**:
   - 引入 `VALID_CATEGORIES` 白名单校验，防御非法字符串污染分类状态机。
   - 监听器触发增加 `try...catch` 异常隔离，防止个别回调异常阻断后续监听器执行。
4. **`src/App.css`**:
   - 将 `.animate-bounce` 补充加入 `@media (prefers-reduced-motion: reduce)` 规则，消除前庭神经敏感用户的跳动刺激。
5. **`tests/settings_layout_refactor.test.mjs`**:
   - 新增 5 组端到端对抗性自动化测试（总测试用例达到 45 个），涵盖下载源与 Java 单选的语义化键盘无障碍、倒挂内存与非法枚举深度清洗、Reduced Motion 浮层动效降级、分类状态机合法性拦截，以及恢复默认配置的 confirm 取消与确认分支覆盖。

---

## 3. Verification Record

- **Deep Verification (ran actual tests):**
  - 执行 `npm test`：
    - 运行全量 45 个自动化测试套件，**45 passed, 0 failed, 0 skipped**（耗时 ~840ms）。
  - 执行 `npm run build`：
    - 执行 `tsc && vite build`，TypeScript 严格检查与 Vite 生产构建**零报错通过**（43 modules transformed, built in ~3.17s）。
- **Shallow Verification (manual only):**
  - 正则扫描：全量扫描 `SettingsView.tsx` 中除数学符号 `×` 外的所有特殊字符，无任何 Emoji、花哨装饰图标或遗留灰褐色样式。
  - 检查代码交互：所有 interactive cards 均符合 W3C Web 无障碍与语义化标签规范。
- **Unverified aspects:**
  - 未在真机真实原生 Tauri Webview 窗口（Rust 编译桌面产物）下进行长时间连续 1000 次标签切换的 GPU 显存监控。

---

## 4. Known Issues
- `Minor Robustness Risk` — 在某些非标准或极端陈旧的浏览器内核中（不支持 HTML5 `inert` 属性的环境），非活动侧边栏仍依赖 `pointer-events-none` 与 `opacity-0` 视觉隐藏；在现代主流浏览器及 Tauri 2.0 Webview（基于现代 Chromium/Edge/WebKit）中均完全原生支持 `inert`。

---

## 5. Remaining risk & next step
- **Next step**: 本轮审查中发现并攻克的 6 项深层交互可访问性、WAI-ARIA 语义、存储倒挂内存防御、SSR/无 DOM 健壮性与动效无障碍缺陷已全部就地修复，测试套件已增补并全绿（45/45 passed），生产构建零报错通过。本任务重构目标已 100% 达成，建议批准合并。
