import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPOS_DECISAO,
  CAMPOS_RESPOSTA,
  MAXIMO_DE_REVISOES,
  adicionarBloco,
  corrigirConta,
  criarBloco,
  dataDeRevisao,
  definirCampos,
  diasAte,
  faltando,
  historicoDeEstudo,
  lerEntradas,
  lerNumeroBr,
  painelDoDiario,
  painelDoEstudo,
  placar,
  revisoesDaSemana,
  situacao,
  textoDaCorrecao,
} from '../caderno.js';

const EXEMPLO = `# Diário de decisões

## 2026-01-10 · Comprar XPTO3
- tipo: compra
- valor: 500
- tese: lucro crescendo três trimestres
- espero: bater o CDI em 12 meses
- provacao: dívida líquida subindo
- revisarEm: 2026-04-10
- revisado:

## 2026-02-01 · Rascunho pela metade
- tipo: estudo
- revisarEm: 2026-05-01
`;

test('lê as entradas do arquivo', () => {
  const entradas = lerEntradas(EXEMPLO);
  assert.equal(entradas.length, 2);
  assert.equal(entradas[0].data, '2026-01-10');
  assert.equal(entradas[0].titulo, 'Comprar XPTO3');
  assert.equal(entradas[0].campos.valor, '500');
  assert.equal(entradas[1].titulo, 'Rascunho pela metade');
  assert.deepEqual(lerEntradas(''), []);
  assert.deepEqual(lerEntradas(null), []);
});

test('acha o que falta preencher', () => {
  const [pronta, pelaMetade] = lerEntradas(EXEMPLO);
  // "revisado" e "corrigido" são preenchidos depois: não contam como pendência.
  const obrigatorios = CAMPOS_DECISAO.filter((chave) => chave !== 'revisado');
  assert.deepEqual(faltando(pronta, obrigatorios), []);
  assert.deepEqual(faltando(pelaMetade, obrigatorios), ['valor', 'tese', 'espero', 'provacao']);
  assert.deepEqual(faltando(pronta, CAMPOS_DECISAO), ['revisado']);
});

test('situação: vencida só quando está pronta e a data passou', () => {
  const [pronta, pelaMetade] = lerEntradas(EXEMPLO);
  assert.equal(situacao(pronta, '2026-02-01').vencida, false);
  assert.equal(situacao(pronta, '2026-02-01').dias, 68);
  assert.equal(situacao(pronta, '2026-04-10').vencida, true);
  assert.equal(situacao(pronta, '2026-06-01').vencida, true);
  assert.equal(situacao(pelaMetade, '2026-06-01').vencida, false); // falta escrever
  assert.equal(situacao({ ...pronta, campos: { ...pronta.campos, revisado: 'aprendi' } }, '2026-06-01').vencida, false);
});

test('diasAte e dataDeRevisao trabalham com datas', () => {
  assert.equal(diasAte('2026-01-11', '2026-01-01'), 10);
  assert.equal(diasAte('', '2026-01-01'), null);
  assert.equal(dataDeRevisao('2026-01-01', 90), '2026-04-01');
});

