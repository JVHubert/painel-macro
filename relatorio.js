// Texto do relatório semanal: contas e frases puras, testáveis com `node --test`.
import {
  NIVEIS,
  formatarData,
  formatarNumero,
  formatarPercentual,
  legendaNiveis,
  nivelDeResultado,
} from './indicadores.js';

const reais = (valor) => `R$ ${formatarNumero(valor, 2)}`;
const seta = (valor) => (valor > 0 ? '▲' : valor < 0 ? '▼' : '=');

export function deslocarDias(dataIso, dias) {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

// Semana ISO (a que o calendário usa): segunda a domingo.
export function numeroDaSemana(dataIso) {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + 4 - (data.getUTCDay() || 7));
  const inicio = new Date(Date.UTC(data.getUTCFullYear(), 0, 1));
  return Math.ceil(((data - inicio) / 86400000 + 1) / 7);
}

export const PERGUNTAS = [
  'Por que a Selic sobe quando a inflação sobe? O que o Copom quer desestimular?',
  'Se o CDI rende o que está no painel e a inflação de 12 meses é o que está lá, quanto sobra de verdade? Faça a conta sem olhar.',
  'CDB de 100% do CDI com liquidez diária ou de 110% sem liquidez: qual vai para a reserva de emergência e por quê?',
  'O que é marcação a mercado e por que ela só dói se você vender antes do vencimento?',
  'Quanto rendem R$ 1.000 em 3 anos no CDI? Compare com a poupança (0,5% ao mês + TR).',
  'Por que o imposto de renda da renda fixa cai quanto mais tempo você deixa o dinheiro parado?',
  'O que o FGC cobre, até quanto, e o seu CDB atual está dentro desse limite?',
  'Por que dividendo não é dinheiro de graça? O que acontece com o preço da ação no dia seguinte?',
  'Sua reserva cobre quantos meses do seu custo de vida? Se for menos de seis, o que muda neste mês?',
  'Se a bolsa cair 30% na semana que vem, sua rotina muda? Se sim, seu risco está acima do seu estômago.',
  'Explique em três frases por que você comprou cada ação da sua carteira, sem olhar a cotação.',
  'Qual foi sua melhor e sua pior decisão financeira no ano? O que você aprendeu de fato com cada uma?',
];

export function perguntaDaSemana(dataIso) {
  return PERGUNTAS[(numeroDaSemana(dataIso) - 1) % PERGUNTAS.length];
}

// Variação do último ponto contra o ponto mais recente até N dias atrás.
export function variacaoPeriodo(serie, dias) {
  if (!Array.isArray(serie) || serie.length < 2) return null;
  const fim = serie.at(-1);
  const limite = deslocarDias(fim.data, -dias);
  const base = [...serie].reverse().find((ponto) => ponto.data <= limite);
  if (!base || !base.valor) return null;
  return fim.valor / base.valor - 1;
}

// Diferença em pontos percentuais (para taxas, não preços).
export function deltaPeriodo(serie, dias) {
  if (!Array.isArray(serie) || serie.length < 2) return null;
  const fim = serie.at(-1);
  const limite = deslocarDias(fim.data, -dias);
  const base = [...serie].reverse().find((ponto) => ponto.data <= limite);
  if (!base) return null;
  return fim.valor - base.valor;
}

function linhaMacro(rotulo, valor, detalhe = '') {
  return `• ${rotulo}: ${valor}${detalhe ? ` ${detalhe}` : ''}`;
}

