# NCM Converter PWA

简洁高效的网易云音乐 `.ncm` 格式文件离线转换工具。

本仓库是 [ncmconverter](https://github.com/mimai114514/ncmconverter) 的纯 Web PWA 分支，提供无需安装、跨平台的 `.ncm` 解密体验。

## 特性

- **纯 Web 体验**：打开浏览器即可使用，支持 PWA 安装到桌面或移动设备。
- **高性能解密**：AES/XOR 核心逻辑配合原生 JavaScript Web Worker 执行，避免阻塞界面。
- **隐私安全**：所有解密操作均在本地浏览器完成，文件不会上传到服务器。
- **现代界面**：React + Vite + Tailwind CSS，支持明暗主题。

## 使用方法

1. 打开部署后的网页。
2. 点击文件选择区域，选择一个或多个 `.ncm` 文件。
3. 点击“开始解密”。
4. 转换完成后下载生成的 `.mp3` 或 `.flac` 文件。

## 开发构建

确保已安装 Node.js 20 或更高版本。

```bash
# 安装依赖
npm ci

# 运行开发服务器
npm run dev

# 执行静态检查
npm run lint

# 构建生产版本
npm run build
```

## 技术栈

- React、TypeScript、Vite
- Tailwind CSS
- CryptoJS（AES-ECB）
- 原生 Web Worker（音频 XOR 解密）
- vite-plugin-pwa

## 许可证

MIT License，详见 [LICENSE](LICENSE)。

## 致谢

- 解密逻辑参考 [ncmppGui](https://github.com/Majjcom/ncmppGui) / [ncmpp](https://github.com/Majjcom/ncmpp)
- 原始项目：[ncmconverter](https://github.com/mimai114514/ncmconverter)
