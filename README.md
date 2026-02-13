# NcmConverter PWA

简洁高效的网易云音乐 .ncm 格式文件在线转换工具。

本仓库是 [ncmconverter](https://github.com/mimai114514/ncmconverter) 的纯 Web PWA 分支，旨在提供无需安装、跨平台的 ncm 解密体验。

## 特性

- **纯 Web 体验**: 打开浏览器即可使用，支持 PWA 安装到桌面/移动端。
- **高性能解密**: 
  - 核心解密算法（AES/XOR）采用 **原生 JavaScript Web Worker** 实现。
  - 支持 **零拷贝 (Zero-Copy)** 数据传输，大文件（50MB+）处理也能保持 UI 丝般顺滑。
- **隐私安全**: 所有解密操作均在 **本地浏览器** 完成，文件**不会**上传到服务器。
- **现代界面**: 遵循 Material Design 3 设计规范，支持深色模式。

## 使用方法

1. 访问部署链接（待部署）。
2. 点击文件选择区域，选择一个或多个 `.ncm` 文件。
3. 点击“开始转换”。
4. 转换完成后，点击下载按钮保存解密后的 `.mp3`/`.flac` 文件。

## 技术栈

- **Flutter Web**: 构建高性能、统一的 UI。
- **Web Worker**: 处理 CPU 密集型任务，确保主线程不阻塞。
- **dart:js_interop**: 实现 Dart 与原生 JS Worker 的高效通信。
- **PointyCastle**: Dart 端的 AES 解密库辅助。

## 开发构建

确保已安装 Flutter SDK (推荐 3.22+)。

```bash
# 获取依赖
flutter pub get

# 运行开发服务器 (Chrome)
flutter run -d chrome

# 构建生产版本
flutter build web --release
```

## 许可证

MIT License. 详见 LICENSE 文件。

## 致谢

- 灵感来源: [ncmppGui](https://github.com/Majjcom/ncmppGui) / [ncmpp](https://github.com/Majjcom/ncmpp)
- 原始项目: [ncmconverter](https://github.com/mimai114514/ncmconverter)
