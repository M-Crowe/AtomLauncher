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
