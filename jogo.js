// O jogo dos marcos (seção 13): o que passa da reserva de emergência vale prêmio, e o sistema
// mostra quanto falta e quanto do caminho vem dos juros, não do bolso.
// Módulo puro: nenhuma leitura de arquivo, nenhuma rede.
import { adicionarBloco, criarBloco, lerEntradas } from './caderno.js';
import { formatarNumero } from './indicadores.js';

export const MARCOS_PADRAO = [25000, 40000, 60000, 80000, 100000, 200000, 300000, 500000, 1000000];
export const REGRA_PADRAO = { base: 'incremento', percentual: 0.2 };
export const CONFIRMACOES_PADRAO = 2;
export const PRAZO_DIAS_PADRAO = 60;
// Dois registros mais perto que isso são a mesma semana: rodar o relatório em dois dias seguidos
// não pode valer como dois domingos na confirmação do marco.
export const DIAS_ENTRE_REGISTROS = 6;

// O que faltar no `jogo` do carteira.json assume as regras decididas em 11/10/2026.
export function regrasDoJogo(jogo = {}) {
  const marcos = (jogo.marcos?.length ? [...jogo.marcos] : [...MARCOS_PADRAO])
    .map(Number)
    .filter((marco) => Number.isFinite(marco) && marco > 0)
    .sort((a, b) => a - b);

  return {
    marcos,
    regra: {
      base: jogo.regra?.base ?? REGRA_PADRAO.base,
      percentual: Number(jogo.regra?.percentual ?? REGRA_PADRAO.percentual),
    },
    confirmacoes: Math.max(1, Number(jogo.confirmacoes ?? CONFIRMACOES_PADRAO)),
    prazoDias: Number(jogo.prazoDias ?? PRAZO_DIAS_PADRAO),
    premios: Array.isArray(jogo.premios) ? jogo.premios : [],
  };
}

// O prêmio é sempre a mesma fração da distância entre dois marcos — por isso gastar o prêmio não
// diminui o próximo. Fora da lista, não há prêmio para calcular.
export function valorDoPremio(jogo, indice) {
  const { marcos, regra } = regrasDoJogo(jogo);
  const marco = marcos[indice];
  if (!Number.isFinite(marco)) return null;

  const base = regra.base === 'acumulado' ? marco : marco - (marcos[indice - 1] ?? 0);
  return base * regra.percentual;
}

// O item que o JV escolheu para aquele marco (13.2), ou null enquanto ele não escolher.
export function premioDoMarco(jogo, marco) {
  const { premios } = regrasDoJogo(jogo);
  return premios.find((item) => Number(item?.marco) === Number(marco)) ?? null;
}

const valorDoJogo = (patrimonio, fora) => Math.max(0, (Number(patrimonio) || 0) - fora);

// Último marco confirmado, próximo marco, quanto falta, % do caminho, prêmio do próximo e os
// marcos recém-confirmados. `historico` são os domingos ANTERIORES (F0.5b) e `patrimonio` é o
// total de agora, reserva de emergência incluída.
export function situacaoDoJogo({ jogo, historico = [], patrimonio = 0, metaDaReserva = 0, hoje = null }) {
  const { marcos, confirmacoes } = regrasDoJogo(jogo);
  const fora = Math.max(0, Number(metaDaReserva) || 0);
  const doJogo = valorDoJogo(patrimonio, fora);

  const domingos = [
    ...historico.map((registro) => ({
      data: registro?.data ?? null,
      valor: valorDoJogo(registro?.patrimonio, fora),
    })),
    { data: hoje, valor: doJogo },
  ];
  const ultimo = domingos.length - 1;

  // O primeiro domingo em que o marco ficou confirmado, isto é, o fim da primeira janela de
  // `confirmacoes` domingos seguidos acima dele. Recalcular o histórico inteiro é o que impede o
  // prêmio de voltar quando o patrimônio cai e sobe de novo.
  const confirmadoEm = marcos.map((marco) => {
    for (let fim = confirmacoes - 1; fim <= ultimo; fim += 1) {
      const janela = domingos.slice(fim - confirmacoes + 1, fim + 1);
      if (janela.length === confirmacoes && janela.every((domingo) => domingo.valor >= marco)) {
        return fim;
      }
    }
    return null;
  });

  const indiceConfirmado = confirmadoEm.reduce(
    (achado, quando, indice) => (quando === null ? achado : indice),
    -1,
  );
  const ultimoMarco = indiceConfirmado === -1 ? 0 : marcos[indiceConfirmado];
  const indiceProximo = indiceConfirmado + 1;
  const proximoMarco = marcos[indiceProximo] ?? null;

  const confirmados = marcos
    .map((marco, indice) => ({ marco, indice, quando: confirmadoEm[indice] }))
    .filter((item) => item.quando === ultimo)
    .map((item) => ({
      marco: item.marco,
      em: domingos[ultimo].data,
      valor: valorDoPremio(jogo, item.indice),
      item: premioDoMarco(jogo, item.marco),
    }));

  const caminho = proximoMarco === null ? 0 : proximoMarco - ultimoMarco;

  return {
    patrimonio: Number(patrimonio) || 0,
    metaDaReserva: fora,
    patrimonioDoJogo: doJogo,
    ultimoMarco,
    proximoMarco,
    falta: proximoMarco === null ? 0 : Math.max(0, proximoMarco - doJogo),
    percentual: caminho === 0 ? 1 : Math.min(1, Math.max(0, (doJogo - ultimoMarco) / caminho)),
    premio:
      proximoMarco === null
        ? null
        : { valor: valorDoPremio(jogo, indiceProximo), item: premioDoMarco(jogo, proximoMarco) },
    confirmados,
    chegouAoFim: marcos.length > 0 && indiceConfirmado === marcos.length - 1,
  };
}

