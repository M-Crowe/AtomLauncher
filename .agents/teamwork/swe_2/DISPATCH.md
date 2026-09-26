## 2026-09-26T09:42:31Z
You are the SWE Light Orchestrator (`swe_2`) for AtomLauncher.

## Your Identity & Workspace
- Identity: `swe_2`
- Working Directory: `D:\tauri-apps\AtomLauncher\atom-launcher\.agents\teamwork\swe_2`
- Project Root: `D:\tauri-apps\AtomLauncher\atom-launcher`
- Original Request File: `D:\tauri-apps\AtomLauncher\atom-launcher\.agents\teamwork\ORIGINAL_REQUEST.md` (Refer to the latest section `## 2026-09-26T09:40:41Z`)

## Task Specification
This is a single self-contained fix; keep it small and focused.
重构 AtomLauncher 设置中心布局与视觉排版：联动右侧栏作为设置分类选项，支持流畅丝滑的展开拉伸与切换动画，中间主区域独占展示纯净表单，彻底移除所有 Emoji 图标与冗余大标题，全面提升文字清晰度与可读性。

Working directory: D:\tauri-apps\AtomLauncher\atom-launcher
Integrity mode: demo

### Requirements
#### R1. 全局两栏联动与平滑拉伸切换动效
- 当点击底部导航切换到“设置”页时，界面具备平滑自然的展开/拉伸过渡动效（`transition-all duration-300 ease-out` 或 transform 动画）；
- 右侧栏（277px）通过平滑淡入与滑动动效，由“最近实例列表”无缝切换为纯文本的设置分类列表（Java 运行环境 / JVM 与游戏参数 / 下载源与网络 / 启动器偏好），高亮当前选中的分类；右下角展示纯文字 `[ 保存配置 ]` 按钮；
- 中间主内容区域 100% 展开用于展示当前分类的详细表单，彻底移除内部嵌套的左侧二级 Tab 栏，释放空间消除拥挤感。

#### R2. 视觉纯净化与去噪（无奇怪图标、无花哨大标题）
- 彻底移除所有 Emoji 与装饰图标（如 ⚙️、☕、🧠、⚡、🛠️、💾 等），所有分类、按钮与标签使用纯粹的中文纯文本。
- 移除所有宣传式大标题（如“启动器设置中心”、“Minecraft 原生像素级内核...”），每项配置直接以清晰纯正的表单呈现。

#### R3. 文字对比度与可读性深度优化
- 文字统一使用高对比度的深墨色（`#1F1F1F` / `#2F1F17`），杜绝灰褐色文字在米色底色上的浑浊模糊感。
- 正文与表单标签采用舒适清晰的字号（12px~14px），各分组之间保持充足呼吸感间距（`gap-5` 或 `gap-6`）。
- 输入框与滑块高度适配，输入操作自然流畅。

### Acceptance Criteria
#### 动画与交互
- [ ] 切换到设置页时，主区域与右侧栏具备平滑连贯的过渡与拉伸动效，无生硬闪烁或布局跳变。
- [ ] 右侧栏精准呈现设置分类选项，点击切换分类时表单平滑响应。
- [ ] 中间主区域无内部嵌套二级 Tab，空间宽敞呼吸感良好。
- [ ] 点击右下角保存按钮可正常保存配置并生效。

#### 视觉与可读性
- [ ] 界面内 100% 纯文本，不存在任何 Emoji 图标与花哨营销标语。
- [ ] 文字清晰锐利，对比度良好，无重叠或模糊排版。

#### 构建与测试
- [ ] 执行 `npm test` 自动化测试全绿通过。
- [ ] 执行 `npm run build`（TypeScript 严格检查 + Vite 构建）零报错通过。

## Execution Protocol
- Run the SWE Light workflow: dispatch one implementer for the change, then conduct reviewer rounds with tests verifying correctness.
- Keep `BRIEFING.md` and `progress.md` updated in your working directory.
- When complete, write `handoff.md` and report back to Sentinel via `send_message`.
