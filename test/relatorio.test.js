import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIVEIS, anualizarDiaria, compararComCdi, legendaNiveis, nivelDeResultado, taxaEquivalente } from '../indicadores.js';
import {
  PERGUNTAS,
  deltaPeriodo,
  deslocarDias,
  encurtar,
  montarRelatorio,
  nivelDaReserva,
  nivelDoCdi,
  numeroDaSemana,
  perguntaDaSemana,
  resumoMacro,
  resumoPosicao,
  resumoReserva,
  tabela,
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
  assert.ok(Math.abs(deltaPeriodo(serie, 7, { hoje: '2026-10-11' }) - 11) < 1e-12);
  assert.equal(variacaoPeriodo(serie, 60), null);
  assert.equal(variacaoPeriodo([], 7), null);
});

test('deltaPeriodo olha a janela de hoje, não a última mudança', () => {
  // Selic parada desde 17/09: numa semana sem Copom, a variação da semana é zero.
  const meta = [
    { data: '2026-06-18', valor: 14.25 },
    { data: '2026-09-17', valor: 13.75 },
    { data: '2026-10-10', valor: 13.75 },
  ];
  assert.equal(deltaPeriodo(meta, 7, { hoje: '2026-10-11' }), 0);

  // CDI ao dia: 0,05% virou 0,06%. Ao ano isso é uma diferença grande, não 0,01.
  const cdi = [
    { data: '2026-09-30', valor: 0.05 },
    { data: '2026-10-08', valor: 0.06 },
  ];
  const delta = deltaPeriodo(cdi, 7, { hoje: '2026-10-11', transformar: (taxa) => anualizarDiaria(taxa) * 100 });
  assert.ok(Math.abs(delta - (anualizarDiaria(0.06) - anualizarDiaria(0.05)) * 100) < 1e-9);
  assert.ok(delta > 2, 'a diferença anualizada passa de 2 p.p.');

  // Sem `hoje` não há janela: devolve null em vez de chutar.
  assert.equal(deltaPeriodo(meta, 7), null);
});

test('tabela alinha as colunas', () => {
  const linhas = tabela(
    [
      ['Onde', 'Saldo'],
      ['Curto', '1,00'],
      ['Nome bem mais longo', '12.345,00'],
    ],
    { colunas: ['esq', 'dir'] },
  ).split('\n');

  assert.equal(linhas.length, 3);
  // Toda coluna começa na mesma posição em todas as linhas.
  assert.equal(linhas[0].indexOf('Saldo'), linhas[1].indexOf('1,00'));
  assert.equal(linhas[0].indexOf('Saldo'), linhas[2].indexOf('12.345,00'));
  assert.ok(linhas[0].startsWith('Onde '));
  assert.equal(linhas[2], 'Nome bem mais longo  12.345,00');
  // Sem espaço sobrando no fim da linha.
  for (const linha of linhas) assert.equal(linha, linha.replace(/ +$/, ''));
});

test('emoji no fim da linha não desalinha a esquerda', () => {
  const saida = tabela([
    ['Norte', '-73,3 p.p. 🔴'],
    ['Nordeste', '-67,1 p.p. 🔴'],
  ]);
  const [primeira, segunda] = saida.split('\n');
  assert.equal(primeira.indexOf('-73'), segunda.indexOf('-67'));
  assert.ok(primeira.startsWith('Norte   '));
});

test('encurtar corta nome comprido', () => {
  assert.equal(encurtar('Curto', 10), 'Curto');
  assert.equal(encurtar('Nome realmente comprido', 10), 'Nome real…');
  assert.equal(encurtar('Caixinha X', 20), 'Caixinha X');
});

test('macro sai em tabela alinhada', () => {
  const bloco = resumoMacro(PAINEL);
  const linhas = bloco.split('\n');

  assert.equal(linhas[0], 'MACRO');
  assert.equal(linhas[1], `Indicador${' '.repeat(7)}Valor  Semana`);
  assert.match(bloco, /Meta Selic\s+13,75%\s+=0,00 p\.p\./);
  assert.match(bloco, /CDI\s+13,65%\s+=0,00 p\.p\./);
  assert.match(bloco, /IPCA \(12m\)\s+4,58%/);
  assert.match(bloco, /Juro real\s+8,77%/);
  assert.match(bloco, /Dólar\s+R\$ 4,9918\s+-0,45%\n/); // sem emoji: câmbio não tem cor
  assert.match(bloco, /CDI acumulado em 12 meses: 14,51%/);
  assert.ok(!bloco.includes('NaN') && !bloco.includes('undefined'));
});

