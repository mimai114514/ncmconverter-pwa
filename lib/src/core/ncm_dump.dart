/// NCM 文件解密器 - 纯 Dart 实现
/// 无需原生依赖，使用 pointycastle 进行 AES 解密
library;

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:pointycastle/pointycastle.dart';
import '../services/web_worker_service.dart';

/// NCM 解密核心类
class NcmDump {
  // 加密密钥（十六进制）
  static const String _coreKeyHex = '687A4852416D736F356B496E62617857';
  static const String _metaKeyHex = '2331346C6A6B5F215C5D2630553C2728';

  // NCM 文件魔数
  static final Uint8List _ncmMagic = Uint8List.fromList([
    0x43, 0x54, 0x45, 0x4E, 0x46, 0x44, 0x41, 0x4D, // CTENFDAM
  ]);

  late Uint8List _coreKey;
  late Uint8List _metaKey;

  NcmDump() {
    _coreKey = _hexToBytes(_coreKeyHex);
    _metaKey = _hexToBytes(_metaKeyHex);
  }

  /// 解密 NCM 数据
  /// 返回 (成功, 解密后的当字节数组, 原始文件名(含扩展名), 错误信息)
  Future<(bool, Uint8List?, String?, String?)> decodeBytes(
    Uint8List inputBytes,
    String originalName,
  ) async {
    try {
      final reader = _ByteReader(inputBytes);

      // 验证魔数
      if (reader.remaining < 8) {
        return (false, null, null, '文件太小');
      }
      final magic = reader.read(8);
      if (!_listEquals(magic, _ncmMagic)) {
        return (false, null, null, '无效的 NCM 文件格式');
      }

      // 跳过 2 字节
      reader.skip(2);

      // 读取并解密密钥
      final keyLength = reader.readLittleEndianUint32();
      final keyData = reader.read(keyLength);

      // XOR 0x64
      for (var i = 0; i < keyData.length; i++) {
        keyData[i] ^= 0x64;
      }

      // AES-ECB 解密
      final decryptedKey = _aesEcbDecrypt(keyData, _coreKey);
      final unpaddedKey = _pkcs7Unpad(decryptedKey);

      // 跳过 "neteasecloudmusic" 前缀 (17 bytes)
      final keyBox = _buildKeyBox(unpaddedKey.sublist(17));

      // 读取元数据
      final metaLength = reader.readLittleEndianUint32();
      final metaData = reader.read(metaLength);

      // XOR 0x63
      for (var i = 0; i < metaData.length; i++) {
        metaData[i] ^= 0x63;
      }

      // 跳过 "163 key(Don't modify):" 前缀 (22 bytes)，Base64 解码
      final metaBase64 = utf8.decode(metaData.sublist(22));
      final metaEncrypted = base64.decode(metaBase64);

      // AES-ECB 解密元数据
      final metaDecrypted = _aesEcbDecrypt(metaEncrypted, _metaKey);
      final metaUnpadded = _pkcs7Unpad(metaDecrypted);

      // 跳过 "music:" 前缀 (6 bytes)，解析 JSON
      final metaJson = utf8.decode(metaUnpadded.sublist(6));
      final metadata = json.decode(metaJson) as Map<String, dynamic>;

      // 跳过 CRC 和专辑图片
      reader.skip(4 + 5);
      final imageLength = reader.readLittleEndianUint32();
      reader.skip(imageLength);

      // 获取输出格式
      final format = metadata['format'] as String? ?? 'mp3';

      // 构建输出文件名
      final baseName = originalName.replaceAll(
        RegExp(r'\.ncm$', caseSensitive: false),
        '',
      );
      final outputName = '$baseName.$format';

      // 解密音频数据
      final audioData = reader.readRemaining();
      // 直接在原数组操作（或者复制一份，视需求而定，这里为了Web性能直接修改）
      // 注意：ByteReader返回的是subview，如果修改会影响原始bytes。
      // Web上通常一次性读取文件到内存，为了避免大文件OOM，可以考虑分块处理，
      // 但这里为了简化直接处理。如果文件很大(>100MB)，Web可能会有压力。
      // 不过NCM通常是单曲，一般几MB到几十MB，应该可以接受。
      // 如果要修改数据，sublist创建了副本，所以是安全的。
      // 为了性能，我们可以直接操作 Uint8List
      // 但 audioData 是 sublistView，修改它会修改原始 inputBytes。
      // 如果 inputBytes 是通过 FilePicker 获得的，通常是只读的或者为了节省内存我们不应该修改它？
      // 不，inputBytes如果是从FilePicker result.files.first.bytes拿到的，是可以修改的。
      // 但为了安全起见，这里我们创建一个新的 Uint8List 作为输出。

      if (kIsWeb) {
        // Web 端使用原生 Worker 进行解密，避免主线程卡顿
        try {
          final workerService = WebWorkerService();
          final decryptedBytes = await workerService.decrypt(audioData, keyBox);
          return (true, decryptedBytes, outputName, null);
        } catch (e) {
          return (false, null, null, 'Web Worker 解密失败: $e');
        }
      }

      // Native 端直接在当前 Isolate 解密（会被 compute 包裹）
      final outputBytes = Uint8List(audioData.length);
      for (var i = 0; i < audioData.length; i++) {
        final j = (i + 1) & 0xff;
        outputBytes[i] =
            audioData[i] ^
            keyBox[(keyBox[j] + keyBox[(keyBox[j] + j) & 0xff]) & 0xff];
      }

      return (true, outputBytes, outputName, null);
    } catch (e) {
      return (false, null, null, '解密失败: $e');
    }
  }