test('criarBloco e adicionarBloco mantêm o formato', () => {
  const bloco = criarBloco({
    data: '2026-01-01',
    titulo: 'Teste',
    campos: { tipo: '', valor: '100', revisarEm: '2026-04-01', revisado: '' },
    ordem: ['tipo', 'valor', 'revisarEm', 'revisado'],
  });
  assert.equal(bloco, '## 2026-01-01 · Teste\n- tipo: \n- valor: 100\n- revisarEm: 2026-04-01\n- revisado: \n');

  const junto = adicionarBloco('## antes · x\n- tipo: y\n', bloco);
  assert.match(junto, /^## antes · x\n- tipo: y\n\n## 2026-01-01 · Teste/);
  assert.equal(adicionarBloco('', bloco), bloco);
  // O que foi escrito pode ser lido de volta.
  assert.equal(lerEntradas(junto).length, 2);
});

test('painel do diário separa o que falta, o que venceu e o placar', () => {
  const painel = painelDoDiario({ texto: EXEMPLO, hoje: '2026-05-01' });
  assert.match(painel, /DIÁRIO DE DECISÕES/);
  assert.match(painel, /FALTANDO PREENCHER[\s\S]*Rascunho pela metade[\s\S]*falta: valor, tese, espero, provacao/);
  assert.match(painel, /HORA DE REVISAR[\s\S]*Comprar XPTO3/);
  assert.match(painel, /você esperava: bater o CDI em 12 meses/);
  assert.match(painel, /prov[aá]ria errado: dívida líquida subindo/i);
  assert.match(painel, /decisões registradas\s+2/);
  assert.match(painel, /para revisar agora\s+1/);
});

test('painel usa os fatos do mercado na revisão', () => {
  const painel = painelDoDiario({
    texto: EXEMPLO,
    hoje: '2026-05-01',
    fatos: { 'Comprar XPTO3': { variacao: 0.12, cdi: 0.09, variacaoSemana: 0.01 } },
  });
  assert.match(painel, /o que aconteceu: ativo 1,00% na semana · desde a decisão 12,00% 🟢 · CDI no período 9,00%/);
  assert.match(painel, /acima do CDI em 3,0 p\.p\./);
});

test('painel do estudo mostra a pergunta e o aproveitamento', () => {
  const texto = `## 41 · 41
- pergunta: quanto rende no CDI?
- resposta: rende o CDI do período, menos o imposto
- corrigido:
`;
  const painel = painelDoEstudo({ texto, hoje: '2026-10-11', numeroSemana: 41, pergunta: 'Pergunta nova' });
  assert.match(painel, /TRILHA DE ESTUDO — semana 41/);
  assert.match(painel, /Pergunta nova/);
  assert.match(painel, /JÁ RESPONDIDAS[\s\S]*rende o CDI do período/);
  assert.match(painel, /aproveitamento\s+100%/);

  const vazio = painelDoEstudo({ texto: '', hoje: '2026-10-11', numeroSemana: 42, pergunta: 'X' });
  assert.match(vazio, /aproveitamento\s+0%/);
});

test('diário vazio explica como começar', () => {
  const painel = painelDoDiario({ texto: '', hoje: '2026-10-11' });
  assert.match(painel, /DIÁRIO VAZIO/);
  assert.match(painel, /npm run diario -- novo/);
});

test('lerNumeroBr entende vírgula, ponto, R$ e negativo', () => {
  assert.equal(lerNumeroBr('1126,83'), 1126.83);
  assert.equal(lerNumeroBr('1.126,83'), 1126.83);
  assert.equal(lerNumeroBr('R$ 1.126,83'), 1126.83);
  assert.equal(lerNumeroBr(' 7.5 '), 7.5);
  assert.equal(lerNumeroBr('-45,76'), -45.76);
  assert.equal(lerNumeroBr('1.126'), 1126); // ponto com três casas depois é milhar
  assert.equal(lerNumeroBr('não sei'), null);
  assert.equal(lerNumeroBr(''), null);
});

test('corrigirConta aceita até 1% de erro e barra o resto', () => {
  // 1.000 a 1% ao mês por 12 meses, na mão: 1000 × 1,01 ^ 12 = 1126,825
  const gabarito = 1000 * 1.01 ** 12;
  assert.equal(corrigirConta('1126,83', gabarito, 0.01).certo, true);
  assert.equal(corrigirConta('1126,825', gabarito, 0.01).certo, true);
  assert.equal(corrigirConta('1138,09', gabarito, 0.01).certo, true); // 1% acima, no limite
  assert.equal(corrigirConta('1150', gabarito, 0.01).certo, false); // 2% acima
  assert.equal(corrigirConta('1126,83', gabarito, 0.01).erro < 0.01, true);
  assert.equal(corrigirConta('sei lá', gabarito, 0.01), null);
  assert.equal(corrigirConta('10', null, 0.01), null);
  // Gabarito zero: aqui a tolerância vale em valor absoluto, senão nada seria comparável.
  assert.equal(corrigirConta('0', 0, 0.01).certo, true);
  assert.equal(corrigirConta('0,5', 0, 0.01).certo, false);
});

test('o texto da correção diz certo, errado e a dica', () => {
  assert.equal(textoDaCorrecao({ certo: true, gabarito: 1000 * 1.01 ** 12 }), 'certo (gabarito 1.126,83)');
  assert.equal(
    textoDaCorrecao({ certo: false, gabarito: 1000 * 1.01 ** 12, dica: 'juros compostos' }),
    'errado — gabarito 1.126,83. Dica: juros compostos',
  );
  assert.equal(textoDaCorrecao({ certo: false, gabarito: Math.log(2) / Math.log(1.1) }), 'errado — gabarito 7,27');
});

test('definirCampos reescreve só o bloco pedido', () => {
  const texto = [
    '# Trilha',
    '',
    '## 2026-10-11 · 41',
    '- pergunta: velha',
    '- resposta: ',
    '- corrigido:',
    '',
    '## 2026-10-18 · 42',
    '- pergunta: outra',
    '- resposta: já respondi',
    '- corrigido:',
    '',
  ].join('\n');
  const novo = definirCampos(texto, {
    titulo: '41',
    campos: { pergunta: 'nova', resposta: '1126,83', gabarito: '1126.83', corrigido: 'certo' },
    ordem: CAMPOS_RESPOSTA,
  });

  // Campo que já existia fica no lugar; o que faltava entra no fim do bloco.
  assert.match(
    novo,
    /## 2026-10-11 · 41\n- pergunta: nova\n- resposta: 1126,83\n- corrigido: certo\n- gabarito: 1126\.83/,
  );
  assert.match(novo, /## 2026-10-18 · 42\n- pergunta: outra\n- resposta: já respondi/);
  assert.equal(definirCampos(texto, { titulo: '99', campos: { resposta: 'x' } }), null);
});

const BLOCO = (semana, pergunta, resposta, corrigido, extra = []) =>
  [`## 2026-01-01 · ${semana}`, `- pergunta: ${pergunta}`, `- resposta: ${resposta}`, `- corrigido: ${corrigido}`, ...extra].join('\n');

test('o histórico do estudo junta as respostas de cada pergunta', () => {
  const entradas = lerEntradas(
    [
      BLOCO(1, 'A', '1', 'errado'),
      BLOCO(2, 'B', '', ''), // sem resposta e sem resultado: fica de fora
      BLOCO(3, 'A', '1126,83', 'certo', ['- gabarito: 1126.83']),
    ].join('\n\n'),
  );

  const historico = historicoDeEstudo(entradas);
  assert.equal(historico.length, 2); // B entra na lista, mas ainda sem resultado
  assert.equal(historico[0].pergunta, 'A');
  assert.deepEqual(historico[0].resultados, ['errado', 'certo']);
  assert.deepEqual(historico[0].datas, ['2026-01-01', '2026-01-01']);
  assert.equal(historico[0].ultimaData, '2026-01-01');
  assert.equal(historico[0].gabarito, 1126.83);
  assert.deepEqual(historico[1].resultados, []);
});

test('a revisão espaçada segue cada linha da tabela do plano', () => {
  const comResultados = (resultados) => [
    { pergunta: 'A', resultados, datas: ['2026-01-01'], ultimaData: '2026-01-01', gabarito: null },
  ];

  // errado volta em 1 semana
  assert.equal(revisoesDaSemana(comResultados(['errado']), '2026-01-07').length, 0);
  assert.equal(revisoesDaSemana(comResultados(['errado']), '2026-01-08')[0].voltaEm, '2026-01-08');

  // parcial volta em 3 semanas
  assert.equal(revisoesDaSemana(comResultados(['parcial']), '2026-01-21').length, 0);
  assert.equal(revisoesDaSemana(comResultados(['parcial']), '2026-01-22').length, 1);

  // certo na 1ª revisão volta em 8 semanas
  assert.equal(revisoesDaSemana(comResultados(['errado', 'certo']), '2026-02-25').length, 0);
  assert.equal(revisoesDaSemana(comResultados(['errado', 'certo']), '2026-02-26').length, 1);

  // certo duas vezes seguidas na revisão: aposentada
  assert.equal(revisoesDaSemana(comResultados(['errado', 'certo', 'certo']), '2027-01-01').length, 0);

  // acertou de primeira também confirma uma vez antes de aposentar
  assert.equal(revisoesDaSemana(comResultados(['certo']), '2026-02-25').length, 0);
  assert.equal(revisoesDaSemana(comResultados(['certo']), '2026-02-26').length, 1);
});

test('no máximo duas revisões por semana, as mais antigas primeiro', () => {
  const item = (pergunta, data) => ({
    pergunta,
    resultados: ['errado'],
    datas: [data],
    ultimaData: data,
    gabarito: null,
  });
  const historico = [item('nova', '2026-03-10'), item('antiga', '2026-01-01'), item('meio', '2026-02-01')];

  const revisoes = revisoesDaSemana(historico, '2026-03-20');
  assert.equal(MAXIMO_DE_REVISOES, 2);
  assert.equal(revisoes.length, 2);
  assert.deepEqual(
    revisoes.map((revisao) => revisao.pergunta),
    ['antiga', 'meio'],
  );
});

test('pergunta respondida de novo depois do vencimento sai da fila', () => {
  const historico = historicoDeEstudo(
    lerEntradas(
      [
        [
          '## 2026-01-01 · 1',
          '- pergunta: A',
          '- resposta: 5',
          '- corrigido: errado',
          '',
          '## 2026-01-12 · 2 · revisão 1',
          '- pergunta: A',
          '- resposta: outro texto',
          '- corrigido:',
        ].join('\n'),
      ].join('\n\n'),
    ),
  );
  assert.deepEqual(historico[0].datas, ['2026-01-01', '2026-01-12']);
  assert.deepEqual(historico[0].resultados, ['errado']);
  assert.equal(revisoesDaSemana(historico, '2026-01-20').length, 0);
});

test('o painel do estudo mostra as revisões que venceram', () => {
  const texto = BLOCO(1, 'A', '5', 'errado');

  const comRevisao = painelDoEstudo({ texto, hoje: '2026-01-10', numeroSemana: 2, pergunta: 'Pergunta nova' });
  assert.match(comRevisao, /REVISÕES DESTA SEMANA/);
  assert.match(comRevisao, /- A\n {2}você errou em 01\/01\/2026/);
  assert.match(comRevisao, /npm run estudo -- revisar/);

  const cedo = painelDoEstudo({ texto, hoje: '2026-01-05', numeroSemana: 2, pergunta: 'Pergunta nova' });
  assert.ok(!cedo.includes('REVISÕES DESTA SEMANA'), 'antes de vencer, a revisão não aparece');
});

test('o placar conta só as últimas 8 semanas de estudo', () => {
  const item = (pergunta, data, resultados, gabarito) => ({
    pergunta,
    resultados,
    datas: [data],
    ultimaData: data,
    gabarito,
  });
  const historico = [
    item('conta de janeiro', '2026-01-01', ['certo'], 10), // saiu da janela de 8 semanas
    item('conta 1', '2026-03-01', ['certo'], 10),
    item('conta 2', '2026-03-05', ['errado'], 10),
    item('conceito', '2026-03-05', ['certo'], null), // conceito não entra no placar
  ];
  const diario = lerEntradas(
    [
      '## 2026-03-01 · Comprar XPTO3',
      '- tipo: compra',
      '- tese: porque o preço estava baixo',
      '- revisado: deu certo',
      '',
      '## 2026-03-08 · Aportar',
      '- tipo: aporte',
      '- tese:',
      '- revisado:',
    ].join('\n'),
  );

  const resultado = placar(historico, diario, '2026-03-20');
  assert.equal(resultado.nivel, 1);
  assert.equal(resultado.contas, 2);
  assert.equal(resultado.certas, 1);
  assert.equal(resultado.percentual, 50);
  assert.equal(resultado.comTese, 1);
  assert.equal(resultado.revisadas, 1);
  assert.equal(resultado.linha, 'Nível 1 · contas certas 1/2 (50%) · decisões com tese 1 · revisadas 1');
});

test('sem contas respondidas o placar diz isso em vez de 0%', () => {
  const resultado = placar([], [], '2026-03-20');
  assert.equal(resultado.percentual, null);
  assert.equal(
    resultado.linha,
    'Nível 1 · nenhuma conta respondida ainda · decisões com tese 0 · revisadas 0',
  );
});
