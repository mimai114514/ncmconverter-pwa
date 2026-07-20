# NCM Converter PWA - 项目结构与功能总结

## 项目概述

本项目是一个网易云音乐 NCM 格式文件解密器，使用 React + Vite 开发，运行于支持现代 Web API 的浏览器。项目基于开源项目 [ncmpp](https://github.com/Majjcom/ncmpp) 的解密逻辑改写。

## 技术栈

| 技术 | 用途 |
|------|------|
| React + Vite | Web UI 与构建工具 |
| TypeScript | 类型安全的开发语言 |
| CryptoJS | AES-ECB 解密 |
| Web Worker | 后台执行音频解密 |
| Tailwind CSS | 界面样式 |
| vite-plugin-pwa | PWA 生成与缓存 |

## 项目结构

```text
ncmconverter-pwa/
├── src/
│   ├── App.tsx                   # 主界面与批量处理流程
│   ├── core/ncmDecrypt.ts        # NCM 解析与 AES/RC4 解密
│   ├── workers/
│   │   ├── ncm.worker.ts         # Web Worker 解密入口
│   │   └── worker-client.ts      # Worker 通信封装
│   ├── services/settings.ts      # 本地设置持久化
│   ├── index.css                 # 全局样式
│   └── main.tsx                  # React 应用入口
├── public/assets/                # PWA 图标资源
├── index.html                    # HTML 入口
├── package.json                  # npm 依赖与脚本
├── vite.config.ts                # Vite/PWA 配置
└── README.md                     # 项目说明
```

## 核心模块

### 解密核心（`src/core/ncmDecrypt.ts`）

实现 NCM 文件的完整解密流程：验证文件魔数、使用 AES-ECB 解密密钥和元数据、构建 RC4 变种 KeyBox，并读取音频数据。

### Web Worker（`src/workers/`）

在后台线程执行音频 XOR 解密，通过 Transferable Buffer 减少大文件复制开销。`App.tsx` 管理批量任务队列和并发数（1-16）。

### 设置服务（`src/services/settings.ts`）

使用浏览器 `localStorage` 保存并发线程数、自动保存和内存警告设置。

### 主界面（`src/App.tsx`）

支持拖拽或多选 `.ncm` 文件、实时显示进度和元数据、自动保存或批量手动下载，并提供明暗主题和设置面板。

## 应用特性

- 拖拽或批量选择 `.ncm` 文件
- 实时显示解密进度和成功/失败统计
- 可配置并行解密线程数
- 自动保存或批量手动下载
- PWA 离线缓存与明暗主题
