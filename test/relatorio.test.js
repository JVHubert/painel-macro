import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIVEIS, compararComCdi, legendaNiveis, nivelDeResultado, taxaEquivalente } from '../indicadores.js';
import {
  PERGUNTAS,
  deltaPeriodo,
  deslocarDias,
  montarRelatorio,
  nivelDaReserva,
  numeroDaSemana,
  perguntaDaSemana,
  resumoMacro,
  resumoPosicao,
  resumoReserva,
  variacaoPeriodo,
} from '../relatorio.js';

const PAINEL = {
  atualizadoEm: '2026-10-11T04:00:00.000Z',
  indicadores: [
    {
      id: 'meta-selic',
      valor: 13.75,
      unidade: '% ao ano',
      serie: [
        { data: '2026-09-20', valor: 14 },
        { data: '2026-09-30', valor: 14 },
        { data: '2026-10-03', valor: 13.75 },
        { data: '2026-10-04', valor: 13.75 },
      ],
    },
    {
      id: 'cdi',
      valor: 13.65,
      unidade: '% ao ano',
      extra: { rotulo: 'acumulado em 12 meses', percentual: 0.1451 },
      serie: [
        { data: '2026-10-01', valor: 0.05166 },
        { data: '2026-10-08', valor: 0.05166 },
      ],
    },
    { id: 'ipca', valor: 4.58, unidade: '% acumulado', extra: null, serie: [] },
    { id: 'juro-real', valor: 8.77, unidade: '% ao ano', extra: null, serie: [] },
    {
      id: 'dolar',
      valor: 4.9918,
      unidade: '',
      serie: [
        { data: '2026-10-01', valor: 5.0119 },
        { data: '2026-10-03', valor: 5.0119 },
        { data: '2026-10-09', valor: 4.9892 },
      ],
    },
  ],
};

test('deslocarDias anda em dias corridos', () => {
  assert.equal(deslocarDias('2026-10-11', -7), '2026-10-04');
  assert.equal(deslocarDias('2026-10-11', 0), '2026-10-11');
  assert.equal(deslocarDias('2026-03-01', -1), '2026-02-28');
});

test('numeroDaSemana segue o calendário ISO', () => {
  assert.equal(numeroDaSemana('2026-10-11'), 41);
  assert.equal(numeroDaSemana('2026-01-01'), 1);
  assert.equal(numeroDaSemana('2025-12-29'), 1);
  assert.equal(numeroDaSemana('2026-12-31'), 53);
});

test('a pergunta da semana gira e é estável dentro da semana', () => {
  assert.equal(perguntaDaSemana('2026-10-11'), perguntaDaSemana('2026-10-10'));
  assert.equal(perguntaDaSemana('2026-10-11'), PERGUNTAS[40 % PERGUNTAS.length]);
  assert.notEqual(perguntaDaSemana('2026-10-11'), perguntaDaSemana('2026-10-18'));
  assert.equal(PERGUNTAS.length, 12);
});

test('variação de período usa o ponto mais recente até a data limite', () => {
  const serie = [
    { data: '2026-10-01', valor: 100 },
    { data: '2026-10-04', valor: 110 },
    { data: '2026-10-11', valor: 121 },
  ];
  assert.ok(Math.abs(variacaoPeriodo(serie, 7) - 0.1) < 1e-12);
  assert.ok(Math.abs(deltaPeriodo(serie, 7) - 11) < 1e-12);
  assert.equal(variacaoPeriodo(serie, 60), null);
  assert.equal(variacaoPeriodo([], 7), null);
});

test('macro do relatório sai legível', () => {
  const linhas = resumoMacro(PAINEL);
  const texto = linhas.join('\n');
  assert.equal(linhas.length, 5);
  assert.match(texto, /Meta Selic: 13,75% ao ano \(▼ 0,25 p\.p\. na semana\)/);
  assert.match(texto, /CDI: 13,65% ao ano/);
  assert.match(texto, /14,51% em 12 meses/);
  assert.match(texto, /IPCA em 12 meses: 4,58%/);
  assert.match(texto, /Juro real: 8,77% ao ano/);
  assert.match(texto, /Dólar: R\$ 4,9918 ⚪ \(▼ 0,45% na semana\)/);
  assert.ok(!texto.includes('undefined') && !texto.includes('NaN'));
});

test('macro sem dado não quebra', () => {
  const texto = resumoMacro({}, {}).join('\n');
  assert.equal(texto.split('sem dado').length - 1, 5);
  assert.ok(!texto.includes('NaN'));
});

test('posição calcula resultado e comparação com o CDI', () => {
  const posicao = resumoPosicao(
    { ticker: 'RENT3', quantidade: 7, precoMedio: 40 },
    { preco: 54.51, variacaoDia: 0.0113, variacaoSemana: 0.0761 },
    { cdiNoPeriodo: 0.1 },
  );
  assert.equal(posicao.investido, 280);
  assert.ok(Math.abs(posicao.mercado - 381.57) < 1e-9);
  assert.ok(Math.abs(posicao.resultado - 101.57) < 1e-9);
  assert.ok(Math.abs(posicao.rentabilidade - 0.3627) < 0.001);
  assert.ok(Math.abs(posicao.vsCdi - 0.2627) < 0.001);
});

