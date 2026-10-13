// A imagem é o canal principal do relatório: cor de verdade, sem emoji.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarHtml } from '../relatorioHtml.js';
import { resumoPosicao } from '../relatorio.js';

const PAINEL = {
  atualizadoEm: '2026-10-11T04:00:00.000Z',
  indicadores: [
    {
      id: 'meta-selic',
      valor: 13.75,
      serie: [
        { data: '2026-09-20', valor: 14 },
        { data: '2026-10-04', valor: 13.75 },
      ],
    },
    {
      id: 'cdi',
      valor: 13.65,
      extra: { rotulo: 'acumulado em 12 meses', percentual: 0.1451 },
      serie: [{ data: '2026-10-08', valor: 0.05166 }],
    },
    { id: 'ipca', valor: 4.58, serie: [] },
    { id: 'juro-real', valor: 8.77, serie: [] },
    {
      id: 'dolar',
      valor: 4.9918,
      serie: [
        { data: '2026-10-01', valor: 5.0119 },
        { data: '2026-10-09', valor: 4.9892 },
      ],
    },
  ],
};

const POSICOES = [
  resumoPosicao(
    { ticker: 'RENT3', quantidade: 10, precoMedio: 20, dataCompra: '2023-01-10' },
    { preco: 21, variacaoDia: 0.012, variacaoSemana: 0.05 },
    { cdiNoPeriodo: 0.5 },
  ),
  resumoPosicao(
    { ticker: 'RENT3', quantidade: 20, precoMedio: 25, dataCompra: '2024-01-10' },
    { preco: 21, variacaoDia: 0.012, variacaoSemana: 0.05 },
    { cdiNoPeriodo: 0.1 },
  ),
];

const RESERVA = {
  alvoMeses: 6,
  detalhe: [
    { nome: 'Conta corrente', saldo: 2500 },
    {
      nome: 'Caixinha X',
      saldo: 10000,
      rendimento: 1000,
      dataAporte: '2025-06-30',
      medido: { dias: 469, total: 0.1111, taxaAnual: 0.0888, percentualDoCdi: 0.8 },
    },
    { nome: 'Cofrinho Y', saldo: 4500, taxaCDI: 1.2 },
  ],
};

const montar = (extra = {}) =>
  montarHtml({
    data: '2026-10-11',
    painel: PAINEL,
    posicoes: POSICOES,
    reserva: RESERVA,
    receitaMensal: 7000,
    custoMensal: 4000,
    aporteMensal: 1000,
    ...extra,
  });

test('html monta a página inteira com a paleta', () => {
  const html = montar();
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /--muito-bom: #6aa9ff/);
  assert.match(html, /--muito-ruim: #ff6b6b/);
  assert.match(html, /Relatório semanal/);
  assert.match(html, /11\/10\/2026 · semana 41/);
});

test('cores viram classe em vez de emoji', () => {
  const html = montar();
  assert.match(html, /class="dir ruim">-10,00%/);
  assert.match(html, /class="dir bom">5,00%/);
  assert.match(html, /class="dir ruim">80%/); // abaixo do CDI: mostarda, não vermelho
  assert.match(html, /class="dir ruim">4,3 meses/);
  assert.ok(!html.includes('🟢') && !html.includes('🔴'));
  assert.match(html, /■ \+20% ou mais/);
  // Nunca dois atributos class no mesmo elemento.
  assert.ok(!/class="[^"]*"\s+class=/.test(html));
});

test('números do relatório aparecem formatados', () => {
  const html = montar();
  assert.match(html, /R\$ 700,00/);
  assert.match(html, /R\$ 630,00/);
  assert.match(html, /Se o mesmo dinheiro tivesse ficado no CDI: R\$ 850,00 \(hoje: R\$ 630,00\)/);
  assert.match(html, /só preço; não inclui dividendos nem imposto/);
  assert.match(html, /R\$ 17\.000,00/);
  assert.match(html, /4,3 meses de custo \(meta 6\)/);
  assert.match(html, /R\$ 3\.000,00/);
  assert.ok(!/class="dir (bom|ruim|neutro|muito-bom|muito-ruim)">-0,45%/.test(html), 'o câmbio da semana não recebe cor');
  assert.ok(!html.includes('NaN') && !html.includes('undefined'));
});

test('sem dado o html não quebra e vira pendência', () => {
  const html = montar({
    posicoes: [resumoPosicao({ ticker: 'RENT3', quantidade: 10, precoMedio: null }, { preco: 54.51 })],
    reserva: {},
  });
  assert.match(html, /sem dado para calcular/);
  assert.match(html, /preencha o precoMedio de RENT3/);
  assert.ok(!html.includes('NaN') && !html.includes('undefined'));
});

test('reserva muito acima da meta fica cinza e cobra a decisão', () => {
  const html = montar({ reserva: { alvoMeses: 6, detalhe: [{ nome: 'Caixinha X', saldo: 40000 }] } });
  assert.match(html, /class="dir neutro">10,0 meses de custo \(meta 6\)/);
  assert.match(html, /R\$ 16\.000,00 acima da meta de 6 meses — esse dinheiro pode ir para prazo maior\./);
});

test('o placar do estudo aparece abaixo do Para esta semana, quando existe caderno', () => {
  const placar = { linha: 'Nível 1 · contas certas 1/2 (50%) · decisões com tese 1 · revisadas 0' };

  const comPlacar = montar({ caderno: { placar } });
  assert.match(comPlacar, /<p class="item placar">Nível 1 · contas certas 1\/2 \(50%\)[\s\S]*Total<\/td>/);

  const semCaderno = montar();
  assert.ok(!semCaderno.includes('class="item placar"'), 'sem caderno, o placar não aparece');
});

test('o jogo dos marcos aparece no HTML, com a barra do próximo marco', () => {
  const comJogo = montar({
    jogo: {
      proximoMarco: 25000,
      falta: 4262.49,
      percentual: 0.83,
      meses: 2,
      premio: { valor: 5000, item: { nome: 'Exemplo de prêmio' } },
      juros: { fracao: 0.3 },
      semHistorico: true,
    },
  });

  assert.match(comJogo, /Faltam R\$ 4,3 mil para o marco de R\$ 25 mil/);
  assert.match(comJogo, /class="jogo-barra"><div style="width:83\.0%"/);
  assert.match(comJogo, /R\$ 25 mil<\/span> · faltam R\$ 4\.262,49 · ~2 meses no ritmo atual/);
  assert.match(comJogo, /Prêmio: até R\$ 5\.000,00 → <span class="forte">Exemplo de prêmio<\/span> · nesse trecho, ~30% virá dos juros/);
  assert.match(comJogo, /Primeiro domingo do histórico/);
  // O cartão do jogo vem entre a semana e o patrimônio.
  assert.match(comJogo, /class="jogo-barra"[\s\S]*Total<\/td>/);

  const semJogo = montar();
  assert.ok(!semJogo.includes('para o marco de'), 'sem jogo, o cartão não aparece');
});

