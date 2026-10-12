import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acumuladoDesde,
  acumular,
  anualizarDiaria,
  caminhoSparkline,
  dataBrParaIso,
  deslocarMeses,
  faixaIR,
  filtrarDesde,
  formatarNumero,
  formatarPercentual,
  hojeEmBrasilia,
  juroReal,
  juroRealMensal,
  mesclarComAnterior,
  montarIndicadores,
  mudancas,
  paraNumero,
  paraSerie,
  podeMostrarDetalhe,
  simulacao,
  urlSgs,
  valorAntes,
} from '../indicadores.js';

test('urlSgs monta o endereço do Banco Central', () => {
  assert.equal(
    urlSgs(432, '01/01/2026'),
    'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=01%2F01%2F2026',
  );
});

test('podeMostrarDetalhe esconde o detalhe no GitHub Actions', () => {
  assert.equal(podeMostrarDetalhe({}), true);
  assert.equal(podeMostrarDetalhe({ GITHUB_ACTIONS: 'false' }), true);
  assert.equal(podeMostrarDetalhe({ GITHUB_ACTIONS: 'true' }), false);
});

test('hojeEmBrasilia usa o dia de Brasília, não o UTC', () => {
  // 23h30 do dia 11 em Brasília já é dia 12 em UTC — o dia tem que continuar sendo 11.
  assert.equal(hojeEmBrasilia(new Date('2026-10-12T02:30:00Z')), '2026-10-11');
  assert.equal(hojeEmBrasilia(new Date('2026-10-11T15:00:00Z')), '2026-10-11');
  assert.equal(hojeEmBrasilia(new Date('2026-10-12T04:00:00Z')), '2026-10-12');
});

test('converte as respostas do Banco Central', () => {
  assert.equal(dataBrParaIso('09/10/2026'), '2026-10-09');
  assert.equal(paraNumero('0.050788'), 0.050788);
  assert.equal(paraNumero('-0,32'), -0.32);
  assert.deepEqual(paraSerie([{ data: '01/09/2026', valor: '0.82' }]), [
    { data: '2026-09-01', valor: 0.82 },
  ]);
  assert.deepEqual(paraSerie(null), []);
});