test('posição sem preço médio avisa em vez de inventar número', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    macro: resumoMacro(PAINEL),
    posicoes: [
      resumoPosicao(
        { ticker: 'RENT3', quantidade: 7, precoMedio: null, dataCompra: null },
        { preco: 54.51, variacaoDia: 0.0113, variacaoSemana: 0.0761 },
      ),
    ],
    reserva: { atual: 0, custoMensal: 2500 },
    aporteMensal: 500,
  });
  assert.match(texto, /RENT3 · 7 cotas × R\$ 54,51 = R\$ 381,57/);
  assert.match(texto, /🟢 no dia 1,13% · na semana 7,61%/);
  assert.match(texto, /preencha precoMedio/);
  assert.ok(!texto.includes('NaN'));
});

test('reserva calcula meses cobertos e o que falta', () => {
  const vazia = resumoReserva({ atual: 2500 }, { custoMensal: 2500 }).join('\n');
  assert.match(vazia, /R\$ 2\.500,00 — 1,0 mês coberto \(meta: 6\) 🟡/);
  assert.match(vazia, /faltam R\$ 12\.500,00/);

  const cheia = resumoReserva({ atual: 36000 }, { custoMensal: 2350 }).join('\n');
  assert.match(cheia, /15,3 meses cobertos/);
  assert.match(cheia, /meta batida/);
  assert.match(cheia, /🔵/);

  const naMeta = resumoReserva({ atual: 14100 }, { custoMensal: 2350 }).join('\n');
  assert.match(naMeta, /6,0 meses cobertos/);
  assert.match(naMeta, /🟢/);

  assert.equal(resumoReserva({}, {}).join('\n'), '• preencha custoMensal em carteira.json');
});

test('reserva com detalhe soma os saldos e mede a taxa de cada item', () => {
  const reserva = {
    detalhe: [
      { nome: 'Conta corrente', saldo: 1000 },
      {
        nome: 'Caixinha X',
        saldo: 1100,
        rendimento: 100,
        dataAporte: '2026-01-01',
        taxaCDI: 1.1,
        medido: { dias: 283, total: 0.1, taxaAnual: 0.132, percentualDoCdi: 1.12 },
      },
      {
        nome: 'Cofrinho Y',
        saldo: 500,
        dataAporte: '2026-02-01',
        taxaCDI: 1.4,
        medido: { dias: 252, total: 0.05, taxaAnual: 0.073, percentualDoCdi: 0.62 },
      },
      { nome: 'Cofrinho Z', saldo: 300, taxaCDI: 1.2 },
    ],
  };
  const texto = resumoReserva(reserva, { custoMensal: 2350 }).join('\n');
  assert.match(texto, /R\$ 2\.900,00 — 1,2 meses cobertos/);
  assert.match(texto, /Caixinha X: R\$ 1\.100,00 · rendeu R\$ 100,00 · ≈ 13,20% ao ano desde 01\/01\/2026 \(283 dias\) · 112% do CDI · ✅ dentro do prometido/);
  assert.match(texto, /Cofrinho Y: R\$ 500,00 · ≈ 7,30% ao ano desde 01\/02\/2026 \(252 dias\) · 62% do CDI · ⚠️ prometido era 140%/);
  assert.match(texto, /Cofrinho Z: R\$ 300,00 · prometido 120% do CDI/);
  assert.match(texto, /vale se não houve aporte novo/);
});

test('relatório completo monta todos os blocos', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    macro: resumoMacro(PAINEL),
    posicoes: [
      resumoPosicao(
        { ticker: 'RENT3', quantidade: 7, precoMedio: 40, dataCompra: '2026-01-01' },
        { preco: 54.51, variacaoDia: 0.0113, variacaoSemana: 0.0761 },
        { cdiNoPeriodo: 0.1 },
      ),
    ],
    reserva: { atual: 3000 },
    receitaMensal: 5000,
    custoMensal: 2350,
    aporteMensal: 500,
    avisos: ['⚠️ teste de aviso'],
  });
  assert.match(texto, /📊 Relatório semanal — 11\/10\/2026/);
  const blocos = [
    'MACRO',
    'CARTEIRA',
    'RESERVA',
    'SOBRA DO MÊS',
    'APORTE',
    'PERGUNTA DA SEMANA (semana 41)',
    'LEGENDA:',
    'teste de aviso',
  ];
  for (const bloco of blocos) {
    assert.ok(texto.includes(bloco), `faltou o bloco ${bloco}`);
  }
  assert.match(texto, /CDI no mesmo período 10,00% \(26,3 p\.p\. acima\)/);
  assert.match(texto, /R\$ 5\.000,00 de receita − R\$ 2\.350,00 de custo = R\$ 2\.650,00 livres/);
  assert.match(texto, /programado: R\$ 500,00 por mês/);
  assert.match(texto, /🔵 \+20% ou mais/);
});

