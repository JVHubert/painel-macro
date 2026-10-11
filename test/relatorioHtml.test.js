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
    { ticker: 'RENT3', quantidade: 1, precoMedio: 51.19, dataCompra: '2021-12-02' },
    { preco: 54.51, variacaoDia: 0.0419, variacaoSemana: 0.3141 },
    { cdiNoPeriodo: 0.7982 },
  ),
  resumoPosicao(
    { ticker: 'RENT3', quantidade: 6, precoMedio: 49.1, dataCompra: '2022-01-11' },
    { preco: 54.51, variacaoDia: 0.0419, variacaoSemana: 0.3141 },
    { cdiNoPeriodo: 0.7813 },
  ),
];

const RESERVA = {
  alvoMeses: 6,
  detalhe: [
    { nome: 'Conta corrente', saldo: 1960.7 },
    {
      nome: 'Caixinha Turbo',
      saldo: 12346.42,
      rendimento: 1740.14,
      dataAporte: '2025-06-29',
      medido: { dias: 469, total: 0.1641, taxaAnual: 0.1255, percentualDoCdi: 0.86 },
    },
    { nome: 'Cofrinho MP', saldo: 7534.53, taxaCDI: 1.2 },
  ],
};

const montar = (extra = {}) =>
  montarHtml({
    data: '2026-10-11',
    painel: PAINEL,
    posicoes: POSICOES,
    reserva: RESERVA,
    receitaMensal: 5000,
    custoMensal: 2350,
    aporteMensal: 2000,
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
  assert.match(html, /class="dir bom">6,49%/);
  assert.match(html, /class="dir bom">10,35%/);
  assert.match(html, /class="dir muito-ruim">−73,3 p\.p\./);
  assert.match(html, /class="dir ruim">86%/); // abaixo do CDI: mostarda, não vermelho
  assert.match(html, /class="dir muito-bom">9,3 meses/);
  assert.ok(!html.includes('🟢') && !html.includes('🔴'));
  assert.match(html, /■ \+20% ou mais/);
  // Nunca dois atributos class no mesmo elemento.
  assert.ok(!/class="[^"]*"\s+class=/.test(html));
});

test('números do relatório aparecem formatados', () => {
  const html = montar();
  assert.match(html, /R\$ 345,79/);
  assert.match(html, /R\$ 381,57/);
  assert.match(html, /R\$ 616,82/);
  assert.match(html, /−73,3 p\.p\./);
  assert.match(html, /R\$ 21\.841,65/);
  assert.match(html, /9,3 meses de custo \(meta 6\)/);
  assert.match(html, /R\$ 2\.650,00/);
  assert.ok(!html.includes('NaN') && !html.includes('undefined'));
});

test('sem dado o html não quebra e vira pendência', () => {
  const html = montar({
    posicoes: [resumoPosicao({ ticker: 'RENT3', quantidade: 7, precoMedio: null }, { preco: 54.51 })],
    reserva: {},
  });
  assert.match(html, /sem dado para calcular/);
  assert.match(html, /preencha o precoMedio de RENT3/);
  assert.ok(!html.includes('NaN') && !html.includes('undefined'));
});
