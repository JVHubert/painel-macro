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
import { perguntaDaSemana } from './trilha.js';

const reais = (valor) => `R$ ${formatarNumero(valor, 2)}`;
const seta = (valor) => (valor > 0 ? '+' : valor < 0 ? '-' : '=');
const plural = (quantidade, singular, pluralDaPalavra) =>
  `${quantidade} ${quantidade === 1 ? singular : pluralDaPalavra}`;

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

// O ano da semana ISO, que não é sempre o ano da data: 03/01/2027 ainda é a semana 53 de 2026.
export function anoDaSemana(dataIso) {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + 4 - (data.getUTCDay() || 7));
  return data.getUTCFullYear();
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

// Uma linha por papel. Os lotes só aparecem quando divergem mais de 5 p.p. entre si.
export function linhasDaCarteira(posicoes, { patrimonio = null } = {}) {
  const pendencias = new Set();
  const linhas = [];
  for (const [ticker, lotes] of agruparPorTicker(posicoes)) {
    const totais = totaisDoTicker(lotes);
    for (const lote of lotes) {
      if (lote.investido === null) pendencias.add(`preencha o precoMedio de ${ticker} em carteira.json`);
      if (!lote.dataCompra) pendencias.add(`informe dataCompra de ${ticker} para comparar com o CDI`);
    }
    const rentabilidades = lotes.map((lote) => lote.rentabilidade).filter((valor) => valor !== null);
    linhas.push({
      ticker,
      quantidade: totais.quantidade,
      aplicado: totais.investido === null ? '–' : reais(totais.investido),
      hoje: totais.mercado === null ? '–' : reais(totais.mercado),
      resultado: totais.rentabilidade === null ? '–' : formatarPercentual(totais.rentabilidade),
      nivel: nivelDeResultado(totais.rentabilidade),
      fracao: patrimonio && totais.mercado !== null ? totais.mercado / patrimonio : null,
      divergem: rentabilidades.length > 1 && Math.max(...rentabilidades) - Math.min(...rentabilidades) > 0.05,
      fraseCdi:
        totais.noCdi !== null && totais.mercado !== null
          ? `Se o mesmo dinheiro tivesse ficado no CDI: ${reais(totais.noCdi)} (hoje: ${reais(totais.mercado)})`
          : null,
      lotes: lotes.map((lote) => ({
        quantidade: formatarNumero(lote.quantidade, 0),
        aplicado: lote.investido === null ? '–' : reais(lote.investido),
        hoje: lote.mercado === null ? '–' : reais(lote.mercado),
        resultado: lote.rentabilidade === null ? '–' : formatarPercentual(lote.rentabilidade),
        nivel: lote.nivel,
      })),
    });
  }
  return { linhas, pendencias };
}

export function blocoCarteira(posicoes, { patrimonio = null } = {}) {
  const { linhas, pendencias } = linhasDaCarteira(posicoes, { patrimonio });
  if (!linhas.length) return { texto: 'CARTEIRA\nnenhuma posição em carteira.json', pendencias };

  const comFracao = linhas.some((linha) => linha.fracao !== null);
  const cabecalho = ['Ticker', 'Aplicado', 'Hoje', 'Resultado', ...(comFracao ? ['% do patrimônio'] : [])];
  const corpo = [cabecalho];
  for (const linha of linhas) {
    corpo.push([
      linha.ticker,
      linha.aplicado,
      linha.hoje,
      `${linha.resultado} ${linha.nivel?.emoji ?? ''}`.trim(),
      ...(comFracao ? [linha.fracao === null ? '–' : formatarPercentual(linha.fracao, 1)] : []),
    ]);
  }

  const partes = ['CARTEIRA', tabela(corpo, { colunas: cabecalho.map((_, i) => (i === 0 ? 'esq' : 'dir')) })];
  for (const linha of linhas) {
    if (linha.fraseCdi) partes.push(linha.fraseCdi);
    if (linha.divergem) {
      partes.push(`lotes de ${linha.ticker}:`);
      partes.push(
        tabela(
          [
            ['Qtd', 'Aplicado', 'Hoje', 'Resultado'],
            ...linha.lotes.map((lote) => [
              lote.quantidade,
              lote.aplicado,
              lote.hoje,
              `${lote.resultado} ${lote.nivel?.emoji ?? ''}`.trim(),
            ]),
          ],
          { colunas: ['dir', 'dir', 'dir', 'dir'] },
        ),
      );
    }
  }
  partes.push('só preço; não inclui dividendos nem imposto');
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

  const notas = ['taxas ao ano · juro real = CDI dos últimos 12 meses acima do IPCA'];
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
        // Câmbio subir ou cair não é bom nem ruim para quem poupa: aqui não entra cor.
        semana: variacaoDolar === null ? '' : `${seta(variacaoDolar)}${formatarPercentual(Math.abs(variacaoDolar))}`,
      },
    ],
    notas,
  };
}

