// Monta o relatório semanal: macro do painel + cotação das posições + reserva + pergunta da semana.
// Uso: npm run relatorio           (envia pelo canal configurado e salva em relatorios/)
//      npm run relatorio -- --seco (monta e salva, mas não envia nada)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { acumuladoDesde, compararComCdi, formatarData, podeMostrarDetalhe, taxaEquivalente } from '../indicadores.js';
import { deslocarDias, montarRelatorio, resumoMacro, resumoPosicao } from '../relatorio.js';
import { montarHtml } from '../relatorioHtml.js';
import { renderizar } from './imagem.mjs';
import { buscarJson, cotacao, serieCdi } from './mercado.mjs';
import { enviarFoto, enviarSemDerrubar } from './notificar.mjs';

const DADOS = new URL('../dados/indicadores.json', import.meta.url);
const CARTEIRA = new URL('../carteira.json', import.meta.url);
const PASTA = new URL('../relatorios/', import.meta.url);
const HOJE = new Date().toISOString().slice(0, 10);
// `--seco` monta e salva o relatório sem enviar (para conferir a imagem antes de publicar).
const SECO = process.argv.includes('--seco');
// Em log público (GitHub Actions) não aparece nome nem valor do JV; na máquina dele, aparece tudo.
const MOSTRAR_DETALHE = podeMostrarDetalhe(process.env);

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

const painel = await lerJson(DADOS, 'Rode `npm run coletar` primeiro.');

const carteira = await lerJson(
  CARTEIRA,
  'Copie carteira.example.json para carteira.json e preencha seus dados (ele não vai para o git).',
);
const macro = resumoMacro(painel);

const posicoes = [];
const avisos = [];

// O BCB bloqueia rajada de consultas (responde 200 com XML em vez de JSON), então o CDI
// é buscado uma única vez, desde a data mais antiga que interessa, e recortado na memória.
const datasComCdi = [
  ...(carteira.posicoes ?? []).map((posicao) => posicao.dataCompra),
  ...(carteira.reserva?.detalhe ?? []).map((item) => item.dataAporte),
]
  .filter(Boolean)
  .sort();

let serieDoCdi = [];
if (datasComCdi.length) {
  try {
    serieDoCdi = await serieCdi(datasComCdi[0]);
    console.log(
      MOSTRAR_DETALHE
        ? `CDI: ${serieDoCdi.length} dias desde ${datasComCdi[0]}`
        : `CDI: ${serieDoCdi.length} dias`,
    );
  } catch (erro) {
    avisos.push(`CDI não veio hoje (${erro.message}) — comparações com o CDI ficam de fora`);
  }
}
const cdiDesdeData = (data) => (data && serieDoCdi.length ? acumuladoDesde(serieDoCdi, data) : null);

for (const posicao of carteira.posicoes ?? []) {
  try {
    const preco = await cotacao(posicao.ticker);
    posicoes.push(resumoPosicao(posicao, preco, { cdiNoPeriodo: cdiDesdeData(posicao.dataCompra) }));
    if (MOSTRAR_DETALHE) console.log(`${posicao.ticker}: R$ ${preco.preco}`);
  } catch (erro) {
    avisos.push(`${posicao.ticker}: ${erro.message}`);
    posicoes.push(resumoPosicao(posicao, null));
  }
}

// Cada item da reserva ganha a taxa equivalente e a comparação com o CDI no período.
function medirReserva(reserva) {
  const detalhe = [];
  for (const item of reserva?.detalhe ?? []) {
    const medido = item.dataAporte ? taxaEquivalente(item, HOJE) : null;
    const percentualDoCdi = medido ? compararComCdi(medido.total, cdiDesdeData(item.dataAporte)) : null;
    if (medido && MOSTRAR_DETALHE) {
      console.log(
        `${item.nome}: ${(medido.taxaAnual * 100).toFixed(2)}% a.a.${
          percentualDoCdi ? ` (${(percentualDoCdi * 100).toFixed(0)}% do CDI)` : ''
        }`,
      );
    }
    detalhe.push({ ...item, medido: medido ? { ...medido, percentualDoCdi } : null });
  }
  console.log(`reserva medida: ${detalhe.length} itens`);
  return detalhe.length ? { ...reserva, detalhe } : reserva;
}

const texto = montarRelatorio({
  data: HOJE,
  macro,
  posicoes,
  reserva: medirReserva(carteira.reserva),
  receitaMensal: carteira.receitaMensal,
  custoMensal: carteira.custoMensal,
  aporteMensal: carteira.aporteMensal,
  avisos,
});

await mkdir(PASTA, { recursive: true });
await writeFile(new URL(`${HOJE}.md`, PASTA), `${texto}\n`, 'utf8');
console.log(`relatório salvo em relatorios/${HOJE}.md`);

// A imagem (com cor de verdade) é o canal principal; o texto é a reserva.
const dadosComuns = {
  data: HOJE,
  painel,
  posicoes,
  reserva: medirReserva(carteira.reserva),
  receitaMensal: carteira.receitaMensal,
  custoMensal: carteira.custoMensal,
  aporteMensal: carteira.aporteMensal,
  avisos,
};

let enviado = null;
try {
  const png = await renderizar(montarHtml(dadosComuns));
  await writeFile(new URL(`${HOJE}.png`, PASTA), png);
  console.log(`imagem salva em relatorios/${HOJE}.png (${Math.round(png.length / 1024)} KB)`);
  if (!SECO) {
    enviado = await enviarFoto(png, { legenda: `📊 Relatório semanal — ${formatarData(HOJE)}` });
    if (enviado) console.log(`imagem enviada por ${enviado.canal}`);
  }
} catch (erro) {
  console.log(`::warning::a imagem não saiu (${erro.message})${SECO ? '' : ' — vou mandar em texto'}`);
}

if (SECO) {
  console.log('modo seco: nada enviado');
} else if (!enviado) {
  await enviarSemDerrubar(texto, { titulo: 'Painel macro - relatorio semanal' });
}
