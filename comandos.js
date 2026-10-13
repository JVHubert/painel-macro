// Os comandos que o JV manda no Telegram: /r (resposta do estudo) e /d (decisão no diário).
// Módulo puro: quem fala com a API do Telegram é o `tools/telegram.mjs`.
import { textoDaCorrecao } from './caderno.js';
import { formatarNumero } from './indicadores.js';

const reais = (valor) => `R$ ${formatarNumero(Number(valor) || 0, 2)}`;

export const AJUDA = [
  'Comandos que eu entendo:',
  '',
  '/r 1126,83 — resposta da pergunta da semana. Nas de conta eu confiro na hora (aceita vírgula ou ponto).',
  '/d título | a tese | o que eu espero | o que provaria que estou errado — registra uma decisão no diário, com revisão em 90 dias.',
  '/premio 4200,00 | a frase que você quer guardar — marca o prêmio do marco como comprado.',
  '',
  'Eu respondo aqui mesmo o que aconteceu com o comando.',
].join('\n');

// '/r 1126,83' → { tipo: 'resposta', resposta: '1126,83' }
// '/d comprar XPTO3 | a tese | subir | cair' → { tipo: 'decisao', titulo: 'comprar XPTO3', ... }
export function interpretarComando(texto) {
  const limpo = String(texto ?? '').trim();
  const primeiro = limpo.split(/\s+/)[0] ?? '';
  const nome = primeiro.toLowerCase().replace(/@[\w_]+$/, ''); // /r@meu_bot também vale
  const argumento = limpo.slice(primeiro.length).trim();

  switch (nome) {
    case '/r':
    case '/responder':
      return argumento
        ? { tipo: 'resposta', resposta: argumento }
        : { tipo: 'ajuda', motivo: 'faltou a resposta' };
    case '/d':
    case '/decisao':
      return argumento
        ? { tipo: 'decisao', ...dividirDecisao(argumento) }
        : { tipo: 'ajuda', motivo: 'faltou a decisão' };
    case '/premio':
      return argumento
        ? { tipo: 'premio', ...dividirPremio(argumento) }
        : { tipo: 'ajuda', motivo: 'faltou o valor gasto' };
    case '/start':
    case '/ajuda':
    case '/help':
      return { tipo: 'ajuda' };
    default:
      return { tipo: 'desconhecido' };
  }
}

// Título | tese | espero | provação: o que não vier fica vazio, e o diário cobra depois.
function dividirDecisao(argumento) {
  const [titulo = '', tese = '', espero = '', provacao = ''] = argumento
    .split('|')
    .map((parte) => parte.trim());
  return { titulo, tese, espero, provacao };
}

// valor gasto | a frase: a frase pode ficar de fora, o valor não.
function dividirPremio(argumento) {
  const [valor = '', frase = ''] = argumento.split('|').map((parte) => parte.trim());
  return { valor, frase };
}

// Só o chat configurado manda: mensagem de outra pessoa é ignorada em silêncio.
export function ehDoChat(mensagem, chatId) {
  const combinado = String(chatId ?? '').trim();
  return combinado !== '' && String(mensagem?.chat?.id ?? '') === combinado;
}

// O que aconteceu com o comando → o texto que o bot responde.
export function mensagemDeResposta(resultado = {}) {
  if (resultado.tipo === 'resposta') {
    if (resultado.recusada) return resultado.recusada;
    if (resultado.aviso) return `Resposta guardada, mas não consegui conferir: ${resultado.aviso}`;
    if (resultado.conceito) {
      return 'Resposta guardada. Essa é de conceito: corrija com o PROMPT.md e escreva o resultado em `corrigido:` no PC.';
    }
    return textoDaCorrecao({ certo: resultado.certo, gabarito: resultado.gabarito, dica: resultado.dica });
  }

  if (resultado.tipo === 'decisao') {
    if (resultado.recusada) return resultado.recusada;
    const linhas = [`Decisão registrada no diário: "${resultado.titulo}".`];
    linhas.push(
      resultado.faltando?.length
        ? `Falta escrever: ${resultado.faltando.join(', ')}.`
        : 'O bloco ficou completo.',
    );
    linhas.push(`Vou te cobrar a revisão em ${resultado.revisarEm.split('-').reverse().join('/')}.`);
    return linhas.join('\n');
  }

  if (resultado.tipo === 'premio') {
    if (resultado.recusada) return resultado.recusada;
    const linhas = [
      `Prêmio do marco de ${reais(resultado.marco)} registrado: ${reais(resultado.valorGasto)} gastos` +
        `${resultado.premio ? ` (${resultado.premio})` : ''}.`,
    ];
    if (resultado.valorGasto > (resultado.valorLiberado ?? 0)) {
      linhas.push(`Você passou do liberado (${reais(resultado.valorLiberado)}) — a diferença saiu do bolso.`);
    } else {
      linhas.push(`Ficou investido: ${reais((resultado.valorLiberado ?? 0) - resultado.valorGasto)}.`);
    }
    if (resultado.frase) linhas.push(`Sua frase: "${resultado.frase}"`);
    return linhas.join('\n');
  }

  if (resultado.tipo === 'ajuda') return resultado.motivo ? `${resultado.motivo}.\n\n${AJUDA}` : AJUDA;
  return `Não entendi esse comando.\n\n${AJUDA}`;
}
