// Small self-contained QR encoder for Recipe Relay.
// Supports byte mode, QR versions 1-40, and error correction levels L or M.
// No network calls and no external runtime dependencies.

const TOTAL_CODEWORDS = [
  0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
  404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
  1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051,
  2185, 2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362,
  3532, 3706
];

const ECC_CODEWORDS_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
};

const NUM_ERROR_CORRECTION_BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
};

const FORMAT_BITS = { L: 1, M: 0 };

class BitBuffer {
  constructor() {
    this.bits = [];
  }
  append(value, length) {
    if (length < 0 || value >>> length !== 0) {
      throw new Error("Value does not fit in bit length");
    }
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }
  get length() {
    return this.bits.length;
  }
  toBytes() {
    const result = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | (this.bits[i + j] || 0);
      }
      result.push(b);
    }
    return result;
  }
}

function getDataCodewords(version, ecl) {
  return TOTAL_CODEWORDS[version] - ECC_CODEWORDS_PER_BLOCK[ecl][version] * NUM_ERROR_CORRECTION_BLOCKS[ecl][version];
}

function getByteLengthBits(version) {
  return version <= 9 ? 8 : 16;
}

function chooseVersion(dataBytes, ecl) {
  for (let version = 1; version <= 40; version++) {
    const capacityBits = getDataCodewords(version, ecl) * 8;
    const neededBits = 4 + getByteLengthBits(version) + dataBytes.length * 8;
    if (neededBits <= capacityBits) return version;
  }
  throw new Error("The QR payload is too long. Try fewer items or shorter item names.");
}

function makeDataCodewords(dataBytes, version, ecl) {
  const bb = new BitBuffer();
  bb.append(0x4, 4); // byte mode
  bb.append(dataBytes.length, getByteLengthBits(version));
  for (const b of dataBytes) bb.append(b, 8);

  const capacityBits = getDataCodewords(version, ecl) * 8;
  bb.append(0, Math.min(4, capacityBits - bb.length));
  while (bb.length % 8 !== 0) bb.append(0, 1);

  const result = bb.toBytes();
  for (let pad = 0xec; result.length < getDataCodewords(version, ecl); pad ^= 0xec ^ 0x11) {
    result.push(pad);
  }
  return result;
}

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomonDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= gfMultiply(divisor[i], factor);
    }
  }
  return result;
}

function makeBlocks(dataCodewords, version, ecl) {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][version];
  const rawCodewords = TOTAL_CODEWORDS[version];
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = reedSolomonDivisor(blockEccLen);
  const blocks = [];
  let k = 0;

  for (let i = 0; i < numBlocks; i++) {
    const dataLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const data = dataCodewords.slice(k, k + dataLen);
    k += dataLen;
    const ecc = reedSolomonRemainder(data, divisor);
    blocks.push({ data, ecc });
  }

  const result = [];
  const maxDataLen = Math.max(...blocks.map(b => b.data.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of blocks) {
      if (i < block.data.length) result.push(block.data[i]);
    }
  }
  for (let i = 0; i < blockEccLen; i++) {
    for (const block of blocks) result.push(block.ecc[i]);
  }
  return result;
}

function getAlignmentPatternPositions(version) {
  if (version === 1) return [];
  const size = version * 4 + 17;
  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = new Array(numAlign);
  result[0] = 6;
  for (let i = result.length - 1, pos = size - 7; i >= 1; i--, pos -= step) {
    result[i] = pos;
  }
  return result;
}

function makeMatrix(version) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

  function setFunction(x, y, dark) {
    modules[y][x] = !!dark;
    isFunction[y][x] = true;
  }

  function drawFinder(cx, cy) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  }

  function drawAlignment(cx, cy) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  for (let i = 0; i < size; i++) {
    if (!isFunction[6][i]) setFunction(i, 6, i % 2 === 0);
    if (!isFunction[i][6]) setFunction(6, i, i % 2 === 0);
  }

  const aligns = getAlignmentPatternPositions(version);
  for (const y of aligns) {
    for (const x of aligns) {
      const overlapsFinder = (x === 6 && y === 6) || (x === 6 && y === size - 7) || (x === size - 7 && y === 6);
      if (!overlapsFinder) drawAlignment(x, y);
    }
  }

  drawFormatBits(modules, isFunction, "M", 0, true);
  if (version >= 7) drawVersionBits(modules, isFunction, version);

  return { modules, isFunction, size };
}

function drawFormatBits(modules, isFunction, ecl, mask, markFunction = false) {
  const size = modules.length;
  const data = (FORMAT_BITS[ecl] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537);
  }
  const bits = ((data << 10) | rem) ^ 0x5412;

  function set(x, y, bit) {
    modules[y][x] = !!bit;
    if (markFunction) isFunction[y][x] = true;
  }

  for (let i = 0; i <= 5; i++) set(8, i, (bits >>> i) & 1);
  set(8, 7, (bits >>> 6) & 1);
  set(8, 8, (bits >>> 7) & 1);
  set(7, 8, (bits >>> 8) & 1);
  for (let i = 9; i < 15; i++) set(14 - i, 8, (bits >>> i) & 1);

  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, (bits >>> i) & 1);
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, (bits >>> i) & 1);
  set(8, size - 8, 1);
}

