import 'dart:typed_data';

/// NCM 文件模型

class NcmFile {
  final String name;
  final Uint8List bytes;
  NcmFileStatus status;
  String? errorMessage;
  Uint8List? outputBytes;
  String? outputName;

  NcmFile({
    required this.name,
    required this.bytes,
    this.status = NcmFileStatus.pending,
    this.errorMessage,
    this.outputBytes,
    this.outputName,
  });
}

/// NCM 文件状态
enum NcmFileStatus {
  pending, // 等待处理
  processing, // 正在处理
  success, // 处理成功
  failed, // 处理失败
}
