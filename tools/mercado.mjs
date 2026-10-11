// Consultas de mercado: cotação da B3 e série do CDI. Sem efeitos colaterais — pode ser
// importado por qualquer ferramenta (o relatório, o diário).
import { filtrarDesde, paraSerie, urlSgs, SERIES } from '../indicadores.js';
import { deslocarDias } from '../relatorio.js';

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart';

// Busca JSON com novas tentativas: o Banco Central responde 200 com XML quando
// limita a rajada de consultas, e isso não é erro de verdade — é espera.
export async function buscarJson(url, { tentativas = 3, espera = 5000 } = {}) {
  for (let tentativa = 1; tentativa <= tentativas; tentativa += 1) {
    const resposta = await fetch(url, { headers: { accept: 'application/json' } });
    if (resposta.status === 404) return [];
    const tipo = resposta.headers.get('content-type') ?? '';
    if (resposta.ok && tipo.includes('json')) return resposta.json();
    if (tentativa < tentativas) {
      console.log(`BCB não devolveu JSON (tentativa ${tentativa}), esperando ${espera / 1000}s…`);
      await new Promise((seguir) => setTimeout(seguir, espera));
    }
  }
  throw new Error(`resposta inesperada de ${url}`);
}

async function buscarSerie(ticker, range) {
  const simbolo = ticker.includes('.') ? ticker : `${ticker}.SA`;
  const resposta = await fetch(`${YAHOO}/${simbolo}?range=${range}&interval=1d`, {
    headers: { 'user-agent': 'Mozilla/5.0' },
  });
  if (!resposta.ok) throw new Error(`${resposta.status} ao buscar ${ticker}`);
  const resultado = (await resposta.json())?.chart?.result?.[0];
  if (!resultado) throw new Error(`sem cotação para ${ticker}`);

  const fechamentos = resultado.indicators.quote[0].close ?? [];
  const serie = resultado.timestamp
    .map((segundos, i) => ({
      data: new Date(segundos * 1000).toISOString().slice(0, 10),
      valor: fechamentos[i],
    }))
    .filter((ponto) => typeof ponto.valor === 'number');
  if (!serie.length) throw new Error(`sem série para ${ticker}`);
  return { preco: resultado.meta.regularMarketPrice ?? serie.at(-1).valor, serie };
}

// Cotação da B3 pelo endpoint público do Yahoo — sem chave, mas sem garantia de futuro.
export async function cotacao(ticker, { dias = 7 } = {}) {
  const { preco, serie } = await buscarSerie(ticker, '1mo');
  const diaAnterior = serie.at(-2);
  const semanaAtras = serie.filter((ponto) => ponto.data <= deslocarDias(serie.at(-1).data, -dias)).at(-1);
  return {
    preco,
    serie,
    variacaoDia: diaAnterior ? preco / diaAnterior.valor - 1 : null,
    variacaoSemana: semanaAtras ? preco / semanaAtras.valor - 1 : null,
  };
}

// Quanto o ativo andou desde uma data (para conferir o que você previu no diário).
export async function variacaoDesde(ticker, dataIso) {
  const { preco, serie } = await buscarSerie(ticker, '2y');
  const inicial = serie.find((ponto) => ponto.data >= dataIso) ?? serie[0];
  if (!inicial?.valor) return null;
  const semanaAtras = serie.filter((ponto) => ponto.data <= deslocarDias(serie.at(-1).data, -7)).at(-1);
  return {
    precoNaData: inicial.valor,
    dataUsada: inicial.data,
    preco,
    variacao: preco / inicial.valor - 1,
    variacaoSemana: semanaAtras ? preco / semanaAtras.valor - 1 : null,
  };
}

// Série diária do CDI desde uma data (uma consulta só, recortada depois).
export async function serieCdi(dataInicial) {
  const inicio = dataInicial.split('-').reverse().join('/');
  const bruto = await buscarJson(urlSgs(SERIES.cdiDiaria, inicio));
  return filtrarDesde(paraSerie(bruto), dataInicial);
}