export function resumoPosicao(posicao, cotacao, { cdiNoPeriodo = null } = {}) {
  const quantidade = Number(posicao.quantidade) || 0;
  const precoAtual = cotacao?.preco ?? null;
  const precoMedio = Number(posicao.precoMedio) || null;
  const mercado = precoAtual === null ? null : precoAtual * quantidade;
  const investido = precoMedio === null ? null : precoMedio * quantidade;
  const rentabilidade = investido && mercado !== null ? mercado / investido - 1 : null;
  const vsCdi = rentabilidade === null || cdiNoPeriodo === null ? null : rentabilidade - cdiNoPeriodo;
  return {
    ticker: posicao.ticker,
    quantidade,
    precoAtual,
    precoMedio,
    mercado,
    investido,
    resultado: investido === null || mercado === null ? null : mercado - investido,
    rentabilidade,
    nivel: nivelDeResultado(rentabilidade),
    dataCompra: posicao.dataCompra ?? null,
    cdiNoPeriodo,
    vsCdi,
    nivelVsCdi: nivelDeResultado(vsCdi),
    variacaoDia: cotacao?.variacaoDia ?? null,
    variacaoSemana: cotacao?.variacaoSemana ?? null,
  };
}

function linhaPosicao(posicao) {
  const cotas = posicao.quantidade === 1 ? 'cota' : 'cotas';
  const linhas = [
    `• ${posicao.ticker} · ${posicao.quantidade} ${cotas} × ${
      posicao.precoAtual === null ? 'sem cotação' : reais(posicao.precoAtual)
    } = ${posicao.mercado === null ? '–' : reais(posicao.mercado)}`,
  ];

  const variacoes = [
    posicao.variacaoDia === null ? null : `no dia ${formatarPercentual(posicao.variacaoDia)}`,
    posicao.variacaoSemana === null ? null : `na semana ${formatarPercentual(posicao.variacaoSemana)}`,
  ].filter(Boolean);
  if (variacoes.length) {
    const nivel = nivelDeResultado(posicao.variacaoSemana ?? posicao.variacaoDia);
    linhas.push(`  ${nivel ? `${nivel.emoji} ` : ''}${variacoes.join(' · ')}`);
  }

  if (posicao.investido === null) {
    linhas.push('  ⚠️ preencha precoMedio em carteira.json para eu calcular seu resultado');
    return linhas.join('\n');
  }

  const sinal = posicao.resultado >= 0 ? '+' : '';
  const partes = [
    `investido ${reais(posicao.investido)}`,
    `${posicao.nivel ? `${posicao.nivel.emoji} ` : ''}hoje ${formatarPercentual(
      posicao.rentabilidade,
    )} (${sinal}${reais(posicao.resultado)})`,
  ];
  if (posicao.cdiNoPeriodo !== null) {
    const acima = posicao.vsCdi >= 0 ? 'acima' : 'abaixo';
    partes.push(
      `${posicao.nivelVsCdi ? `${posicao.nivelVsCdi.emoji} ` : ''}CDI no mesmo período ${formatarPercentual(
        posicao.cdiNoPeriodo,
      )} (${formatarNumero(Math.abs(posicao.vsCdi) * 100, 1)} p.p. ${acima})`,
    );
  }
  linhas.push(`  ${partes.join(' · ')}`);
  if (!posicao.dataCompra) {
    linhas.push('  ⚠️ falta a dataCompra (está na nota de corretagem) para eu comparar com o CDI');
  }
  return linhas.join('\n');
}

// A reserva não é rentabilidade: aqui a cor é o progresso até a meta de meses.
export function nivelDaReserva(meses, alvoMeses) {
  const proporcao = alvoMeses ? meses / alvoMeses : 0;
  if (proporcao >= 1.5) return NIVEIS[0]; // 🔵 bem acima da meta
  if (proporcao >= 1) return NIVEIS[1]; // 🟢 meta batida
  if (proporcao > 0) return NIVEIS[3]; // 🟡 em construção
  return NIVEIS[4]; // 🔴 nada guardado
}

