/**
 * Minimal pure-TypeScript QR Code (ISO/IEC 18004) encoder.
 *
 * Public-domain algorithm — adapted from Project Nayuki's QR-Code-generator
 * reference. Self-contained (no external dependency) so the operator
 * console works behind strict Content-Security-Policy.
 *
 * Capabilities:
 *  - Encodes any UTF-8 string in byte mode.
 *  - Error-correction level configurable; default `M` (~15%).
 *  - Auto-selects the smallest version that fits.
 *  - Renders to an inline SVG string (small, scalable, CSP-friendly).
 *
 * This is intentionally focused on what the MFA enrollment flow needs
 * (small payload, byte mode). Numeric/alphanumeric/Kanji modes are not
 * required and are not implemented.
 */

export type EccLevel = "L" | "M" | "Q" | "H";

const ECC_FORMAT_BITS: Readonly<Record<EccLevel, number>> = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2,
};

// Table per version 1..40: { eccCodewordsPerBlock[L,M,Q,H], blocks[L,M,Q,H] }
// Source: ISO/IEC 18004 (also reproduced in Nayuki reference impl).
// prettier-ignore
const ECC_CODEWORDS_PER_BLOCK: Readonly<Record<EccLevel, readonly number[]>> = {
  L: [-1, 7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,26,28,28,28,28,28,28,28,28,28,28,28,28,30],
  M: [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  Q: [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  H: [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
};
// prettier-ignore
const NUM_ERROR_CORRECTION_BLOCKS: Readonly<Record<EccLevel, readonly number[]>> = {
  L: [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  M: [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  Q: [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  H: [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81],
};

function getNumRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function getNumDataCodewords(version: number, ecl: EccLevel): number {
  return (
    Math.floor(getNumRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecl][version] *
      NUM_ERROR_CORRECTION_BLOCKS[ecl][version]
  );
}

// Reed-Solomon over GF(256) with primitive polynomial 0x11D.
function reedSolomonComputeDivisor(degree: number): Uint8Array {
  if (degree < 1 || degree > 255) throw new Error("RS degree out of range");
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = reedSolomonMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonComputeRemainder(
  data: Uint8Array,
  divisor: Uint8Array,
): Uint8Array {
  const result = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= reedSolomonMultiply(divisor[i], factor);
    }
  }
  return result;
}

function reedSolomonMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function getAlignmentPatternPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step =
    version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result: number[] = [6];
  for (let pos = version * 4 + 10; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

class QrMatrix {
  readonly size: number;
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];

  constructor(
    readonly version: number,
    readonly ecl: EccLevel,
    dataCodewords: Uint8Array,
    mask: number,
  ) {
    if (version < 1 || version > 40) throw new Error("Version out of range");
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    );
    this.isFunction = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    );

    this.drawFunctionPatterns();
    const allCodewords = this.appendErrorCorrection(dataCodewords);
    this.drawCodewords(allCodewords);

    if (mask < 0) {
      let minPenalty = Infinity;
      let bestMask = 0;
      for (let m = 0; m < 8; m++) {
        this.applyMask(m);
        this.drawFormatBits(m);
        const penalty = this.getPenaltyScore();
        if (penalty < minPenalty) {
          minPenalty = penalty;
          bestMask = m;
        }
        this.applyMask(m); // undo
      }
      mask = bestMask;
    }
    this.applyMask(mask);
    this.drawFormatBits(mask);
  }

  private setFunctionModule(x: number, y: number, isDark: boolean): void {
    this.modules[y][x] = isDark;
    this.isFunction[y][x] = true;
  }

  private drawFunctionPatterns(): void {
    // Timing patterns
    for (let i = 0; i < this.size; i++) {
      this.setFunctionModule(6, i, i % 2 === 0);
      this.setFunctionModule(i, 6, i % 2 === 0);
    }
    // Finder patterns + separators
    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);

    // Alignment patterns
    const alignPositions = getAlignmentPatternPositions(this.version);
    const numAlign = alignPositions.length;
    for (let i = 0; i < numAlign; i++) {
      for (let j = 0; j < numAlign; j++) {
        // Skip three finder corners
        if (
          (i === 0 && j === 0) ||
          (i === 0 && j === numAlign - 1) ||
          (i === numAlign - 1 && j === 0)
        )
          continue;
        this.drawAlignmentPattern(alignPositions[i], alignPositions[j]);
      }
    }

    // Format & version info placeholders (real bits drawn later)
    this.drawFormatBits(0);
    if (this.version >= 7) this.drawVersion();
  }

  private drawFinderPattern(x: number, y: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  private drawAlignmentPattern(x: number, y: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunctionModule(
          x + dx,
          y + dy,
          Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
        );
      }
    }
  }

  private drawFormatBits(mask: number): void {
    // BCH(15,5) format info
    const data = (ECC_FORMAT_BITS[this.ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) {
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    }
    const bits = ((data << 10) | rem) ^ 0x5412;

    for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, getBit(bits, i));
    this.setFunctionModule(8, 7, getBit(bits, 6));
    this.setFunctionModule(8, 8, getBit(bits, 7));
    this.setFunctionModule(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++)
      this.setFunctionModule(14 - i, 8, getBit(bits, i));

    for (let i = 0; i < 8; i++)
      this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++)
      this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
    this.setFunctionModule(8, this.size - 8, true);
  }

  private drawVersion(): void {
    let rem = this.version;
    for (let i = 0; i < 12; i++) {
      rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    }
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunctionModule(a, b, bit);
      this.setFunctionModule(b, a, bit);
    }
  }

  private appendErrorCorrection(data: Uint8Array): Uint8Array {
    const v = this.version;
    const ecl = this.ecl;
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][v];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][v];
    const rawCodewords = Math.floor(getNumRawDataModules(v) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);

    const blocks: Uint8Array[] = [];
    const rsDivisor = reedSolomonComputeDivisor(blockEccLen);
    let k = 0;
    for (let i = 0; i < numBlocks; i++) {
      const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
      const dat = data.slice(k, k + datLen);
      k += datLen;
      const ecc = reedSolomonComputeRemainder(dat, rsDivisor);
      const block = new Uint8Array(shortBlockLen + 1);
      block.set(dat, 0);
      if (i < numShortBlocks) {
        // pad slot retains 0 — interleaving below skips it
      } else {
        block[datLen] = 0;
      }
      block.set(ecc, block.length - blockEccLen);
      blocks.push(block);
    }

    const result = new Uint8Array(rawCodewords);
    let pos = 0;
    // Interleave data codewords
    for (let i = 0; i < blocks[0].length - blockEccLen; i++) {
      for (let j = 0; j < blocks.length; j++) {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
          result[pos++] = blocks[j][i];
        }
      }
    }
    // Interleave ECC codewords
    for (let i = blocks[0].length - blockEccLen; i < blocks[0].length; i++) {
      for (let j = 0; j < blocks.length; j++) {
        result[pos++] = blocks[j][i];
      }
    }
    return result;
  }

  private drawCodewords(data: Uint8Array): void {
    let i = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  private applyMask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.isFunction[y][x]) continue;
        let invert = false;
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0;
            break;
          case 1:
            invert = y % 2 === 0;
            break;
          case 2:
            invert = x % 3 === 0;
            break;
          case 3:
            invert = (x + y) % 3 === 0;
            break;
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) === 0;
            break;
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          case 7:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          default:
            throw new Error("Invalid mask");
        }
        if (invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  private getPenaltyScore(): number {
    let result = 0;
    const n = this.size;
    // Rule 1: 5+ same-color modules in a row/col
    for (let y = 0; y < n; y++) {
      let runColor = false;
      let runLen = 0;
      for (let x = 0; x < n; x++) {
        if (this.modules[y][x] === runColor) {
          runLen++;
          if (runLen === 5) result += 3;
          else if (runLen > 5) result++;
        } else {
          runColor = this.modules[y][x];
          runLen = 1;
        }
      }
    }
    for (let x = 0; x < n; x++) {
      let runColor = false;
      let runLen = 0;
      for (let y = 0; y < n; y++) {
        if (this.modules[y][x] === runColor) {
          runLen++;
          if (runLen === 5) result += 3;
          else if (runLen > 5) result++;
        } else {
          runColor = this.modules[y][x];
          runLen = 1;
        }
      }
    }
    // Rule 2: 2x2 blocks of same color
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const c = this.modules[y][x];
        if (
          c === this.modules[y][x + 1] &&
          c === this.modules[y + 1][x] &&
          c === this.modules[y + 1][x + 1]
        )
          result += 3;
      }
    }
    // Rule 3: finder-like patterns
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (x + 6 < n) {
          if (
            this.modules[y][x] &&
            !this.modules[y][x + 1] &&
            this.modules[y][x + 2] &&
            this.modules[y][x + 3] &&
            this.modules[y][x + 4] &&
            !this.modules[y][x + 5] &&
            this.modules[y][x + 6]
          ) {
            if (
              (x + 10 < n &&
                !this.modules[y][x + 7] &&
                !this.modules[y][x + 8] &&
                !this.modules[y][x + 9] &&
                !this.modules[y][x + 10]) ||
              (x - 4 >= 0 &&
                !this.modules[y][x - 1] &&
                !this.modules[y][x - 2] &&
                !this.modules[y][x - 3] &&
                !this.modules[y][x - 4])
            )
              result += 40;
          }
        }
        if (y + 6 < n) {
          if (
            this.modules[y][x] &&
            !this.modules[y + 1][x] &&
            this.modules[y + 2][x] &&
            this.modules[y + 3][x] &&
            this.modules[y + 4][x] &&
            !this.modules[y + 5][x] &&
            this.modules[y + 6][x]
          ) {
            if (
              (y + 10 < n &&
                !this.modules[y + 7][x] &&
                !this.modules[y + 8][x] &&
                !this.modules[y + 9][x] &&
                !this.modules[y + 10][x]) ||
              (y - 4 >= 0 &&
                !this.modules[y - 1][x] &&
                !this.modules[y - 2][x] &&
                !this.modules[y - 3][x] &&
                !this.modules[y - 4][x])
            )
              result += 40;
          }
        }
      }
    }
    // Rule 4: dark module proportion
    let dark = 0;
    for (const row of this.modules) for (const m of row) if (m) dark++;
    const total = n * n;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * 10;
    return result;
  }
}

