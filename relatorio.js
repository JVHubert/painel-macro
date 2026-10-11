// Texto do relatório semanal: contas e frases puras, testáveis com `node --test`.
// Sai tudo em texto monoespaçado (o Telegram recebe dentro de <pre>), com colunas alinhadas.
import {
  NIVEIS,
  formatarData,
  formatarNumero,
  formatarPercentual,
  legendaNiveis,
  nivelDeResultado,
} from './indicadores.js';

const reais = (valor) => `R$ ${formatarNumero(valor, 2)}`;
const seta = (valor) => (valor > 0 ? '+' : valor < 0 ? '-' : '=');

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

// Largura na tela: emoji ocupa duas colunas, o resto ocupa uma.
function largura(texto) {
  return [...String(texto)].reduce(
    (total, char) => total + (/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/u.test(char) ? 2 : 1),
    0,
  );
}

export const SOMAR_ESPACOS = '  ';

// Monta uma tabela de texto alinhado. A última coluna nunca recebe espaço à direita,
// então emoji no fim da linha não bagunça o alinhamento.
export function tabela(linhas, { colunas = [], separador = SOMAR_ESPACOS } = {}) {
  const celulas = linhas.map((linha) => linha.map((valor) => (valor === null || valor === undefined ? '' : String(valor))));
  const larguras = [];
  for (const linha of celulas) {
    linha.forEach((celula, i) => {
      larguras[i] = Math.max(larguras[i] ?? 0, largura(celula));
    });
  }
  return celulas
    .map((linha) =>
      linha
        .map((celula, i) => {
          if (i === linha.length - 1) return celula;
          const espacos = ' '.repeat(Math.max(0, larguras[i] - largura(celula)));
          return (colunas[i] ?? 'esq') === 'dir' ? `${espacos}${celula}` : `${celula}${espacos}`;
        })
        .join(separador)
        .replace(/\s+$/, ''),
    )
    .join('\n');
}

