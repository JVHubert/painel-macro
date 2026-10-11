// Monta o relatório semanal: macro do painel + cotação das posições + reserva + pergunta da semana.
// Uso: npm run relatorio   (envia pelo canal configurado e salva em relatorios/)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { acumular, compararComCdi, filtrarDesde, paraSerie, taxaEquivalente, urlSgs, SERIES } from '../indicadores.js';
import { deslocarDias, montarRelatorio, resumoMacro, resumoPosicao } from '../relatorio.js';
import { enviarSemDerrubar } from './notificar.mjs';

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart';
const DADOS = new URL('../dados/indicadores.json', import.meta.url);
const CARTEIRA = new URL('../carteira.json', import.meta.url);
const PASTA = new URL('../relatorios/', import.meta.url);
const HOJE = new Date().toISOString().slice(0, 10);

// Segredos locais em .env.local (fora do git): o token do Telegram não entra no repositório.
try {
  process.loadEnvFile(new URL('../.env.local', import.meta.url));
} catch {
  // Sem arquivo local: no GitHub as variáveis vêm dos secrets.
}

async function lerJson(url, dica) {
  try {
    return JSON.parse(await readFile(url, 'utf8'));
  } catch (erro) {
    throw new Error(`${url.pathname} indisponível (${erro.message}). ${dica}`);
  }
}

// Cotação da B3 pelo endpoint público do Yahoo — sem token, mas sem garantia de futuro.
export async function cotacao(ticker, { dias = 7 } = {}) {
  const simbolo = ticker.includes('.') ? ticker : `${ticker}.SA`;
  const resposta = await fetch(`${YAHOO}/${simbolo}?range=1mo&interval=1d`, {
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

  const preco = resultado.meta.regularMarketPrice ?? serie.at(-1)?.valor ?? null;
  const diaAnterior = serie.at(-2);
  const semanaAtras = serie.filter((ponto) => ponto.data <= deslocarDias(serie.at(-1).data, -dias)).at(-1);
  return {
    preco,
    variacaoDia: diaAnterior ? preco / diaAnterior.valor - 1 : null,
    variacaoSemana: semanaAtras ? preco / semanaAtras.valor - 1 : null,
  };
}

// Quanto o CDI rendeu entre a data da compra e hoje.
export async function cdiDesde(dataCompra) {
  const inicio = dataCompra.split('-').reverse().join('/');
  const resposta = await fetch(urlSgs(SERIES.cdiDiaria, inicio), {
    headers: { accept: 'application/json' },
  });
  if (!resposta.ok) throw new Error(`${resposta.status} ao buscar o CDI`);
  const serie = filtrarDesde(paraSerie(await resposta.json()), dataCompra);
  return serie.length ? acumular(serie) : null;
}

const painel = await lerJson(DADOS, 'Rode `npm run coletar` primeiro.');

const carteira = await lerJson(
  CARTEIRA,
  'Copie carteira.example.json para carteira.json e preencha seus dados (ele não vai para o git).',
);
const macro = resumoMacro(painel);

const posicoes = [];
const avisos = [];
for (const posicao of carteira.posicoes ?? []) {
  try {
    const preco = await cotacao(posicao.ticker);
    const cdi = posicao.dataCompra ? await cdiDesde(posicao.dataCompra).catch(() => null) : null;
    posicoes.push(resumoPosicao(posicao, preco, { cdiNoPeriodo: cdi }));
    console.log(`${posicao.ticker}: R$ ${preco.preco}`);
  } catch (erro) {
    avisos.push(`⚠️ ${posicao.ticker}: ${erro.message}`);
    posicoes.push(resumoPosicao(posicao, null));
  }
}

// Cada item da reserva ganha a taxa equivalente e a comparação com o CDI no período.
async function medirReserva(reserva) {
  const detalhe = [];
  for (const item of reserva?.detalhe ?? []) {
    const medido = item.dataAporte ? taxaEquivalente(item, HOJE) : null;
    const cdi = item.dataAporte ? await cdiDesde(item.dataAporte).catch(() => null) : null;
    const percentualDoCdi = medido ? compararComCdi(medido.total, cdi) : null;
    if (medido) console.log(`${item.nome}: ${(medido.taxaAnual * 100).toFixed(2)}% a.a.${percentualDoCdi ? ` (${(percentualDoCdi * 100).toFixed(0)}% do CDI)` : ''}`);
    detalhe.push({ ...item, medido: medido ? { ...medido, percentualDoCdi } : null });
  }
  return detalhe.length ? { ...reserva, detalhe } : reserva;
}

const texto = montarRelatorio({
  data: HOJE,
  macro,
  posicoes,
  reserva: await medirReserva(carteira.reserva),
  receitaMensal: carteira.receitaMensal,
  custoMensal: carteira.custoMensal,
  aporteMensal: carteira.aporteMensal,
  avisos,
});

await mkdir(PASTA, { recursive: true });
await writeFile(new URL(`${HOJE}.md`, PASTA), `${texto}\n`, 'utf8');
console.log(`relatório salvo em relatorios/${HOJE}.md`);
await enviarSemDerrubar(texto, { titulo: 'Painel macro - relatorio semanal' });
