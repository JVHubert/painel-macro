// Versão em HTML do relatório: é ela que vira imagem colorida, porque o Telegram não
// aceita texto colorido em mensagem. Os números são os mesmos do texto — muda a roupa.
import { formatarData, formatarNumero, formatarPercentual } from './indicadores.js';
import {
  alocacao,
  dadosMacro,
  fraseResumo,
  juntarPendencias,
  linhasDaCarteira,
  linhasDaReserva,
  nivelDaReserva,
  notaDoExcedente,
  numeroDaSemana,
  paraEstaSemana,
  rotuloDoMarco,
  totalDaReserva,
  variacaoDaSemana,
} from './relatorio.js';

const reais = (valor) => `R$ ${formatarNumero(valor, 2)}`;

const tdNivel = (texto, nivel) => `<td class="dir${nivel ? ` ${nivel.classe}` : ''}">${texto}</td>`;

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
  font-size: 16px;
  line-height: 1.35;
  padding: 22px;
}
header { margin-bottom: 16px; }
h1 { font-size: 24px; }
header p { color: var(--apagado); font-size: 15px; margin-top: 4px; }
section {
  background: var(--cartao);
  border: 1px solid var(--linha);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 11px;
}
h2 {
  font-size: 14px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--apagado);
  margin-bottom: 10px;
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
td { padding: 3px 0; }
tr.totais td { border-top: 1px solid var(--linha); padding-top: 9px; font-weight: 600; }
.muito-bom { color: var(--muito-bom); }
.bom { color: var(--bom); }
.neutro { color: var(--neutro); }
.ruim { color: var(--ruim); }
.muito-ruim { color: var(--muito-ruim); }
.nota { color: var(--apagado); font-size: 13px; margin-top: 10px; }
.pergunta { font-size: 17px; line-height: 1.45; }
.item { margin-top: 6px; }
.placar { color: var(--apagado); font-size: 14px; }
.jogo-barra { height: 14px; margin: 2px 0 10px; border-radius: 7px; background: var(--linha); overflow: hidden; }
.jogo-barra div { height: 100%; background: var(--bom); }
.jogo-linha { font-size: 16px; margin-top: 4px; }
.jogo-linha .forte { color: var(--bom); }
header .resumo { color: var(--texto); font-size: 16px; margin-top: 8px; }
.barra { display: flex; height: 20px; margin-top: 10px; border-radius: 6px; overflow: hidden; background: var(--linha); }
.barra .parte { height: 100%; }
.parte-0 { background: #33405a; }
.parte-1 { background: #8b93a1; }
footer { margin-top: 8px; }
.legenda { display: flex; flex-wrap: wrap; gap: 16px; color: var(--apagado); font-size: 13px; }
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
    (linha) => `<tr><td>${linha.nome}</td><td class="dir">${linha.valor}</td><td class="dir">${linha.semana}</td></tr>`,
  );
  return secao('Macro', `${tabelaHtml(['Indicador', 'Valor', 'Semana'], corpo)}<p class="nota">${notas.join(' · ')}</p>`);
}

function paraEstaSemanaHtml(dados) {
  const { itens, pergunta } = paraEstaSemana(dados);
  const lista = itens.map((item) => `<p class="item">${item}</p>`).join('');
  const placar = dados.caderno?.placar?.linha
    ? `<p class="item placar">${dados.caderno.placar.linha}</p>`
    : '';
  return secao('Para esta semana', `${lista}<p class="pergunta">${pergunta}</p>${placar}`);
}

// A comemoração vem antes de tudo: é o único momento em que o dinheiro compra vontade.
function comemoracaoHtml(comemoracoes) {
  if (!comemoracoes?.length) return '';
  const corpo = comemoracoes
    .map((comemoracao) => {
      const nome = comemoracao.premio ? ` — <span class="forte">${comemoracao.premio}</span>` : '';
      return `<p class="jogo-linha">Você passou de <span class="forte">${rotuloDoMarco(
        comemoracao.marco,
      )}</span> além da reserva! Prêmio liberado: até ${reais(comemoracao.valorLiberado)}${nome} · compre até ${formatarData(
        comemoracao.prazo,
      )}.</p>`;
    })
    .join('');
  return secao(
    '🎉 Marco batido',
    `${corpo}<p class="nota">Depois de comprar, mande no Telegram: /premio &lt;valor gasto&gt; | &lt;a frase que você quer guardar&gt;</p>`,
  );
}

