// O bloco que o JV cola no professor de IA: a situação em faixas (nada de número exato), as
// últimas respostas da trilha e as decisões abertas do diário. Texto puro: sem rede e sem disco.
import { formatarData, formatarNumero } from './indicadores.js';
import { mesesDeReserva, totalDaReserva } from './relatorio.js';
import { situacao } from './caderno.js';

const PASSOS = [
  { abaixoDe: 1000, passo: 100 },
  { abaixoDe: 10000, passo: 1000 },
  { abaixoDe: 100000, passo: 5000 },
  { abaixoDe: Infinity, passo: 10000 },
];

const emReais = (valor) => (valor >= 1000 ? `R$ ${valor / 1000} mil` : `R$ ${formatarNumero(valor, 0)}`);

const NOMES_DO_DIARIO = {
  tipo: 'o tipo',
  valor: 'o valor',
  tese: 'a tese',
  espero: 'o que eu espero',
  provacao: 'o que provaria que eu estou errado',
  revisarEm: 'a data de revisão',
  revisado: 'a revisão',
};

// Faixa larga em volta do valor: dá para o professor entender a ordem de grandeza sem eu
// entregar o meu número exato em um chat.
export function faixaDeValor(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  const { passo } = PASSOS.find((faixa) => numero < faixa.abaixoDe);
  const inicio = Math.floor(numero / passo) * passo;
  return `entre ${emReais(inicio)} e ${emReais(inicio + passo)}`;
}

// O que está em ações vale o preço de compra: o bloco é arredondado e este comando não vai na rede.
export function valorDasAcoes(posicoes = []) {
  return posicoes.reduce(
    (total, posicao) => total + (Number(posicao.precoMedio) || 0) * (Number(posicao.quantidade) || 0),
    0,
  );
}

function oQueFalta(estado) {
  if (!estado.pronta) {
    const nomes = estado.emFalta.map((campo) => NOMES_DO_DIARIO[campo] ?? campo);
    return `falta escrever ${nomes.join(', ')}`;
  }
  if (estado.vencida) return 'a revisão venceu e eu ainda não conferi o resultado';
  if (typeof estado.dias === 'number') return `confiro o resultado em ${estado.dias} dias`;
  return 'sem data para conferir o resultado';
}

export function blocoDeContexto(dados = {}) {
  const { data, receitaMensal, custoMensal, aporteMensal, reserva, posicoes = [], respostas = [], decisoes = [] } = dados;
  const custo = Number(custoMensal) || Number(reserva?.custoMensal) || 0;

  const linhas = [
    `CONTEXTO PARA O PROFESSOR DE IA — ${formatarData(data)}`,
    '',
    'MINHA SITUAÇÃO, EM FAIXAS (números exatos eu não passo no chat)',
  ];

  const faixas = [
    ['Renda por mês', faixaDeValor(receitaMensal)],
    ['Custo de vida por mês', faixaDeValor(custo)],
    ['Sobra que eu invisto por mês', faixaDeValor(aporteMensal)],
  ].filter(([, faixa]) => faixa);
  for (const [rotulo, faixa] of faixas) linhas.push(`- ${rotulo}: ${faixa}`);

  const meses = mesesDeReserva({ reserva, custoMensal: custo });
  if (meses) linhas.push(`- Reserva de emergência: uns ${Math.round(meses)} meses de custo (meta: ${Number(reserva?.alvoMeses) || 6} meses)`);

  const acoes = valorDasAcoes(posicoes);
  const patrimonio = totalDaReserva(reserva) + acoes;
  if (patrimonio) linhas.push(`- Ações: uns ${Math.round((acoes / patrimonio) * 100)}% do patrimônio (pelo preço de compra)`);

  if (!faixas.length && !meses && !patrimonio) linhas.push('- sem números agora (o carteira.json está vazio)');

  linhas.push('', 'MINHAS ÚLTIMAS RESPOSTAS DA TRILHA');
  const respondidas = respostas.filter((entrada) => entrada.campos?.resposta);
  if (!respondidas.length) linhas.push('- ainda não respondi nada da trilha');
  for (const entrada of respondidas.slice(-3)) {
    const { pergunta, resposta, corrigido } = entrada.campos;
    // O campo `corrigido` guarda o resultado e, depois de um travessão, o comentário do professor.
    const nota = String(corrigido ?? '').split('—')[0].trim();
    linhas.push(`- Semana ${entrada.titulo}: ${pergunta ?? 'pergunta não registrada'} → ${resposta}${nota ? ` (corrigido: ${nota})` : ''}`);
  }

  linhas.push('', 'DECISÕES ABERTAS NO MEU DIÁRIO');
  const abertas = decisoes.filter((entrada) => !situacao(entrada, data).revisado);
  if (!abertas.length) linhas.push('- nenhuma decisão aberta');
  for (const entrada of abertas) {
    linhas.push(`- ${formatarData(entrada.data)} — ${entrada.titulo || 'sem título'}: ${oQueFalta(situacao(entrada, data))}`);
  }

  linhas.push('', 'Use isto como o meu contexto e siga as regras do meu prompt de professor.');
  return linhas.join('\n');
}
