import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIVEIS, anualizarDiaria, compararComCdi, legendaNiveis, nivelDeResultado, taxaEquivalente } from '../indicadores.js';
import {
  alocacao,
  cartaoDoJogo,
  deltaPeriodo,
  deslocarDias,
  encurtar,
  fraseResumo,
  montarRelatorio,
  nivelDaReserva,
  nivelDoCdi,
  numeroDaSemana,
  paraEstaSemana,
  reaisCurto,
  resumoMacro,
  resumoPosicao,
  resumoReserva,
  rotuloDoMarco,
  tabela,
  tituloDaCarteira,
  tituloDaReserva,
  tituloDaSemana,
  tituloDasPendencias,
  tituloDoJogo,
  tituloDoMacro,
  tituloDoPatrimonio,
  tituloDoSobra,
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

  // Sem rótulo: quem monta o relatório põe o título-afirmação acima da tabela.
  assert.equal(linhas[0], `Indicador${' '.repeat(7)}Valor  Semana`);
  assert.equal(linhas[1], `Meta Selic${' '.repeat(5)}13,75%  =0,00 p.p.`);
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
    painel: PAINEL,
    posicoes: [
      resumoPosicao(
        { ticker: 'RENT3', quantidade: 10, precoMedio: null, dataCompra: null },
        { preco: 54.51, variacaoDia: 0.0113, variacaoSemana: 0.0761 },
      ),
    ],
    reserva: { atual: 0 },
  });
  assert.match(texto, /RENT3\s+–\s+R\$ 545,10/);
  assert.match(texto, /pendências para resolver[\s\S]*preencha o precoMedio de RENT3/);
  assert.ok(!texto.includes('NaN'));
});

test('dois lotes do mesmo papel viram uma linha e só se abrem quando divergem', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    painel: PAINEL,
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
  assert.match(texto, /RENT3\s+R\$ 700,00\s+R\$ 630,00\s+-10,00% 🟡\s+100,0%/);
  // 200×1,50 + 500×1,10 = 850
  assert.match(texto, /Se o mesmo dinheiro tivesse ficado no CDI: R\$ 850,00 \(hoje: R\$ 630,00\)/);
  // 5,00% e -16,00% divergem mais de 5 p.p.: os lotes aparecem.
  assert.match(texto, /lotes de RENT3/);
  assert.match(texto, /10\s+R\$ 200,00\s+R\$ 210,00\s+5,00% 🟢/);
  assert.match(texto, /20\s+R\$ 500,00\s+R\$ 420,00\s+-16,00% 🟡/);
  assert.match(texto, /só preço; não inclui dividendos nem imposto/);
});

