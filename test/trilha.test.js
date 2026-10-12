import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INICIO_TRILHA, TRILHA, nivelDaTrilha, perguntaDaSemana } from '../trilha.js';

const painel = (valores) => ({ indicadores: Object.entries(valores).map(([id, valor]) => ({ id, valor })) });
const gabarito = (id) => TRILHA[0].perguntas.find((pergunta) => pergunta.id === id).gabarito;
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