  /// 构建 RC4 变种的 KeyBox
  Uint8List _buildKeyBox(Uint8List key) {
    final box = Uint8List(256);
    for (var i = 0; i < 256; i++) {
      box[i] = i;
    }

    var c = 0;
    var lastByte = 0;
    var keyOffset = 0;

    for (var i = 0; i < 256; i++) {
      final swap = box[i];
      c = (swap + lastByte + key[keyOffset]) & 0xff;
      keyOffset++;
      if (keyOffset >= key.length) {
        keyOffset = 0;
      }
      box[i] = box[c];
      box[c] = swap;
      lastByte = c;
    }

    return box;
  }

  /// AES-ECB 解密
  Uint8List _aesEcbDecrypt(Uint8List data, Uint8List key) {
    final cipher = BlockCipher('AES/ECB');
    cipher.init(false, KeyParameter(key));

    final result = Uint8List(data.length);
    for (var i = 0; i < data.length; i += 16) {
      cipher.processBlock(data, i, result, i);
    }
    return result;
  }

  /// PKCS7 去填充
  Uint8List _pkcs7Unpad(Uint8List data) {
    if (data.isEmpty) return data;
    final padLen = data.last;
    if (padLen > 16 || padLen > data.length) return data;
    return data.sublist(0, data.length - padLen);
  }

  /// 十六进制字符串转字节数组
  Uint8List _hexToBytes(String hex) {
    final result = Uint8List(hex.length ~/ 2);
    for (var i = 0; i < result.length; i++) {
      result[i] = int.parse(hex.substring(i * 2, i * 2 + 2), radix: 16);
    }
    return result;
  }

  /// 比较两个列表是否相等
  bool _listEquals(Uint8List a, Uint8List b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}

/// 字节流读取器
class _ByteReader {
  final Uint8List _data;
  int _offset = 0;

  _ByteReader(this._data);

  int get remaining => _data.length - _offset;

  Uint8List read(int length) {
    if (_offset + length > _data.length) {
      throw RangeError('读取超出范围');
    }
    final result = Uint8List.sublistView(_data, _offset, _offset + length);
    _offset += length;
    return result;
  }

  void skip(int length) {
    if (_offset + length > _data.length) {
      _offset = _data.length;
    } else {
      _offset += length;
    }
  }

  int readLittleEndianUint32() {
    final bytes = read(4);
    return bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
  }

  Uint8List readRemaining() {
    final result = Uint8List.sublistView(_data, _offset);
    _offset = _data.length;
    return result;
  }
}
