import {
  caminhoSparkline,
  formatarData,
  formatarNumero,
  formatarPercentual,
  legendaNiveis,
  nivelDeResultado,
  simulacao,
} from './indicadores.js';

const $ = (id) => document.getElementById(id);
const listaEl = $('indicadores');
const situacaoEl = $('situacao');
const valorEl = $('valor');
const mesesEl = $('meses');
const resultadoEl = $('resultado');

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
      <div class="cabecalho">
        <h2>${cartao.nome}</h2>
        <span class="fonte">${cartao.fonte}</span>
      </div>
      <p class="valor">${numero}${unidade}</p>
      <p class="variacao">${linhaVariacao(cartao)}</p>
      ${grafico}
      <p class="sobre">${cartao.sobre}</p>
      <p class="referencia">${cartao.rotuloReferencia ?? 'dado de'} ${formatarData(cartao.referencia)}</p>
    </article>
  `;
}

function renderizarCartoes() {
  listaEl.innerHTML = painel.indicadores.map(cartaoHtml).join('');
}

function renderizarSimulacao() {
  const cdi = buscar('cdi');
  const ipca = buscar('ipca');
  if (!cdi?.valor || !ipca?.valor) {
    resultadoEl.innerHTML = '<p class="ajuda">Indicadores indisponíveis para simular.</p>';
    return;
  }
  const valor = Number(valorEl.value) || 0;
  const resultado = simulacao({
    valor,
    cdi: cdi.valor / 100,
    ipca: ipca.valor / 100,
    meses: Number(mesesEl.value),
  });
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
  resultadoEl.innerHTML = linhas
    .map(([rotulo, numero, fracao]) => {
      const nivel = nivelDeResultado(fracao);
      const classe = nivel ? ` class="nivel-${nivel.classe}"` : '';
      return `<dt>${rotulo}</dt><dd${classe}>${reais(numero)}</dd>`;
    })
    .join('');
}

async function carregar() {
  situacaoEl.textContent = 'Carregando…';
  try {
    const resposta = await fetch('dados/indicadores.json', { cache: 'no-store' });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    painel = await resposta.json();
    renderizarCartoes();
    renderizarSimulacao();
    const quando = new Date(painel.atualizadoEm);
    situacaoEl.textContent = `Coletado em ${quando.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })}`;
  } catch (erro) {
    situacaoEl.textContent = 'Sem dados. Confira a conexão e toque em Atualizar.';
  }
}

$('atualizar').addEventListener('click', carregar);
valorEl.addEventListener('input', renderizarSimulacao);
mesesEl.addEventListener('change', renderizarSimulacao);
$('legenda').textContent = legendaNiveis();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => null);
}

carregar();
