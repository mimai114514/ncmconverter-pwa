export function decryptWithWorker(audioData: Uint8Array, keyBox: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    // Instantiate worker using Vite URL construction
    const worker = new Worker(
      new URL('./ncm.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent) => {
      const { outputBytes } = e.data;
      resolve(outputBytes);
      worker.terminate();
    };

    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };

    // Send the message and transfer the audioData buffer for zero-copy
    worker.postMessage({ audioData, keyBox }, [audioData.buffer]);
  });
}