test('reserva calcula cobertura e usa a cor do progresso', () => {
  const vazia = resumoReserva({ atual: 2500 }, { custoMensal: 2500 }).texto;
  assert.match(vazia, /Saldo\s+R\$ 2\.500,00/);
  assert.match(vazia, /Cobertura\s+1,0 meses de custo \(meta 6\) 🟡/);

  const cheia = resumoReserva({ atual: 36000 }, { custoMensal: 4000 }).texto;
  assert.match(cheia, /9,0 meses de custo \(meta 6\) ⚪/);
  assert.match(
    cheia,
    /R\$ 12\.000,00 acima da meta de 6 meses — esse dinheiro pode ir para prazo maior\./,
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
  assert.match(texto, /Caixinha X\s+1\.100,00\s+13,20%\s+112% 🟢/);
  assert.match(texto, /Cofrinho W\s+200,00\s+10,20%\s+86% 🟡/);
  assert.match(texto, /Cofrinho Y\s+500,00\s+7,30%\s+62% 🔴/);
  assert.match(texto, /Cofrinho Z\s+300,00\s+120% do CDI\s+–/);
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

test('alocação mostra reserva e ações em %', () => {
  const { total, partes } = alocacao({
    reserva: { detalhe: [{ nome: 'Caixinha X', saldo: 990 }] },
    posicoes: [{ mercado: 10 }],
  });
  assert.equal(total, 1000);
  assert.deepEqual(
    partes.map((parte) => [parte.nome, parte.fracao]),
    [
      ['Reserva', 0.99],
      ['Ações', 0.01],
    ],
  );
  assert.deepEqual(alocacao({}), { total: 0, partes: [] });
});

test('fraseResumo diz o que a semana fez e onde a reserva está', () => {
  const frase = fraseResumo({
    painel: PAINEL,
    posicoes: [resumoPosicao({ ticker: 'RENT3', quantidade: 10, precoMedio: 20 }, { preco: 21, variacaoSemana: 0.05 })],
    reserva: { alvoMeses: 6, detalhe: [{ nome: 'Caixinha X', saldo: 9000 }] },
    custoMensal: 1000,
  });
  assert.match(frase, /^Patrimônio ≈ \+/);
  assert.match(frase, /Reserva segue bem acima da meta \(9,0 meses de custo\)\./);
});

test('paraEstaSemana prioriza o excedente, o produto ruim e a pergunta', () => {
  const { itens, pergunta } = paraEstaSemana({
    data: '2026-10-11',
    painel: PAINEL,
    posicoes: [],
    custoMensal: 1000,
    reserva: {
      alvoMeses: 6,
      detalhe: [
        { nome: 'Caixinha X', saldo: 9000, medido: { taxaAnual: 0.08, percentualDoCdi: 0.8 } },
        { nome: 'Cofrinho Y', saldo: 1000, medido: { taxaAnual: 0.14, percentualDoCdi: 1.2 } },
      ],
    },
    caderno: { decisoesVencidas: 1, decisoesSemTese: 2, respostaDaSemanaVazia: true },
  });
  assert.equal(itens.length, 3, 'no máximo 3 itens');
  assert.match(itens[0], /R\$ 4\.000,00 acima da meta de 6 meses — decida o destino e registre no diário\./);
  assert.match(itens[1], /Caixinha X rende 80% do CDI\./);
  assert.match(itens[2], /1 decisão do diário para revisar\./);
  assert.match(pergunta, /^R\$ 1\.000 a 1% ao mês por 12 meses viram quanto\?/);
});

test('relatório completo monta todos os blocos', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    painel: PAINEL,
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

  assert.match(texto, /📊 Relatório semanal — 11\/10\/2026 · semana 41/);
  assert.match(texto, /Patrimônio ≈ \+/);
  // Os títulos são afirmações sobre cada seção, na ordem conclusão → detalhes → rodapé.
  const titulos = [
    /coisas? para fazer nesta semana|Nada pendente nesta semana/,
    /Seu patrimônio (subiu|caiu|ficou parado|é de)/,
    /Sua reserva (cobre|bateu|ainda)/,
    /Nenhum papel em carteira|RENT3 (subiu|caiu)/,
    /Sobram .* sem destino neste mês/,
    /O juro real está em/,
    /LEGENDA: /,
  ];
  let anterior = -1;
  for (const titulo of titulos) {
    const posicao = texto.search(titulo);
    assert.ok(posicao > anterior, `título ausente ou fora de ordem: ${titulo}`);
    anterior = posicao;
  }
  assert.match(texto, /Sobra R\$ 3\.000,00 · aporte programado R\$ 500,00 · sobram R\$ 2\.500,00 sem destino/);
  assert.match(texto, /- teste de aviso/);
});

test('relatório sem posições diz que a carteira está vazia', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    painel: PAINEL,
    posicoes: [],
    reserva: {},
  });
  assert.match(texto, /nenhuma posição em carteira\.json/);
  assert.ok(!texto.includes('SOBRA DO MÊS'));
});

test('o placar do estudo aparece abaixo do Para esta semana', () => {
  const dados = {
    data: '2026-10-11',
    painel: PAINEL,
    posicoes: [],
    reserva: { alvoMeses: 6, detalhe: [{ nome: 'Caixinha X', saldo: 6000 }] },
    custoMensal: 1000,
  };

  const comPlacar = montarRelatorio({
    ...dados,
    caderno: { placar: { linha: 'Nível 1 · contas certas 1/2 (50%) · decisões com tese 1 · revisadas 0' } },
  });
  assert.match(
    comPlacar,
    /Nível 1 · contas certas 1\/2 \(50%\) · decisões com tese 1 · revisadas 0\n\nSeu patrimônio/,
  );

  const semCaderno = montarRelatorio(dados);
  assert.ok(!semCaderno.includes('Nível 1 ·'), 'sem caderno, o placar não entra no relatório');
});

test('o cartão do jogo entra logo depois do Para esta semana', () => {
  const jogo = {
    proximoMarco: 25000,
    falta: 4262.49,
    percentual: 0.83,
    meses: 2,
    premio: { valor: 5000, item: { nome: 'Exemplo de prêmio' } },
    juros: { fracao: 0.3 },
  };

  const texto = montarRelatorio({
    data: '2026-10-11',
    painel: PAINEL,
    posicoes: [],
    reserva: { alvoMeses: 6, detalhe: [{ nome: 'Caixinha X', saldo: 6000 }] },
    custoMensal: 1000,
    jogo,
  });

  assert.match(texto, /Faltam R\$ 4,3 mil para o marco de R\$ 25 mil\n\[█+░+\] 83%/);
  assert.match(texto, /Próximo marco: R\$ 25 mil · faltam R\$ 4\.262,49 · ~2 meses no ritmo atual/);
  assert.match(texto, /Prêmio: até R\$ 5\.000,00 → Exemplo de prêmio · nesse trecho, ~30% virá dos juros/);
  assert.match(texto, /Faltam R\$ 4,3 mil[\s\S]*Seu patrimônio/);

  const semJogo = montarRelatorio({ data: '2026-10-11', painel: PAINEL, posicoes: [], reserva: { atual: 0 } });
  assert.ok(!semJogo.includes('para o marco de'), 'sem jogo, o cartão não entra');
});

