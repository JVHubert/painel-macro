import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPOS_DECISAO,
  adicionarBloco,
  criarBloco,
  dataDeRevisao,
  diasAte,
  faltando,
  lerEntradas,
  painelDoDiario,
  painelDoEstudo,
  situacao,
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