function getBit(x: number, i: number): boolean {
  return ((x >>> i) & 1) !== 0;
}

function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function buildByteSegmentBits(data: Uint8Array, version: number): number[] {
  const bits: number[] = [];
  const appendBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  // Mode indicator: byte mode = 0100
  appendBits(0x4, 4);
  // Character count indicator: 8 bits for v1-9, 16 bits for v10+
  const cciLen = version < 10 ? 8 : 16;
  if (data.length >= 1 << cciLen)
    throw new Error("Data too long for selected version");
  appendBits(data.length, cciLen);
  for (const b of data) appendBits(b, 8);
  return bits;
}

function bitsToCodewords(
  bits: number[],
  version: number,
  ecl: EccLevel,
): Uint8Array {
  const dataCapacityBits = getNumDataCodewords(version, ecl) * 8;
  if (bits.length > dataCapacityBits) throw new Error("Data exceeds capacity");
  // Terminator
  const terminatorLen = Math.min(4, dataCapacityBits - bits.length);
  for (let i = 0; i < terminatorLen; i++) bits.push(0);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad with 0xEC 0x11 alternating
  const padBytes = [0xec, 0x11];
  for (let i = 0; bits.length < dataCapacityBits; i++) {
    const pad = padBytes[i % 2];
    for (let b = 7; b >= 0; b--) bits.push((pad >>> b) & 1);
  }
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bits.length; i++) {
    bytes[i >>> 3] |= bits[i] << (7 - (i & 7));
  }
  return bytes;
}