function drawVersionBits(modules, isFunction, version) {
  const size = modules.length;
  let rem = version;
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ (((rem >>> 11) & 1) * 0x1f25);
  }
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const bit = (bits >>> i) & 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    modules[b][a] = !!bit;
    modules[a][b] = !!bit;
    isFunction[b][a] = true;
    isFunction[a][b] = true;
  }
}

function drawCodewords(modules, isFunction, codewords) {
  const size = modules.length;
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < size; vert++) {
      const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      for (let x = right; x >= right - 1; x--) {
        if (isFunction[y][x]) continue;
        let dark = false;
        if (bitIndex < totalBits) {
          dark = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex++;
        }
        modules[y][x] = dark;
      }
    }
  }
}

function maskBit(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2 + (x * y) % 3) === 0;
    case 6: return (((x * y) % 2 + (x * y) % 3) % 2) === 0;
    case 7: return (((x + y) % 2 + (x * y) % 3) % 2) === 0;
    default: throw new Error("Invalid mask");
  }
}

function applyMask(modules, isFunction, mask) {
  const size = modules.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isFunction[y][x] && maskBit(mask, x, y)) modules[y][x] = !modules[y][x];
    }
  }
}

function getPenalty(modules) {
  const size = modules.length;
  let penalty = 0;

  for (let y = 0; y < size; y++) {
    let runColor = modules[y][0];
    let runLen = 1;
    for (let x = 1; x < size; x++) {
      if (modules[y][x] === runColor) {
        runLen++;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty++;
      } else {
        runColor = modules[y][x];
        runLen = 1;
      }
    }
  }

  for (let x = 0; x < size; x++) {
    let runColor = modules[0][x];
    let runLen = 1;
    for (let y = 1; y < size; y++) {
      if (modules[y][x] === runColor) {
        runLen++;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty++;
      } else {
        runColor = modules[y][x];
        runLen = 1;
      }
    }
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) penalty += 3;
    }
  }

  const pattern1 = [true, false, true, true, true, false, true, false, false, false, false];
  const pattern2 = [false, false, false, false, true, false, true, true, true, false, true];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x <= size - 11; x++) {
      const segment = modules[y].slice(x, x + 11);
      if (matches(segment, pattern1) || matches(segment, pattern2)) penalty += 40;
    }
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y <= size - 11; y++) {
      const segment = [];
      for (let k = 0; k < 11; k++) segment.push(modules[y + k][x]);
      if (matches(segment, pattern1) || matches(segment, pattern2)) penalty += 40;
    }
  }

  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
  const k = Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1;
  penalty += k * 10;
  return penalty;
}

function matches(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function cloneMatrix(m) {
  return m.map(row => row.slice());
}

function encodeMatrix(text, options = {}) {
  const preferredEcl = options.ecc === "L" ? "L" : "M";
  const dataBytes = Array.from(new TextEncoder().encode(text));
  let ecl = preferredEcl;
  let version;
  try {
    version = chooseVersion(dataBytes, ecl);
  } catch (err) {
    if (ecl !== "L") {
      ecl = "L";
      version = chooseVersion(dataBytes, ecl);
    } else {
      throw err;
    }
  }

  const dataCodewords = makeDataCodewords(dataBytes, version, ecl);
  const allCodewords = makeBlocks(dataCodewords, version, ecl);
  const base = makeMatrix(version);
  drawCodewords(base.modules, base.isFunction, allCodewords);

  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestModules = null;
  for (let mask = 0; mask < 8; mask++) {
    const trial = cloneMatrix(base.modules);
    applyMask(trial, base.isFunction, mask);
    drawFormatBits(trial, base.isFunction, ecl, mask, false);
    const penalty = getPenalty(trial);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
      bestModules = trial;
    }
  }

  return { modules: bestModules, size: base.size, version, ecc: ecl, mask: bestMask };
}

function drawToCanvas(canvas, matrix, options = {}) {
  const margin = Number.isFinite(options.margin) ? options.margin : 4;
  const scale = Number.isFinite(options.scale) ? options.scale : 6;
  const size = matrix.size + margin * 2;
  canvas.width = size * scale;
  canvas.height = size * scale;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = options.background || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.foreground || "#000000";
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.modules[y][x]) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
    }
  }
}

function toCanvas(canvas, text, options = {}) {
  const matrix = encodeMatrix(text, options);
  drawToCanvas(canvas, matrix, options);
  return matrix;
}

function toSvg(text, options = {}) {
  const matrix = encodeMatrix(text, options);
  const margin = Number.isFinite(options.margin) ? options.margin : 4;
  const size = matrix.size + margin * 2;
  const paths = [];
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.modules[y][x]) paths.push(`M${x + margin},${y + margin}h1v1h-1z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${size}v${size}H0z"/><path fill="#000" d="${paths.join("")}"/></svg>`;
}

export const QRCode = { encodeMatrix, toCanvas, toSvg };
