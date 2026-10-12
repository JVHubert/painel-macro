import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocoDeContexto, faixaDeValor, valorDasAcoes } from '../contexto.js';

// Números redondos e falsos: o teste não guarda dado nenhum de verdade.
const CARTEIRA = {
  data: '2026-10-11',
  receitaMensal: 6000,
  custoMensal: 3000,
  aporteMensal: 2000,
  reserva: { alvoMeses: 6, detalhe: [{ nome: 'Caixinha X', saldo: 30000 }] },
  posicoes: [{ ticker: 'PETR4', quantidade: 10, precoMedio: 20 }],
  respostas: [],
  decisoes: [],
};

test('a faixa esconde o número exato', () => {
  assert.equal(faixaDeValor(6000), 'entre R$ 6 mil e R$ 7 mil');
  assert.equal(faixaDeValor(2600), 'entre R$ 2 mil e R$ 3 mil');
  assert.equal(faixaDeValor(32000), 'entre R$ 30 mil e R$ 35 mil');
  assert.equal(faixaDeValor(700), 'entre R$ 700 e R$ 800');
  assert.equal(faixaDeValor(0), null);
  assert.equal(faixaDeValor(undefined), null);
});

test('as ações valem o preço de compra', () => {
  assert.equal(valorDasAcoes(CARTEIRA.posicoes), 200);
  assert.equal(valorDasAcoes([]), 0);
});

test('o bloco traz a situação em faixas, sem os números exatos', () => {
  const bloco = blocoDeContexto(CARTEIRA);

  assert.match(bloco, /Renda por mês: entre R\$ 6 mil e R\$ 7 mil/);
  assert.match(bloco, /Custo de vida por mês: entre R\$ 3 mil e R\$ 4 mil/);
  assert.match(bloco, /Sobra que eu invisto por mês: entre R\$ 2 mil e R\$ 3 mil/);
  assert.match(bloco, /Reserva de emergência: uns 10 meses de custo \(meta: 6 meses\)/);
  assert.match(bloco, /Ações: uns 1% do patrimônio/);

  for (const exato of ['6000', '6.000', '3000', '3.000', '30000', '30.000']) {
    assert.ok(!bloco.includes(exato), `o bloco entregou o número exato ${exato}`);
  }
});

test('o bloco traz as três últimas respostas e as decisões abertas', () => {
  const resposta = (semana, texto) => ({ titulo: semana, campos: { pergunta: `pergunta ${semana}`, resposta: texto } });
  const bloco = blocoDeContexto({
    ...CARTEIRA,
    respostas: [
      resposta('38', 'antiga'),
      resposta('39', 'primeira'),
      resposta('40', 'segunda'),
      resposta('41', 'terceira'),
      { titulo: '42', campos: { pergunta: 'ainda sem resposta', resposta: '' } },
    ],
    decisoes: [
      { data: '2026-09-01', titulo: 'Comprar PETR4', campos: { tipo: 'compra', valor: '200', tese: 'porque sim', espero: 'subir', provacao: 'cair', revisarEm: '2026-09-15', revisado: 'certo' } },
      { data: '2026-10-01', titulo: 'Aportar mais', campos: { tipo: 'aporte', valor: '500', revisarEm: '2026-12-01' } },
    ],
  });

  assert.match(bloco, /Semana 39: pergunta 39 → primeira/);
  assert.match(bloco, /Semana 41: pergunta 41 → terceira/);
  assert.ok(!bloco.includes('antiga'), 'deveria mostrar só as três últimas respostas');
  assert.ok(!bloco.includes('ainda sem resposta'), 'resposta vazia não entra');

  assert.match(bloco, /DECISÕES ABERTAS[\s\S]*01\/10\/2026 — Aportar mais: falta escrever a tese, o que eu espero, o que provaria que eu estou errado/);
  assert.ok(!bloco.includes('Comprar PETR4'), 'decisão já revisada não é decisão aberta');
});

test('o bloco mostra a correção da resposta quando existe', () => {
  const bloco = blocoDeContexto({
    ...CARTEIRA,
    respostas: [{ titulo: '41', campos: { pergunta: 'quanto rende?', resposta: '1.126,83', corrigido: 'certo — conta redonda' } }],
  });
  assert.match(bloco, /→ 1\.126,83 \(corrigido: certo\)/);
});

test('sem diário e sem estudo o bloco diz isso e não quebra', () => {
  const bloco = blocoDeContexto({ data: '2026-10-11' });
  assert.match(bloco, /ainda não respondi nada da trilha/);
  assert.match(bloco, /nenhuma decisão aberta/);
  assert.match(bloco, /sem números agora/);
});
