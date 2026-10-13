import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPOS_MURAL,
  CONFIRMACOES_PADRAO,
  MARCOS_PADRAO,
  PRAZO_DIAS_PADRAO,
  criarBlocoDoMural,
  historicoAtualizado,
  mensagemDoMarco,
  mesesAte,
  muralComMarco,
  parteDosJuros,
  premioDoMarco,
  premioEmAberto,
  regrasDoJogo,
  situacaoDoJogo,
  tituloDoMarco,
  valorDoPremio,
} from '../jogo.js';
import { definirCampos, lerEntradas } from '../caderno.js';

const jogo = (extra = {}) => ({
  marcos: MARCOS_PADRAO,
  regra: { base: 'incremento', percentual: 0.2 },
  ...extra,
});

test('sem config, valem os padrões decididos em 11/10/2026', () => {
  const regras = regrasDoJogo();
  assert.deepEqual(regras.marcos, MARCOS_PADRAO);
  assert.deepEqual(regras.regra, { base: 'incremento', percentual: 0.2 });
  assert.equal(regras.confirmacoes, CONFIRMACOES_PADRAO);
  assert.equal(regras.prazoDias, PRAZO_DIAS_PADRAO);
  assert.deepEqual(regras.premios, []);
  // Marcos fora de ordem viram uma lista ordenada, e lixo não entra.
  assert.deepEqual(regrasDoJogo({ marcos: [50000, 0, 25000, null] }).marcos, [25000, 50000]);
});

test('o prêmio segue a tabela da 13.1 nas três regras', () => {
  // Lista decidida pelo JV em 13/10/2026: degraus de 15 e 20 mil até 100 mil.
  const decidida = [5000, 3000, 4000, 4000, 4000, 20000, 20000, 40000, 100000];
  const dez = [2500, 1500, 2000, 2000, 2000, 10000, 10000, 20000, 50000];
  const acumulado = [5000, 8000, 12000, 16000, 20000, 40000, 60000, 100000, 200000];
  const todos = (regra) => MARCOS_PADRAO.map((_, indice) => valorDoPremio({ marcos: MARCOS_PADRAO, regra }, indice));

  assert.deepEqual(todos({ base: 'incremento', percentual: 0.2 }), decidida);
  assert.deepEqual(todos({ base: 'incremento', percentual: 0.1 }), dez);
  assert.deepEqual(todos({ base: 'acumulado', percentual: 0.2 }), acumulado);
  assert.equal(valorDoPremio(jogo(), MARCOS_PADRAO.length), null);
});

test('o marco só libera com dois domingos seguidos acima dele', () => {
  const primeiroDomingo = situacaoDoJogo({ jogo: jogo(), historico: [], patrimonio: 30000 });
  assert.deepEqual(primeiroDomingo.confirmados, []);
  assert.equal(primeiroDomingo.ultimoMarco, 0);
  assert.equal(primeiroDomingo.proximoMarco, 25000);
  assert.equal(primeiroDomingo.falta, 0);

  const aindaNao = situacaoDoJogo({
    jogo: jogo(),
    historico: [{ data: '2026-10-04', patrimonio: 24000 }],
    patrimonio: 30000,
  });
  assert.deepEqual(aindaNao.confirmados, []);

  const confirmado = situacaoDoJogo({
    jogo: jogo(),
    historico: [{ data: '2026-10-04', patrimonio: 30000 }],
    patrimonio: 31000,
    hoje: '2026-10-11',
  });
  assert.deepEqual(confirmado.confirmados, [
    { marco: 25000, em: '2026-10-11', valor: 5000, item: null },
  ]);
  assert.equal(confirmado.ultimoMarco, 25000);
  assert.equal(confirmado.proximoMarco, 40000);
  assert.equal(confirmado.falta, 9000);
  assert.equal(confirmado.percentual, 6000 / 15000);
});

test('cair e voltar não libera o mesmo marco duas vezes', () => {
  const situacao = situacaoDoJogo({
    jogo: jogo(),
    historico: [
      { data: '2026-10-04', patrimonio: 30000 },
      { data: '2026-10-11', patrimonio: 30000 },
      { data: '2026-10-18', patrimonio: 20000 },
    ],
    patrimonio: 30000,
    hoje: '2026-10-25',
  });

  // O marco já tinha sido confirmado no primeiro par de domingos: não é novidade hoje.
  assert.deepEqual(situacao.confirmados, []);
  assert.equal(situacao.ultimoMarco, 25000);
  assert.equal(situacao.proximoMarco, 40000);
});

