// O jogo dos marcos (seção 13): o que passa da reserva de emergência vale prêmio, e o sistema
// mostra quanto falta e quanto do caminho vem dos juros, não do bolso.
// Módulo puro: nenhuma leitura de arquivo, nenhuma rede.
export const MARCOS_PADRAO = [25000, 50000, 100000, 200000, 300000, 500000, 1000000];
export const REGRA_PADRAO = { base: 'incremento', percentual: 0.2 };
export const CONFIRMACOES_PADRAO = 2;
export const PRAZO_DIAS_PADRAO = 60;

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