test('macro sem dado não quebra', () => {
  const bloco = resumoMacro({}, {});
  assert.equal(bloco.split('–').length - 1, 5);
  assert.ok(!bloco.includes('NaN') && !bloco.includes('undefined'));
});

test('posição calcula resultado e comparação com o CDI', () => {
  const posicao = resumoPosicao(
    { ticker: 'RENT3', quantidade: 10, precoMedio: 40 },
    { preco: 54.51, variacaoDia: 0.0113, variacaoSemana: 0.0761 },
    { cdiNoPeriodo: 0.1 },
  );
  assert.equal(posicao.investido, 400);
  assert.ok(Math.abs(posicao.mercado - 545.1) < 1e-9);
  assert.ok(Math.abs(posicao.resultado - 145.1) < 1e-9);
  assert.ok(Math.abs(posicao.rentabilidade - 0.3627) < 0.001);
  assert.equal(posicao.nivel.nome, 'muito bom');
  assert.ok(Math.abs(posicao.vsCdi - 0.2627) < 0.001);
});

test('posição sem preço médio vira pendência, não número inventado', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    macro: resumoMacro(PAINEL),
    posicoes: [
      resumoPosicao(
        { ticker: 'RENT3', quantidade: 10, precoMedio: null, dataCompra: null },
        { preco: 54.51, variacaoDia: 0.0113, variacaoSemana: 0.0761 },
      ),
    ],
    reserva: { atual: 0 },
  });
  assert.match(texto, /RENT3 \(10 cotas\)/);
  assert.match(texto, /R\$ 545,10/);
  assert.match(texto, /PENDÊNCIAS[\s\S]*preencha o precoMedio de RENT3/);
  assert.ok(!texto.includes('NaN'));
});

test('dois lotes do mesmo papel ganham soma e o CDI de cada data', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    macro: resumoMacro(PAINEL),
    posicoes: [
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
    ],
    reserva: { atual: 0 },
  });
  assert.match(texto, /soma\s+R\$ 700,00\s+R\$ 630,00\s+-10,00% 🟡/);
  assert.match(texto, /10 cotas\s+50,00%\s+-45,0 p\.p\. 🔴/);
  assert.match(texto, /20 cotas\s+10,00%\s+-26,0 p\.p\. 🔴/);
  // 200×1,50 + 500×1,10 = 850
  assert.match(texto, /Se o mesmo dinheiro tivesse ficado no CDI: R\$ 850,00 \(hoje: R\$ 630,00\)/);
  assert.ok(!/soma\s+R\$ 850,00/.test(texto), 'a tabela do CDI não mistura R$ com %');
  assert.match(texto, /só preço; não inclui dividendos nem imposto/);
  assert.match(texto, /na semana 5,00% 🟢/);
});

test('reserva calcula cobertura e usa a cor do progresso', () => {
  const vazia = resumoReserva({ atual: 2500 }, { custoMensal: 2500 }).texto;
  assert.match(vazia, /Saldo\s+R\$ 2\.500,00/);
  assert.match(vazia, /Cobertura\s+1,0 meses de custo \(meta 6\) 🟡/);

  const cheia = resumoReserva({ atual: 36000 }, { custoMensal: 4000 }).texto;
  assert.match(cheia, /9,0 meses de custo \(meta 6\) ⚪/);
  assert.match(
    cheia,
    /R\$ 12\.000,00 acima da meta de 6 meses — dinheiro que pode ir para prazo maior\. Registre a decisão no diário\./,
  );
  assert.ok(!vazia.includes('acima da meta'));

  const semDado = resumoReserva({}, {});
  assert.match(semDado.texto, /sem dado para calcular/);
  assert.equal(semDado.pendencias.size, 1);
});

