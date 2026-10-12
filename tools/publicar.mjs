// Monta dist/site com o que vai para o GitHub Pages (sem etapa de build de verdade).
// A versão do service worker sai do conteúdo dos arquivos: ninguém precisa lembrar de aumentá-la.
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { nomeDaVersao, trocarVersao } from './versao.mjs';

const raiz = new URL('..', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
const destino = new URL('../dist/site/', import.meta.url);

const ARQUIVOS = ['index.html', 'style.css', 'app.js', 'indicadores.js', 'sw.js', 'manifest.webmanifest'];
const PASTAS = ['icons', 'dados'];

// A casca é o que o service worker guarda no aparelho: o site publicado menos os dados (mudam
// duas vezes por dia e vêm da rede primeiro) e menos o próprio sw.js (é ele que guarda o número).
async function arquivosDaCasca(pasta, prefixo = '') {
  const caminhos = [];
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    const relativo = prefixo ? `${prefixo}/${item.name}` : item.name;
    if (relativo === 'sw.js' || relativo === 'dados') continue;
    if (item.isDirectory()) caminhos.push(...(await arquivosDaCasca(new URL(`${item.name}/`, pasta), relativo)));
    else caminhos.push(relativo);
  }
  return caminhos;
}

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

const casca = await arquivosDaCasca(destino);
const versao = nomeDaVersao(
  await Promise.all(
    casca.map(async (caminho) => ({ caminho, conteudo: await readFile(new URL(caminho, destino)) })),
  ),
);
const sw = new URL('sw.js', destino);
await writeFile(sw, trocarVersao(await readFile(sw, 'utf8'), versao));
console.log(`sw.js: versão ${versao}`);

console.log('pronto: dist/site');
