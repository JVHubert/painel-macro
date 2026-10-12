// Texto do relatório semanal: contas e frases puras, testáveis com `node --test`.
// Sai tudo em texto monoespaçado (o Telegram recebe dentro de <pre>), com colunas alinhadas.
import {
  NIVEIS,
  anualizarDiaria,
  formatarData,
  formatarNumero,
  formatarPercentual,
  hojeEmBrasilia,
  legendaNiveis,
  nivelDeResultado,
  valorAntes,
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

// Diferença, em pontos percentuais, entre o último ponto até `hoje` e o ponto de `dias` antes.
// `transformar` leva a taxa do ponto para a escala da conta (o CDI, por exemplo, vem ao dia).
// Sem mudança no período, a diferença é 0 — e não "a última mudança contra a anterior".
export function deltaPeriodo(serie, dias, { hoje, transformar = (valor) => valor } = {}) {
  if (!Array.isArray(serie) || serie.length < 2 || !hoje) return null;
  const fim = valorAntes(serie, hoje);
  const base = valorAntes(serie, deslocarDias(hoje, -dias));
  if (!fim || !base) return null;
  return transformar(fim.valor) - transformar(base.valor);
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

export function agruparPorTicker(posicoes) {
  const mapa = new Map();
  for (const posicao of posicoes) {
    mapa.set(posicao.ticker, [...(mapa.get(posicao.ticker) ?? []), posicao]);
  }
  return mapa;
}

// Totais de um papel (um ou vários lotes), inclusive contra o CDI de cada lote.
export function totaisDoTicker(lotes) {
  const quantidade = soma(lotes.map((lote) => lote.quantidade));
  const mercado = soma(lotes.map((lote) => lote.mercado));
  const investido = soma(lotes.map((lote) => lote.investido));
  const noCdi = soma(
    lotes.map((lote) =>
      typeof lote.investido === 'number' && typeof lote.cdiNoPeriodo === 'number'
        ? lote.investido * (1 + lote.cdiNoPeriodo)
        : null,
    ),
  );
  return {
    quantidade,
    mercado,
    investido,
    rentabilidade: investido && mercado !== null ? mercado / investido - 1 : null,
    noCdi,
    contraCdi: noCdi && mercado !== null ? mercado / noCdi - 1 : null,
  };
}

function tabelaDoTicker(ticker, lotes, pendencias) {
  const blocos = [];
  const totais = totaisDoTicker(lotes);
  blocos.push(`${ticker} (${totais.quantidade} ${totais.quantidade === 1 ? 'cota' : 'cotas'})`);

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
    linhas.push([
      'soma',
      totais.investido === null ? '–' : reais(totais.investido),
      totais.mercado === null ? '–' : reais(totais.mercado),
      totais.rentabilidade === null
        ? '–'
        : `${formatarPercentual(totais.rentabilidade)} ${nivelDeResultado(totais.rentabilidade)?.emoji ?? ''}`.trim(),
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
    if (comCdi.length > 1 && totais.contraCdi !== null) {
      linhasCdi.push([
        'soma',
        reais(totais.noCdi),
        `${formatarPercentual(totais.contraCdi)} ${nivelDeResultado(totais.contraCdi)?.emoji ?? ''}`.trim(),
      ]);
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

// Dados do macro em linhas prontas: o texto e o HTML saem da mesma fonte.
export function dadosMacro(painel, { dias = 7, hoje } = {}) {
  // Sem `hoje` explícito, vale o dia dos dados do painel (o relatório roda no mesmo dia da coleta).
  const dia = hoje ?? hojeEmBrasilia(painel?.atualizadoEm ? new Date(painel.atualizadoEm) : new Date());
  const achar = (id) => painel?.indicadores?.find((cartao) => cartao.id === id) ?? null;
  const semDado = (cartao) => !cartao || cartao.valor === null;

  const meta = achar('meta-selic');
  const cdi = achar('cdi');
  const ipca = achar('ipca');
  const juroReal = achar('juro-real');
  const dolar = achar('dolar');

  const deltaMeta = meta && !semDado(meta) ? deltaPeriodo(meta.serie, dias, { hoje: dia }) : null;
  const deltaCdi =
    cdi && !semDado(cdi)
      ? deltaPeriodo(cdi.serie, dias, { hoje: dia, transformar: (taxa) => anualizarDiaria(taxa) * 100 })
      : null;
  const variacaoDolar = dolar && !semDado(dolar) ? variacaoPeriodo(dolar.serie, dias) : null;
  const emPontos = (valor) => `${seta(valor)}${formatarNumero(Math.abs(valor))} p.p.`;

  const notas = ['taxas ao ano · juro real = meta Selic acima do IPCA'];
  if (cdi?.extra) notas.push(`CDI acumulado em 12 meses: ${formatarPercentual(cdi.extra.percentual)}`);

  return {
    linhas: [
      {
        nome: 'Meta Selic',
        valor: semDado(meta) ? '–' : `${formatarNumero(meta.valor)}%`,
        semana: deltaMeta === null ? '' : emPontos(deltaMeta),
      },
      {
        nome: 'CDI',
        valor: semDado(cdi) ? '–' : `${formatarNumero(cdi.valor)}%`,
        semana: deltaCdi === null ? '' : emPontos(deltaCdi),
      },
      { nome: 'IPCA (12m)', valor: semDado(ipca) ? '–' : `${formatarNumero(ipca.valor)}%`, semana: '' },
      { nome: 'Juro real', valor: semDado(juroReal) ? '–' : `${formatarNumero(juroReal.valor)}%`, semana: '' },
      {
        nome: 'Dólar',
        valor: semDado(dolar) ? '–' : `R$ ${formatarNumero(dolar.valor, 4)}`,
        semana: variacaoDolar === null ? '' : `${seta(variacaoDolar)}${formatarPercentual(Math.abs(variacaoDolar))}`,
        fracao: variacaoDolar,
      },
    ],
    notas,
  };
}

export function resumoMacro(painel, opcoes = {}) {
  const { linhas, notas } = dadosMacro(painel, opcoes);
  const corpo = [['Indicador', 'Valor', 'Semana']];
  for (const linha of linhas) {
    const emoji = linha.fracao === undefined ? '' : ` ${nivelDeResultado(linha.fracao)?.emoji ?? ''}`.trimEnd();
    corpo.push([linha.nome, linha.valor, `${linha.semana}${emoji}`]);
  }
  return `MACRO\n${tabela(corpo, { colunas: ['esq', 'dir', 'dir'] })}\n${notas.join(' · ')}`;
}

// A reserva não é rentabilidade: aqui a cor é o progresso até a meta de meses.
export function nivelDaReserva(meses, alvoMeses) {
  const proporcao = alvoMeses ? meses / alvoMeses : 0;
  if (proporcao >= 1.5) return NIVEIS[0]; // 🔵 bem acima da meta
  if (proporcao >= 1) return NIVEIS[1]; // 🟢 meta batida
  if (proporcao > 0) return NIVEIS[3]; // 🟡 em construção
  return NIVEIS[4]; // 🔴 nada guardado
}

// Faixa do "% do CDI": compara com o prometido, se houver promessa.
export function nivelDoCdi(percentualDoCdi, taxaCDI) {
  if (percentualDoCdi === null || percentualDoCdi === undefined) return null;
  if (taxaCDI) return percentualDoCdi >= taxaCDI - 0.02 ? NIVEIS[1] : NIVEIS[3]; // 🟢 ou 🟡
  if (percentualDoCdi >= 1) return NIVEIS[1]; // 🟢 bateu o CDI
  if (percentualDoCdi >= 0.8) return NIVEIS[3]; // 🟡 perto do CDI
  return NIVEIS[4]; // 🔴 bem abaixo
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
        const nivel = nivelDoCdi(item.medido.percentualDoCdi, item.taxaCDI);
        linhas.push([
          encurtar(item.nome, 20),
          formatarPercentual(item.medido.taxaAnual),
          item.medido.percentualDoCdi === null
            ? '–'
            : `${formatarPercentual(item.medido.percentualDoCdi, 0)} ${nivel?.emoji ?? ''}`.trim(),
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

  const { carteira, blocoReserva, pendencias } = juntarPendencias({
    posicoes,
    reserva,
    custoMensal,
    avisos,
  });
  blocos.push(carteira.texto);
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

  if (pendencias.size) {
    blocos.push(`PENDÊNCIAS\n${[...pendencias].map((item) => `- ${item}`).join('\n')}`);
  }

  return blocos.join('\n\n');
}

// Carteira e reserva mais as pendências das duas: texto e HTML partem daqui.
export function juntarPendencias({ posicoes = [], reserva, custoMensal, avisos = [] }) {
  const carteira = blocoCarteira(posicoes);
  const blocoReserva = resumoReserva(reserva, { custoMensal });
  const pendencias = new Set([...carteira.pendencias, ...blocoReserva.pendencias, ...avisos]);
  return { carteira, blocoReserva, pendencias };
}