// O jogo dos marcos: a barra é o que faz o próximo prêmio parecer perto.
function jogoHtml(dados) {
  const jogo = dados.jogo;
  if (!jogo) return '';

  if (!jogo.proximoMarco) {
    return secao(
      'Jogo dos marcos',
      '<div class="jogo-barra"><div style="width:100%"></div></div><p class="jogo-linha">Você passou do último marco da lista — hora de escolher os próximos.</p>',
    );
  }

  const barra = `<div class="jogo-barra"><div style="width:${(jogo.percentual * 100).toFixed(1)}%"></div></div>`;
  const meses = !Number.isFinite(jogo.meses)
    ? 'no ritmo atual não chega'
    : jogo.meses > 0
      ? `~${jogo.meses} ${jogo.meses === 1 ? 'mês' : 'meses'} no ritmo atual`
      : 'bateu o marco — falta a confirmação de mais um domingo';
  const linhaDoMarco = `<p class="jogo-linha"><span class="forte">${rotuloDoMarco(jogo.proximoMarco)}</span> · faltam ${reais(
    jogo.falta,
  )} · ${meses} <span class="nota">(reserva de emergência fora da conta)</span></p>`;

  const juros = jogo.juros?.fracao;
  const pedacoDeJuros = Number.isFinite(juros) ? ` · nesse trecho, ~${formatarPercentual(juros, 0)} virá dos juros` : '';
  const linhaDoPremio = jogo.premio?.item
    ? `<p class="jogo-linha">Prêmio: até ${reais(jogo.premio.valor)} → <span class="forte">${jogo.premio.item.nome}</span>${pedacoDeJuros}</p>`
    : `<p class="jogo-linha">Prêmio: escolha o prêmio do marco de ${rotuloDoMarco(jogo.proximoMarco)}</p>`;

  const aviso = jogo.semHistorico
    ? '<p class="nota">Primeiro domingo do histórico: a confirmação do marco começa no próximo.</p>'
    : '';

  const aberto = jogo.premioAberto;
  const nomeDoPremio = aberto?.premio ? ` — <span class="forte">${aberto.premio}</span>` : '';
  const linhaLiberada =
    aberto && !aberto.expirado
      ? `<p class="jogo-linha">Prêmio liberado: até ${reais(aberto.valorLiberado)}${nomeDoPremio} · compre até ${formatarData(
          aberto.prazo,
        )} (${aberto.diasAteOPrazo} ${aberto.diasAteOPrazo === 1 ? 'dia' : 'dias'})</p>`
      : aberto?.expirado
        ? `<p class="jogo-linha">Prêmio do marco de ${rotuloDoMarco(aberto.marco)} expirou · o dinheiro fica investido</p>`
        : '';

  return secao('Jogo dos marcos', `${barra}${linhaDoMarco}${linhaDoPremio}${linhaLiberada}${aviso}`);
}

function patrimonioHtml(dados) {
  const { total, partes } = alocacao(dados);
  const variacao = variacaoDaSemana(dados);
  const linhas = [`<tr><td>Total</td><td class="dir">${reais(total)}</td></tr>`];
  if (variacao !== null) {
    linhas.push(
      `<tr><td>Na semana (estimativa)</td><td class="dir">${variacao >= 0 ? '+' : '−'}${formatarPercentual(
        Math.abs(variacao),
      )}</td></tr>`,
    );
  }
  const barra = partes.length
    ? `<div class="barra">${partes
        .map((parte, i) => `<div class="parte parte-${i}" style="width:${(parte.fracao * 100).toFixed(1)}%"></div>`)
        .join('')}</div><p class="nota">${partes
        .map((parte) => `${parte.nome} ${formatarPercentual(parte.fracao, 1)}`)
        .join(' · ')}</p>`
    : '';
  return secao('Patrimônio', `${tabelaSimples(linhas)}${barra}`);
}

