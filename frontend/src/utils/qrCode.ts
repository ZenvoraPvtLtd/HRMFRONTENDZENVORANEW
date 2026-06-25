type Matrix = (boolean | null)[][];

const SIZE = 33;
const DATA_CODEWORDS = 80;
const ECC_CODEWORDS = 20;
const ALPHANUMERIC_BITS = 8;

const EXP = new Array<number>(512).fill(0);
const LOG = new Array<number>(256).fill(0);

let gfReady = false;

function initGalois() {
  if (gfReady) return;
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    EXP[index] = value;
    LOG[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) {
    EXP[index] = EXP[index - 255];
  }
  gfReady = true;
}

function gfMul(a: number, b: number) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function generatorPolynomial(degree: number) {
  initGalois();
  let poly = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let item = 0; item < poly.length; item += 1) {
      next[item] ^= gfMul(poly[item], 1);
      next[item + 1] ^= gfMul(poly[item], EXP[index]);
    }
    poly = next;
  }
  return poly;
}

function reedSolomon(data: number[], degree: number) {
  const gen = generatorPolynomial(degree);
  const result = new Array(degree).fill(0);

  data.forEach((byte) => {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let index = 0; index < degree; index += 1) {
      result[index] ^= gfMul(gen[index + 1], factor);
    }
  });

  return result;
}

function pushBits(bits: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function createCodewords(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 78) {
    throw new Error("QR content is too long");
  }

  const bits: number[] = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, ALPHANUMERIC_BITS);
  bytes.forEach((byte) => pushBits(bits, byte, 8));

  const maxBits = DATA_CODEWORDS * 8;
  pushBits(bits, 0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(Number.parseInt(bits.slice(index, index + 8).join(""), 2));
  }

  const pads = [0xec, 0x11];
  let padIndex = 0;
  while (data.length < DATA_CODEWORDS) {
    data.push(pads[padIndex % 2]);
    padIndex += 1;
  }

  return [...data, ...reedSolomon(data, ECC_CODEWORDS)];
}

function createMatrix(): Matrix {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
}

function setModule(matrix: Matrix, row: number, col: number, value: boolean) {
  if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) matrix[row][col] = value;
}

function drawFinder(matrix: Matrix, row: number, col: number) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
      const dark = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      matrix[rr][cc] = dark;
    }
  }
}

function drawFunctionPatterns(matrix: Matrix) {
  drawFinder(matrix, 0, 0);
  drawFinder(matrix, 0, SIZE - 7);
  drawFinder(matrix, SIZE - 7, 0);

  for (let index = 8; index < SIZE - 8; index += 1) {
    setModule(matrix, 6, index, index % 2 === 0);
    setModule(matrix, index, 6, index % 2 === 0);
  }

  [6, 26].forEach((row) => {
    [6, 26].forEach((col) => {
      if (matrix[row][col] !== null) return;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          setModule(matrix, row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
        }
      }
    });
  });

  setModule(matrix, SIZE - 8, 8, true);
  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      setModule(matrix, 8, index, false);
      setModule(matrix, index, 8, false);
    }
  }
  for (let index = 0; index < 8; index += 1) {
    setModule(matrix, 8, SIZE - 1 - index, false);
    setModule(matrix, SIZE - 1 - index, 8, false);
  }
}

function maskBit(mask: number, row: number, col: number) {
  switch (mask) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

function drawData(matrix: Matrix, codewords: number[], mask: number) {
  const bits = codewords.flatMap((byte) => Array.from({ length: 8 }, (_, index) => (byte >>> (7 - index)) & 1));
  let bitIndex = 0;
  let upward = true;

  for (let col = SIZE - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let offset = 0; offset < SIZE; offset += 1) {
      const row = upward ? SIZE - 1 - offset : offset;
      for (let pair = 0; pair < 2; pair += 1) {
        const cc = col - pair;
        if (matrix[row][cc] !== null) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        matrix[row][cc] = bit !== maskBit(mask, row, cc);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function formatBits(mask: number) {
  const data = (0b01 << 3) | mask;
  let bits = data << 10;
  const poly = 0b10100110111;
  for (let index = 14; index >= 10; index -= 1) {
    if ((bits >>> index) & 1) bits ^= poly << (index - 10);
  }
  return (((data << 10) | bits) ^ 0b101010000010010) & 0x7fff;
}

function drawFormat(matrix: Matrix, mask: number) {
  const bits = formatBits(mask);
  const coordsA = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  const coordsB = [[SIZE - 1, 8], [SIZE - 2, 8], [SIZE - 3, 8], [SIZE - 4, 8], [SIZE - 5, 8], [SIZE - 6, 8], [SIZE - 7, 8], [8, SIZE - 8], [8, SIZE - 7], [8, SIZE - 6], [8, SIZE - 5], [8, SIZE - 4], [8, SIZE - 3], [8, SIZE - 2], [8, SIZE - 1]];
  coordsA.forEach(([row, col], index) => setModule(matrix, row, col, ((bits >>> index) & 1) === 1));
  coordsB.forEach(([row, col], index) => setModule(matrix, row, col, ((bits >>> index) & 1) === 1));
}

function penalty(matrix: Matrix) {
  let score = 0;
  const dark = (row: number, col: number) => Boolean(matrix[row][col]);

  for (let row = 0; row < SIZE; row += 1) {
    let runColor = dark(row, 0);
    let runLength = 1;
    for (let col = 1; col < SIZE; col += 1) {
      if (dark(row, col) === runColor) runLength += 1;
      else {
        if (runLength >= 5) score += 3 + runLength - 5;
        runColor = dark(row, col);
        runLength = 1;
      }
    }
    if (runLength >= 5) score += 3 + runLength - 5;
  }

  for (let col = 0; col < SIZE; col += 1) {
    let runColor = dark(0, col);
    let runLength = 1;
    for (let row = 1; row < SIZE; row += 1) {
      if (dark(row, col) === runColor) runLength += 1;
      else {
        if (runLength >= 5) score += 3 + runLength - 5;
        runColor = dark(row, col);
        runLength = 1;
      }
    }
    if (runLength >= 5) score += 3 + runLength - 5;
  }

  for (let row = 0; row < SIZE - 1; row += 1) {
    for (let col = 0; col < SIZE - 1; col += 1) {
      const value = dark(row, col);
      if (dark(row + 1, col) === value && dark(row, col + 1) === value && dark(row + 1, col + 1) === value) score += 3;
    }
  }

  let darkCount = 0;
  matrix.forEach((row) => row.forEach((cell) => { if (cell) darkCount += 1; }));
  score += Math.floor(Math.abs((darkCount * 100) / (SIZE * SIZE) - 50) / 5) * 10;
  return score;
}

export function generateQrMatrix(value: string): boolean[][] {
  const codewords = createCodewords(value);
  let best: Matrix | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = createMatrix();
    drawFunctionPatterns(matrix);
    drawData(matrix, codewords, mask);
    drawFormat(matrix, mask);
    const score = penalty(matrix);
    if (score < bestPenalty) {
      best = matrix;
      bestPenalty = score;
    }
  }

  return (best as Matrix).map((row) => row.map(Boolean));
}
