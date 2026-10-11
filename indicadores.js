// Contas do painel: sem DOM e sem internet, para poder testar com `node --test`.
// Tudo em fração (0.02 = 2%), exceto onde o nome diz "Percentual".

// Séries do Banco Central (SGS): https://api.bcb.gov.br
export const SERIES = {
  metaSelic: 432,
  selicDiaria: 11,
  cdiDiaria: 12,
  ipcaMensal: 433,
  dolar: 1,
};

const BASE_SGS = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';

export function urlSgs(codigo, dataInicial) {
  const parametros = new URLSearchParams({ formato: 'json', dataInicial });
  return `${BASE_SGS}.${codigo}/dados?${parametros}`;
}

export function dataBrParaIso(data) {
  const [dia, mes, ano] = data.split('/');
  return `${ano}-${mes}-${dia}`;
}

export function paraNumero(valor) {
  return Number(String(valor).replace(',', '.'));
}

export function paraSerie(bruto) {
  return (bruto ?? []).map((ponto) => ({
    data: dataBrParaIso(ponto.data),
    valor: paraNumero(ponto.valor),
  }));
}

export function deslocarMeses(dataIso, meses) {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const base = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  const novoDia = Math.min(dia, ultimoDia);
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  return `${base.getUTCFullYear()}-${mm}-${String(novoDia).padStart(2, '0')}`;
}

export function filtrarDesde(serie, dataIso) {
  return serie.filter((ponto) => ponto.data >= dataIso);
}

export function ultimos(serie, quantidade) {
  return serie.slice(-quantidade);
}

// Só os pontos em que o valor mudou (a meta Selic fica repetida todo dia útil).
export function mudancas(serie) {
  return serie.filter((ponto, i) => i === 0 || ponto.valor !== serie[i - 1].valor);
}

// Ponto mais recente com data menor ou igual ao limite (busca binária simples).
export function valorAntes(serie, dataIso) {
  let achado = null;
  for (const ponto of serie) {
    if (ponto.data > dataIso) break;
    achado = ponto;
  }
  return achado;
}

// Juros compostos de uma série de variações percentuais.
export function acumular(serie) {
  return serie.reduce((total, ponto) => total * (1 + ponto.valor / 100), 1) - 1;
}

// Taxa diária (%) para taxa ao ano (%): 252 dias úteis.
export function anualizarDiaria(taxaDiariaPercentual, diasUteis = 252) {
  return (1 + taxaDiariaPercentual / 100) ** diasUteis - 1;
}

// Juro real: quanto sobra depois de descontar a inflação.
export function juroReal(nominal, inflacao) {
  return (1 + nominal) / (1 + inflacao) - 1;
}

// Tabela regressiva do imposto de renda de renda fixa.
export const FAIXAS_IR = [
  { ateDias: 180, aliquota: 0.225, rotulo: 'até 180 dias' },
  { ateDias: 360, aliquota: 0.2, rotulo: '181 a 360 dias' },
  { ateDias: 720, aliquota: 0.175, rotulo: '361 a 720 dias' },
  { ateDias: Infinity, aliquota: 0.15, rotulo: 'acima de 720 dias' },
];

export function faixaIR(dias) {
  return FAIXAS_IR.find((faixa) => dias <= faixa.ateDias);
}

// Quanto sobra de um aporte no CDI, já com o imposto descontado.
export function simulacao({ valor, cdi, ipca, meses = 12 }) {
  const bruto = valor * ((1 + cdi) ** (meses / 12) - 1);
  const faixa = faixaIR(Math.round(meses * 30.4375));
  const imposto = bruto * faixa.aliquota;
  const liquido = bruto - imposto;
  const inflacao = valor * ((1 + ipca) ** (meses / 12) - 1);
  return {
    bruto,
    imposto,
    aliquota: faixa.aliquota,
    rotuloAliquota: faixa.rotulo,
    liquido,
    inflacao,
    ganhoReal: liquido - inflacao,
  };
}

