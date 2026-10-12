// Busca os indicadores nas APIs públicas e grava dados/indicadores.json.
// Roda na mão (npm run coletar) e todo dia no GitHub Actions.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { mesclarComAnterior, montarIndicadores, paraSerie, urlSgs, SERIES } from '../indicadores.js';
import { buscarJson } from './mercado.mjs';

const DOLAR_AGORA = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';
const SAIDA = new URL('../dados/indicadores.json', import.meta.url);

// Janela de busca: mais largo que o necessário para o Banco Central ter o que devolver.
const JANELAS = { diaria: 18, mensal: 30 };

function dataBr(data) {
  const dd = String(data.getUTCDate()).padStart(2, '0');
  const mm = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${data.getUTCFullYear()}`;
}

function inicio(meses) {
  const hoje = new Date();
  return dataBr(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - meses, 1)));
}

// O JSON que já está no repositório é a rede de segurança de hoje: série vazia não apaga dado bom.
async function lerAnterior() {
  try {
    return JSON.parse(await readFile(SAIDA, 'utf8'));
  } catch {
    return null;
  }
}

async function coletar() {
  const bruto = {};
  for (const [chave, codigo] of Object.entries(SERIES)) {
    const meses = chave === 'ipcaMensal' ? JANELAS.mensal : JANELAS.diaria;
    bruto[chave] = paraSerie(await buscarJson(urlSgs(codigo, inicio(meses))));
    console.log(`${chave}: ${bruto[chave].length} ponto(s)`);
  }

  // Cotação do dia; se a API cair, o painel cai para a série oficial do dólar.
  try {
    const cotacao = await buscarJson(DOLAR_AGORA);
    bruto.dolarAgora = cotacao?.USDBRL ?? null;
    console.log(`dólar agora: R$ ${bruto.dolarAgora?.bid ?? 'sem dado'}`);
  } catch (erro) {
    console.warn(`aviso: dólar ao vivo indisponível (${erro.message})`);
  }

  const novo = montarIndicadores(bruto);
  if (novo.indicadores.every((cartao) => cartao.valor === null)) {
    console.error('::error::nenhum indicador veio hoje — o painel não foi atualizado');
    process.exit(1);
  }

  const { painel, mantidos } = mesclarComAnterior(novo, await lerAnterior());
  for (const nome of mantidos) console.log(`::warning::${nome} não veio hoje — mantive o valor anterior`);

  for (const cartao of painel.indicadores) {
    console.log(`${cartao.nome}: ${cartao.valor ?? 'sem dado'}`);
  }

  await mkdir(new URL('../dados/', import.meta.url), { recursive: true });
  await writeFile(SAIDA, `${JSON.stringify(painel, null, 2)}\n`, 'utf8');
  console.log(`gravado em ${SAIDA.pathname}`);
}

if (process.argv[1]?.endsWith('coletar.mjs')) {
  await coletar();
}