test('o cartão cobra o prêmio e avisa o primeiro domingo do histórico', () => {
  const texto = cartaoDoJogo({
    proximoMarco: 40000,
    falta: 1000,
    percentual: 0.5,
    meses: 0,
    premio: { valor: 3000, item: null },
    juros: { fracao: 0.2 },
    semHistorico: true,
  });

  assert.match(texto, /bateu o marco — falta a confirmação de mais um domingo/);
  assert.match(texto, /Prêmio: escolha o prêmio do marco de R\$ 40 mil/);
  assert.match(texto, /primeiro domingo do histórico/);
});

test('o prêmio liberado aparece com prazo, e o expirado sem bronca', () => {
  const base = { proximoMarco: 40000, falta: 1000, percentual: 0.5, meses: 2, premio: { valor: 3000, item: null } };

  const liberado = cartaoDoJogo({
    ...base,
    premioAberto: { marco: 25000, valorLiberado: 5000, premio: 'Tatuagem', prazo: '2026-12-10', expirado: false, diasAteOPrazo: 12 },
  });
  assert.match(liberado, /Prêmio liberado: até R\$ 5\.000,00 — Tatuagem · compre até 10\/12\/2026 \(12 dias\)/);

  const expirado = cartaoDoJogo({
    ...base,
    premioAberto: { marco: 25000, valorLiberado: 5000, premio: 'Tatuagem', prazo: '2026-09-30', expirado: true, diasAteOPrazo: -13 },
  });
  assert.match(expirado, /Prêmio do marco de R\$ 25 mil expirou · o dinheiro fica investido/);
});

test('marco batido vira o primeiro cartão, com o prêmio e o prazo', () => {
  const dados = {
    data: '2026-10-11',
    painel: PAINEL,
    posicoes: [],
    reserva: { alvoMeses: 6, detalhe: [{ nome: 'Caixinha X', saldo: 6000 }] },
    custoMensal: 1000,
  };

  const texto = montarRelatorio({
    ...dados,
    jogo: {
      comemoracoes: [{ marco: 25000, valorLiberado: 5000, premio: 'Exemplo de prêmio', prazo: '2026-12-10' }],
    },
  });

  assert.match(
    texto,
    /MARCO BATIDO\nVocê passou de R\$ 25 mil além da reserva! Prêmio liberado: até R\$ 5\.000,00 — Exemplo de prêmio · compre até 10\/12\/2026\./,
  );
  assert.match(texto, /MARCO BATIDO[\s\S]*Nada pendente nesta semana/);
});

test('quando a lista acaba, o cartão diz que é hora de escolher os próximos', () => {
  assert.match(cartaoDoJogo({ proximoMarco: null, percentual: 1 }), /Você passou do último marco da lista/);
  assert.equal(cartaoDoJogo(null), null);
});

test('o marco aparece na língua de quem lê', () => {
  assert.equal(rotuloDoMarco(25000), 'R$ 25 mil');
  assert.equal(rotuloDoMarco(80000), 'R$ 80 mil');
  assert.equal(rotuloDoMarco(1000000), 'R$ 1 milhão');
  assert.equal(rotuloDoMarco(1500000), 'R$ 1,5 milhão');
  assert.equal(rotuloDoMarco(2000000), 'R$ 2 milhões');
  assert.equal(rotuloDoMarco(500), 'R$ 500,00');
});

