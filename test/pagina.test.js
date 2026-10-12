// Confere se a página e o service worker apontam para arquivos que existem, e se a versão
// do service worker é calculada sozinha na publicação.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { nomeDaVersao, trocarVersao } from '../tools/versao.mjs';

const raiz = new URL('..', import.meta.url);
const ler = (arquivo) => readFile(new URL(arquivo, raiz), 'utf8');
const existe = async (arquivo) => {
  try {
    await access(new URL(arquivo, raiz));
    return true;
  } catch {
    return false;
  }
};

test('todo id usado no app.js existe no index.html', async () => {
  const html = await ler('index.html');
  const app = await ler('app.js');
  const ids = [...app.matchAll(/\$\('([^']+)'\)/g)].map((achado) => achado[1]);
  assert.ok(ids.length >= 5, 'o app deveria pegar alguns elementos pelo id');
  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`), `falta o elemento #${id} no index.html`);
  }
});

test('a lista do service worker existe de verdade', async () => {
  const sw = await ler('sw.js');
  const lista = sw.match(/const ARQUIVOS = \[([\s\S]*?)\];/)[1];
  const arquivos = [...lista.matchAll(/'([^']+)'/g)].map((achado) => achado[1]);
  assert.ok(arquivos.includes('dados/indicadores.json'), 'o JSON precisa estar no cache');
  for (const arquivo of arquivos) {
    const caminho = arquivo === './' ? 'index.html' : arquivo;
    assert.ok(await existe(caminho), `o service worker cita ${arquivo}, que não existe`);
  }
});

test('os ícones do manifest existem de verdade', async () => {
  const manifest = JSON.parse(await ler('manifest.webmanifest'));
  for (const icone of manifest.icons) {
    assert.ok(await existe(icone.src), `falta ${icone.src}`);
  }
  assert.equal(manifest.lang, 'pt-BR');
});

test('a versão do service worker sai do conteúdo da casca', () => {
  const a = nomeDaVersao([
    { caminho: 'app.js', conteudo: 'um' },
    { caminho: 'style.css', conteudo: 'dois' },
  ]);
  const mesmaCoisaEmOutraOrdem = nomeDaVersao([
    { caminho: 'style.css', conteudo: 'dois' },
    { caminho: 'app.js', conteudo: 'um' },
  ]);
  const outroConteudo = nomeDaVersao([
    { caminho: 'app.js', conteudo: 'um' },
    { caminho: 'style.css', conteudo: 'três' },
  ]);

  assert.match(a, /^painel-macro-[0-9a-f]{8}$/);
  assert.equal(a, mesmaCoisaEmOutraOrdem);
  assert.notEqual(a, outroConteudo);
});

test('a troca da versão no sw.js reclama se a linha não estiver lá', () => {
  const sw = "const VERSAO = 'painel-macro-dev';\n";
  assert.match(trocarVersao(sw, 'painel-macro-1234abcd'), /const VERSAO = 'painel-macro-1234abcd';/);
  assert.throws(() => trocarVersao('sw.js sem a linha da versão', 'painel-macro-1234abcd'));
});

test('o painel publicado tem os mesmos arquivos do repositório', async () => {
  const publicar = await ler('tools/publicar.mjs');
  for (const arquivo of ['index.html', 'style.css', 'app.js', 'indicadores.js', 'trilha.js', 'sw.js', 'manifest.webmanifest']) {
    assert.ok(publicar.includes(`'${arquivo}'`), `${arquivo} ficaria de fora do dist/site`);
  }
  assert.ok(publicar.includes("'dados'"), 'os dados ficariam de fora do dist/site');
  assert.ok(publicar.includes('nomeDaVersao'), 'o sw.js publicado precisa sair com a versão calculada');
});