export function resumoMacro(painel, opcoes = {}) {
  const { linhas, notas } = dadosMacro(painel, opcoes);
  const corpo = [['Indicador', 'Valor', 'Semana']];
  for (const linha of linhas) corpo.push([linha.nome, linha.valor, linha.semana]);
  return `MACRO\n${tabela(corpo, { colunas: ['esq', 'dir', 'dir'] })}\n${notas.join(' · ')}`;
}

// A reserva não é rentabilidade: aqui a cor é o progresso até a meta de meses.
export function nivelDaReserva(meses, alvoMeses) {
  const proporcao = alvoMeses ? meses / alvoMeses : 0;
  if (proporcao >= 1.5) return NIVEIS[2]; // ⚪ bem acima da meta: sobra decisão pendente, não conquista
  if (proporcao >= 1) return NIVEIS[1]; // 🟢 meta batida
  if (proporcao > 0) return NIVEIS[3]; // 🟡 em construção
  return NIVEIS[4]; // 🔴 nada guardado
}

// Dinheiro parado acima da meta é decisão pendente: a frase cobra o registro no diário.
export function notaDoExcedente({ meses, alvoMeses, atual, custo }) {
  if (meses < alvoMeses * 1.5) return null;
  const excedente = atual - alvoMeses * custo;
  if (excedente <= 0) return null;
  return `${reais(excedente)} acima da meta de ${alvoMeses} meses — dinheiro que pode ir para prazo maior. Registre a decisão no diário.`;
}

// Faixa do "% do CDI": compara com o prometido, se houver promessa.
export function nivelDoCdi(percentualDoCdi, taxaCDI) {
  if (percentualDoCdi === null || percentualDoCdi === undefined) return null;
  if (taxaCDI) return percentualDoCdi >= taxaCDI - 0.02 ? NIVEIS[1] : NIVEIS[3]; // 🟢 ou 🟡
  if (percentualDoCdi >= 1) return NIVEIS[1]; // 🟢 bateu o CDI
  if (percentualDoCdi >= 0.8) return NIVEIS[3]; // 🟡 perto do CDI
  return NIVEIS[4]; // 🔴 bem abaixo
}

// ---- números do topo ----

export function totalDaReserva(reserva) {
  const detalhe = Array.isArray(reserva?.detalhe) ? reserva.detalhe : [];
  return detalhe.length
    ? detalhe.reduce((total, item) => total + (Number(item.saldo) || 0), 0)
    : Number(reserva?.atual) || 0;
}

// Quantos meses de custo a reserva cobre (null quando falta dado).
export function mesesDeReserva({ reserva, custoMensal } = {}) {
  const custo = Number(custoMensal) || Number(reserva?.custoMensal) || 0;
  const total = totalDaReserva(reserva);
  return custo && total ? total / custo : null;
}

// Onde o dinheiro está hoje (reserva x ações). Os baldes da política entram no Nível 3.
export function alocacao({ reserva, posicoes = [] } = {}) {
  const naReserva = totalDaReserva(reserva);
  const emAcoes = posicoes.reduce((total, posicao) => total + (Number(posicao.mercado) || 0), 0);
  const total = naReserva + emAcoes;
  if (!total) return { total: 0, partes: [] };
  return {
    total,
    partes: [
      { nome: 'Reserva', valor: naReserva },
      { nome: 'Ações', valor: emAcoes },
    ]
      .filter((parte) => parte.valor > 0)
      .map((parte) => ({ ...parte, fracao: parte.valor / total })),
  };
}

