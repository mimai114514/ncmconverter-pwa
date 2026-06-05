import CryptoJS from 'crypto-js';

// Keys in hex
const CORE_KEY_HEX = '687A4852416D736F356B496E62617857';
const META_KEY_HEX = '2331346C6A6B5F215C5D2630553C2728';

const NCM_MAGIC = new Uint8Array([0x43, 0x54, 0x45, 0x4E, 0x46, 0x44, 0x41, 0x4D]); // CTENFDAM

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const coreKeyBytes = hexToBytes(CORE_KEY_HEX);
const metaKeyBytes = hexToBytes(META_KEY_HEX);

function uint8ArrayToWordArray(u8: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = [];
  const len = u8.length;
  for (let i = 0; i < len; i++) {
    words[i >>> 2] |= u8[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, len);
}

function wordArrayToUint8Array(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return u8;
}

function aesEcbDecrypt(dataBytes: Uint8Array, keyBytes: Uint8Array): Uint8Array {
  const ciphertext = uint8ArrayToWordArray(dataBytes);
  const key = uint8ArrayToWordArray(keyBytes);
  
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext } as any,
    key,
    {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.NoPadding
    }
  );
  return wordArrayToUint8Array(decrypted);
}

function pkcs7Unpad(data: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  const padLen = data[data.length - 1];
  if (padLen > 16 || padLen > data.length) return data;
  for (let i = data.length - padLen; i < data.length; i++) {
    if (data[i] !== padLen) return data;
  }
  return data.subarray(0, data.length - padLen);
}

class ByteReader {
  private data: Uint8Array;
  private offset = 0;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  get remaining(): number {
    return this.data.length - this.offset;
  }

  read(length: number): Uint8Array {
    if (this.offset + length > this.data.length) {
      throw new Error('读取超出范围');
    }
    const result = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return new Uint8Array(result);
  }

  skip(length: number): void {
    this.offset = Math.min(this.data.length, this.offset + length);
  }

  readLittleEndianUint32(): number {
    const bytes = this.read(4);
    return bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
  }

  readRemaining(): Uint8Array {
    const result = this.data.subarray(this.offset);
    this.offset = this.data.length;
    return new Uint8Array(result);
  }
}

export interface DecodeResult {
  success: boolean;
  outputBytes?: Uint8Array;
  outputName?: string;
  errorMessage?: string;
  metadata?: any;
}

export function buildKeyBox(key: Uint8Array): Uint8Array {
  const box = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    box[i] = i;
  }
  let c = 0;
  let lastByte = 0;
  let keyOffset = 0;
  for (let i = 0; i < 256; i++) {
    const swap = box[i];
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

export function parseNcmMetadata(inputBytes: Uint8Array, originalName: string) {
  const reader = new ByteReader(inputBytes);

  if (reader.remaining < 8) {
    throw new Error('文件太小');
  }

  const magic = reader.read(8);
  for (let i = 0; i < 8; i++) {
    if (magic[i] !== NCM_MAGIC[i]) {
      throw new Error('无效的 NCM 文件格式');
    }
  }

  reader.skip(2);

  const keyLength = reader.readLittleEndianUint32();
  const keyData = reader.read(keyLength);

  for (let i = 0; i < keyData.length; i++) {
    keyData[i] ^= 0x64;
  }

  const decryptedKey = aesEcbDecrypt(keyData, coreKeyBytes);
  const unpaddedKey = pkcs7Unpad(decryptedKey);

  // 跳过 "neteasecloudmusic" 前缀 (17 bytes)
  const keyBox = buildKeyBox(unpaddedKey.subarray(17));

  const metaLength = reader.readLittleEndianUint32();
  const metaData = reader.read(metaLength);

  for (let i = 0; i < metaData.length; i++) {
    metaData[i] ^= 0x63;
  }

  // 跳过 "163 key(Don't modify):" 前缀 (22 bytes)，Base64 解码
  const textDecoder = new TextDecoder('utf-8');
  const metaBase64 = textDecoder.decode(metaData.subarray(22));
  
  // Base64 转换为字节
  const rawBase64 = atob(metaBase64);
  const metaEncrypted = new Uint8Array(rawBase64.length);
  for (let i = 0; i < rawBase64.length; i++) {
    metaEncrypted[i] = rawBase64.charCodeAt(i);
  }

  const metaDecrypted = aesEcbDecrypt(metaEncrypted, metaKeyBytes);
  const metaUnpadded = pkcs7Unpad(metaDecrypted);

  // 跳过 "music:" 前缀 (6 bytes)，解析 JSON
  const metaJson = textDecoder.decode(metaUnpadded.subarray(6));
  const metadata = JSON.parse(metaJson);

  // 跳过 CRC 和专辑图片
  reader.skip(4 + 5);
  const imageLength = reader.readLittleEndianUint32();
  reader.skip(imageLength);

  const format = metadata.format || 'mp3';
  const baseName = originalName.replace(/\.ncm$/i, '');
  const outputName = `${baseName}.${format}`;

  const audioData = reader.readRemaining();

  return {
    keyBox,
    outputName,
    format,
    audioData,
    metadata
  };
}

export function decryptAudioData(audioData: Uint8Array, keyBox: Uint8Array): Uint8Array {
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
  return outputBytes;
}
