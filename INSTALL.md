# 安装与构建说明

本文档说明如何在本地运行和打包 `gesture-app` 的 Tauri 桌面应用，以及如何通过 GitHub Actions 构建 macOS 安装包。

## 1. 环境要求

### Windows 本地开发 / 打包
- Node.js 18+
- npm
- Rust（建议 stable）
- Visual Studio C++ Build Tools
- WebView2（一般 Windows 10/11 已内置）

### macOS 打包
本项目当前在 Windows 下开发，macOS 安装包通过 GitHub Actions 构建。

---

## 2. 安装依赖

在项目根目录执行：

```bash
npm ci
```

如果本机尚未安装 Rust，请先安装：

```bash
rustup toolchain install stable
```

---

## 3. 本地开发运行（Windows）

启动 Tauri 桌面开发环境：

```bash
npm run tauri:dev
```

说明：
- 该命令会先启动 Vite 开发服务器
- 然后启动 Tauri 桌面窗口
- 默认使用 `3000` 端口

如果启动时报 `Port 3000 is already in use`，需要先释放该端口后再重试。

---

## 4. 本地构建 Windows 安装包

执行：

```bash
npm run tauri:build
```

构建完成后，可在以下目录找到安装包：

- MSI 安装包：

```text
src-tauri/target/release/bundle/msi/gesture-app_0.1.0_x64_en-US.msi
```

- EXE 安装包：

```text
src-tauri/target/release/bundle/nsis/gesture-app_0.1.0_x64-setup.exe
```

### Windows 安装方式

#### 方式 1：安装 MSI 包
1. 双击打开：

```text
gesture-app_0.1.0_x64_en-US.msi
```

2. 按安装向导点击 **Next** / **Install**
3. 安装完成后，点击 **Finish**
4. 可从开始菜单或桌面快捷方式启动应用

#### 方式 2：安装 EXE 包
1. 双击打开：

```text
gesture-app_0.1.0_x64-setup.exe
```

2. 按安装向导完成安装
3. 安装完成后启动应用

说明：
- 一般优先使用 `MSI` 包
- `EXE` 包可作为备用安装方式
- 如果 Windows 弹出安全提示，请确认安装包来源后选择继续

---

## 5. 通过 GitHub Actions 构建 macOS 安装包

项目已配置工作流：

```text
.github/workflows/tauri-macos.yml
```

### 触发方式
可通过以下方式触发：
- 向 `main` 分支推送
- 向 `feature/offline` 分支推送
- 创建 Pull Request
- 在 GitHub Actions 页面手动执行 `workflow_dispatch`

### 查看构建结果
1. 打开仓库 GitHub 页面
2. 进入 **Actions**
3. 选择工作流 **Build macOS Tauri app**
4. 打开某次运行记录
5. 在页面底部 **Artifacts** 下载：

```text
tauri-macos-bundles
```

### macOS 构建结果如何安装到 Mac

从 GitHub Actions 下载 `tauri-macos-bundles` 后，通常会得到 `dmg` 和 `macos` 两类产物。

#### 方式 1：安装 `.dmg`（推荐）
1. 在 Mac 上双击打开 `.dmg` 文件
2. 在弹出的安装窗口中，将 `gesture-app.app` 拖到 **Applications** 文件夹
3. 打开 **Applications**，找到 `gesture-app` 并启动

如果第一次打开被 macOS 拦截：
1. 打开 **系统设置** → **隐私与安全性**
2. 在安全提示区域找到被拦截的 `gesture-app`
3. 点击 **仍要打开**
4. 再次确认启动

#### 方式 2：直接使用 `.app`
如果下载结果里直接包含 `.app`：
1. 将 `gesture-app.app` 拷贝到 **Applications** 文件夹
2. 在 **Applications** 中双击打开
3. 若被系统拦截，同样到 **隐私与安全性** 中选择 **仍要打开**

说明：
- 当前 macOS 构建使用的是 ad-hoc 签名，不是 Apple 正式签名
- 因此首次安装时出现安全提示是正常现象
- 该包适合自用测试，不适合直接面向公众分发

---

## 6. 签名说明

当前 macOS 包用途为**自用测试**，未接入 Apple 正式签名与公证流程。

当前配置使用 ad-hoc：

```text
signingIdentity: "-"
```

这适合内部测试、自行分发或功能验证，不适合公开发布到 Apple 生态渠道。

---

## 7. 常见问题

### 1）`Port 3000 is already in use`
表示本地已有进程占用了 Vite/Tauri 开发端口。

处理方式：
- 关闭已有本地开发服务
- 或结束占用 3000 端口的进程
- 然后重新执行：

```bash
npm run tauri:dev
```

### 2）GitHub Actions 没触发
请检查：
- 工作流文件是否已推送到远程仓库
- 当前推送分支是否为 `main` 或 `feature/offline`
- 是否在仓库的 Actions 设置中禁用了工作流

### 3）macOS 包下载后在哪看
在 GitHub Actions 某次运行详情页底部的 **Artifacts** 中下载。

---

## 8. 推荐命令汇总

安装依赖：

```bash
npm ci
```

本地开发：

```bash
npm run tauri:dev
```

本地构建 Windows 安装包：

```bash
npm run tauri:build
```