test('a reserva de emergência fica fora do jogo e o jogo nunca fica negativo', () => {
  const dentro = situacaoDoJogo({ jogo: jogo(), patrimonio: 34000, metaDaReserva: 30000 });
  assert.equal(dentro.patrimonioDoJogo, 4000);
  assert.equal(dentro.ultimoMarco, 0);
  assert.equal(dentro.proximoMarco, 25000);
  assert.equal(dentro.falta, 21000);
  assert.equal(dentro.percentual, 4000 / 25000);
  assert.equal(dentro.premio.valor, 5000);

  const abaixo = situacaoDoJogo({ jogo: jogo(), patrimonio: 20000, metaDaReserva: 30000 });
  assert.equal(abaixo.patrimonioDoJogo, 0);
  assert.equal(abaixo.falta, 25000);
  assert.equal(abaixo.percentual, 0);
});

test('o prêmio do próximo marco pode existir sem item escolhido', () => {
  const semNome = situacaoDoJogo({ jogo: jogo(), patrimonio: 1000 });
  assert.equal(semNome.premio.valor, 5000);
  assert.equal(semNome.premio.item, null);

  const comNome = situacaoDoJogo({
    jogo: jogo({ premios: [{ marco: 25000, nome: 'Exemplo de prêmio', preco: 4000, tipo: 'simbolo', porque: 'sempre quis' }] }),
    patrimonio: 1000,
  });
  assert.equal(comNome.premio.item.nome, 'Exemplo de prêmio');
  assert.equal(premioDoMarco(jogo(), 25000), null);
});

test('acima do último marco da lista, o caminho acabou', () => {
  const situacao = situacaoDoJogo({
    jogo: jogo(),
    historico: [
      { data: '2026-10-04', patrimonio: 1100000 },
      { data: '2026-10-11', patrimonio: 1100000 },
    ],
    patrimonio: 1100000,
    hoje: '2026-10-18',
  });

  assert.equal(situacao.ultimoMarco, 1000000);
  assert.equal(situacao.proximoMarco, null);
  assert.equal(situacao.falta, 0);
  assert.equal(situacao.percentual, 1);
  assert.equal(situacao.premio, null);
  assert.equal(situacao.chegouAoFim, true);
  assert.deepEqual(situacao.confirmados, []);
});

test('meses até o alvo, com a conta na mão no comentário', () => {
  // Sem juros: 200 de distância a 10 por mês.
  assert.equal(mesesAte(1200, 1000, 10, 0), 20);
  // A 10% ao ano: 1000 × 1,1^(23/12) = 1204,21; em 22 meses ainda dá 1195,49.
  assert.equal(mesesAte(1200, 1000, 0, 0.1), 23);
  // Já passou do alvo.
  assert.equal(mesesAte(900, 1000, 10, 0.1), 0);
  // Sem juros e sem aporte, o alvo nunca chega.
  assert.equal(mesesAte(1200, 1000, 0, 0), Infinity);
});

test('o histórico do jogo guarda um registro por dia, em ordem', () => {
  const primeiro = historicoAtualizado([], { data: '2026-10-11', patrimonio: 30000 });
  assert.deepEqual(primeiro, [{ data: '2026-10-11', patrimonio: 30000 }]);

  // Rodar o relatório de novo no mesmo dia atualiza o registro, não cria um segundo.
  const corrigido = historicoAtualizado(primeiro, { data: '2026-10-11', patrimonio: 31000 });
  assert.deepEqual(corrigido, [{ data: '2026-10-11', patrimonio: 31000 }]);

  // Registro mais antigo entra na frente, e lixo é ignorado.
  const completo = historicoAtualizado(corrigido, { data: '2026-10-04', patrimonio: 20000 });
  assert.deepEqual(completo, [
    { data: '2026-10-04', patrimonio: 20000 },
    { data: '2026-10-11', patrimonio: 31000 },
  ]);
  assert.deepEqual(historicoAtualizado(completo, { data: '', patrimonio: 5000 }), completo);
  assert.deepEqual(historicoAtualizado(completo, { data: '2026-10-18', patrimonio: 'nada' }), completo);
});

test('a confirmação usa o histórico que o relatório salvou', () => {
  const patrimonio = 30000;
  const historico = historicoAtualizado([], { data: '2026-10-04', patrimonio });
  const situacao = situacaoDoJogo({ jogo: jogo(), historico, patrimonio, hoje: '2026-10-11' });
  assert.deepEqual(situacao.confirmados.map((item) => item.marco), [25000]);
});