test('faixas de cor por resultado', () => {
  assert.equal(nivelDeResultado(0.25).nome, 'muito bom');
  assert.equal(nivelDeResultado(0.2).nome, 'muito bom');
  assert.equal(nivelDeResultado(0.199).nome, 'bom');
  assert.equal(nivelDeResultado(0.02).nome, 'bom');
  assert.equal(nivelDeResultado(0).nome, 'neutro');
  assert.equal(nivelDeResultado(-0.01).nome, 'neutro');
  assert.equal(nivelDeResultado(-0.02).nome, 'ruim');
  assert.equal(nivelDeResultado(-0.199).nome, 'ruim');
  assert.equal(nivelDeResultado(-0.2).nome, 'muito ruim');
  assert.equal(nivelDeResultado(-0.5).nome, 'muito ruim');
  assert.equal(nivelDeResultado(null), null);
  assert.equal(nivelDeResultado(undefined), null);
  assert.equal(nivelDeResultado(Number.NaN), null);
  assert.deepEqual(
    NIVEIS.map((nivel) => nivel.classe),
    ['muito-bom', 'bom', 'neutro', 'ruim', 'muito-ruim'],
  );
});

test('legenda de cores acompanha as faixas', () => {
  assert.match(legendaNiveis(), /🔵 \+20% ou mais/);
  assert.match(legendaNiveis(), /🟢 positivo/);
  assert.match(legendaNiveis(), /⚪ perto de zero \(±1%\)/);
  assert.match(legendaNiveis(), /🟡 negativo/);
  assert.match(legendaNiveis(), /🔴 −20% ou menos/);
});

test('cor da reserva é o progresso até a meta, não rentabilidade', () => {
  assert.equal(nivelDaReserva(14.7, 6).nome, 'muito bom'); // bem acima
  assert.equal(nivelDaReserva(9, 6).nome, 'muito bom');
  assert.equal(nivelDaReserva(6, 6).nome, 'bom'); // meta batida
  assert.equal(nivelDaReserva(5.9, 6).nome, 'ruim'); // em construção
  assert.equal(nivelDaReserva(0.1, 6).nome, 'ruim');
  assert.equal(nivelDaReserva(0, 6).nome, 'muito ruim'); // nada guardado
});

test('taxa equivalente a partir da data do aporte', () => {
  const umAno = taxaEquivalente({ saldo: 1100, rendimento: 100, dataAporte: '2025-01-01' }, '2026-01-01');
  assert.equal(umAno.dias, 365);
  assert.ok(Math.abs(umAno.total - 0.1) < 1e-12);
  assert.ok(Math.abs(umAno.taxaAnual - 0.1) < 1e-12);

  const meioAno = taxaEquivalente({ saldo: 1100, rendimento: 100, dataAporte: '2026-01-01' }, '2026-07-02');
  assert.ok(meioAno.taxaAnual > 0.2, 'meio ano rendendo 10% equivale a mais de 20% ao ano');

  assert.equal(taxaEquivalente({ saldo: 1000, rendimento: 0 }, '2026-07-02'), null);
  assert.equal(taxaEquivalente({ saldo: 100, rendimento: 100, dataAporte: '2026-01-01' }, '2026-07-02'), null);
  assert.equal(taxaEquivalente({ saldo: 1000, rendimento: 10, dataAporte: '2026-12-01' }, '2026-01-01'), null);
});

test('comparação com o CDI no mesmo período', () => {
  assert.ok(Math.abs(compararComCdi(0.12, 0.1) - 1.2) < 1e-12);
  assert.equal(compararComCdi(null, 0.1), null);
  assert.equal(compararComCdi(0.12, 0), null);
});

test('dois lotes do mesmo papel ganham linha de total, inclusive contra o CDI', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    macro: resumoMacro(PAINEL),
    posicoes: [
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
    ],
    reserva: { atual: 0 },
  });
  assert.match(texto, /= RENT3 no total: 7 cotas · investido R\$ 345,79 · hoje R\$ 381,57/);
  assert.match(texto, /🟢 10,35%/);
  // 51,19×1,7982 + 294,60×1,7813 = 616,82 → 381,57/616,82 - 1
  assert.match(texto, /no CDI seria R\$ 616,82 \(-38,14%\)/);
  assert.match(texto, /🔴 CDI no mesmo período 79,82% \(73,3 p\.p\. abaixo\)/);
});

test('relatório sem posições diz que a carteira está vazia', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    macro: resumoMacro(PAINEL),
    posicoes: [],
    reserva: {},
  });
  assert.match(texto, /nenhuma posição em carteira\.json/);
  assert.ok(!texto.includes('APORTE'));
});
