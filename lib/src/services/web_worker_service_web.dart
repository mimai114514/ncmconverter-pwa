import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'dart:typed_data';
import 'package:web/web.dart' as web;

class WebWorkerService {
  Future<Uint8List> decrypt(Uint8List audioData, Uint8List keyBox) {
    final completer = Completer<Uint8List>();
    // Create worker
    final worker = web.Worker('ncm_worker.js'.toJS);

    // Prepare message
    final jsAudioData = audioData.toJS;
    final jsKeyBox = keyBox.toJS;

    final msg = WorkerMessage(audioData: jsAudioData, keyBox: jsKeyBox);

    // Transfer list: we want to transfer the audio data buffer to avoid copy.
    // audioData.buffer might match the entire file buffer.
    // If audioData is a subview, transferring its buffer invalidates the original buffer (inputBytes).
    // This is acceptable as we don't use inputBytes after this point in NcmDump.
    final buffer = (jsAudioData as JSObject).getProperty('buffer'.toJS);
    final transferList = [buffer].toJS;

    // Set up listeners
    worker.onmessage = (web.MessageEvent e) {
      final data = e.data as WorkerResult;
      // toDart creates a copy or view?
      // JSUint8Array.toDart returns Uint8List.
      // Since the worker transferred it back, we own it now.
      final output = data.outputBytes.toDart;
      completer.complete(output);
      worker.terminate();
    }.toJS;

    worker.onerror = (web.Event e) {
      completer.completeError('Web Worker Error');
      worker.terminate();
    }.toJS;

    // Post message with transfer
    worker.postMessage(msg, transferList);

    return completer.future;
  }
}

@JS()
@anonymous
extension type WorkerMessage._(JSObject _) implements JSObject {
  external factory WorkerMessage({
    required JSUint8Array audioData,
    required JSUint8Array keyBox,
  });
}

@JS()
@anonymous
extension type WorkerResult._(JSObject _) implements JSObject {
  external JSUint8Array get outputBytes;
}