test('deslocarMeses respeita o fim do mês', () => {
  assert.equal(deslocarMeses('2026-10-09', -12), '2025-10-09');
  assert.equal(deslocarMeses('2026-03-31', -1), '2026-02-28');
  assert.equal(deslocarMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(deslocarMeses('2024-02-29', 12), '2025-02-28');
});

test('valorAntes pega o ponto mais recente dentro do limite', () => {
  const serie = [
    { data: '2025-01-01', valor: 10 },
    { data: '2025-06-01', valor: 12 },
    { data: '2026-01-01', valor: 14 },
  ];
  assert.equal(valorAntes(serie, '2025-12-31').valor, 12);
  assert.equal(valorAntes(serie, '2024-12-31'), null);
  assert.equal(valorAntes(serie, '2030-01-01').valor, 14);
});

test('mudancas mantém só as viradas de valor', () => {
  const serie = [
    { data: '2026-01-01', valor: 15 },
    { data: '2026-01-02', valor: 15 },
    { data: '2026-03-18', valor: 14.75 },
    { data: '2026-03-19', valor: 14.75 },
  ];
  assert.deepEqual(mudancas(serie), [serie[0], serie[2]]);
  assert.deepEqual(mudancas([]), []);
});

test('juros compostos de uma série', () => {
  assert.ok(Math.abs(acumular([{ valor: 1 }, { valor: 1 }]) - 0.0201) < 1e-12);
  assert.equal(acumular([]), 0);
});

test('anualiza a taxa diária', () => {
  // 0,050788% ao dia é a Selic de 13,75% ao ano.
  assert.ok(Math.abs(anualizarDiaria(0.050788) - 0.1365) < 0.002);
  assert.ok(Math.abs(anualizarDiaria(0.05) - 0.1342) < 0.002);
});

test('juro real desconta a inflação', () => {
  assert.ok(Math.abs(juroReal(0.1375, 0.0458) - 0.08767) < 0.0001);
  assert.ok(Math.abs(juroReal(0.05, 0.05)) < 1e-12);
});

test('juro real mensal: CDI de 12 meses contra IPCA de 12 meses', () => {
  // 13 meses de IPCA a 0,5% e 21 dias úteis de CDI a 0,05% por mês, para conferir a janela.
  const ipcaMensal = Array.from({ length: 13 }, (_, i) => ({
    data: `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`,
    valor: 0.5,
  }));
  const cdiDiaria = ipcaMensal.flatMap((ponto) =>
    Array.from({ length: 21 }, () => ({ data: ponto.data, valor: 0.05 })),
  );
  const serie = juroRealMensal(cdiDiaria, ipcaMensal);
  // 13 meses de IPCA dão 2 janelas de 12 meses.
  assert.equal(serie.length, 2);
  assert.equal(serie.at(-1).data, '2026-01-01');
  assert.ok(Math.abs(serie.at(-1).valor - (1.0005 ** (21 * 12) / 1.005 ** 12 - 1) * 100) < 1e-9);
});

test('tabela regressiva do imposto de renda', () => {
  assert.equal(faixaIR(180).aliquota, 0.225);
  assert.equal(faixaIR(181).aliquota, 0.2);
  assert.equal(faixaIR(360).aliquota, 0.2);
  assert.equal(faixaIR(365).aliquota, 0.175);
  assert.equal(faixaIR(721).aliquota, 0.15);
  assert.equal(faixaIR(3650).aliquota, 0.15);
});

test('simulação de aporte no CDI por 12 meses', () => {
  const r = simulacao({ valor: 1000, cdi: 0.1365, ipca: 0.0458, meses: 12 });
  assert.ok(Math.abs(r.bruto - 136.5) < 0.001);
  assert.equal(r.aliquota, 0.175);
  assert.equal(r.rotuloAliquota, '361 a 720 dias');
  assert.ok(Math.abs(r.imposto - 23.8875) < 0.001);
  assert.ok(Math.abs(r.liquido - 112.6125) < 0.001);
  assert.ok(Math.abs(r.inflacao - 45.8) < 0.001);
  // (1000 + 112,6125) descontado pela inflação de 4,58% = 1.063,89
  assert.ok(Math.abs(r.ganhoReal - 63.8865) < 0.001);
});

test('simulação muda a alíquota conforme o prazo', () => {
  assert.equal(simulacao({ valor: 1000, cdi: 0.13, ipca: 0.04, meses: 6 }).aliquota, 0.2);
  assert.equal(simulacao({ valor: 1000, cdi: 0.13, ipca: 0.04, meses: 24 }).aliquota, 0.15);
});

test('minigráfico vira caminho SVG', () => {
  const serie = [1, 2, 3].map((valor, i) => ({ data: `2026-01-0${i + 1}`, valor }));
  const caminho = caminhoSparkline(serie);
  assert.ok(caminho.startsWith('M'));
  assert.equal(caminho.split('L').length - 1, 2);
  assert.equal(caminhoSparkline([serie[0]]), '');
  // Série reta não pode dividir por zero.
  assert.equal(caminhoSparkline([{ valor: 5 }, { valor: 5 }]).includes('NaN'), false);
});

test('formatação em português', () => {
  assert.equal(formatarNumero(13.75), '13,75');
  assert.equal(formatarNumero(1234.5, 2), '1.234,50');
  assert.equal(formatarPercentual(0.1365), '13,65%');
  assert.equal(formatarPercentual(-0.0052, 2), '-0,52%');
  assert.equal(formatarNumero(null), '–');
  assert.equal(formatarPercentual(undefined), '–');
});

test('filtrarDesde recorta a janela', () => {
  const serie = [{ data: '2025-01-01' }, { data: '2026-01-01' }];
  assert.deepEqual(filtrarDesde(serie, '2025-06-01'), [{ data: '2026-01-01' }]);
});

test('acumuladoDesde compõe a série a partir de uma data', () => {
  const serie = [
    { data: '2025-01-01', valor: 10 },
    { data: '2026-01-01', valor: 10 },
    { data: '2026-06-01', valor: 10 },
  ];
  assert.ok(Math.abs(acumuladoDesde(serie, '2025-01-01') - 0.331) < 1e-9);
  assert.ok(Math.abs(acumuladoDesde(serie, '2026-01-01') - 0.21) < 1e-9);
  assert.equal(acumuladoDesde(serie, '2027-01-01'), 0);
});

const BRUTO = {
  metaSelic: [
    { data: '2025-11-04', valor: 15 },
    { data: '2026-11-04', valor: 13.75 },
  ],
  cdiDiaria: Array.from({ length: 260 }, (_, i) => ({
    data: `2025-0${(i % 9) + 1}-01`,
    valor: 0.05,
  })),
  ipcaMensal: Array.from({ length: 12 }, (_, i) => ({ data: `2025-${i + 1}-01`, valor: 0.4 })),
  dolar: [
    { data: '2026-10-08', valor: 5.0119 },
    { data: '2026-10-09', valor: 4.9892 },
  ],
  dolarAgora: { bid: '4.9918', pctChange: '-0.520138', create_date: '2026-10-09 19:30:05' },
};

test('monta os cartões do painel', () => {
  const painel = montarIndicadores(BRUTO, { hoje: '2026-11-10', atualizadoEm: '2026-11-10T12:00:00.000Z' });
  assert.equal(painel.atualizadoEm, '2026-11-10T12:00:00.000Z');
  assert.deepEqual(
    painel.indicadores.map((c) => c.id),
    ['meta-selic', 'cdi', 'ipca', 'juro-real', 'dolar'],
  );

  const [meta, cdi, ipca, juroReal, dolar] = painel.indicadores;
  assert.equal(meta.valor, 13.75);
  assert.equal(meta.variacao, -1.25); // caiu de 15% para 13,75%
  assert.equal(meta.referencia, '2026-11-04');
  assert.equal(meta.rotuloReferencia, 'em vigor desde');
  assert.equal(meta.serie.length, 2);
  assert.ok(meta.sobre.length > 20);

  assert.ok(Math.abs(cdi.valor - 13.42) < 0.2);
  assert.ok(cdi.extra.percentual > 0.13);

  assert.ok(Math.abs(ipca.valor - 4.907) < 0.01);
  assert.ok(Math.abs(ipca.extra.percentual - 0.004) < 1e-12);

  // CDI de 12 meses (13,88%) contra o IPCA de 12 meses (4,9067%)
  assert.ok(Math.abs(juroReal.valor - 8.55) < 0.01);
  assert.equal(juroReal.unidade, '% nos últimos 12 meses');

  assert.equal(dolar.valor, 4.9918);
  assert.ok(Math.abs(dolar.variacao + 0.00520138) < 1e-9);
  assert.equal(dolar.referencia, '2026-10-09');
  assert.equal(dolar.serie.length, 2);
});

test('meta Selic ignora os pontos com data futura', () => {
  // A série real vem com pontos repetidos até a próxima reunião do Copom — inclusive com data no futuro.
  const bruto = {
    metaSelic: [
      { data: '2026-09-20', valor: 14 },
      { data: '2026-10-03', valor: 13.75 },
      { data: '2026-10-11', valor: 13.75 },
      { data: '2026-10-25', valor: 13.75 },
      { data: '2026-11-04', valor: 13.75 },
    ],
  };
  const painel = montarIndicadores(bruto, { hoje: '2026-10-11', atualizadoEm: '2026-10-11T12:00:00.000Z' });
  const meta = painel.indicadores.find((c) => c.id === 'meta-selic');
  assert.equal(meta.valor, 13.75);
  // "em vigor desde" é a data da última mudança, não a última data (futura) da série.
  assert.equal(meta.referencia, '2026-10-03');
  assert.equal(meta.rotuloReferencia, 'em vigor desde');
  assert.deepEqual(meta.serie.map((p) => p.data), ['2026-09-20', '2026-10-03']);
});

test('sem rede o painel não quebra: valores nulos', () => {
  const painel = montarIndicadores({}, { atualizadoEm: '2026-11-10T12:00:00.000Z' });
  for (const cartao of painel.indicadores) {
    assert.equal(cartao.valor, null);
    assert.equal(cartao.extra, null);
    assert.deepEqual(cartao.serie, []);
  }
  assert.equal(formatarNumero(painel.indicadores[0].valor), '–');
});

test('dólar sem API ao vivo usa a série do Banco Central', () => {
  const painel = montarIndicadores({ dolar: BRUTO.dolar });
  const dolar = painel.indicadores.find((c) => c.id === 'dolar');
  assert.equal(dolar.valor, 4.9892);
  assert.match(dolar.fonte, /BACEN/);
  assert.ok(Math.abs(dolar.variacao + 0.0045292) < 1e-5);
});

test('IPCA em 12 meses exige 12 meses de dados', () => {
  const painel = montarIndicadores({ ipcaMensal: BRUTO.ipcaMensal.slice(0, 11) });
  const ipca = painel.indicadores.find((c) => c.id === 'ipca');
  assert.equal(ipca.valor, null);
  assert.equal(ipca.extra.percentual, 0.004);
});

test('série vazia derruba só o cartão dela', () => {
  const painel = montarIndicadores({ metaSelic: [], cdiDiaria: BRUTO.cdiDiaria });
  const valor = (id) => painel.indicadores.find((c) => c.id === id).valor;
  assert.equal(valor('meta-selic'), null);
  assert.ok(valor('cdi') > 0);
});

test('mesclarComAnterior devolve o cartão anterior quando o novo vem vazio', () => {
  const anterior = {
    atualizadoEm: '2026-10-11T05:00:00.000Z',
    indicadores: [
      { id: 'meta-selic', nome: 'Meta Selic', valor: 13.75 },
      { id: 'dolar', nome: 'Dólar', valor: 4.98 },
    ],
  };
  const novo = {
    atualizadoEm: '2026-10-12T05:00:00.000Z',
    indicadores: [
      { id: 'meta-selic', nome: 'Meta Selic', valor: null },
      { id: 'dolar', nome: 'Dólar', valor: 5.1 },
    ],
  };
  const { painel, mantidos } = mesclarComAnterior(novo, anterior);
  assert.deepEqual(mantidos, ['Meta Selic']);
  assert.equal(painel.indicadores[0].valor, 13.75);
  assert.equal(painel.indicadores[1].valor, 5.1);
  assert.equal(painel.atualizadoEm, '2026-10-12T05:00:00.000Z');
});

test('mesclarComAnterior sem anterior não inventa valor', () => {
  const novo = { indicadores: [{ id: 'cdi', nome: 'CDI', valor: null }] };
  const { painel, mantidos } = mesclarComAnterior(novo, null);
  assert.deepEqual(mantidos, []);
  assert.equal(painel.indicadores[0].valor, null);
});
