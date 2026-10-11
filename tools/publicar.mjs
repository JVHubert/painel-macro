// Monta dist/site com o que vai para o GitHub Pages (sem etapa de build de verdade).
import { cp, mkdir, rm } from 'node:fs/promises';

const raiz = new URL('..', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
const destino = new URL('../dist/site/', import.meta.url);

const ARQUIVOS = ['index.html', 'style.css', 'app.js', 'indicadores.js', 'sw.js', 'manifest.webmanifest'];
const PASTAS = ['icons', 'dados'];

await rm(dist, { recursive: true, force: true });
await mkdir(destino, { recursive: true });

for (const arquivo of ARQUIVOS) {
  await cp(new URL(arquivo, raiz), new URL(arquivo, destino));
  console.log(arquivo);
}
for (const pasta of PASTAS) {
  await cp(new URL(pasta, raiz), new URL(pasta, destino), { recursive: true });
  console.log(`${pasta}/`);
}

console.log('pronto: dist/site');
