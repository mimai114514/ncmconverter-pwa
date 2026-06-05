self.onmessage = (e: MessageEvent) => {
  const { audioData, keyBox } = e.data as { audioData: Uint8Array; keyBox: Uint8Array };
  const len = audioData.length;
  const outputBytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    const j = (i + 1) & 0xff;
    const boxJ = keyBox[j];
    const idx1 = (boxJ + j) & 0xff;
    const val1 = keyBox[idx1];
    const idx2 = (boxJ + val1) & 0xff;
    const key = keyBox[idx2];
    outputBytes[i] = audioData[i] ^ key;
  }

  // Transfer the buffer back for zero-copy
  self.postMessage({ outputBytes }, [outputBytes.buffer]);
};
