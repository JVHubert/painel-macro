import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dadosUrl, lerJson, lerLista, lerTexto, pastaDeDados } from '../tools/arquivos.mjs';

// A raiz do projeto vem do próprio módulo: assim o teste vale com qualquer nome de pasta (no CI
// ela é o nome do repositório, que muda).
const RAIZ = pastaDeDados({ ddir: '', temClone: false });

test('sem DADOS_DIR os dados saem da raiz do projeto, ou do clone quando ele existe', () => {
  assert.equal(
    dadosUrl('carteira.json', { ddir: '', temClone: false }).href,
    new URL('carteira.json', RAIZ).href,
  );
  assert.equal(
    dadosUrl('carteira.json', { ddir: '', temClone: true }).href,
    new URL('.privado/carteira.json', RAIZ).href,
  );
});

test('com DADOS_DIR os dados saem da pasta apontada (relativa ou absoluta)', () => {
  assert.equal(dadosUrl('carteira.json', { ddir: 'privado/' }).href, new URL('privado/carteira.json', RAIZ).href);
  assert.equal(
    dadosUrl('diario/decisoes.md', { ddir: 'privado/' }).href,
    new URL('privado/diario/decisoes.md', RAIZ).href,
  );
  assert.equal(
    dadosUrl('estudo/respostas.md', { ddir: 'privado/' }).href,
    new URL('privado/estudo/respostas.md', RAIZ).href,
  );

  // Caminho absoluto: não pode ser resolvido contra a raiz do projeto (vale em qualquer plataforma).
  const absoluto = dadosUrl('carteira.json', { ddir: '/dados/x' }).pathname;
  assert.ok(absoluto.endsWith('/dados/x/carteira.json'), absoluto);
  assert.ok(!absoluto.includes(RAIZ.pathname), absoluto);

  // No Windows, o caminho com letra de unidade também é absoluto (é o que o DADOS_DIR dos testes usa).
  if (process.platform === 'win32') {
    const comUnidade = dadosUrl('carteira.json', { ddir: 'C:/dados/x' }).pathname;
    assert.ok(comUnidade.endsWith('/C:/dados/x/carteira.json'), comUnidade);
  }
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
