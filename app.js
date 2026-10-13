import {
  caminhoSparkline,
  formatarData,
  formatarNumero,
  formatarPercentual,
  hojeEmBrasilia,
  legendaNiveis,
  nivelDeResultado,
  poupanca,
  resumoDoPainel,
  simulacao,
} from './indicadores.js';

const $ = (id) => document.getElementById(id);
const listaEl = $('indicadores');
const resumoEl = $('resumo');
const situacaoEl = $('situacao');
const valorEl = $('valor');
const mesesEl = $('meses');
const percentualCdiEl = $('percentual-cdi');
const resultadoEl = $('resultado');
const notaPoupancaEl = $('nota-poupanca');

// A ordem da tela: o juro real primeiro, porque é o número que muda a vida de quem poupa.
const ORDEM_DOS_CARTOES = ['juro-real', 'meta-selic', 'cdi', 'ipca', 'dolar'];

let painel = null;

const buscar = (id) => painel?.indicadores.find((cartao) => cartao.id === id) ?? null;
const reais = (numero) => `R$ ${formatarNumero(numero, 2)}`;

function linhaVariacao(cartao) {
  if (cartao.extra) return `${formatarPercentual(cartao.extra.percentual)} ${cartao.extra.rotulo}`;
  if (cartao.variacao === null) return '';
  const seta = cartao.variacao > 0 ? '▲' : cartao.variacao < 0 ? '▼' : '=';
  const tamanho =
    cartao.id === 'meta-selic'
      ? `${formatarNumero(Math.abs(cartao.variacao), 2)} p.p.`
      : formatarPercentual(Math.abs(cartao.variacao));
  return `${seta} ${tamanho} ${cartao.rotuloVariacao}`.trim();
}

// A fonte técnica sai do topo do cartão e vai para o pé, em texto menor.
function cartaoHtml(cartao) {
  const casas = cartao.id === 'dolar' ? 4 : 2;
  const numero = cartao.valor === null ? '–' : `${cartao.prefixoValor ?? ''}${formatarNumero(cartao.valor, casas)}`;
  const unidade = cartao.valor === null || !cartao.unidade ? '' : `<small>${cartao.unidade}</small>`;
  const desenho = caminhoSparkline(cartao.serie);
  const grafico = desenho
    ? `<svg class="grafico" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true"><path d="${desenho}"/></svg>`
    : '';
  // Macro não recebe cor: a taxa e o câmbio da semana não são bom nem ruim para quem poupa.
  return `
    <article class="cartao" data-id="${cartao.id}">
      <h2>${cartao.nome}</h2>
      <p class="valor">${numero}${unidade}</p>
      <p class="variacao">${linhaVariacao(cartao)}</p>
      ${grafico}
      <p class="sobre">${cartao.sobre}</p>
      <p class="referencia">${cartao.rotuloReferencia ?? 'dado de'} ${formatarData(cartao.referencia)}</p>
      <p class="fonte">${cartao.fonte}</p>
    </article>
  `;
}

function renderizarCartoes() {
  const posicao = (cartao) => {
    const indice = ORDEM_DOS_CARTOES.indexOf(cartao.id);
    return indice === -1 ? ORDEM_DOS_CARTOES.length : indice;
  };
  const cartoes = [...painel.indicadores].sort((a, b) => posicao(a) - posicao(b));
  listaEl.innerHTML = cartoes.map(cartaoHtml).join('');
}

function renderizarSimulacao() {
  const cdi = buscar('cdi');
  const ipca = buscar('ipca');
  const meta = buscar('meta-selic');
  if (!cdi?.valor || !ipca?.valor) {
    resultadoEl.innerHTML = '<p class="ajuda">Indicadores indisponíveis para simular.</p>';
    notaPoupancaEl.textContent = '';
    return;
  }
  const valor = Number(valorEl.value) || 0;
  const meses = Number(mesesEl.value);
  const percentualDoCdi = (Number(percentualCdiEl.value) || 100) / 100;
  const resultado = simulacao({ valor, cdi: (cdi.valor / 100) * percentualDoCdi, ipca: ipca.valor / 100, meses });
  const naPoupanca = meta?.valor ? poupanca({ valor, meses, selic: meta.valor }) : null;
  const linhas = [
    ['Rendimento bruto', resultado.bruto, resultado.bruto / valor],
    [
      `Imposto de renda (${formatarPercentual(resultado.aliquota, 1)} · ${resultado.rotuloAliquota})`,
      -resultado.imposto,
      -resultado.imposto / valor,
    ],
    ['Você recebe no fim', valor + resultado.liquido, null],
    ['Perda para a inflação', -resultado.inflacao, -resultado.inflacao / valor],
    ['Sobra de verdade (ganho real)', resultado.ganhoReal, resultado.ganhoReal / valor],
  ];
  if (naPoupanca) linhas.push(['Na poupança seria', naPoupanca.final, null]);
  resultadoEl.innerHTML = linhas
    .map(([rotulo, numero, fracao]) => {
      const nivel = nivelDeResultado(fracao);
      const classe = nivel ? ` class="nivel-${nivel.classe}"` : '';
      return `<dt>${rotulo}</dt><dd${classe}>${reais(numero)}</dd>`;
    })
    .join('');
  notaPoupancaEl.textContent = naPoupanca
    ? `Poupança: ${formatarPercentual(naPoupanca.taxaMensal, 2)} ao mês, sem imposto e sem contar a TR.`
    : '';
}

// As fontes saem do campo `fonte` de cada cartão: se o dólar veio do BCB num dia, é o BCB que aparece.
// O nome da fonte entra uma vez só; as séries dela vêm entre parênteses.
function linhaDeFontes(fontes = []) {
  const porFonte = new Map();
  for (const fonte of fontes) {
    const [nome, ...series] = String(fonte).split(' · ');
    if (!porFonte.has(nome)) porFonte.set(nome, new Set());
    for (const serie of series) porFonte.get(nome).add(serie);
  }
  return [...porFonte.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([nome, series]) => (series.size ? `${nome} (${[...series].sort().join(', ')})` : nome))
    .join(' · ');
}

function mostrarFontes() {
  const fontes = (painel?.indicadores ?? []).map((cartao) => cartao.fonte).filter(Boolean);
  $('fontes').textContent = fontes.length
    ? `Fontes: ${linhaDeFontes(fontes)}. Série atualizada por GitHub Actions.`
    : '';
}

// Esta página é pública: ela não sabe em que nível da trilha você está, então não mostra a pergunta
// da semana (isso é do relatório e do `npm run estudo`).
async function carregar() {
  situacaoEl.textContent = 'Carregando…';
  try {
    const resposta = await fetch('dados/indicadores.json', { cache: 'no-store' });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    painel = await resposta.json();
    resumoEl.textContent = resumoDoPainel(painel);
    renderizarCartoes();
    renderizarSimulacao();
    mostrarFontes();
    const quando = new Date(painel.atualizadoEm);
    situacaoEl.textContent = `Coletado em ${quando.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })}`;
  } catch (erro) {
    resumoEl.textContent = '';
    situacaoEl.textContent = 'Sem dados. Confira a conexão e toque em Atualizar.';
  }
}

$('atualizar').addEventListener('click', carregar);
valorEl.addEventListener('input', renderizarSimulacao);
mesesEl.addEventListener('change', renderizarSimulacao);
percentualCdiEl.addEventListener('input', renderizarSimulacao);
$('legenda').textContent = legendaNiveis();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => null);
}

carregar();
