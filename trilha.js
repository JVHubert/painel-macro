// A trilha de estudo como dado: o currículo é este array, não texto espalhado no código.
// Módulo puro, sem rede e sem disco — só importa as contas de `indicadores.js`.
//
// Regras:
// - um `id` nunca volta a ser usado: se a pergunta mudar de sentido, crie um id novo;
// - `conta` tem `gabarito` (o sistema corrige sozinho), `conceito` e `pessoal` não têm;
// - `gabarito` pode receber o painel do dia: `(painel) => ...`.
import { simulacao } from './indicadores.js';

export const TRILHA = [
  {
    nivel: 1,
    nome: 'Fundamentos',
    objetivo: 'Fazer sozinho as contas de juros, inflação e juro real.',
    perguntas: [
      {
        id: 'n1-01',
        tipo: 'conta',
        texto: 'R$ 1.000 a 1% ao mês por 12 meses viram quanto?',
        gabarito: () => 1000 * 1.01 ** 12,
        tolerancia: 0.01,
        dica: 'juros compostos: valor × (1 + taxa) ^ meses',
      },
      {
        id: 'n1-02',
        tipo: 'conta',
        texto: 'Uma aplicação rendeu 12% num ano em que a inflação foi 5%. Qual foi o ganho real, em %?',
        gabarito: () => (1.12 / 1.05 - 1) * 100,
        tolerancia: 0.01,
        dica: 'desconte a inflação dividindo, não subtraindo: (1 + nominal) ÷ (1 + inflação) − 1',
      },
      {
        id: 'n1-03',
        tipo: 'conceito',
        texto: 'Por que a Selic sobe quando a inflação sobe? O que o Copom quer desestimular?',
      },
      {
        id: 'n1-04',
        tipo: 'conta',
        texto: 'Com o CDI e o IPCA de 12 meses do painel de hoje, qual é o juro real dos últimos 12 meses, em %?',
        gabarito: (painel) => cartaoDoPainel(painel, 'juro-real'),
        tolerancia: 0.01,
        dica: 'é o número do cartão "Juro real" do painel: CDI de 12 meses contra o IPCA do mesmo período',
      },
      {
        id: 'n1-05',
        tipo: 'conceito',
        texto: 'Por que quase todo produto de renda fixa paga "um pedaço do CDI"?',
      },
      {
        id: 'n1-06',
        tipo: 'conta',
        texto: 'Em quantos anos R$ 10.000 dobram a 10% ao ano? (com 1 casa decimal)',
        gabarito: () => Math.log(2) / Math.log(1.1),
        tolerancia: 0.01,
        dica: 'logaritmo resolve de uma vez: log(2) ÷ log(1,1)',
      },
      {
        id: 'n1-07',
        tipo: 'conta',
        texto:
          'R$ 1.000 em 3 anos: quanto rende a mais um CDB de 100% do CDI do que a poupança, já com o IR do CDB? Use o CDI de hoje e a poupança a 0,5% ao mês.',
        gabarito: (painel) => {
          const cdi = cartaoDoPainel(painel, 'cdi');
          if (cdi === null) return null;
          // Três anos passam dos 720 dias da faixa mais barata do IR: 15% sobre o rendimento.
          const cdb = simulacao({ valor: 1000, cdi: cdi / 100, ipca: 0, meses: 36 }).liquido;
          return cdb - 1000 * (1.005 ** 36 - 1);
        },
        tolerancia: 0.01,
        dica: 'a poupança (0,5% ao mês) não paga imposto; o CDB paga 15% de IR acima de 720 dias',
      },
      {
        id: 'n1-08',
        tipo: 'pessoal',
        texto: 'Escreva em 3 frases o que mudou no seu jeito de ver os juros desde que começou.',
      },
    ],
    prova: [
      '5 exercícios de conta certos seguidos',
      'acertar a n1-07 sem ajuda',
      'explicar sem consulta a diferença entre juro nominal e juro real (a nota entra no estudo)',
    ],
  },
];

// A trilha começa no domingo do primeiro relatório: a semana de 11/10/2026 traz a n1-01.
export const INICIO_TRILHA = '2026-10-11';

const cartaoDoPainel = (painel, id) =>
  painel?.indicadores?.find((cartao) => cartao.id === id)?.valor ?? null;

// Nível que ainda não foi escrito (o JV adiantou o `nivelAtual`): usa o último que existe.
export function nivelDaTrilha(nivel = TRILHA[0].nivel) {
  return TRILHA.find((item) => item.nivel === nivel) ?? TRILHA.at(-1);
}

// A config da trilha vive no carteira.json (`trilha`): em que nível o JV está e quando o nível
// atual começou. Ao mudar de nível, a sequência de perguntas recomeça em `inicioNivel`.
export function opcoesDaTrilha(carteira = {}) {
  return {
    nivelAtual: Number(carteira?.trilha?.nivelAtual) || TRILHA[0].nivel,
    inicioTrilha: carteira?.trilha?.inicioNivel || INICIO_TRILHA,
  };
}

// O simulador do painel ajuda a responder as perguntas que comparam rendimentos na mesma conta.
const PALAVRAS_DO_SIMULADOR = ['poupança', 'CDB'];

export function ehPerguntaDeSimulacao(pergunta) {
  if (!pergunta || pergunta.tipo !== 'conta') return false;
  return PALAVRAS_DO_SIMULADOR.some((palavra) => String(pergunta.texto ?? '').includes(palavra));
}

// A resposta guardada traz o texto da pergunta, não o id: é assim que a revisão reencontra
// a pergunta na trilha (com o tipo, o gabarito e a dica dela).
export function perguntaPorTexto(texto) {
  const procurado = String(texto ?? '').trim();
  for (const nivel of TRILHA) {
    const achada = nivel.perguntas.find((pergunta) => pergunta.texto.trim() === procurado);
    if (achada) return achada;
  }
  return null;
}

// Uma pergunta por semana, na ordem, a partir do início da trilha; esgotou, volta à primeira.
export function perguntaDaSemana(
  dataIso,
  { inicioTrilha = INICIO_TRILHA, nivelAtual = TRILHA[0].nivel } = {},
) {
  const { perguntas } = nivelDaTrilha(nivelAtual);
  const dias = (Date.parse(`${dataIso}T00:00:00Z`) - Date.parse(`${inicioTrilha}T00:00:00Z`)) / 86400000;
  const semana = Number.isFinite(dias) ? Math.max(0, Math.floor(dias / 7)) : 0;
  return perguntas[semana % perguntas.length];
}