test('os títulos das seções são afirmações tiradas dos dados', () => {
  assert.equal(tituloDaSemana([]), 'Nada pendente nesta semana');
  assert.equal(tituloDaSemana(['a']), 'Uma coisa para fazer nesta semana');
  assert.equal(tituloDaSemana(['a', 'b', 'c']), '3 coisas para fazer nesta semana');

  const comSaldo = (saldo) => ({ reserva: { alvoMeses: 6, detalhe: [{ nome: 'Caixinha X', saldo }] }, custoMensal: 2000 });
  assert.equal(tituloDaReserva(comSaldo(29400)), 'Sua reserva cobre 14,7 meses — 8,7 a mais que a meta');
  assert.equal(tituloDaReserva(comSaldo(12000)), 'Sua reserva bateu a meta: cobre 6,0 meses');
  assert.equal(tituloDaReserva(comSaldo(4000)), 'Sua reserva cobre 2,0 dos 6 meses que você quer');
  assert.equal(tituloDaReserva({ reserva: {} }), 'Ainda não dá para medir a reserva');

  assert.equal(tituloDoJogo({ proximoMarco: 25000, falta: 4262.49 }), 'Faltam R$ 4,3 mil para o marco de R$ 25 mil');
  assert.equal(tituloDoJogo({ proximoMarco: 25000, falta: 0 }), 'Você bateu o marco de R$ 25 mil — falta a confirmação de mais um domingo');
  assert.equal(tituloDoJogo({ proximoMarco: null }), 'Você passou do último marco da lista');
  assert.equal(tituloDoJogo(null), null);

  assert.equal(
    tituloDoSobra({ receitaMensal: 7000, custoMensal: 4000, aporteMensal: 2350 }),
    'Sobram R$ 650,00 sem destino neste mês',
  );
  assert.equal(tituloDoSobra({ receitaMensal: 7000, custoMensal: 4000, aporteMensal: 3000 }), 'Cada real da sobra do mês já tem destino');
  assert.equal(tituloDoSobra({}), null);

  assert.equal(tituloDoMacro(PAINEL), 'O juro real está em 8,77% ao ano');
  assert.equal(tituloDoMacro({ indicadores: [] }), 'Sem indicador de juro real hoje');

  assert.equal(tituloDasPendencias(new Set()), null);
  assert.equal(tituloDasPendencias(new Set(['a'])), 'Uma pendência para resolver');
  assert.equal(tituloDasPendencias(new Set(['a', 'b'])), '2 pendências para resolver');

  assert.equal(tituloDaCarteira([]), 'Nenhum papel em carteira ainda');
  assert.equal(
    tituloDaCarteira([{ ticker: 'XPTO3', mercado: 100, rentabilidade: 0.1, vsCdi: -0.05 }]),
    'XPTO3 subiu 10,00% desde a compra — o CDI rendeu mais no mesmo período',
  );
  assert.equal(
    tituloDaCarteira([{ ticker: 'XPTO3', mercado: 100, rentabilidade: -0.1, vsCdi: 0.05 }]),
    'XPTO3 caiu 10,00% desde a compra — acima do CDI no mesmo período',
  );

  assert.equal(reaisCurto(4262.49), 'R$ 4,3 mil');
  assert.equal(reaisCurto(650.5), 'R$ 650,50');
  assert.equal(reaisCurto(1200000), 'R$ 1,2 mi');
});

test('o título do patrimônio diz o que a semana fez com o dinheiro', () => {
  const comAcoes = {
    painel: PAINEL,
    reserva: { detalhe: [{ nome: 'Caixinha X', saldo: 30000 }] },
    posicoes: [{ ticker: 'XPTO3', mercado: 1000, variacaoSemana: 0.05 }],
  };
  const titulo = tituloDoPatrimonio(comAcoes);

  assert.match(titulo, /^Seu patrimônio (subiu|caiu) \d+,\d{2}% na semana$/);
  assert.equal(tituloDoPatrimonio({ reserva: {} }), 'Sem patrimônio para medir ainda');
  assert.equal(
    tituloDoPatrimonio({ reserva: { detalhe: [{ nome: 'Caixinha X', saldo: 1000 }] }, posicoes: [] }),
    'Seu patrimônio ficou parado na semana',
  );
});

test('o excedente da reserva aponta para o jogo dos marcos', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    painel: PAINEL,
    posicoes: [],
    reserva: { alvoMeses: 6, detalhe: [{ nome: 'Caixinha X', saldo: 29400 }] },
    custoMensal: 2000,
  });

  assert.match(texto, /acima da meta de 6 meses[\s\S]*É esse excedente que conta no jogo dos marcos\./);
});

test('a legenda das cores fecha o relatório, sem separar dois cartões', () => {
  const texto = montarRelatorio({
    data: '2026-10-11',
    painel: PAINEL,
    posicoes: [resumoPosicao({ ticker: 'RENT3', quantidade: 10, precoMedio: null }, { preco: 54.51 })],
    reserva: { atual: 0 },
  });

  assert.match(texto.trimEnd(), /LEGENDA: [\s\S]*−20% ou menos$/);
  assert.ok(
    texto.indexOf('LEGENDA:') > texto.indexOf('preencha o precoMedio'),
    'a legenda fica no rodapé, depois das pendências',
  );
});

