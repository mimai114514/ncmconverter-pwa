self.onmessage = function (e) {
    const { audioData, keyBox } = e.data;
    const len = audioData.length;
    // Create output buffer
    const outputBytes = new Uint8Array(len);

    // Performance optimization: cache keyBox access if possible, but it's random access.
    // Loop unrolling might help but V8 is good at optimizing this loop.

    for (let i = 0; i < len; i++) {
        const j = (i + 1) & 0xff;

        // Logic: keyBox[(keyBox[j] + keyBox[(keyBox[j] + j) & 0xff]) & 0xff]

        // 1. (keyBox[j] + j) & 0xff
        const boxJ = keyBox[j]; // keyBox[j]
        const idx1 = (boxJ + j) & 0xff;

        // 2. keyBox[...]
        const val1 = keyBox[idx1];

        // 3. keyBox[j] + ...
        const idx2 = (boxJ + val1) & 0xff;

        // 4. keyBox[...]
        const key = keyBox[idx2];

        outputBytes[i] = audioData[i] ^ key;
    }

    // Send back result. Use Transferable to zero-copy transfer the buffer.
    self.postMessage({ outputBytes }, [outputBytes.buffer]);
};
