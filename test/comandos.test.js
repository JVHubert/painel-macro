import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AJUDA, ehDoChat, interpretarComando, mensagemDeResposta } from '../comandos.js';

test('o /r aceita vírgula, ponto e a resposta com espaço', () => {
  assert.deepEqual(interpretarComando('/r 1126,83'), { tipo: 'resposta', resposta: '1126,83' });
  assert.deepEqual(interpretarComando('/r 1126.83'), { tipo: 'resposta', resposta: '1126.83' });
  assert.deepEqual(interpretarComando('  /r   1126,83  '), { tipo: 'resposta', resposta: '1126,83' });
  assert.deepEqual(interpretarComando('/responder 1126,83'), { tipo: 'resposta', resposta: '1126,83' });
  // O nome do bot vem junto quando o comando é escolhido na lista do Telegram.
  assert.deepEqual(interpretarComando('/r@jv_rent3_bot 1126,83'), { tipo: 'resposta', resposta: '1126,83' });
});

test('o /r sem resposta pede a resposta', () => {
  const resultado = interpretarComando('/r');
  assert.equal(resultado.tipo, 'ajuda');
  assert.match(resultado.motivo, /faltou a resposta/);
  assert.match(mensagemDeResposta(resultado), /faltou a resposta/);
});

test('o /d separa título, tese, espero e provação', () => {
  assert.deepEqual(interpretarComando('/d comprar XPTO3 | porque está barato | subir | cair'), {
    tipo: 'decisao',
    titulo: 'comprar XPTO3',
    tese: 'porque está barato',
    espero: 'subir',
    provacao: 'cair',
  });
  // Só o título já vale: o diário cobra o resto depois.
  assert.deepEqual(interpretarComando('/d aportar mais'), {
    tipo: 'decisao',
    titulo: 'aportar mais',
    tese: '',
    espero: '',
    provacao: '',
  });
  assert.equal(interpretarComando('/decisao aportar mais').tipo, 'decisao');
  assert.match(mensagemDeResposta(interpretarComando('/d')), /faltou a decisão/);
});

test('o /start e o /ajuda mostram os comandos, e o resto é desconhecido', () => {
  for (const comando of ['/start', '/ajuda', '/help']) {
    assert.equal(interpretarComando(comando).tipo, 'ajuda');
    assert.equal(mensagemDeResposta(interpretarComando(comando)), AJUDA);
  }
  assert.equal(interpretarComando('bom dia').tipo, 'desconhecido');
  assert.match(mensagemDeResposta(interpretarComando('bom dia')), /Não entendi esse comando/);
  assert.equal(interpretarComando('').tipo, 'desconhecido');
  assert.equal(interpretarComando(null).tipo, 'desconhecido');
});

test('só o chat combinado manda; mensagem de outra pessoa é ignorada', () => {
  const mensagem = (id) => ({ chat: { id }, text: '/r 1126,83' });
  assert.equal(ehDoChat(mensagem(12345), '12345'), true);
  assert.equal(ehDoChat(mensagem(12345), 12345), true);
  assert.equal(ehDoChat(mensagem(99999), '12345'), false);
  assert.equal(ehDoChat(mensagem('12345'), '12345'), true);
  // Sem chat configurado ninguém entra, e mensagem sem chat não derruba nada.
  assert.equal(ehDoChat(mensagem(12345), ''), false);
  assert.equal(ehDoChat(mensagem(12345), undefined), false);
  assert.equal(ehDoChat({}, '12345'), false);
  assert.equal(ehDoChat(undefined, '12345'), false);
});

test('a resposta da conta corrigida vira a frase que o bot manda', () => {
  const certo = mensagemDeResposta({ tipo: 'resposta', guardada: true, certo: true, gabarito: 1126.83, dica: 'x' });
  assert.match(certo, /certo/);
  assert.match(certo, /1\.126,83/);

  const errado = mensagemDeResposta({ tipo: 'resposta', guardada: true, certo: false, gabarito: 1126.83, dica: 'some o que você já tem' });
  assert.match(errado, /errado/);
  assert.match(errado, /some o que você já tem/);

  const conceito = mensagemDeResposta({ tipo: 'resposta', guardada: true, conceito: true });
  assert.match(conceito, /PROMPT\.md/);

  const aviso = mensagemDeResposta({ tipo: 'resposta', guardada: true, aviso: 'não entendi o número que você escreveu.' });
  assert.match(aviso, /não consegui conferir/);

  const recusada = mensagemDeResposta({ tipo: 'resposta', recusada: 'O bloco "42" já tem resposta registrada.' });
  assert.equal(recusada, 'O bloco "42" já tem resposta registrada.');
});

test('a decisão registrada avisa o que falta e quando a revisão volta', () => {
  const completa = mensagemDeResposta({
    tipo: 'decisao',
    titulo: 'comprar XPTO3',
    faltando: [],
    revisarEm: '2027-01-09',
  });
  assert.match(completa, /comprar XPTO3/);
  assert.match(completa, /O bloco ficou completo\./);
  assert.match(completa, /09\/01\/2027/);

  const incompleta = mensagemDeResposta({
    tipo: 'decisao',
    titulo: 'aportar mais',
    faltando: ['tese', 'espero'],
    revisarEm: '2027-01-09',
  });
  assert.match(incompleta, /Falta escrever: tese, espero\./);

  assert.equal(
    mensagemDeResposta({ tipo: 'decisao', recusada: 'Diga o que você está decidindo.' }),
    'Diga o que você está decidindo.',
  );
});

test('o /premio separa o valor gasto da frase', () => {
  assert.deepEqual(interpretarComando('/premio 4200,00 | valeu cada centavo'), {
    tipo: 'premio',
    valor: '4200,00',
    frase: 'valeu cada centavo',
  });
  assert.deepEqual(interpretarComando('/premio 4200'), { tipo: 'premio', valor: '4200', frase: '' });
  assert.match(mensagemDeResposta(interpretarComando('/premio')), /faltou o valor gasto/);
});

test('a resposta do prêmio diz quanto ficou investido', () => {
  const mensagem = mensagemDeResposta({
    tipo: 'premio',
    marco: 25000,
    valorLiberado: 5000,
    valorGasto: 4200,
    premio: 'Tatuagem',
    frase: 'valeu cada centavo',
  });
  assert.match(mensagem, /Prêmio do marco de R\$ 25\.000,00 registrado: R\$ 4\.200,00 gastos \(Tatuagem\)\./);
  assert.match(mensagem, /Ficou investido: R\$ 800,00\./);
  assert.match(mensagem, /Sua frase: "valeu cada centavo"/);

  const passou = mensagemDeResposta({ tipo: 'premio', marco: 25000, valorLiberado: 5000, valorGasto: 5600 });
  assert.match(passou, /Você passou do liberado \(R\$ 5\.000,00\) — a diferença saiu do bolso\./);

  assert.equal(
    mensagemDeResposta({ tipo: 'premio', recusada: 'Não achei nenhum prêmio liberado esperando compra.' }),
    'Não achei nenhum prêmio liberado esperando compra.',
  );
});