function carteiraHtml(posicoes, { patrimonio = null } = {}) {
  const { linhas } = linhasDaCarteira(posicoes, { patrimonio });
  if (!linhas.length) return secao('Carteira', '<p class="nota">nenhuma posição em carteira.json</p>');

  const comFracao = linhas.some((linha) => linha.fracao !== null);
  const cabecalho = ['Ticker', 'Aplicado', 'Hoje', 'Resultado', ...(comFracao ? ['% do patrimônio'] : [])];
  const corpo = linhas.map(
    (linha) =>
      `<tr><td>${linha.ticker}</td><td class="dir">${linha.aplicado}</td><td class="dir">${linha.hoje}</td>${tdNivel(
        linha.resultado,
        linha.nivel,
      )}${
        comFracao ? `<td class="dir">${linha.fracao === null ? '–' : formatarPercentual(linha.fracao, 1)}</td>` : ''
      }</tr>`,
  );

  const partes = [tabelaHtml(cabecalho, corpo)];
  for (const linha of linhas) {
    if (linha.fraseCdi) partes.push(`<p class="nota">${linha.fraseCdi}</p>`);
    if (linha.divergem) {
      partes.push(
        `<h3>lotes de ${linha.ticker}</h3>`,
        tabelaHtml(
          ['Qtd', 'Aplicado', 'Hoje', 'Resultado'],
          linha.lotes.map(
            (lote) =>
              `<tr><td class="dir">${lote.quantidade}</td><td class="dir">${lote.aplicado}</td><td class="dir">${lote.hoje}</td>${tdNivel(
                lote.resultado,
                lote.nivel,
              )}</tr>`,
          ),
        ),
      );
    }
  }
  partes.push('<p class="nota">só preço; não inclui dividendos nem imposto</p>');
  return secao('Carteira', partes.join(''));
}

function reservaHtml(reserva, custoMensal) {
  const custo = Number(custoMensal) || Number(reserva?.custoMensal) || 0;
  const atual = totalDaReserva(reserva);
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

  const notaExcedente = notaDoExcedente({ meses, alvoMeses, atual, custo });
  if (notaExcedente) partes.push(`<p class="nota">${notaExcedente}</p>`);

  const { linhas } = linhasDaReserva(reserva);
  if (linhas.length) {
    partes.push(
      tabelaHtml(
        ['Onde', 'Saldo', 'Rende', 'vs CDI'],
        linhas.map(
          (linha) =>
            `<tr><td>${linha.onde}</td><td class="dir">${linha.saldo}</td><td class="dir">${linha.rende}</td>${tdNivel(
              linha.vsCdi,
              linha.nivel,
            )}</tr>`,
        ),
      ),
    );
  }

  return secao('Reserva', partes.join(''));
}

function sobraHtml({ receitaMensal, custoMensal, aporteMensal }) {
  if (!receitaMensal || !custoMensal) return '';
  const sobra = receitaMensal - custoMensal;
  const semDestino = sobra - (Number(aporteMensal) || 0);
  const pedacos = [`Sobra ${reais(sobra)}`];
  if (aporteMensal) pedacos.push(`aporte programado ${reais(aporteMensal)}`);
  pedacos.push(semDestino > 0 ? `sobram ${reais(semDestino)} sem destino` : 'nada sobrando sem destino');
  return secao('Sobra do mês', `<p class="pergunta">${pedacos.join(' · ')}</p>`);
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

export function montarHtml(dados = {}) {
  const { data, painel, posicoes = [], reserva, custoMensal } = dados;
  const { total } = alocacao(dados);
  const { pendencias } = juntarPendencias({ ...dados, patrimonio: total });

  const partes = [
    `<header><h1>Relatório semanal</h1><p>${formatarData(data)} · semana ${numeroDaSemana(data)}</p><p class="resumo">${fraseResumo(
      dados,
    )}</p></header>`,
    comemoracaoHtml(dados.jogo?.comemoracoes),
    paraEstaSemanaHtml(dados),
    jogoHtml(dados),
    patrimonioHtml(dados),
    reservaHtml(reserva, custoMensal),
    carteiraHtml(posicoes, { patrimonio: total }),
    sobraHtml(dados),
    macroHtml(painel),
    `<footer><p class="legenda">${legendaHtml()}</p></footer>`,
  ];

  if (pendencias.size) {
    partes.push(
      secao('Pendências', `<ul class="pendencia">${[...pendencias].map((item) => `<li>${item}</li>`).join('')}</ul>`),
    );
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${partes.join(
    '',
  )}</body></html>`;
}