// Quantos meses, no ritmo atual, até o alvo. Arredonda para cima: é promessa, não média.
// A taxa é real (já sem a inflação) e anual; o aporte entra no fim de cada mês.
export function mesesAte(alvo, atual, aporteMensal = 0, taxaRealAnual = 0) {
  const valor = Number(alvo);
  const distancia = valor - Number(atual);
  if (!Number.isFinite(distancia)) return Infinity;
  if (distancia <= 0) return 0;

  const aporte = Math.max(0, Number(aporteMensal) || 0);
  const taxaMensal = (1 + Number(taxaRealAnual)) ** (1 / 12) - 1;

  if (!(taxaMensal > 0)) return aporte > 0 ? Math.ceil(distancia / aporte) : Infinity;

  // Valor futuro de uma série de aportes: FV(n) = atual×(1+i)^n + aporte×((1+i)^n − 1)/i.
  const mensal = aporte / taxaMensal;
  const meses = Math.log((valor + mensal) / (Number(atual) + mensal)) / Math.log(1 + taxaMensal);
  return Number.isFinite(meses) ? Math.max(0, Math.ceil(meses)) : Infinity;
}

// Quanto do caminho até o alvo virá dos juros, e não do bolso, no ritmo atual.
export function parteDosJuros(alvo, atual, aporteMensal = 0, taxaRealAnual = 0) {
  const meses = mesesAte(alvo, atual, aporteMensal, taxaRealAnual);
  const caminho = Math.max(0, Number(alvo) - Number(atual));
  const aporte = Math.max(0, Number(aporteMensal) || 0);

  if (!Number.isFinite(meses)) return { meses, aportado: null, juros: null, fracao: null };

  const aportado = Math.min(caminho, aporte * meses);
  const juros = Math.max(0, caminho - aportado);
  return { meses, aportado, juros, fracao: caminho > 0 ? juros / caminho : 0 };
}

// A memória do jogo: um registro por dia de relatório, em ordem. Rodar o relatório de novo no mesmo
// dia atualiza o registro daquele dia em vez de criar outro — dois registros no mesmo dia não podem
// valer como dois domingos na confirmação do marco.
export function historicoAtualizado(historico = [], { data, patrimonio } = {}) {
  const valor = Number(patrimonio);
  if (!data || !Number.isFinite(valor)) return [...historico];

  const lista = [...historico].filter((registro) => registro?.data).sort((a, b) => (a.data < b.data ? -1 : 1));
  const ultimo = lista.at(-1);
  const mesmoDia = ultimo?.data === data;
  // O histórico é semanal: um registro fora de domingo que caia a menos de `DIAS_ENTRE_REGISTROS` do
  // último atualiza o registro da semana em vez de criar outro — senão terça e quarta valeriam como
  // dois domingos e um pico do mercado liberaria prêmio.
  const dias = ultimo ? diasEntre(ultimo.data, data) : null;
  const colado = ultimo && dias !== null && dias > 0 && dias < DIAS_ENTRE_REGISTROS;

  const novo = [...(mesmoDia || colado ? lista.slice(0, -1) : lista), { data, patrimonio: valor }];
  return novo.sort((a, b) => (a.data < b.data ? -1 : 1));
}

// --- O mural: o que foi liberado, o que já foi comprado e a frase de cada marco (F0.5d) ---

export const CAMPOS_MURAL = ['marco', 'liberadoEm', 'valorLiberado', 'premio', 'compradoEm', 'valorGasto', 'frase'];

