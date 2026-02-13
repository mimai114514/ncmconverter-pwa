import 'dart:typed_data';

/// Interface for Web Worker Service
class WebWorkerService {
  Future<Uint8List> decrypt(Uint8List audioData, Uint8List keyBox) async {
    throw UnimplementedError('Web Worker is not supported on this platform.');
  }
}