test('reserva detalhada separa medido de prometido', () => {
  const { texto, pendencias } = resumoReserva(
    {
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
          medido: { dias: 252, total: 0.05, taxaAnual: 0.073, percentualDoCdi: 0.62 },
        },
        {
          nome: 'Cofrinho W',
          saldo: 200,
          dataAporte: '2026-02-01',
          medido: { dias: 252, total: 0.07, taxaAnual: 0.102, percentualDoCdi: 0.86 },
        },
        { nome: 'Cofrinho Z', saldo: 300, taxaCDI: 1.2 },
      ],
    },
    { custoMensal: 4000 },
  );

  assert.match(texto, /Saldo\s+R\$ 3\.100,00/);
  assert.match(texto, /Conta corrente\s+1\.000,00/);
  assert.match(texto, /Caixinha X\s+1\.100,00/);
  assert.match(texto, /Caixinha X\s+13,20%\s+112% 🟢/);
  assert.match(texto, /Cofrinho W\s+10,20%\s+86% 🟡/);
  assert.match(texto, /Cofrinho Y\s+7,30%\s+62% 🔴/);
  assert.match(texto, /Cofrinho Z\s+120% do CDI/);
  // Só quem tem taxa prometida e nenhuma data vira pendência.
  assert.deepEqual([...pendencias], ['informe dataAporte e rendimento de Cofrinho Z para eu medir']);
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
  assert.equal(nivelDeResultado(null), null);
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
  assert.equal(nivelDaReserva(14.7, 6).nome, 'neutro'); // muito acima da meta: decisão pendente, não conquista
  assert.equal(nivelDaReserva(9, 6).nome, 'neutro'); // 1,5× a meta já é excedente
  assert.equal(nivelDaReserva(8.9, 6).nome, 'bom');
  assert.equal(nivelDaReserva(6, 6).nome, 'bom');
  assert.equal(nivelDaReserva(5.9, 6).nome, 'ruim');
  assert.equal(nivelDaReserva(0.1, 6).nome, 'ruim');
  assert.equal(nivelDaReserva(0, 6).nome, 'muito ruim');
});

test('faixa do % do CDI compara com a promessa quando existe', () => {
  assert.equal(nivelDoCdi(1.22).nome, 'bom');
  assert.equal(nivelDoCdi(0.86).nome, 'ruim');
  assert.equal(nivelDoCdi(0.62).nome, 'muito ruim');
  assert.equal(nivelDoCdi(1.12, 1.1).nome, 'bom'); // entregou a promessa de 110%
  assert.equal(nivelDoCdi(0.86, 1.4).nome, 'ruim'); // prometeu 140% e não veio
  assert.equal(nivelDoCdi(null, 1.2), null);
});

test('taxa equivalente a partir da data do aporte', () => {
  const umAno = taxaEquivalente({ saldo: 1100, rendimento: 100, dataAporte: '2025-01-01' }, '2026-01-01');
  assert.equal(umAno.dias, 365);
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

test('relatório completo monta todos os blocos', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    macro: resumoMacro(PAINEL),
    posicoes: [
      resumoPosicao(
        { ticker: 'RENT3', quantidade: 10, precoMedio: 40, dataCompra: '2026-01-01' },
        { preco: 54.51, variacaoDia: 0.0113, variacaoSemana: 0.0761 },
        { cdiNoPeriodo: 0.1 },
      ),
    ],
    reserva: { atual: 3000 },
    receitaMensal: 7000,
    custoMensal: 4000,
    aporteMensal: 500,
    avisos: ['teste de aviso'],
  });

  assert.match(texto, /📊 Relatório semanal — 11\/10\/2026/);
  const blocos = [
    'MACRO',
    'CARTEIRA',
    'RESERVA',
    'SOBRA DO MÊS',
    'APORTE',
    'PERGUNTA DA SEMANA (41)',
    'LEGENDA:',
    'PENDÊNCIAS',
  ];
  for (const bloco of blocos) {
    assert.ok(texto.includes(bloco), `faltou o bloco ${bloco}`);
  }
  assert.match(texto, /Receita\s+R\$ 7\.000,00/);
  assert.match(texto, /Custo\s+-R\$ 4\.000,00/);
  assert.match(texto, /Livre\s+R\$ 3\.000,00/);
  assert.match(texto, /programado\s+R\$ 500,00 por mês/);
  assert.match(texto, /\+26,3 p\.p\. 🔵/);
  assert.match(texto, /- teste de aviso/);
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
