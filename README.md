# AtomLauncher ⚛️

一款基于 **Tauri v2 + Rust + React / TypeScript** 构建的现代化复古像素风 Minecraft 启动器。

---

## 🌟 特性概览

- 🎮 **现代复古像素美学**：温暖复古暗黑主题，嵌入 [Fusion Pixel (缝合像素字体)](src/assets/fonts/)，支持动态苦力怕背景与视线跟随。
- ⚡ **高性能原生 Rust 后端**：
  - 极速跨平台 Java 环境探测与版本自动适配；
  - 纯 Rust 启动核心与依赖解析，支持 Forge / ModLauncher `--add-opens` 参数补全与进程生命周期状态机；
  - 实时日志查看器与过滤高亮流。
- 📦 **多源高速下载引擎**：
  - 智能支持 Mojang 官方源、BMCLAPI 以及 MCBBS 国内镜像源自动切换；
  - Steam 风格常驻底栏与下载工作台，支持 3,000+ 文件虚拟滚动零卡顿列表。
- 🔐 **微软与离线认证中心**：
  - 原生支持微软 OAuth2 设备代码流（Device Code Flow）与 Xbox Live / XSTS 鉴权链；
  - 支持快捷创建与切换离线账户。
- 🧩 **独立插件系统 (Plugin Sandbox)**：
  - 基于 WASM 运行时（Wasmtime）与动态插槽，支持第三方扩展开发。

---

## 🛠️ 技术栈

- **前端**：React 19, TypeScript, Tailwind CSS, Vite, Pretext
- **后端**：Tauri v2, Rust
- **插件运行时**：Wasmtime (WebAssembly)

---

## 🧪 自动化测试

项目内置分层测试套件（90 项前端契约测试 + 25 项 Rust 独立集成测试）：

```bash
# 运行前端测试
npm run test:frontend

# 运行 Rust 集成测试
npm run test:rust

# 运行全量测试
npm test
```

---

## 📄 开源许可证 (License)

本项目采用 **[Mozilla Public License 2.0 (MPL-2.0)](LICENSE)** 开源许可证。

- **核心保护**：任何对本项目现有源码文件的修改与衍生，必须在 MPL-2.0 下开源。
- **插件自由**：第三方开发者基于 AtomLauncher 插件接口独立开发的 WASM 插件或扩展组件属于独立模块（Larger Work），**插件作者享有 100% 独立的版权与许可选择权（可选择开源、闭源或任何授权条款）**。

---

## ⚠️ 免责声明 (Disclaimer)

**NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**  
本项目并非 Minecraft 官方产品，未获 Mojang 或 Microsoft 批准，亦与其无关。
