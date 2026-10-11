// Versão em HTML do relatório: é ela que vira imagem colorida, porque o Telegram não
// aceita texto colorido em mensagem. Os números são os mesmos do texto — muda a roupa.
import { formatarData, formatarNumero, formatarPercentual, nivelDeResultado } from './indicadores.js';
import {
  agruparPorTicker,
  dadosMacro,
  juntarPendencias,
  nivelDaReserva,
  nivelDoCdi,
  numeroDaSemana,
  perguntaDaSemana,
  totaisDoTicker,
} from './relatorio.js';

const reais = (valor) => `R$ ${formatarNumero(valor, 2)}`;

const classe = (fracao) => {
  const nivel = nivelDeResultado(fracao);
  return nivel ? ` class="${nivel.classe}"` : '';
};

const td = (texto, fracao = null) => {
  const nivel = nivelDeResultado(fracao);
  return `<td class="dir${nivel ? ` ${nivel.classe}` : ''}">${texto}</td>`;
};

const CSS = `
:root {
  --fundo: #0f1115;
  --cartao: #141821;
  --texto: #f2f2f2;
  --apagado: #8b93a1;
  --linha: #2a2f3a;
  --muito-bom: #6aa9ff;
  --bom: #2ecc71;
  --neutro: #8b93a1;
  --ruim: #d4a017;
  --muito-ruim: #ff6b6b;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: 100%;
  background: var(--fundo);
  color: var(--texto);
  font-family: system-ui, -apple-system, Roboto, "Segoe UI", sans-serif;
  font-size: 17px;
  line-height: 1.4;
  padding: 30px;
}
header { margin-bottom: 22px; }
h1 { font-size: 30px; }
header p { color: var(--apagado); font-size: 15px; margin-top: 4px; }
section {
  background: var(--cartao);
  border: 1px solid var(--linha);
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 16px;
}
h2 {
  font-size: 14px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--apagado);
  margin-bottom: 12px;
}
h3 { font-size: 18px; margin: 14px 0 8px; }
h3:first-child { margin-top: 0; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th {
  font-size: 14px;
  font-weight: 500;
  color: var(--apagado);
  text-align: left;
  padding: 0 0 6px;
}
th.dir, td.dir { text-align: right; }
td { padding: 5px 0; }
tr.totais td { border-top: 1px solid var(--linha); padding-top: 9px; font-weight: 600; }
.muito-bom { color: var(--muito-bom); }
.bom { color: var(--bom); }
.neutro { color: var(--neutro); }
.ruim { color: var(--ruim); }
.muito-ruim { color: var(--muito-ruim); }
.nota { color: var(--apagado); font-size: 14px; margin-top: 12px; }
.pergunta { font-size: 19px; line-height: 1.5; }
.legenda { display: flex; flex-wrap: wrap; gap: 16px; color: var(--apagado); font-size: 14px; }
.pendencia { color: var(--ruim); font-size: 15px; }
.pendencia li { margin-top: 4px; margin-left: 18px; }
`;

function secao(titulo, corpo) {
  return `<section><h2>${titulo}</h2>${corpo}</section>`;
}

function tabelaHtml(cabecalho, linhas) {
  const colunas = cabecalho
    .map((titulo, i) => `<th${i > 0 ? ' class="dir"' : ''}>${titulo}</th>`)
    .join('');
  return `<table><thead><tr>${colunas}</tr></thead><tbody>${linhas.join('')}</tbody></table>`;
}

// Tabela de rótulo e valor, sem cabeçalho.
function tabelaSimples(linhas) {
  return `<table><tbody>${linhas.join('')}</tbody></table>`;
}

function macroHtml(painel) {
  const { linhas, notas } = dadosMacro(painel);
  const corpo = linhas.map(
    (linha) =>
      `<tr><td>${linha.nome}</td><td class="dir">${linha.valor}</td>${td(linha.semana, linha.fracao)}</tr>`,
  );
  return secao('Macro', `${tabelaHtml(['Indicador', 'Valor', 'Semana'], corpo)}<p class="nota">${notas.join(' · ')}</p>`);
}

