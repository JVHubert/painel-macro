import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dadosUrl, lerJson, lerLista, lerTexto } from '../tools/arquivos.mjs';

test('sem DADOS_DIR os dados saem da raiz do projeto, ou do clone quando ele existe', () => {
  assert.match(dadosUrl('carteira.json', { ddir: '', temClone: false }).pathname, /painel-macro\/carteira\.json$/);
  assert.match(
    dadosUrl('carteira.json', { ddir: '', temClone: true }).pathname,
    /painel-macro\/\.privado\/carteira\.json$/,
  );
});

test('com DADOS_DIR os dados saem da pasta apontada (relativa ou absoluta)', () => {
  assert.match(dadosUrl('carteira.json', { ddir: 'privado/' }).pathname, /painel-macro\/privado\/carteira\.json$/);
  assert.match(dadosUrl('diario/decisoes.md', { ddir: 'privado/' }).pathname, /privado\/diario\/decisoes\.md$/);
  assert.match(dadosUrl('estudo/respostas.md', { ddir: 'privado/' }).pathname, /privado\/estudo\/respostas\.md$/);
  assert.match(dadosUrl('carteira.json', { ddir: 'C:/dados/x' }).pathname, /^\/C:\/dados\/x\/carteira\.json$/);
});

test('arquivo que falta não derruba quem só quer ler texto', async () => {
  assert.equal(await lerTexto(new URL('../nao-existe.md', import.meta.url)), '');
  await assert.rejects(
    () => lerJson(new URL('../nao-existe.json', import.meta.url), 'rode `npm run coletar` primeiro.'),
    /nao-existe\.json.*rode `npm run coletar`/s,
  );
});

test('JSON com marca de ordem (BOM) é lido igual', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const pasta = await mkdtemp(join(tmpdir(), 'painel-'));
  const arquivo = join(pasta, 'teste.json');
  try {
    await writeFile(arquivo, `\uFEFF${JSON.stringify({ receitaMensal: 7000 })}`, 'utf8');
    const lido = await lerJson(new URL(`file://${arquivo.replace(/\\/g, '/')}`), 'dica');
    assert.equal(lido.receitaMensal, 7000);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});

test('lista que ainda não existe, ou quebrada, vira lista vazia', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  assert.deepEqual(await lerLista(new URL('../nao-existe.json', import.meta.url)), []);

  const pasta = await mkdtemp(join(tmpdir(), 'painel-'));
  const url = (nome) => new URL(`file://${join(pasta, nome).replace(/\\/g, '/')}`);
  try {
    await writeFile(url('vazio.json'), '', 'utf8');
    assert.deepEqual(await lerLista(url('vazio.json')), []);

    await writeFile(url('quebrado.json'), '{ isso não é json', 'utf8');
    assert.deepEqual(await lerLista(url('quebrado.json')), []);

    await writeFile(url('objeto.json'), '{"data":"2026-10-11"}', 'utf8');
    assert.deepEqual(await lerLista(url('objeto.json')), []);

    await writeFile(url('lista.json'), '[{"data":"2026-10-11","patrimonio":30000}]', 'utf8');
    assert.deepEqual(await lerLista(url('lista.json')), [{ data: '2026-10-11', patrimonio: 30000 }]);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});
