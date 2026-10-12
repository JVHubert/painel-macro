import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dadosUrl, lerJson, lerTexto } from '../tools/arquivos.mjs';

test('sem DADOS_DIR os dados saem da pasta do projeto', () => {
  delete process.env.DADOS_DIR;
  assert.match(dadosUrl('carteira.json').pathname, /painel-macro\/carteira\.json$/);
});

test('com DADOS_DIR os dados saem da pasta privada', () => {
  process.env.DADOS_DIR = 'privado/';
  try {
    assert.match(dadosUrl('carteira.json').pathname, /painel-macro\/privado\/carteira\.json$/);
    assert.match(dadosUrl('diario/decisoes.md').pathname, /privado\/diario\/decisoes\.md$/);
    assert.match(dadosUrl('estudo/respostas.md').pathname, /privado\/estudo\/respostas\.md$/);
  } finally {
    delete process.env.DADOS_DIR;
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