function carteiraHtml(posicoes) {
  if (!posicoes.length) return secao('Carteira', '<p class="nota">nenhuma posição em carteira.json</p>');

  const partes = [];
  for (const [ticker, lotes] of agruparPorTicker(posicoes)) {
    const totais = totaisDoTicker(lotes);
    const corpo = lotes.map(
      (lote) =>
        `<tr><td class="dir">${formatarNumero(lote.quantidade, 0)}</td><td class="dir">${
          lote.investido === null ? '–' : reais(lote.investido)
        }</td><td class="dir">${lote.mercado === null ? '–' : reais(lote.mercado)}</td>${td(
          lote.rentabilidade === null ? '–' : formatarPercentual(lote.rentabilidade),
          lote.rentabilidade,
        )}</tr>`,
    );
    if (lotes.length > 1) {
      corpo.push(
        `<tr class="totais"><td class="dir">soma</td><td class="dir">${
          totais.investido === null ? '–' : reais(totais.investido)
        }</td><td class="dir">${totais.mercado === null ? '–' : reais(totais.mercado)}</td>${td(
          totais.rentabilidade === null ? '–' : formatarPercentual(totais.rentabilidade),
          totais.rentabilidade,
        )}</tr>`,
      );
    }

    const semana = lotes[0]?.variacaoSemana ?? null;
    const variacao =
      semana === null
        ? ''
        : `<p class="nota">hoje ${formatarPercentual(lotes[0].variacaoDia ?? 0)} · na semana <span${classe(
            semana,
          )}>${formatarPercentual(semana)}</span></p>`;

    partes.push(
      `<h3>${ticker} (${totais.quantidade} ${totais.quantidade === 1 ? 'cota' : 'cotas'})</h3>`,
      tabelaHtml(['Qtd', 'Aplicado', 'Hoje', 'Resultado'], corpo),
      variacao,
    );

    const comCdi = lotes.filter((lote) => lote.cdiNoPeriodo !== null);
    if (comCdi.length) {
      const linhasCdi = comCdi.map(
        (lote) =>
          `<tr><td>${formatarNumero(lote.quantidade, 0)} ${lote.quantidade === 1 ? 'cota' : 'cotas'}</td><td class="dir">${formatarPercentual(
            lote.cdiNoPeriodo,
          )}</td>${td(
            `${lote.vsCdi >= 0 ? '+' : '−'}${formatarNumero(Math.abs(lote.vsCdi) * 100, 1)} p.p.`,
            lote.vsCdi,
          )}</tr>`,
      );
      if (comCdi.length > 1 && totais.contraCdi !== null) {
        linhasCdi.push(
          `<tr class="totais"><td>soma</td><td class="dir">${reais(totais.noCdi)}</td>${td(
            formatarPercentual(totais.contraCdi),
            totais.contraCdi,
          )}</tr>`,
        );
      }
      partes.push(
        '<p class="nota">Contra o CDI — o que o mesmo dinheiro teria rendido, cada lote desde a sua data:</p>',
        tabelaHtml(['Lote', 'CDI no período', 'Diferença'], linhasCdi),
      );
    }
  }
  return secao('Carteira', partes.join(''));
}