test('quanto do caminho vem dos juros', () => {
  // Sem aporte, todo o caminho é dos juros.
  assert.deepEqual(parteDosJuros(1200, 1000, 0, 0.1), { meses: 23, aportado: 0, juros: 200, fracao: 1 });
  // Sem juros, tudo sai do bolso.
  assert.deepEqual(parteDosJuros(1200, 1000, 10, 0), { meses: 20, aportado: 200, juros: 0, fracao: 0 });
  // Misto: 5 por mês a 10% ao ano chega em 15 meses (14 meses dão 1191,36; 15 dão 1205,86).
  // Dos 200 de caminho, 75 saem do bolso e 125 são juros.
  assert.deepEqual(parteDosJuros(1200, 1000, 5, 0.1), {
    meses: 15,
    aportado: 75,
    juros: 125,
    fracao: 0.625,
  });
  // Sem juros e sem aporte, o alvo não chega.
  assert.deepEqual(parteDosJuros(1200, 1000, 0, 0), {
    meses: Infinity,
    aportado: null,
    juros: null,
    fracao: null,
  });
});

const blocoDoMarco = (extra = {}) => ({
  marco: 25000,
  liberadoEm: '2026-10-11',
  valorLiberado: 5000,
  premio: 'Exemplo de prêmio',
  ...extra,
});

test('o bloco do mural nasce com os campos que o jogo cobra', () => {
  const bloco = criarBlocoDoMural(blocoDoMarco());
  assert.match(bloco, /^## 2026-10-11 · Marco de R\$ 25\.000/);
  for (const campo of CAMPOS_MURAL) assert.ok(bloco.includes(`- ${campo}:`), `faltou o campo ${campo}`);
  assert.match(bloco, /- valorLiberado: 5000\.00/);
  assert.match(bloco, /- compradoEm:\s*\n/);
});

test('cada marco entra no mural uma vez só', () => {
  const primeiro = muralComMarco('', blocoDoMarco());
  assert.equal(muralComMarco(primeiro, blocoDoMarco()), primeiro);

  const outro = muralComMarco(primeiro, blocoDoMarco({ marco: 40000, valorLiberado: 3000 }));
  assert.equal(lerEntradas(outro).length, 2);
});

test('o prêmio em aberto tem prazo de 60 dias e expira sem bronca', () => {
  const mural = lerEntradas(muralComMarco('', blocoDoMarco()));

  const noPrazo = premioEmAberto(mural, { hoje: '2026-11-20' });
  assert.equal(noPrazo.marco, 25000);
  assert.equal(noPrazo.prazo, '2026-12-10');
  assert.equal(noPrazo.expirado, false);
  assert.equal(noPrazo.diasAteOPrazo, 20);

  const depois = premioEmAberto(mural, { hoje: '2026-12-11' });
  assert.equal(depois.expirado, true);
  assert.equal(depois.diasAteOPrazo, -1);

  assert.equal(premioEmAberto([], { hoje: '2026-11-20' }), null);
});

test('prêmio comprado sai da fila e o mais antigo vem primeiro', () => {
  // O /premio do Telegram preenche o bloco assim: pelos campos, não criando outro.
  const comprado = definirCampos(muralComMarco('', blocoDoMarco()), {
    titulo: tituloDoMarco(25000),
    campos: { compradoEm: '2026-11-01', valorGasto: '4200.00', frase: 'valeu cada centavo' },
    ordem: CAMPOS_MURAL,
  });
  assert.equal(premioEmAberto(lerEntradas(comprado), { hoje: '2026-11-20' }), null);

  const dois = muralComMarco(
    muralComMarco('', blocoDoMarco()),
    blocoDoMarco({ marco: 40000, liberadoEm: '2026-11-01' }),
  );
  assert.equal(premioEmAberto(lerEntradas(dois), { hoje: '2026-11-20' }).marco, 25000);
});

test('a mensagem da comemoração diz o prêmio e o prazo', () => {
  assert.equal(
    mensagemDoMarco({ marco: 25000, valorLiberado: 5000, premio: 'Exemplo de prêmio', prazo: '2026-12-10' }),
    '🎉 Você passou de R$ 25.000 além da reserva! Prêmio liberado: até R$ 5.000,00 — Exemplo de prêmio. Você tem até 10/12/2026 para comprar.',
  );
  assert.match(
    mensagemDoMarco({ marco: 40000, valorLiberado: 3000, premio: '', prazo: '2027-01-09' }),
    /Prêmio liberado: até R\$ 3\.000,00\. Você tem até 09\/01\/2027/,
  );
});

