// Gera os PNGs do ícone sem dependência nenhuma: desenha os pixels e escreve o PNG na mão.
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

const FUNDO = [0x0f, 0x11, 0x15, 0xff];
const AZUL = [0x6a, 0xa9, 0xff, 0xff];
const VERDE = [0x2e, 0xcc, 0x71, 0xff];
const PONTOS = [
  [96, 352],
  [160, 240],
  [224, 296],
  [288, 160],
  [352, 216],
  [416, 128],
];
const LINHA = 17;
const BOLINHA = 26;

const TABELA_CRC = (() => {
  const tabela = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c;
  }
  return tabela;
})();

function crc32(buffer) {
  let c = -1;
  for (const byte of buffer) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function png(pixels, lado) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  const linhas = [];
  for (let y = 0; y < lado; y++) {
    linhas.push(Buffer.from([0]), pixels.subarray(y * lado * 4, (y + 1) * lado * 4));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(Buffer.concat(linhas), { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

function distanciaAoTraco(x, y, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

function desenhar(lado, margem) {
  const pixels = Buffer.alloc(lado * lado * 4);
  for (let i = 0; i < lado * lado; i++) pixels.set(FUNDO, i * 4);

  const escala = (lado * (1 - margem * 2)) / 512;
  const recuo = lado * margem;
  const pontos = PONTOS.map(([x, y]) => [recuo + x * escala, recuo + y * escala]);
  const raioLinha = LINHA * escala;
  const raioPonto = BOLINHA * escala;
  const centro = pontos.at(-1);

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let cor = null;
      if (Math.hypot(px - centro[0], py - centro[1]) <= raioPonto) cor = VERDE;
      else if (
        pontos.some(
          (_, i) => i < pontos.length - 1 && distanciaAoTraco(px, py, pontos[i], pontos[i + 1]) <= raioLinha,
        )
      )
        cor = AZUL;
      if (cor) pixels.set(cor, (y * lado + x) * 4);
    }
  }
  return png(pixels, lado);
}

const destino = new URL('../icons/', import.meta.url);
await mkdir(destino, { recursive: true });

const icones = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.18],
];

for (const [nome, lado, margem] of icones) {
  await writeFile(new URL(nome, destino), desenhar(lado, margem));
  console.log(`${nome}: ${lado}x${lado}`);
}