// Estimativa da variação do patrimônio na semana: a carteira pelo preço do dia e a reserva
// no ritmo do CDI. É estimativa — o extrato de verdade não está aqui.
export function variacaoDaSemana({ painel, posicoes = [], reserva } = {}) {
  const { total, partes } = alocacao({ reserva, posicoes });
  if (!total) return null;
  const comPreco = posicoes.filter((posicao) => typeof posicao.variacaoSemana === 'number' && posicao.mercado);
  const mercado = comPreco.reduce((soma, posicao) => soma + posicao.mercado, 0);
  const carteira = mercado
    ? comPreco.reduce((soma, posicao) => soma + posicao.mercado * posicao.variacaoSemana, 0) / mercado
    : 0;
  const cdi = painel?.indicadores?.find((cartao) => cartao.id === 'cdi')?.valor ?? null;
  const reservaNaSemana = cdi === null ? 0 : (1 + cdi / 100) ** (7 / 252) - 1;
  const pesoDaCarteira = partes.find((parte) => parte.nome === 'Ações')?.fracao ?? 0;
  return pesoDaCarteira * carteira + (1 - pesoDaCarteira) * reservaNaSemana;
}

// A frase do topo: o que a semana fez com o patrimônio e onde a reserva está. Regras, não IA.
export function fraseResumo(dados = {}) {
  const frases = [];
  const variacao = variacaoDaSemana(dados);
  if (variacao !== null) {
    frases.push(`Patrimônio ≈ ${seta(variacao)}${formatarPercentual(Math.abs(variacao))} na semana.`);
  }
  const meses = mesesDeReserva(dados);
  if (meses !== null) {
    const alvo = Number(dados.reserva?.alvoMeses) || 6;
    const cobertura = `${formatarNumero(meses, 1)} meses de custo`;
    if (meses >= alvo * 1.5) frases.push(`Reserva segue bem acima da meta (${cobertura}).`);
    else if (meses >= alvo) frases.push(`Reserva bateu a meta (${cobertura}).`);
    else frases.push(`Reserva cobre ${cobertura} (meta ${alvo}).`);
  }
  return frases.join(' ');
}

// Até 3 ações para a semana, em ordem de prioridade, mais a pergunta do estudo.
export function paraEstaSemana(dados = {}) {
  const itens = [];
  const custo = Number(dados.custoMensal) || 0;
  const alvo = Number(dados.reserva?.alvoMeses) || 6;
  const meses = mesesDeReserva(dados);

  if (meses !== null && meses >= alvo * 1.5 && custo) {
    const excedente = totalDaReserva(dados.reserva) - alvo * custo;
    itens.push(`${reais(excedente)} acima da meta de ${alvo} meses — decida o destino e registre no diário.`);
  }

  for (const item of dados.reserva?.detalhe ?? []) {
    if (itens.length >= 3) break;
    const percentual = item.medido?.percentualDoCdi;
    if (percentual === null || percentual === undefined) continue;
    const promessa = Number(item.taxaCDI) || null;
    if (percentual < 0.9 || (promessa !== null && percentual < promessa - 0.02)) {
      itens.push(`${item.nome} rende ${formatarPercentual(percentual, 0)} do CDI.`);
    }
  }

  // Diário e estudo só entram quando o relatório roda na máquina do JV (os arquivos são privados).
  const caderno = dados.caderno ?? {};
  if (itens.length < 3 && caderno.decisoesVencidas) {
    itens.push(`${plural(caderno.decisoesVencidas, 'decisão', 'decisões')} do diário para revisar.`);
  }
  if (itens.length < 3 && caderno.decisoesSemTese) {
    itens.push(`${plural(caderno.decisoesSemTese, 'decisão', 'decisões')} do diário sem tese escrita.`);
  }
  if (itens.length < 3 && caderno.respostaDaSemanaVazia) {
    itens.push('A resposta da semana continua vazia.');
  }

  return { itens, pergunta: perguntaDaSemana(dados.data)?.texto ?? '' };
}

// O marco na língua de quem lê: 25000 vira R$ 25 mil, 1000000 vira R$ 1 milhão.
export function rotuloDoMarco(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '';
  if (numero >= 1000000) {
    const milhoes = numero / 1000000;
    const texto = milhoes.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return `R$ ${texto} ${milhoes < 2 ? 'milhão' : 'milhões'}`;
  }
  if (numero >= 1000) return `R$ ${(numero / 1000).toLocaleString('pt-BR')} mil`;
  return reais(numero);
}

const barraDeTexto = (fracao, largura = 18) => {
  const preenchido = Math.round(Math.min(1, Math.max(0, Number(fracao) || 0)) * largura);
  return `[${'█'.repeat(preenchido)}${'░'.repeat(largura - preenchido)}]`;
};

