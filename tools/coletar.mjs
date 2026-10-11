// Busca os indicadores nas APIs públicas e grava dados/indicadores.json.
// Roda na mão (npm run coletar) e todo dia no GitHub Actions.
import { mkdir, writeFile } from 'node:fs/promises';
import { montarIndicadores, paraSerie, urlSgs, SERIES } from '../indicadores.js';

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

async function buscarJson(url) {
  const resposta = await fetch(url, { headers: { accept: 'application/json' } });
  // O Banco Central responde 404 quando não há dado no período (série mensal recente, por exemplo).
  if (resposta.status === 404) return [];
  if (!resposta.ok) throw new Error(`${resposta.status} ${resposta.statusText} em ${url}`);
  return resposta.json();
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

  const painel = montarIndicadores(bruto);
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
