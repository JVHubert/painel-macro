// Os workflows conversam com dois repositórios. Estes testes guardam a regra que já falhou uma vez:
// quem escreve nos dados privados tem que salvar o repositório privado antes de terminar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const PASTA = new URL('../.github/workflows/', import.meta.url);

const lerWorkflows = async () => {
  const nomes = (await readdir(PASTA)).filter((nome) => nome.endsWith('.yml'));
  return Promise.all(
    nomes.map(async (nome) => ({ nome, texto: await readFile(new URL(nome, PASTA), 'utf8') })),
  );
};

test('todo workflow que escreve nos dados privados também salva o repositório privado', async () => {
  const workflows = await lerWorkflows();
  assert.ok(workflows.length, 'nenhum workflow encontrado');

  for (const { nome, texto } of workflows) {
    if (!texto.includes('DADOS_DIR=privado')) continue;
    assert.match(texto, /cd privado/, `${nome}: escreve em privado/, mas não entra na pasta para salvar`);
    assert.match(texto, /git pull --rebase/, `${nome}: salva sem atualizar antes (git pull --rebase)`);
    assert.match(texto, /git push/, `${nome}: escreve em privado/, mas não faz push`);
    assert.match(texto, /hashFiles\('privado\/carteira\.json'\)/, `${nome}: salva sem checar se os dados privados vieram`);
  }
});