function linhaDetalhe(item) {
  const partes = [`• ${item.nome}: ${reais(item.saldo)}`];
  if (item.rendimento !== undefined && item.rendimento !== null) {
    partes.push(`rendeu ${reais(item.rendimento)}`);
  }
  if (item.medido) {
    // Só vale como medição se não houve aporte novo depois da data informada.
    partes.push(
      `≈ ${formatarPercentual(item.medido.taxaAnual)} ao ano desde ${formatarData(item.dataAporte)} (${
        item.medido.dias
      } dias)`,
    );
    if (item.medido.percentualDoCdi !== null) {
      partes.push(`${formatarPercentual(item.medido.percentualDoCdi, 0)} do CDI`);
      if (item.taxaCDI) {
        const prometido = item.taxaCDI;
        const entregou = item.medido.percentualDoCdi >= prometido - 0.02;
        partes.push(entregou ? '✅ dentro do prometido' : `⚠️ prometido era ${formatarPercentual(prometido, 0)}`);
      }
    }
    return partes.join(' · ');
  }
  if (item.taxaCDI) partes.push(`prometido ${formatarPercentual(item.taxaCDI, 0)} do CDI`);
  return partes.join(' · ');
}

export function resumoReserva(reserva, { custoMensal, alvoMeses = 6 } = {}) {
  const custo = Number(custoMensal) || Number(reserva?.custoMensal) || 0;
  const detalhe = Array.isArray(reserva?.detalhe) ? reserva.detalhe : [];
  const soma = detalhe.reduce((total, item) => total + (Number(item.saldo) || 0), 0);
  const atual = detalhe.length ? soma : Number(reserva?.atual) || 0;

  if (!custo) return ['• preencha custoMensal em carteira.json'];
  const alvo = custo * alvoMeses;
  const meses = atual / custo;

  const linhas = [
    `• ${reais(atual)} — ${formatarNumero(meses, 1)} ${
      meses === 1 ? 'mês coberto' : 'meses cobertos'
    } (meta: ${alvoMeses}) ${nivelDaReserva(meses, alvoMeses).emoji}`,
  ];
  linhas.push(
    atual >= alvo
      ? '  meta batida ✓ — daqui pra frente o dinheiro pode buscar risco, mas o excedente pede destino'
      : `  faltam ${reais(alvo - atual)} — antes de qualquer risco, isso primeiro`,
  );
  for (const item of detalhe) linhas.push(`  ${linhaDetalhe(item)}`);
  if (detalhe.length) {
    linhas.push('  (a taxa anual de cada item vale se não houve aporte novo depois da data informada)');
  }
  return linhas;
}

function blocoCarteira(posicoes) {
  if (!posicoes.length) return ['• nenhuma posição em carteira.json'];
  const linhas = [];
  const porTicker = new Map();
  for (const posicao of posicoes) {
    linhas.push(linhaPosicao(posicao));
    porTicker.set(posicao.ticker, [...(porTicker.get(posicao.ticker) ?? []), posicao]);
  }
  // Mais de um lote do mesmo papel: vale ver o total junto, inclusive contra o CDI.
  for (const [ticker, lotes] of porTicker) {
    if (lotes.length < 2) continue;
    const soma = (valores) =>
      valores.every((valor) => typeof valor === 'number') ? valores.reduce((a, b) => a + b, 0) : null;
    const mercado = soma(lotes.map((lote) => lote.mercado));
    const investido = soma(lotes.map((lote) => lote.investido));
    const quantidade = soma(lotes.map((lote) => lote.quantidade));
    const rentabilidade = investido && mercado !== null ? mercado / investido - 1 : null;
    const nivel = nivelDeResultado(rentabilidade);

    // Quanto o mesmo dinheiro teria virado no CDI, cada lote desde a sua data.
    const noCdi = soma(
      lotes.map((lote) =>
        typeof lote.investido === 'number' && typeof lote.cdiNoPeriodo === 'number'
          ? lote.investido * (1 + lote.cdiNoPeriodo)
          : null,
      ),
    );
    const contraCdi = noCdi && mercado !== null ? mercado / noCdi - 1 : null;
    const nivelCdi = nivelDeResultado(contraCdi);

    const partes = [
      `${quantidade} cotas`,
      `investido ${reais(investido)}`,
      `hoje ${reais(mercado)}`,
      `${nivel ? `${nivel.emoji} ` : ''}${formatarPercentual(rentabilidade)}`,
    ];
    if (contraCdi !== null) {
      partes.push(
        `${nivelCdi ? `${nivelCdi.emoji} ` : ''}no CDI seria ${reais(noCdi)} (${formatarPercentual(
          contraCdi,
        )})`,
      );
    }
    linhas.push(`  = ${ticker} no total: ${partes.join(' · ')}`);
  }
  return linhas;
}