export interface EncodeOptions {
  ecl?: EccLevel;
  minVersion?: number;
  maxVersion?: number;
}

export interface QrCode {
  readonly version: number;
  readonly size: number;
  readonly modules: readonly boolean[][];
}

export function encodeText(text: string, opts: EncodeOptions = {}): QrCode {
  const ecl = opts.ecl ?? "M";
  const minVersion = Math.max(1, opts.minVersion ?? 1);
  const maxVersion = Math.min(40, opts.maxVersion ?? 40);
  const data = utf8Encode(text);

  for (let version = minVersion; version <= maxVersion; version++) {
    const capacityBits = getNumDataCodewords(version, ecl) * 8;
    const cciLen = version < 10 ? 8 : 16;
    const need = 4 + cciLen + data.length * 8;
    if (need <= capacityBits) {
      const bits = buildByteSegmentBits(data, version);
      const codewords = bitsToCodewords(bits, version, ecl);
      const matrix = new QrMatrix(version, ecl, codewords, -1);
      return {
        version,
        size: matrix.size,
        modules: matrix.modules,
      };
    }
  }
  throw new Error("Data too long for QR code");
}

/**
 * Render a QR code to an inline SVG string. Pure black/white;
 * caller styles via CSS attributes if desired. Includes a configurable
 * quiet zone (border) — the spec requires at least 4 modules.
 */
export function renderSvg(
  qr: QrCode,
  options: { border?: number; light?: string; dark?: string } = {},
): string {
  const border = options.border ?? 4;
  const light = options.light ?? "#ffffff";
  const dark = options.dark ?? "#000000";
  if (border < 0) throw new Error("Border must be non-negative");
  const dim = qr.size + border * 2;
  const parts: string[] = [];
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) {
        parts.push(`M${x + border},${y + border}h1v1h-1z`);
      }
    }
  }
  const path = parts.join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${dim} ${dim}" stroke="none" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    `</svg>`
  );
}

/** Convenience: encode + render in one call. */
export function toSvgString(text: string, opts: EncodeOptions = {}): string {
  return renderSvg(encodeText(text, opts));
}