function reservaHtml(reserva, custoMensal) {
  const detalhe = Array.isArray(reserva?.detalhe) ? reserva.detalhe : [];
  const total = detalhe.reduce((soma, item) => soma + (Number(item.saldo) || 0), 0);
  const atual = detalhe.length ? total : Number(reserva?.atual) || 0;
  const custo = Number(custoMensal) || Number(reserva?.custoMensal) || 0;
  if (!custo || !atual) return secao('Reserva', '<p class="nota">sem dado para calcular</p>');

  const alvoMeses = reserva?.alvoMeses ?? 6;
  const meses = atual / custo;

  const partes = [
    tabelaSimples([
      `<tr><td>Saldo</td><td class="dir">${reais(atual)}</td></tr>`,
      `<tr><td>Cobertura</td><td class="dir ${nivelDaReserva(meses, alvoMeses).classe}">${formatarNumero(
        meses,
        1,
      )} meses de custo (meta ${alvoMeses})</td></tr>`,
    ]),
  ];

  if (detalhe.length) {
    partes.push(
      '<h3>Saldos</h3>',
      tabelaHtml(
        ['Onde', 'Saldo'],
        detalhe.map((item) => `<tr><td>${item.nome}</td><td class="dir">${formatarNumero(item.saldo, 2)}</td></tr>`),
      ),
    );
  }

  const medidos = detalhe.filter((item) => item.medido);
  if (medidos.length) {
    partes.push(
      '<h3>Rendimento medido</h3>',
      tabelaHtml(
        ['Onde', 'Taxa a.a.', '% do CDI'],
        medidos.map((item) => {
          const nivel = nivelDoCdi(item.medido.percentualDoCdi, item.taxaCDI);
          return `<tr><td>${item.nome}</td><td class="dir">${formatarPercentual(
            item.medido.taxaAnual,
          )}</td><td class="dir${nivel ? ` ${nivel.classe}` : ''}">${formatarPercentual(
            item.medido.percentualDoCdi,
            0,
          )}</td></tr>`;
        }),
      ),
      '<p class="nota">medido desde a data do aporte informada (vale se não houve aporte novo depois)</p>',
    );
  }

  const prometidos = detalhe.filter((item) => !item.medido && item.taxaCDI);
  if (prometidos.length) {
    partes.push(
      '<h3>Prometido</h3>',
      tabelaHtml(
        ['Onde', 'Taxa'],
        prometidos.map(
          (item) => `<tr><td>${item.nome}</td><td class="dir">${formatarPercentual(item.taxaCDI, 0)} do CDI</td></tr>`,
        ),
      ),
    );
  }

  return secao('Reserva', partes.join(''));
}

// Na imagem a legenda usa cor de verdade, não emoji.
function legendaHtml() {
  return [
    ['muito-bom', '■ +20% ou mais'],
    ['bom', '■ positivo'],
    ['neutro', '■ perto de zero (±1%)'],
    ['ruim', '■ negativo'],
    ['muito-ruim', '■ −20% ou menos'],
  ]
    .map(([nome, texto]) => `<span class="${nome}">${texto}</span>`)
    .join('');
}

export function montarHtml({
  data,
  painel,
  posicoes = [],
  reserva,
  receitaMensal,
  custoMensal,
  aporteMensal,
  avisos = [],
}) {
  const { pendencias } = juntarPendencias({ posicoes, reserva, custoMensal, avisos });

  const partes = [
    `<header><h1>Relatório semanal</h1><p>${formatarData(data)} · semana ${numeroDaSemana(data)}</p></header>`,
    macroHtml(painel),
    carteiraHtml(posicoes),
    reservaHtml(reserva, custoMensal),
  ];

  if (receitaMensal && custoMensal) {
    partes.push(
      secao(
        'Sobra do mês',
        tabelaSimples([
          `<tr><td>Receita</td><td class="dir">${reais(receitaMensal)}</td></tr>`,
          `<tr><td>Custo</td><td class="dir">-${reais(custoMensal)}</td></tr>`,
          `<tr class="totais"><td>Livre</td><td class="dir">${reais(receitaMensal - custoMensal)}</td></tr>`,
        ]),
      ),
    );
  }

  if (aporteMensal) partes.push(secao('Aporte', `<p class="pergunta">${reais(aporteMensal)} por mês</p>`));

  partes.push(
    secao('Pergunta da semana', `<p class="pergunta">${perguntaDaSemana(data)}</p>`),
    secao('Cores', `<p class="legenda">${legendaHtml()}</p>`),
  );

  if (pendencias.size) {
    partes.push(
      secao(
        'Pendências',
        `<ul class="pendencia">${[...pendencias].map((item) => `<li>${item}</li>`).join('')}</ul>`,
      ),
    );
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${partes.join(
    '',
  )}</body></html>`;
}