const somarDias = (dataIso, dias) =>
  new Date(Date.parse(`${dataIso}T00:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);

const diasEntre = (de, para) => (Date.parse(`${para}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000;

const dataBr = (dataIso) => String(dataIso ?? '').split('-').reverse().join('/');

export const tituloDoMarco = (marco) => `Marco de R$ ${formatarNumero(Number(marco), 0)}`;

// O bloco do marco no mural, no mesmo formato do diário e do estudo. O prazo sai de `liberadoEm` +
// `prazoDias`, então mudar a regra não deixa data velha escrita no arquivo.
export function criarBlocoDoMural({ marco, liberadoEm, valorLiberado, premio, prazoDias = PRAZO_DIAS_PADRAO }) {
  return criarBloco({
    data: liberadoEm,
    titulo: tituloDoMarco(marco),
    campos: {
      marco: String(marco),
      liberadoEm,
      valorLiberado: Number(valorLiberado ?? 0).toFixed(2),
      premio: premio ?? '',
      compradoEm: '',
      valorGasto: '',
      frase: '',
    },
    ordem: CAMPOS_MURAL,
  });
}

// Cada marco entra no mural uma vez só, mesmo se o relatório rodar duas vezes no mesmo dia.
export function muralComMarco(texto = '', { marco, liberadoEm, valorLiberado, premio, prazoDias = PRAZO_DIAS_PADRAO }) {
  const jaTem = lerEntradas(texto).some((entrada) => Number(entrada?.campos?.marco) === Number(marco));
  if (jaTem) return texto;
  return adicionarBloco(texto, criarBlocoDoMural({ marco, liberadoEm, valorLiberado, premio, prazoDias }));
}

// O prazo de compra do prêmio: 60 dias depois de liberado (configurável no carteira.json).
export const prazoDeCompra = (liberadoEm, prazoDias = PRAZO_DIAS_PADRAO) =>
  somarDias(liberadoEm, Number(prazoDias) || PRAZO_DIAS_PADRAO);

// O prêmio liberado que ainda espera compra (o mais antigo primeiro), com o prazo e o que falta.
export function premioEmAberto(entradasDoMural = [], { hoje = null, prazoDias = PRAZO_DIAS_PADRAO } = {}) {
  const abertos = entradasDoMural
    .filter(
      (entrada) =>
        String(entrada?.campos?.marco ?? '').trim() && !String(entrada?.campos?.compradoEm ?? '').trim(),
    )
    .sort((a, b) => (String(a.campos.liberadoEm) < String(b.campos.liberadoEm) ? -1 : 1));

  const aberto = abertos[0];
  if (!aberto) return null;

  const prazo = prazoDeCompra(aberto.campos.liberadoEm, prazoDias);
  return {
    marco: Number(aberto.campos.marco),
    liberadoEm: aberto.campos.liberadoEm,
    valorLiberado: Number(aberto.campos.valorLiberado) || 0,
    premio: String(aberto.campos.premio ?? ''),
    prazo,
    expirado: Boolean(hoje && hoje > prazo),
    diasAteOPrazo: hoje
      ? Math.round((Date.parse(`${prazo}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000)
      : null,
  };
}

// A comemoração vai como mensagem separada no Telegram, antes do relatório.
export function mensagemDoMarco({ marco, valorLiberado, premio, prazo }) {
  const nome = premio ? ` — ${premio}` : '';
  return `🎉 Você passou de R$ ${formatarNumero(Number(marco), 0)} além da reserva! Prêmio liberado: até R$ ${formatarNumero(
    Number(valorLiberado) || 0,
    2,
  )}${nome}. Você tem até ${dataBr(prazo)} para comprar.`;
}

// --- O mural de conquistas (F0.5e): cada trecho e quantos meses ele levou ---

// Meses entre duas datas, com uma casa: é o número que mostra os juros acelerando.
export function mesesEntre(de, para) {
  const dias = diasEntre(de, para);
  if (!Number.isFinite(dias)) return null;
  return Math.max(0, Math.round((dias / 30.4375) * 10) / 10);
}

// Cada marco batido, do mais antigo para o mais novo, com o tempo que levou desde o anterior.
// Para o primeiro trecho, o relógio começa no primeiro registro do histórico (`inicio`).
export function trechosDoMural(entradasDoMural = [], { inicio = null } = {}) {
  const blocos = entradasDoMural
    .filter((entrada) => Number(entrada?.campos?.marco) > 0)
    .sort((a, b) => (String(a.campos.liberadoEm) < String(b.campos.liberadoEm) ? -1 : 1));

  let anterior = inicio;
  return blocos.map((bloco) => {
    const item = {
      marco: Number(bloco.campos.marco),
      liberadoEm: bloco.campos.liberadoEm,
      valorLiberado: Number(bloco.campos.valorLiberado) || 0,
      premio: String(bloco.campos.premio ?? ''),
      compradoEm: String(bloco.campos.compradoEm ?? ''),
      valorGasto: bloco.campos.valorGasto ? Number(bloco.campos.valorGasto) : null,
      frase: String(bloco.campos.frase ?? ''),
      meses: anterior ? mesesEntre(anterior, bloco.campos.liberadoEm) : null,
    };
    anterior = bloco.campos.liberadoEm;
    return item;
  });
}
