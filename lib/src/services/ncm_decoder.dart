/// NCM 解密器服务
/// 提供高层封装，支持后台解密
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import '../core/ncm_dump.dart';

/// 解密结果
class DecodeResult {
  final bool success;
  final Uint8List? data;
  final String? outputName;
  final String? errorMessage;
  final String originalName;

  DecodeResult({
    required this.success,
    this.data,
    this.outputName,
    this.errorMessage,
    required this.originalName,
  });
}

/// NCM 解密器
class NcmDecoder {
  static final NcmDecoder _instance = NcmDecoder._();
  static NcmDecoder get instance => _instance;

  NcmDecoder._();

  /// 解密单个文件（在后台 Isolate 执行，Web 端在主线程执行）
  Future<DecodeResult> decodeBytes(Uint8List bytes, String fileName) async {
    try {
      if (kIsWeb) {
        // Web 端直接在主线程执行（配合 Web Worker 防止卡顿）
        return await _decodeInIsolate(_DecodeParams(bytes, fileName));
      } else {
        // Native 端在后台线程执行
        final result = await compute(
          _decodeInIsolate,
          _DecodeParams(bytes, fileName),
        );
        return result;
      }
    } catch (e) {
      return DecodeResult(
        success: false,
        errorMessage: e.toString(),
        originalName: fileName,
      );
    }
  }

  /// 获取版本
  String getVersion() => '1.2.0 (Web)';
}

class _DecodeParams {
  final Uint8List bytes;
  final String fileName;

  _DecodeParams(this.bytes, this.fileName);
}

/// Isolate 中执行的解密函数
Future<DecodeResult> _decodeInIsolate(_DecodeParams params) async {
  final ncmDump = NcmDump();
  final (success, data, outputName, error) = await ncmDump.decodeBytes(
    params.bytes,
    params.fileName,
  );

  return DecodeResult(
    success: success,
    data: data,
    outputName: outputName,
    errorMessage: error,
    originalName: params.fileName,
  );
}