// A comemoração: quando o marco é confirmado, ela vira o primeiro cartão do relatório.
export function cartaoDaComemoracao(comemoracoes) {
  if (!comemoracoes?.length) return null;
  const linhas = [];
  for (const comemoracao of comemoracoes) {
    const nome = comemoracao.premio ? ` — ${comemoracao.premio}` : '';
    linhas.push(
      `Você passou de ${rotuloDoMarco(comemoracao.marco)} além da reserva! Prêmio liberado: até ${reais(
        comemoracao.valorLiberado,
      )}${nome} · compre até ${formatarData(comemoracao.prazo)}.`,
    );
  }
  linhas.push('Depois de comprar, mande no Telegram: /premio <valor gasto> | <a frase que você quer guardar>');
  return `🎉 MARCO BATIDO\n${linhas.join('\n')}`;
}

// O cartão do jogo dos marcos (F0.5c): a barra até o próximo marco, o que falta e o prêmio.
export function cartaoDoJogo(jogo) {
  if (!jogo) return null;

  const linhas = [];
  if (!jogo.proximoMarco) {
    linhas.push(`${barraDeTexto(1)} 100%`);
    linhas.push('Você passou do último marco da lista — hora de escolher os próximos.');
    return `JOGO DOS MARCOS\n${linhas.join('\n')}`;
  }

  linhas.push(`${barraDeTexto(jogo.percentual)} ${formatarPercentual(jogo.percentual, 0)}`);

  const pedacos = [`Próximo marco: ${rotuloDoMarco(jogo.proximoMarco)}`, `faltam ${reais(jogo.falta)}`];
  if (!Number.isFinite(jogo.meses)) {
    pedacos.push('no ritmo atual não chega');
  } else if (jogo.meses > 0) {
    pedacos.push(`~${plural(jogo.meses, 'mês', 'meses')} no ritmo atual`);
  } else {
    pedacos.push('bateu o marco — falta a confirmação de mais um domingo');
  }
  linhas.push(`${pedacos.join(' · ')} (reserva de emergência fora da conta)`);

  if (jogo.premio?.item) {
    const juros = jogo.juros?.fracao;
    const pedacoDeJuros = Number.isFinite(juros) ? ` · nesse trecho, ~${formatarPercentual(juros, 0)} virá dos juros` : '';
    linhas.push(`Prêmio: até ${reais(jogo.premio.valor)} → ${jogo.premio.item.nome}${pedacoDeJuros}`);
  } else {
    linhas.push(`Prêmio: escolha o prêmio do marco de ${rotuloDoMarco(jogo.proximoMarco)}`);
  }

  if (jogo.semHistorico) {
    linhas.push('(primeiro domingo do histórico: a confirmação do marco começa no próximo)');
  }

  const aberto = jogo.premioAberto;
  if (aberto && !aberto.expirado) {
    const nome = aberto.premio ? ` — ${aberto.premio}` : '';
    linhas.push(
      `Prêmio liberado: até ${reais(aberto.valorLiberado)}${nome} · compre até ${formatarData(
        aberto.prazo,
      )} (${plural(aberto.diasAteOPrazo, 'dia', 'dias')})`,
    );
  } else if (aberto?.expirado) {
    linhas.push(`Prêmio do marco de ${rotuloDoMarco(aberto.marco)} expirou · o dinheiro fica investido`);
  }

  return `JOGO DOS MARCOS\n${linhas.join('\n')}`;
}

// A reserva numa tabela só: onde está, quanto tem, o que rende e quanto isso é do CDI.
export function linhasDaReserva(reserva) {
  const pendencias = new Set();
  const linhas = [];
  for (const item of reserva?.detalhe ?? []) {
    const medido = item.medido ?? null;
    if (!medido && (item.taxaCDI || item.rendimento)) {
      pendencias.add(`informe dataAporte e rendimento de ${item.nome} para eu medir`);
    }
    const percentual = medido?.percentualDoCdi;
    linhas.push({
      onde: encurtar(item.nome, 20),
      saldo: formatarNumero(item.saldo, 2),
      rende: medido
        ? formatarPercentual(medido.taxaAnual)
        : item.taxaCDI
          ? `${formatarPercentual(item.taxaCDI, 0)} do CDI`
          : '–',
      vsCdi: percentual === null || percentual === undefined ? '–' : formatarPercentual(percentual, 0),
      nivel: medido ? nivelDoCdi(percentual, item.taxaCDI) : null,
    });
  }
  return { linhas, pendencias };
}