export function encurtar(texto, limite) {
  const letras = [...String(texto)];
  return letras.length <= limite ? texto : `${letras.slice(0, limite - 1).join('')}…`;
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

const soma = (valores) =>
  valores.every((valor) => typeof valor === 'number') ? valores.reduce((a, b) => a + b, 0) : null;

function agruparPorTicker(posicoes) {
  const mapa = new Map();
  for (const posicao of posicoes) {
    mapa.set(posicao.ticker, [...(mapa.get(posicao.ticker) ?? []), posicao]);
  }
  return mapa;
}

function tabelaDoTicker(ticker, lotes, pendencias) {
  const blocos = [];
  const quantidade = soma(lotes.map((lote) => lote.quantidade));
  blocos.push(`${ticker} (${quantidade} ${quantidade === 1 ? 'cota' : 'cotas'})`);

  const variacaoSemana = lotes[0]?.variacaoSemana;
  const nivelSemana = nivelDeResultado(variacaoSemana);
  const linhas = [['Qtd', 'Aplicado', 'Hoje', 'Resultado']];
  for (const lote of lotes) {
    if (lote.investido === null) pendencias.add(`preencha o precoMedio de ${ticker} em carteira.json`);
    if (!lote.dataCompra) pendencias.add(`informe dataCompra de ${ticker} para comparar com o CDI`);
    linhas.push([
      formatarNumero(lote.quantidade, 0),
      lote.investido === null ? '–' : reais(lote.investido),
      lote.mercado === null ? '–' : reais(lote.mercado),
      lote.rentabilidade === null
        ? '–'
        : `${formatarPercentual(lote.rentabilidade)} ${lote.nivel?.emoji ?? ''}`.trim(),
    ]);
  }
  if (lotes.length > 1) {
    const mercado = soma(lotes.map((lote) => lote.mercado));
    const investido = soma(lotes.map((lote) => lote.investido));
    const rentabilidade = investido && mercado !== null ? mercado / investido - 1 : null;
    linhas.push([
      'soma',
      investido === null ? '–' : reais(investido),
      mercado === null ? '–' : reais(mercado),
      rentabilidade === null
        ? '–'
        : `${formatarPercentual(rentabilidade)} ${nivelDeResultado(rentabilidade)?.emoji ?? ''}`.trim(),
    ]);
  }
  blocos.push(tabela(linhas, { colunas: ['dir', 'dir', 'dir', 'dir'] }));

  if (variacaoSemana !== null && variacaoSemana !== undefined) {
    blocos.push(
      `hoje ${formatarPercentual(lotes[0].variacaoDia ?? 0)} · na semana ${formatarPercentual(
        variacaoSemana,
      )} ${nivelSemana?.emoji ?? ''}`.trim(),
    );
  }

  // Contra o CDI: cada lote com a sua própria data de compra.
  const comCdi = lotes.filter((lote) => lote.cdiNoPeriodo !== null);
  if (comCdi.length) {
    const linhasCdi = [['Lote', 'CDI no período', 'Diferença']];
    const rotulo = (lote) => `${formatarNumero(lote.quantidade, 0)} ${lote.quantidade === 1 ? 'cota' : 'cotas'}`;
    for (const lote of comCdi) {
      linhasCdi.push([
        rotulo(lote),
        formatarPercentual(lote.cdiNoPeriodo),
        `${seta(lote.vsCdi)}${formatarNumero(Math.abs(lote.vsCdi) * 100, 1)} p.p. ${lote.nivelVsCdi?.emoji ?? ''}`.trim(),
      ]);
    }
    if (comCdi.length > 1) {
      const mercado = soma(comCdi.map((lote) => lote.mercado));
      const noCdi = soma(comCdi.map((lote) => lote.investido * (1 + lote.cdiNoPeriodo)));
      const contra = noCdi && mercado !== null ? mercado / noCdi - 1 : null;
      if (contra !== null) {
        linhasCdi.push([
          'soma',
          reais(noCdi),
          `${formatarPercentual(contra)} ${nivelDeResultado(contra)?.emoji ?? ''}`.trim(),
        ]);
      }
    }
    blocos.push('Contra o CDI (o que o mesmo dinheiro teria rendido)');
    blocos.push(tabela(linhasCdi, { colunas: ['esq', 'dir', 'dir'] }));
  }
  return blocos.join('\n');
}

export function blocoCarteira(posicoes) {
  const pendencias = new Set();
  if (!posicoes.length) return { texto: 'CARTEIRA\nnenhuma posição em carteira.json', pendencias };
  const partes = ['CARTEIRA'];
  for (const [ticker, lotes] of agruparPorTicker(posicoes)) {
    partes.push(tabelaDoTicker(ticker, lotes, pendencias));
  }
  return { texto: partes.join('\n'), pendencias };
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
  const nivelDolar = nivelDeResultado(variacaoDolar);
  const emPontos = (valor) => `${seta(valor)}${formatarNumero(Math.abs(valor))} p.p.`;

  const linhas = [['Indicador', 'Valor', 'Semana']];
  linhas.push([
    'Meta Selic',
    semDado(meta) ? '–' : `${formatarNumero(meta.valor)}%`,
    deltaMeta === null ? '' : emPontos(deltaMeta),
  ]);
  linhas.push([
    'CDI',
    semDado(cdi) ? '–' : `${formatarNumero(cdi.valor)}%`,
    deltaCdi === null ? '' : emPontos(deltaCdi),
  ]);
  linhas.push(['IPCA (12m)', semDado(ipca) ? '–' : `${formatarNumero(ipca.valor)}%`, '']);
  linhas.push(['Juro real', semDado(juroReal) ? '–' : `${formatarNumero(juroReal.valor)}%`, '']);
  linhas.push([
    'Dólar',
    semDado(dolar) ? '–' : `R$ ${formatarNumero(dolar.valor, 4)}`,
    variacaoDolar === null
      ? ''
      : `${seta(variacaoDolar)}${formatarPercentual(Math.abs(variacaoDolar))} ${nivelDolar.emoji}`,
  ]);

  const notas = ['taxas ao ano · juro real = meta Selic acima do IPCA'];
  if (cdi?.extra) notas.push(`CDI acumulado em 12 meses: ${formatarPercentual(cdi.extra.percentual)}`);
  return `MACRO\n${tabela(linhas, { colunas: ['esq', 'dir', 'dir'] })}\n${notas.join(' · ')}`;
}

// A reserva não é rentabilidade: aqui a cor é o progresso até a meta de meses.
export function nivelDaReserva(meses, alvoMeses) {
  const proporcao = alvoMeses ? meses / alvoMeses : 0;
  if (proporcao >= 1.5) return NIVEIS[0]; // 🔵 bem acima da meta
  if (proporcao >= 1) return NIVEIS[1]; // 🟢 meta batida
  if (proporcao > 0) return NIVEIS[3]; // 🟡 em construção
  return NIVEIS[4]; // 🔴 nada guardado
}

export function resumoReserva(reserva, { custoMensal, alvoMeses = reserva?.alvoMeses ?? 6 } = {}) {
  const pendencias = new Set();
  const custo = Number(custoMensal) || Number(reserva?.custoMensal) || 0;
  const detalhe = Array.isArray(reserva?.detalhe) ? reserva.detalhe : [];
  const total = detalhe.reduce((acumulado, item) => acumulado + (Number(item.saldo) || 0), 0);
  const atual = detalhe.length ? total : Number(reserva?.atual) || 0;

  if (!custo || !atual) {
    pendencias.add('preencha custoMensal e o saldo da reserva em carteira.json');
    return { texto: 'RESERVA\nsem dado para calcular', pendencias };
  }

  const meses = atual / custo;
  const blocos = [
    `RESERVA\n${tabela(
      [
        ['Saldo', reais(atual)],
        [
          'Cobertura',
          `${formatarNumero(meses, 1)} meses de custo (meta ${alvoMeses}) ${nivelDaReserva(meses, alvoMeses).emoji}`,
        ],
      ],
      { colunas: ['esq', 'dir'] },
    )}`,
  ];

  if (detalhe.length) {
    const saldos = [['Onde', 'Saldo']];
    for (const item of detalhe) saldos.push([encurtar(item.nome, 20), formatarNumero(item.saldo, 2)]);
    blocos.push(tabela(saldos, { colunas: ['esq', 'dir'] }));

    const medidos = detalhe.filter((item) => item.medido);
    const prometidos = detalhe.filter((item) => !item.medido && item.taxaCDI);

    for (const item of detalhe) {
      if (!item.medido && (item.taxaCDI || item.rendimento)) {
        pendencias.add(`informe dataAporte e rendimento de ${item.nome} para eu medir`);
      }
    }
    if (medidos.length) {
      const linhas = [['Onde', 'Taxa a.a.', '% do CDI']];
      for (const item of medidos) {
        const entregou = item.taxaCDI
          ? item.medido.percentualDoCdi >= item.taxaCDI - 0.02
          : item.medido.percentualDoCdi >= 1;
        linhas.push([
          encurtar(item.nome, 20),
          formatarPercentual(item.medido.taxaAnual),
          item.medido.percentualDoCdi === null
            ? '–'
            : `${formatarPercentual(item.medido.percentualDoCdi, 0)} ${entregou ? '🟢' : '🟡'}`,
        ]);
      }
      blocos.push(tabela(linhas, { colunas: ['esq', 'dir', 'dir'] }));
    }

    if (prometidos.length) {
      const linhas = [['Onde', 'Taxa']];
      for (const item of prometidos) {
        linhas.push([encurtar(item.nome, 20), `${formatarPercentual(item.taxaCDI, 0)} do CDI`]);
      }
      blocos.push(tabela(linhas, { colunas: ['esq', 'dir'] }));
    }
  }
  return { texto: blocos.join('\n\n'), pendencias };
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
  blocos.push(macro);

  const carteira = blocoCarteira(posicoes);
  blocos.push(carteira.texto);

  const blocoReserva = resumoReserva(reserva, { custoMensal });
  blocos.push(blocoReserva.texto);

  if (receitaMensal && custoMensal) {
    blocos.push(
      `SOBRA DO MÊS\n${tabela(
        [
          ['Receita', reais(receitaMensal)],
          ['Custo', `-${reais(custoMensal)}`],
          ['Livre', reais(receitaMensal - custoMensal)],
        ],
        { colunas: ['esq', 'dir'] },
      )}`,
    );
  }
  if (aporteMensal) blocos.push(`APORTE\nprogramado  ${reais(aporteMensal)} por mês`);

  blocos.push(`PERGUNTA DA SEMANA (${numeroDaSemana(data)})\n${perguntaDaSemana(data)}`);
  blocos.push(`LEGENDA: ${legendaNiveis()}`);

  const pendencias = new Set([...carteira.pendencias, ...blocoReserva.pendencias, ...avisos]);
  if (pendencias.size) {
    blocos.push(`PENDÊNCIAS\n${[...pendencias].map((item) => `- ${item}`).join('\n')}`);
  }

  return blocos.join('\n\n');
}