// Minigráfico: série de pontos -> caminho SVG.
export function caminhoSparkline(serie, { largura = 120, altura = 32, margem = 3 } = {}) {
  const valores = serie.map((ponto) => ponto.valor);
  if (valores.length < 2) return '';
  const menor = Math.min(...valores);
  const faixa = Math.max(...valores) - menor || 1;
  const util = altura - margem * 2;
  return valores
    .map((valor, i) => {
      const x = (i / (valores.length - 1)) * largura;
      const y = margem + (1 - (valor - menor) / faixa) * util;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

const formatador = (casas) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function formatarNumero(valor, casas = 2) {
  return valor === null || valor === undefined || Number.isNaN(valor)
    ? '–'
    : formatador(casas).format(valor);
}

export function formatarPercentual(fracao, casas = 2) {
  return fracao === null || fracao === undefined || Number.isNaN(fracao)
    ? '–'
    : `${formatarNumero(fracao * 100, casas)}%`;
}

export function formatarData(dataIso) {
  if (!dataIso) return '–';
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

const EXPLICACOES = {
  'meta-selic':
    'Juros básicos definidos pelo Copom. Quando sobe, segura a inflação e faz a renda fixa pagar mais.',
  cdi: 'Taxa que os bancos cobram entre si. É o que rende a maior parte dos CDBs e a poupança do seu banco, quase sempre colada na Selic.',
  ipca: 'Inflação oficial do país. É o número que corrói o seu rendimento: ganhar menos que isso é perder poder de compra.',
  'juro-real': 'Quanto a renda fixa paga acima da inflação. É esse número que importa para quem poupa.',
  dolar: 'Preço do dólar. Serve de termômetro de risco e é a base do custo de qualquer investimento lá fora.',
};

// Dados brutos das APIs -> cartões prontos para a tela.
export function montarIndicadores(bruto = {}, { atualizadoEm = new Date().toISOString() } = {}) {
  const serie = (chave) => bruto[chave] ?? [];
  const ultimo = (chave) => serie(chave).at(-1) ?? null;

  const meta = ultimo('metaSelic');
  const metaAntes = meta ? valorAntes(serie('metaSelic'), deslocarMeses(meta.data, -12)) : null;

  const cdi = ultimo('cdiDiaria');
  const fim = cdi?.data ?? null;
  const cdi12Meses = fim ? acumular(filtrarDesde(serie('cdiDiaria'), deslocarMeses(fim, -12))) : null;

  const ipcaMensal = ultimos(serie('ipcaMensal'), 12);
  const ipca12Meses = ipcaMensal.length === 12 ? acumular(ipcaMensal) : null;

  const dolarSerie = serie('dolar');
  const agora = bruto.dolarAgora?.bid ? bruto.dolarAgora : null;
  const dolar = agora
    ? { valor: paraNumero(agora.bid), variacao: paraNumero(agora.pctChange) / 100 }
    : dolarSerie.length
      ? (() => {
          const fimDolar = dolarSerie.at(-1);
          const antes = dolarSerie.at(-2);
          return { valor: fimDolar.valor, variacao: antes ? fimDolar.valor / antes.valor - 1 : null };
        })()
      : null;

  const juroRealAtual = meta && ipca12Meses !== null ? juroReal(meta.valor / 100, ipca12Meses) : null;

  const cartoes = [
    {
      id: 'meta-selic',
      nome: 'Meta Selic',
      unidade: '% ao ano',
      prefixoValor: '',
      valor: meta?.valor ?? null,
      referencia: meta?.data ?? null,
      fonte: `BACEN · SGS ${SERIES.metaSelic}`,
      variacao: meta && metaAntes ? meta.valor - metaAntes.valor : null,
      rotuloVariacao: 'vs. 12 meses atrás',
      extra: null,
      serie: ultimos(mudancas(serie('metaSelic')), 12),
    },
    {
      id: 'cdi',
      nome: 'CDI',
      unidade: '% ao ano',
      prefixoValor: '',
      valor: cdi ? anualizarDiaria(cdi.valor) * 100 : null,
      referencia: cdi?.data ?? null,
      fonte: `BACEN · SGS ${SERIES.cdiDiaria}`,
      variacao: null,
      rotuloVariacao: '',
      extra: cdi12Meses === null ? null : { rotulo: 'acumulado em 12 meses', percentual: cdi12Meses },
      serie: ultimos(serie('cdiDiaria'), 45),
    },
    {
      id: 'ipca',
      nome: 'IPCA em 12 meses',
      unidade: '% acumulado',
      prefixoValor: '',
      valor: ipca12Meses === null ? null : ipca12Meses * 100,
      referencia: ultimo('ipcaMensal')?.data ?? null,
      fonte: `BACEN · SGS ${SERIES.ipcaMensal}`,
      variacao: null,
      rotuloVariacao: '',
      extra: ultimo('ipcaMensal')
        ? { rotulo: 'no último mês', percentual: ultimo('ipcaMensal').valor / 100 }
        : null,
      serie: ultimos(serie('ipcaMensal'), 24),
    },
    {
      id: 'juro-real',
      nome: 'Juro real',
      unidade: '% ao ano',
      prefixoValor: '',
      valor: juroRealAtual === null ? null : juroRealAtual * 100,
      referencia: meta?.data ?? null,
      fonte: 'cálculo do painel',
      variacao: null,
      rotuloVariacao: '',
      extra: null,
      serie: [],
    },
    {
      id: 'dolar',
      nome: 'Dólar',
      unidade: '',
      prefixoValor: 'R$ ',
      valor: dolar?.valor ?? null,
      referencia: agora?.create_date ? agora.create_date.slice(0, 10) : fim,
      fonte: agora ? 'AwesomeAPI · USD-BRL' : `BACEN · SGS ${SERIES.dolar}`,
      variacao: dolar?.variacao ?? null,
      rotuloVariacao: 'no dia',
      extra: null,
      serie: ultimos(dolarSerie, 45),
    },
  ];

  return {
    atualizadoEm,
    indicadores: cartoes.map((cartao) => ({ ...cartao, sobre: EXPLICACOES[cartao.id] })),
  };
}

// Formatação condicional: as faixas de cor usadas no painel e no relatório.
export const FAIXA_NEUTRA = 0.01;
export const FAIXA_MUITO_BOM = 0.2;
export const FAIXA_MUITO_RUIM = -0.2;

export const NIVEIS = [
  { nome: 'muito bom', emoji: '🔵', classe: 'muito-bom' },
  { nome: 'bom', emoji: '🟢', classe: 'bom' },
  { nome: 'neutro', emoji: '⚪', classe: 'neutro' },
  { nome: 'ruim', emoji: '🟡', classe: 'ruim' },
  { nome: 'muito ruim', emoji: '🔴', classe: 'muito-ruim' },
];

// Valor em fração (0.2 = 20%) -> faixa. Devolve null quando não há número.
// +20% ou mais azul · positivo verde · perto de zero cinza · negativo amarelo · −20% ou menos vermelho.
export function nivelDeResultado(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return null;
  if (valor >= FAIXA_MUITO_BOM) return NIVEIS[0];
  if (valor >= FAIXA_NEUTRA) return NIVEIS[1];
  if (valor >= -FAIXA_NEUTRA) return NIVEIS[2];
  if (valor > FAIXA_MUITO_RUIM) return NIVEIS[3];
  return NIVEIS[4];
}

export function legendaNiveis() {
  const exagero = formatarNumero(Math.abs(FAIXA_MUITO_RUIM) * 100, 0);
  return [
    `🔵 +${formatarNumero(FAIXA_MUITO_BOM * 100, 0)}% ou mais`,
    '🟢 positivo',
    `⚪ perto de zero (±${formatarNumero(FAIXA_NEUTRA * 100, 0)}%)`,
    '🟡 negativo',
    `🔴 −${exagero}% ou menos`,
  ].join(' · ');
}

// Quanto rendeu ao ano, a partir do saldo, do rendimento e da data do aporte.
export function taxaEquivalente({ saldo, rendimento, dataAporte }, hoje) {
  const principal = Number(saldo) - Number(rendimento);
  if (!dataAporte || !Number.isFinite(principal) || principal <= 0) return null;
  const dias = (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${dataAporte}T00:00:00Z`)) / 86400000;
  if (!Number.isFinite(dias) || dias <= 0) return null;
  const total = Number(saldo) / principal - 1;
  return { dias: Math.round(dias), total, taxaAnual: (1 + total) ** (365 / dias) - 1 };
}

// Quanto do CDI o produto entregou no mesmo período (0.92 = 92% do CDI).
export function compararComCdi(rendimentoPeriodo, cdiNoPeriodo) {
  if (rendimentoPeriodo === null || rendimentoPeriodo === undefined) return null;
  if (!cdiNoPeriodo) return null;
  return rendimentoPeriodo / cdiNoPeriodo;
}

