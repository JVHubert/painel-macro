// Monta o relatório semanal: macro do painel + cotação das posições + reserva + pergunta da semana.
// Uso: npm run relatorio           (envia pelo canal configurado e salva em relatorios/)
//      npm run relatorio -- --seco (monta e salva, mas não envia nada)
import { mkdir, writeFile } from 'node:fs/promises';
import { acumuladoDesde, compararComCdi, formatarData, hojeEmBrasilia, podeMostrarDetalhe, taxaEquivalente } from '../indicadores.js';
import { alocacao, montarRelatorio, numeroDaSemana, resumoPosicao } from '../relatorio.js';
import { montarHtml } from '../relatorioHtml.js';
import { lerEntradas, historicoDeEstudo, placar, situacao } from '../caderno.js';
import {
  historicoAtualizado,
  mensagemDoMarco,
  mesesAte,
  muralComMarco,
  parteDosJuros,
  prazoDeCompra,
  premioEmAberto,
  regrasDoJogo,
  situacaoDoJogo,
} from '../jogo.js';
import { dadosUrl, lerJson, lerLista, lerTexto } from './arquivos.mjs';
import { renderizar } from './imagem.mjs';
import { cotacao, serieCdi } from './mercado.mjs';
import { enviarFoto, enviarSemDerrubar } from './notificar.mjs';

const DADOS = new URL('../dados/indicadores.json', import.meta.url);
const CARTEIRA = dadosUrl('carteira.json');
const DIARIO = dadosUrl('diario/decisoes.md');
const ESTUDO = dadosUrl('estudo/respostas.md');
const HISTORICO = dadosUrl('jogo/historico.json');
const MURAL = dadosUrl('jogo/mural.md');
const PASTA = new URL('../relatorios/', import.meta.url);
const HOJE = hojeEmBrasilia();
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

function resumoDoCaderno(hoje, textoDoDiario, textoDoEstudo) {
  const decisoes = lerEntradas(textoDoDiario);
  const respostas = lerEntradas(textoDoEstudo);
  const daSemana = respostas.find((entrada) => entrada.titulo === String(numeroDaSemana(hoje)));
  return {
    decisoesVencidas: decisoes.filter((entrada) => situacao(entrada, hoje).vencida).length,
    decisoesSemTese: decisoes.filter((entrada) => !entrada.campos.tese).length,
    respostaDaSemanaVazia: Boolean(daSemana && !daSemana.campos.resposta),
    // O placar só entra no relatório quando existe caderno: no GitHub esses arquivos não existem.
    placar: decisoes.length || respostas.length ? placar(historicoDeEstudo(respostas), decisoes, hoje) : null,
  };
}

const painel = await lerJson(DADOS, 'Rode `npm run coletar` primeiro.');

const carteira = await lerJson(
  CARTEIRA,
  'Copie carteira.example.json para carteira.json e preencha seus dados (ele não vai para o git).',
);

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
  return detalhe.length ? { ...reserva, detalhe } : reserva;
}

// Dados uma vez só: o texto e a imagem saem do mesmo objeto.
const dados = {
  data: HOJE,
  painel,
  posicoes,
  reserva: medirReserva(carteira.reserva),
  receitaMensal: carteira.receitaMensal,
  custoMensal: carteira.custoMensal,
  aporteMensal: carteira.aporteMensal,
  avisos,
  caderno: resumoDoCaderno(HOJE, await lerTexto(DIARIO), await lerTexto(ESTUDO)),
};

// O jogo dos marcos precisa da memória do patrimônio: é ela que confirma o marco em dois domingos
// seguidos, e não um pico do mercado. A memória é gravada com um registro por dia de relatório.
const patrimonio = alocacao(dados).total;
const historicoSalvo = await lerLista(HISTORICO);
const jogoDoArquivo = carteira.jogo ?? {};
const metaDaReserva = (Number(carteira.reserva?.alvoMeses) || 6) * (Number(carteira.custoMensal) || 0);
// A taxa real do painel é a melhor estimativa do ritmo daqui para a frente.
const taxaRealAnual = (painel?.indicadores?.find((cartao) => cartao.id === 'juro-real')?.valor ?? 0) / 100;

const jogoDeHoje = situacaoDoJogo({
  jogo: jogoDoArquivo,
  historico: historicoSalvo,
  patrimonio,
  metaDaReserva,
  hoje: HOJE,
});
const regras = regrasDoJogo(jogoDoArquivo);

// Marco confirmado: entra no mural (uma vez só) e a comemoração sai como mensagem separada,
// antes do relatório — o relatório da semana já vem mostrando o próximo marco.
let mural = await lerTexto(MURAL);
const comemoracoes = [];
for (const confirmado of jogoDeHoje.confirmados) {
  const premioDoMarco = confirmado.item?.nome ?? '';
  mural = muralComMarco(mural, {
    marco: confirmado.marco,
    liberadoEm: HOJE,
    valorLiberado: confirmado.valor,
    premio: premioDoMarco,
    prazoDias: regras.prazoDias,
  });
  comemoracoes.push({
    marco: confirmado.marco,
    valorLiberado: confirmado.valor,
    premio: premioDoMarco,
    prazo: prazoDeCompra(HOJE, regras.prazoDias),
  });
}
if (comemoracoes.length) {
  await mkdir(new URL('./', MURAL), { recursive: true });
  await writeFile(MURAL, mural, 'utf8');
  if (!SECO) {
    for (const comemoracao of comemoracoes) {
      await enviarSemDerrubar(mensagemDoMarco(comemoracao), { titulo: 'Painel macro - marco batido' });
    }
  }
}

dados.jogo = {
  ...jogoDeHoje,
  comemoracoes,
  premioAberto: premioEmAberto(lerEntradas(mural), { hoje: HOJE, prazoDias: regras.prazoDias }),
  semHistorico: historicoSalvo.length === 0,
  meses:
    jogoDeHoje.proximoMarco === null
      ? 0
      : mesesAte(jogoDeHoje.proximoMarco, jogoDeHoje.patrimonioDoJogo, carteira.aporteMensal, taxaRealAnual),
  juros:
    jogoDeHoje.proximoMarco === null
      ? null
      : parteDosJuros(jogoDeHoje.proximoMarco, jogoDeHoje.patrimonioDoJogo, carteira.aporteMensal, taxaRealAnual),
};

const historico = historicoAtualizado(historicoSalvo, { data: HOJE, patrimonio });
await mkdir(new URL('./', HISTORICO), { recursive: true });
await writeFile(HISTORICO, `${JSON.stringify(historico, null, 2)}\n`, 'utf8');
console.log(
  MOSTRAR_DETALHE
    ? `jogo: ${historico.length} registro(s) no histórico, patrimônio R$ ${patrimonio}`
    : `jogo: ${historico.length} registro(s) no histórico`,
);

const texto = montarRelatorio(dados);
await mkdir(PASTA, { recursive: true });
await writeFile(new URL(`${HOJE}.md`, PASTA), `${texto}\n`, 'utf8');
console.log(`relatório salvo em relatorios/${HOJE}.md`);

// A imagem (com cor de verdade) é o canal principal; o texto é a reserva.
let enviado = null;
try {
  const png = await renderizar(montarHtml(dados));
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
