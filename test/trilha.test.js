import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INICIO_TRILHA, TRILHA, ehPerguntaDeSimulacao, nivelDaTrilha, opcoesDaTrilha, perguntaDaSemana, perguntaPorTexto } from '../trilha.js';

const painel = (valores) => ({ indicadores: Object.entries(valores).map(([id, valor]) => ({ id, valor })) });
const gabarito = (id) => TRILHA[0].perguntas.find((pergunta) => pergunta.id === id).gabarito;
const pergunta = (id) => TRILHA[0].perguntas.find((item) => item.id === id);
const idDaSemana = (dataIso, opcoes) => perguntaDaSemana(dataIso, opcoes).id;

test('o nível 1 está escrito com oito perguntas de ids únicos', () => {
  assert.equal(TRILHA.length, 1);
  const [nivel] = TRILHA;
  assert.equal(nivel.nivel, 1);
  assert.equal(nivel.nome, 'Fundamentos');
  assert.equal(nivel.prova.length, 3);
  assert.deepEqual(
    nivel.perguntas.map((pergunta) => pergunta.id),
    ['n1-01', 'n1-02', 'n1-03', 'n1-04', 'n1-05', 'n1-06', 'n1-07', 'n1-08'],
  );

  for (const pergunta of nivel.perguntas) {
    assert.ok(pergunta.texto.length > 10, `${pergunta.id} sem texto`);
    if (pergunta.tipo === 'conta') {
      assert.equal(typeof pergunta.gabarito, 'function', `${pergunta.id} sem gabarito`);
      assert.equal(pergunta.tolerancia, 0.01);
    } else {
      assert.ok(['conceito', 'pessoal'].includes(pergunta.tipo), `${pergunta.id} com tipo estranho`);
    }
  }
});

test('a pergunta anda uma por semana a partir do início da trilha', () => {
  assert.equal(INICIO_TRILHA, '2026-10-11');
  assert.equal(idDaSemana('2026-10-11'), 'n1-01');
  assert.equal(idDaSemana('2026-10-17'), 'n1-01'); // mesma semana, mesma pergunta
  assert.equal(idDaSemana('2026-10-18'), 'n1-02');
  assert.equal(idDaSemana('2026-11-29'), 'n1-08');
  assert.equal(idDaSemana('2026-12-06'), 'n1-01'); // acabaram as oito: volta à primeira
});

test('antes do início, ou com data esquisita, fica na primeira pergunta', () => {
  assert.equal(idDaSemana('2026-10-01'), 'n1-01');
  assert.equal(idDaSemana(''), 'n1-01');
  assert.equal(idDaSemana('2026-10-11', { inicioTrilha: '2026-10-04' }), 'n1-02');
});

test('nível que ainda não foi escrito usa o último que existe', () => {
  assert.equal(nivelDaTrilha(1).nome, 'Fundamentos');
  assert.equal(nivelDaTrilha(2).nivel, 1);
  assert.equal(idDaSemana('2026-10-11', { nivelAtual: 3 }), 'n1-01');
});

test('o nível atual vem do carteira.json', () => {
  assert.deepEqual(opcoesDaTrilha(), { nivelAtual: 1, inicioTrilha: INICIO_TRILHA });
  assert.deepEqual(opcoesDaTrilha({ trilha: { nivelAtual: 2, inicioNivel: '2027-01-04' } }), {
    nivelAtual: 2,
    inicioTrilha: '2027-01-04',
  });
  // Config estranha não derruba: volta para o começo da trilha.
  assert.deepEqual(opcoesDaTrilha({ trilha: { nivelAtual: 'x' } }), { nivelAtual: 1, inicioTrilha: INICIO_TRILHA });

  // Nível 2 (ainda não escrito) com o nível começando em 04/01/2027: a sequência recomeça na
  // primeira pergunta do último nível que existe.
  assert.equal(idDaSemana('2027-01-04', opcoesDaTrilha({ trilha: { nivelAtual: 2, inicioNivel: '2027-01-04' } })), 'n1-01');
  // A mesma data no Nível 1, que começou em 11/10/2026, já está na quinta pergunta.
  assert.equal(idDaSemana('2027-01-04', opcoesDaTrilha({ trilha: { nivelAtual: 1, inicioNivel: '2026-10-11' } })), 'n1-05');
});

test('as contas de gabarito dão os números esperados', () => {
  assert.ok(Math.abs(gabarito('n1-01')() - 1126.83) < 0.01);
  assert.ok(Math.abs(gabarito('n1-02')() - 6.6667) < 0.001);
  assert.ok(Math.abs(gabarito('n1-06')() - 7.2725) < 0.001);
});

test('o gabarito que depende do painel usa o cartão do dia', () => {
  const doDia = painel({ cdi: 13.65, ipca: 4.58, 'juro-real': 8.77 });
  assert.equal(gabarito('n1-04')(doDia), 8.77);
  // 1.000 no CDB de 100% do CDI por 3 anos rende 397,37 líquido; a poupança, 196,68.
  assert.ok(Math.abs(gabarito('n1-07')(doDia) - 201.07) < 0.01);

  assert.equal(gabarito('n1-04')({}), null);
  assert.equal(gabarito('n1-07')({}), null);
});

test('só a pergunta que compara com a poupança é do simulador', () => {
  assert.equal(ehPerguntaDeSimulacao(pergunta('n1-07')), true);
  assert.equal(ehPerguntaDeSimulacao(perguntaDaSemana('2026-11-22')), true);
  assert.equal(ehPerguntaDeSimulacao(pergunta('n1-01')), false);
  assert.equal(ehPerguntaDeSimulacao(pergunta('n1-04')), false);
  assert.equal(ehPerguntaDeSimulacao(pergunta('n1-05')), false);
  assert.equal(ehPerguntaDeSimulacao(undefined), false);
});

test('a revisão reencontra a pergunta pelo texto guardado', () => {
  assert.equal(perguntaPorTexto(pergunta('n1-07').texto).id, 'n1-07');
  assert.equal(perguntaPorTexto(`  ${pergunta('n1-01').texto}  `).id, 'n1-01');
  assert.equal(perguntaPorTexto('pergunta que não existe mais'), null);
  assert.equal(perguntaPorTexto(undefined), null);
});
