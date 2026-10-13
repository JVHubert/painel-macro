// Mural de conquistas: gera o HTML em `00 Outputs` (arquivo local, nunca publicado).
// Uso: npm run mural
import { mkdir, writeFile } from 'node:fs/promises';
import { lerEntradas } from '../caderno.js';
import { formatarNumero } from '../indicadores.js';
import { hojeEmBrasilia } from '../indicadores.js';
import { mesesAte, parteDosJuros, situacaoDoJogo, trechosDoMural } from '../jogo.js';
import { montarMural } from '../muralHtml.js';
import { dadosUrl, lerJson, lerTexto } from './arquivos.mjs';
import { baixar } from './sincronizar.mjs';

const CARTEIRA = dadosUrl('carteira.json');
const HISTORICO = dadosUrl('jogo/historico.json');
const MURAL = dadosUrl('jogo/mural.md');
const PAINEL = new URL('../dados/indicadores.json', import.meta.url);
const SAIDA = new URL('../../../00 Outputs/', import.meta.url);
const HOJE = hojeEmBrasilia();

// Antes de ler: o mural e o histórico mais novos podem estar no Telegram ou no GitHub.
await baixar();

const carteira = await lerJson(
  CARTEIRA,
  'Copie carteira.example.json para carteira.json e preencha seus dados (ele não vai para o git).',
);
const painel = await lerJson(PAINEL, 'Rode `npm run coletar` primeiro.');
const historico = JSON.parse((await lerTexto(HISTORICO)) || '[]');
const mural = await lerTexto(MURAL);

const doJogo = (patrimonio) =>
  Math.max(0, (Number(patrimonio) || 0) - (Number(carteira.reserva?.alvoMeses) || 6) * (Number(carteira.custoMensal) || 0));

// O patrimônio de agora é o do último relatório (o histórico guarda esses números); sem histórico
// ainda, vale a soma da reserva — o resto do cartão fica igual, só sem o valor das ações.
const somaDaReserva = (carteira.reserva?.detalhe ?? []).reduce((total, item) => total + (Number(item.saldo) || 0), 0);
const patrimonio = Number(historico.at(-1)?.patrimonio) || somaDaReserva;

const jogo = carteira.jogo ?? {};
const situacao = situacaoDoJogo({
  jogo,
  historico,
  patrimonio,
  metaDaReserva: (Number(carteira.reserva?.alvoMeses) || 6) * (Number(carteira.custoMensal) || 0),
  hoje: HOJE,
});

// A taxa real do painel é o ritmo com que os marcos devem chegar daqui para a frente.
const taxaRealAnual = (painel?.indicadores?.find((cartao) => cartao.id === 'juro-real')?.valor ?? 0) / 100;
const proximo = situacao.proximoMarco
  ? {
      marco: situacao.proximoMarco,
      falta: situacao.falta,
      percentual: situacao.percentual,
      valorPremio: situacao.premio?.valor ?? 0,
      premio: situacao.premio?.item?.nome ?? '',
      meses: mesesAte(situacao.proximoMarco, doJogo(patrimonio), carteira.aporteMensal, taxaRealAnual),
      fracaoDosJuros: parteDosJuros(situacao.proximoMarco, doJogo(patrimonio), carteira.aporteMensal, taxaRealAnual).fracao,
    }
  : null;

const trechos = trechosDoMural(lerEntradas(mural), { inicio: historico[0]?.data ?? null });
const html = montarMural({ trechos, proximo, hoje: HOJE });

await mkdir(SAIDA, { recursive: true });
const arquivo = new URL(`${HOJE.replace(/-/g, '.')} Mural de conquistas.html`, SAIDA);
await writeFile(arquivo, html, 'utf8');
console.log(`mural salvo em 00 Outputs/${HOJE.replace(/-/g, '.')} Mural de conquistas.html`);
if (!trechos.length) console.log('nenhum marco batido ainda: o mural mostra o caminho até o primeiro');
else console.log(`${trechos.length} marco(s) no mural, até ${formatarNumero(trechos.at(-1).marco, 0)}`);
