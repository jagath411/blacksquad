/**
 * Pure JavaScript WebCrypto Subtle digest polyfill for HTTP origins
 * Enables expo-crypto / expo-auth-session to work without errors on non-HTTPS IP addresses
 */

function sha256(ascii: Uint8Array): ArrayBuffer {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';

  const result: number[] = [];
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isPrime = (n: number) => {
    for (let factor = 2, factorLimit = Math.sqrt(n); factor <= factorLimit; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 1 / 2) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  for (let index = 0; index < ascii[lengthProperty]; index++) {
    words[index >> 2] |= ascii[index] << (24 - (index % 4) * 8);
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (let blockIndex = 0; blockIndex < words[lengthProperty]; blockIndex += 16) {
    const w: number[] = [];
    for (let wordIndex = 0; wordIndex < 16; wordIndex++) {
      w[wordIndex] = words[blockIndex + wordIndex] | 0;
    }
    for (let wordIndex = 16; wordIndex < 64; wordIndex++) {
      const s0 =
        rightRotate(w[wordIndex - 15], 7) ^
        rightRotate(w[wordIndex - 15], 18) ^
        (w[wordIndex - 15] >>> 3);
      const s1 =
        rightRotate(w[wordIndex - 2], 17) ^
        rightRotate(w[wordIndex - 2], 19) ^
        (w[wordIndex - 2] >>> 10);
      w[wordIndex] = (w[wordIndex - 16] + s0 + w[wordIndex - 7] + s1) | 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let index = 0; index < 64; index++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[index] + w[index]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (let index = 0; index < 8; index++) {
    for (let byteIndex = 3; byteIndex >= 0; byteIndex--) {
      result.push((hash[index] >> (byteIndex * 8)) & 255);
    }
  }

  return new Uint8Array(result).buffer;
}

export function installCryptoPolyfill(): void {
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.crypto) {
      (globalThis as any).crypto = {};
    }
    const c = globalThis.crypto as any;
    if (!c.subtle) {
      c.subtle = {
        digest: async (_algorithm: string | { name: string }, data: BufferSource): Promise<ArrayBuffer> => {
          const u8 =
            data instanceof Uint8Array
              ? data
              : data instanceof ArrayBuffer
              ? new Uint8Array(data)
              : new Uint8Array((data as ArrayBufferView).buffer);
          return sha256(u8);
        },
      };
    } else if (!c.subtle.digest) {
      c.subtle.digest = async (_algorithm: string | { name: string }, data: BufferSource): Promise<ArrayBuffer> => {
        const u8 =
          data instanceof Uint8Array
            ? data
            : data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : new Uint8Array((data as ArrayBufferView).buffer);
        return sha256(u8);
      };
    }
  }
}

// Automatically install on module evaluation
installCryptoPolyfill();
