# Original User Request

## 2026-09-26T07:50:08Z

This is a single self-contained fix; keep it small and focused. 为 AtomLauncher 实现动态 Canvas 苦力怕漫步交互首页（基于 Pretext 文本排版），并打通底部导航栏（BottomNav）的多页面路由切换（首页、设置、工具页）。

Working directory: C:\Users\XuanY\.gemini\antigravity\worktrees\atom-launcher\discuss_homepage_requirements
Integrity mode: demo

## Requirements

### R1. 底部导航栏受控化与主视图路由打通
重构 `BottomNav.tsx` 为受控组件（接收当前选中的 Tab 状态与切换回调），在 `App.tsx` 中建立统一的页面状态管理（`home` | `settings` | `tools`）。保留原有的底部高亮滑块平滑移动动效。将原写死在主区域的 `PluginSlot`（WASM 插件测试模块）移至“工具”页展示，确保原有功能完好无损。

### R2. 苦力怕漫步交互式 Canvas 动态首页 (Pretext)
在首页实现一个纯代码驱动的动态交互式 Canvas 展台（`CreeperCanvas.tsx`）：
- **苦力怕行走动画**：绘制经典 8-bit 绿色像素苦力怕，具有四腿交替摆动运动、躯体微动和巡逻漫步逻辑，碰到左右边界自动掉头。
- **Pretext 动态文字排版**：利用项目中已安装的 `@chenglou/pretext` 在 Canvas 上高效排版 "ATOM LAUNCHER" 艺术标题与随机 Minecraft 标语/特性说明，与像素字体（`FusionPixelFont`）视觉高度融合。
- **交互趣味彩蛋**：支持鼠标交互（如光标悬停或靠近时苦力怕停步注视，点击苦力怕时产生受惊膨胀或像素粒子等趣味反馈）。
- **自适应与零破损**：Canvas 尺寸随父容器边框自适应，无多余滚动条，零外部网络图片依赖，冷启动秒开。

## Acceptance Criteria

### 导航与路由切换
- [ ] 点击底部导航栏“首页”、“设置”、“工具”能精准切换对应视图，滑块动画正常同步。
- [ ] 切换到“工具”页时，原有的 `PluginSlot` 正常加载并能运行 WASM 测试。
- [ ] 切换到“设置”页时，展示基础的像素风设置占位面板。

### 苦力怕 Canvas 展台
- [ ] 首页展示自适应 Canvas 区域，背景与边框与启动器当前像素主题（`grass-80`, `border-hard` 等）协调一致。
- [ ] 苦力怕像素造型准确，具有流畅自然的步态摆动与边界转向逻辑。
- [ ] 成功调用 `@chenglou/pretext` 进行文本计算与 Canvas 渲染，不触发任何控制台异常。
- [ ] 具备鼠标交互反馈（悬停注视或点击触发响应）。

### 构建与类型检查
- [ ] 执行 `npm run build`（TypeScript 编译 + Vite 构建）完全通过，零错误警告。

## 2026-09-26T09:40:41Z

This is a single self-contained fix; keep it small and focused. 重构 AtomLauncher 设置中心布局与视觉排版：联动右侧栏作为设置分类选项，支持流畅丝滑的展开拉伸与切换动画，中间主区域独占展示纯净表单，彻底移除所有 Emoji 图标与冗余大标题，全面提升文字清晰度与可读性。

Working directory: D:\tauri-apps\AtomLauncher\atom-launcher
Integrity mode: demo

## Requirements

### R1. 全局两栏联动与平滑拉伸切换动效
- 当点击底部导航切换到“设置”页时，界面具备**平滑自然的展开/拉伸过渡动效**（	ransition-all duration-300 ease-out 或 transform 动画）；
- 右侧栏（277px）通过平滑淡入与滑动动效，由“最近实例列表”无缝切换为**纯文本的设置分类列表**（Java 运行环境 / JVM 与游戏参数 / 下载源与网络 / 启动器偏好），高亮当前选中的分类；右下角展示纯文字 [ 保存配置 ] 按钮；
- 中间主内容区域 100% 展开用于展示当前分类的详细表单，彻底移除内部嵌套的左侧二级 Tab 栏，释放空间消除拥挤感。

### R2. 视觉纯净化与去噪（无奇怪图标、无花哨大标题）
- 彻底移除所有 Emoji 与装饰图标（如 ⚙️、☕、🧠、⚡、🛠️、💾 等），所有分类、按钮与标签使用纯粹的中文纯文本。
- 移除所有宣传式大标题（如“启动器设置中心”、“Minecraft 原生像素级内核...”），每项配置直接以清晰纯正的表单呈现。

### R3. 文字对比度与可读性深度优化
- 文字统一使用高对比度的深墨色（#1F1F1F / #2F1F17），杜绝灰褐色文字在米色底色上的浑浊模糊感。
- 正文与表单标签采用舒适清晰的字号（12px~14px），各分组之间保持充足呼吸感间距（gap-5 或 gap-6）。
- 输入框与滑块高度适配，输入操作自然流畅。

## Acceptance Criteria

### 动画与交互
- [ ] 切换到设置页时，主区域与右侧栏具备平滑连贯的过渡与拉伸动效，无生硬闪烁或布局跳变。
- [ ] 右侧栏精准呈现设置分类选项，点击切换分类时表单平滑响应。
- [ ] 中间主区域无内部嵌套二级 Tab，空间宽敞呼吸感良好。
- [ ] 点击右下角保存按钮可正常保存配置并生效。

### 视觉与可读性
- [ ] 界面内 100% 纯文本，不存在任何 Emoji 图标与花哨营销标语。
- [ ] 文字清晰锐利，对比度良好，无重叠或模糊排版。

### 构建与测试
- [ ] 执行 
pm test 自动化测试全绿通过。
- [ ] 执行 
pm run build（TypeScript 严格检查 + Vite 构建）零报错通过。