export function resumoReserva(reserva, { custoMensal, alvoMeses = reserva?.alvoMeses ?? 6 } = {}) {
  const pendencias = new Set();
  const custo = Number(custoMensal) || Number(reserva?.custoMensal) || 0;
  const atual = totalDaReserva(reserva);

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

  const notaExcedente = notaDoExcedente({ meses, alvoMeses, atual, custo });
  if (notaExcedente) blocos.push(notaExcedente);

  const { linhas, pendencias: faltando } = linhasDaReserva(reserva);
  for (const item of faltando) pendencias.add(item);
  if (linhas.length) {
    blocos.push(
      tabela(
        [
          ['Onde', 'Saldo', 'Rende', 'vs CDI'],
          ...linhas.map((linha) => [
            linha.onde,
            linha.saldo,
            linha.rende,
            `${linha.vsCdi} ${linha.nivel?.emoji ?? ''}`.trim(),
          ]),
        ],
        { colunas: ['esq', 'dir', 'dir', 'dir'] },
      ),
    );
  }
  return { texto: blocos.join('\n\n'), pendencias };
}

export function montarRelatorio(dados = {}) {
  const { data, painel, receitaMensal, custoMensal, aporteMensal } = dados;

  const blocos = [
    `📊 Relatório semanal — ${formatarData(data)} · semana ${numeroDaSemana(data)}\n${fraseResumo(dados)}`,
  ];

  const comemoracao = cartaoDaComemoracao(dados.jogo?.comemoracoes);
  if (comemoracao) blocos.push(comemoracao);

  const semana = paraEstaSemana(dados);
  const itensDaSemana = semana.itens.map((item, i) => `${i + 1}. ${item}`);
  itensDaSemana.push(`Pergunta da semana: ${semana.pergunta}`);
  if (dados.caderno?.placar?.linha) itensDaSemana.push(dados.caderno.placar.linha);
  blocos.push(`PARA ESTA SEMANA\n${itensDaSemana.join('\n')}`);

  const cartao = cartaoDoJogo(dados.jogo);
  if (cartao) blocos.push(cartao);

  const { total, partes } = alocacao(dados);
  const variacao = variacaoDaSemana(dados);
  const linhasDoPatrimonio = [['Total', reais(total)]];
  if (variacao !== null) {
    linhasDoPatrimonio.push(['Na semana (estimativa)', `${seta(variacao)}${formatarPercentual(Math.abs(variacao))}`]);
  }
  blocos.push(`PATRIMÔNIO\n${tabela(linhasDoPatrimonio, { colunas: ['esq', 'dir'] })}`);
  if (partes.length) {
    blocos.push(partes.map((parte) => `${parte.nome} ${formatarPercentual(parte.fracao, 1)}`).join(' · '));
  }

  const { carteira, blocoReserva, pendencias } = juntarPendencias({ ...dados, patrimonio: total });
  blocos.push(blocoReserva.texto);
  blocos.push(carteira.texto);

  if (receitaMensal && custoMensal) {
    const sobra = receitaMensal - custoMensal;
    const semDestino = sobra - (Number(aporteMensal) || 0);
    const pedacos = [`Sobra ${reais(sobra)}`];
    if (aporteMensal) pedacos.push(`aporte programado ${reais(aporteMensal)}`);
    pedacos.push(semDestino > 0 ? `sobram ${reais(semDestino)} sem destino` : 'nada sobrando sem destino');
    blocos.push(`SOBRA DO MÊS\n${pedacos.join(' · ')}`);
  }

  blocos.push(resumoMacro(painel));
  blocos.push(`LEGENDA: ${legendaNiveis()}`);
  if (pendencias.size) {
    blocos.push(`PENDÊNCIAS\n${[...pendencias].map((item) => `- ${item}`).join('\n')}`);
  }

  return blocos.join('\n\n');
}

// Carteira e reserva mais as pendências das duas: texto e HTML partem daqui.
export function juntarPendencias({ posicoes = [], reserva, custoMensal, avisos = [], patrimonio = null }) {
  const carteira = blocoCarteira(posicoes, { patrimonio });
  const blocoReserva = resumoReserva(reserva, { custoMensal });
  const pendencias = new Set([...carteira.pendencias, ...blocoReserva.pendencias, ...avisos]);
  return { carteira, blocoReserva, pendencias };
}