export function montarRelatorio({
  data,
  macro,
  posicoes = [],
  reserva,
  receitaMensal,
  custoMensal,
  aporteMensal,
  avisos = [],
}) {
  const blocos = [`📊 Relatório semanal — ${formatarData(data)}`];

  blocos.push(['MACRO', ...macro].join('\n'));
  blocos.push(['CARTEIRA', ...blocoCarteira(posicoes)].join('\n'));
  blocos.push(['RESERVA', ...resumoReserva(reserva, { custoMensal })].join('\n'));

  if (receitaMensal && custoMensal) {
    blocos.push(
      `SOBRA DO MÊS\n• ${reais(receitaMensal)} de receita − ${reais(custoMensal)} de custo = ${reais(
        receitaMensal - custoMensal,
      )} livres`,
    );
  }
  if (aporteMensal) blocos.push(`APORTE\n• programado: ${reais(aporteMensal)} por mês`);

  blocos.push(`PERGUNTA DA SEMANA (semana ${numeroDaSemana(data)})\n${perguntaDaSemana(data)}`);
  blocos.push(`LEGENDA: ${legendaNiveis()}`);
  if (avisos.length) blocos.push(avisos.join('\n'));

  return blocos.join('\n\n');
}

export function resumoMacro(painel, { dias = 7 } = {}) {
  const achar = (id) => painel?.indicadores?.find((cartao) => cartao.id === id) ?? null;
  const semDado = (cartao) => !cartao || cartao.valor === null;

  const meta = achar('meta-selic');
  const cdi = achar('cdi');
  const ipca = achar('ipca');
  const juroReal = achar('juro-real');
  const dolar = achar('dolar');

  const deltaMeta = meta && !semDado(meta) ? deltaPeriodo(meta.serie, dias) : null;
  const deltaCdi = cdi && !semDado(cdi) ? deltaPeriodo(cdi.serie, dias) : null;
  const variacaoDolar = dolar && !semDado(dolar) ? variacaoPeriodo(dolar.serie, dias) : null;

  const linhas = [];
  linhas.push(
    linhaMacro(
      'Meta Selic',
      semDado(meta) ? 'sem dado' : `${formatarNumero(meta.valor)}% ao ano`,
      deltaMeta === null ? '' : `(${seta(deltaMeta)} ${formatarNumero(Math.abs(deltaMeta), 2)} p.p. na semana)`,
    ),
  );
  linhas.push(
    linhaMacro(
      'CDI',
      semDado(cdi) ? 'sem dado' : `${formatarNumero(cdi.valor)}% ao ano`,
      [
        deltaCdi === null ? '' : `(${seta(deltaCdi)} ${formatarNumero(Math.abs(deltaCdi), 2)} p.p.)`,
        cdi?.extra ? `${formatarPercentual(cdi.extra.percentual)} em 12 meses` : '',
      ]
        .filter(Boolean)
        .join(' '),
    ),
  );
  linhas.push(
    linhaMacro('IPCA em 12 meses', semDado(ipca) ? 'sem dado' : `${formatarNumero(ipca.valor)}%`),
  );
  linhas.push(
    linhaMacro(
      'Juro real',
      semDado(juroReal) ? 'sem dado' : `${formatarNumero(juroReal.valor)}% ao ano`,
      '— é isso que a renda fixa paga acima da inflação',
    ),
  );
  const nivelDolar = nivelDeResultado(variacaoDolar);
  linhas.push(
    linhaMacro(
      'Dólar',
      semDado(dolar) ? 'sem dado' : `R$ ${formatarNumero(dolar.valor, 4)}`,
      variacaoDolar === null
        ? ''
        : `${nivelDolar.emoji} (${seta(variacaoDolar)} ${formatarPercentual(Math.abs(variacaoDolar))} na semana)`,
    ),
  );
  return linhas;
}
