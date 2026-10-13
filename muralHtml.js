// Mural de conquistas (F0.5e): a linha do tempo dos marcos em um HTML só, que abre no celular e
// funciona offline. Arquivo local, nunca publicado — sai de `jogo/mural.md` e `jogo/historico.json`.
import { formatarData, formatarNumero, formatarPercentual } from './indicadores.js';
import { rotuloDoMarco } from './relatorio.js';

const reais = (valor) => `R$ ${formatarNumero(Number(valor) || 0, 2)}`;

const CSS = `
:root { color-scheme: dark; --fundo: #0f1216; --cartao: #171b21; --cartao2: #1f242c; --texto: #e7e5e0; --apagado: #9aa1ab; --linha: #262c35; --destaque: #2ecc71; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--fundo); color: var(--texto); font-family: system-ui, "Segoe UI", Roboto, sans-serif; font-size: 18px; line-height: 1.5; padding: 22px 18px 40px; }
main { max-width: 640px; margin: 0 auto; }
h1 { font-size: 26px; line-height: 1.25; }
header p { color: var(--apagado); font-size: 15px; margin-top: 6px; }
.conclusao { font-size: 21px; line-height: 1.35; margin: 20px 0 26px; }
.conclusao strong { color: var(--destaque); }
ol { list-style: none; position: relative; margin-left: 12px; border-left: 2px solid var(--linha); padding-left: 20px; }
li { position: relative; padding: 0 0 26px; }
li::before { content: ""; position: absolute; left: -27px; top: 7px; width: 12px; height: 12px; border-radius: 50%; background: var(--destaque); }
.marco { font-size: 20px; font-weight: 600; }
.data { color: var(--apagado); font-size: 15px; margin-left: 8px; }
.premio { display: block; color: var(--texto); margin-top: 4px; }
.frase { display: block; color: var(--apagado); font-style: italic; margin-top: 4px; }
.trecho { display: block; color: var(--apagado); font-size: 15px; margin-top: 6px; }
.detalhe { color: var(--apagado); }
.proximo { background: var(--cartao); border: 1px solid var(--linha); border-radius: 14px; padding: 16px; margin-top: 8px; }
.proximo h2 { font-size: 15px; letter-spacing: .08em; text-transform: uppercase; color: var(--apagado); margin-bottom: 10px; }
.barra { height: 14px; border-radius: 7px; background: var(--cartao2); overflow: hidden; }
.barra div { height: 100%; background: var(--destaque); }
.proximo p { margin-top: 10px; }
footer { color: var(--apagado); font-size: 14px; margin-top: 26px; }
@media print { :root { color-scheme: light; } body { background: #fff; color: #111; } .proximo, li::before, .barra div { background: #eee; } }
`;

// A primeira tela responde: quantos marcos e se está ficando mais rápido.
export function fraseDoMural({ trechos = [], proximo = null } = {}) {
  if (!trechos.length) {
    if (!proximo) return 'Nenhum marco batido ainda — e a lista de marcos acabou.';
    const ritmo = Number.isFinite(proximo.meses)
      ? ` São cerca de ${proximo.meses} ${proximo.meses === 1 ? 'mês' : 'meses'} no ritmo atual.`
      : '';
    return `Nenhum marco batido ainda: faltam ${reais(proximo.falta)} para ${rotuloDoMarco(proximo.marco)}.${ritmo}`;
  }

  const ultimo = trechos.at(-1);
  const meses =
    ultimo.meses === null
      ? ''
      : ` O último trecho levou ${formatarNumero(ultimo.meses, 1)} ${ultimo.meses === 1 ? 'mês' : 'meses'}.`;
  const acelerou =
    trechos.length > 1 &&
    trechos[0].meses !== null &&
    ultimo.meses !== null &&
    ultimo.meses < trechos[0].meses;
  const fraseAcelerou = acelerou ? ' E cada trecho está levando menos tempo que o anterior.' : '';

  return `${trechos.length === 1 ? 'Primeiro marco batido' : `${trechos.length} marcos batidos`}: ${rotuloDoMarco(
    ultimo.marco,
  )}.${meses}${fraseAcelerou}`;
}

function linhaDoTempo(trechos) {
  return trechos
    .map((trecho) => {
      const pedacos = [`<span class="marco">${rotuloDoMarco(trecho.marco)}</span>`];
      if (trecho.liberadoEm) pedacos.push(`<span class="data">${formatarData(trecho.liberadoEm)}</span>`);

      const corpo = [`<div>${pedacos.join('')}</div>`];
      if (trecho.premio) {
        const gasto = trecho.valorGasto === null ? '' : ` — ${reais(trecho.valorGasto)} gastos`;
        corpo.push(`<span class="premio">${trecho.premio}${gasto}</span>`);
      }
      if (trecho.frase) corpo.push(`<span class="frase">"${trecho.frase}"</span>`);
      if (trecho.meses !== null) {
        const doAnterior =
          trecho.anterior === null ? 'desde o começo do jogo' : `desde ${rotuloDoMarco(trecho.anterior)}`;
        corpo.push(
          `<span class="trecho">levou ${formatarNumero(trecho.meses, 1)} ${
            trecho.meses === 1 ? 'mês' : 'meses'
          } ${doAnterior}</span>`,
        );
      } else if (trecho.liberadoEm) {
        corpo.push('<span class="trecho">primeiro trecho: o histórico ainda não tinha começado</span>');
      }

      return `<li>${corpo.join('')}</li>`;
    })
    .join('');
}

function proximoBloco(proximo) {
  if (!proximo) {
    return `<section class="proximo"><h2>Próximo marco</h2><p>Você passou do último marco da lista — hora de escolher os próximos.</p></section>`;
  }

  const premio = proximo.premio ? ` → ${proximo.premio}` : ' (prêmio ainda não escolhido)';
  const meses = Number.isFinite(proximo.meses)
    ? `~${proximo.meses} ${proximo.meses === 1 ? 'mês' : 'meses'} no ritmo atual`
    : 'no ritmo atual não chega';
  const juros = Number.isFinite(proximo.fracaoDosJuros)
    ? ` · nesse trecho, ~${formatarPercentual(proximo.fracaoDosJuros, 0)} virá dos juros`
    : '';

  return `<section class="proximo"><h2>Próximo marco</h2>
<div class="barra"><div style="width:${(proximo.percentual * 100).toFixed(1)}%"></div></div>
<p><strong>${rotuloDoMarco(proximo.marco)}</strong> · faltam ${reais(proximo.falta)} · ${meses}</p>
<p class="detalhe">Prêmio: até ${reais(proximo.valorPremio)}${premio}${juros}</p></section>`;
}

export function montarMural({ trechos = [], proximo = null, hoje, fonte = 'jogo/mural.md' } = {}) {
  const comAnterior = [];
  let anterior = null;
  for (const trecho of trechos) {
    comAnterior.push({ ...trecho, anterior });
    anterior = trecho.marco;
  }

  const lista = comAnterior.length
    ? `<ol>${linhaDoTempo(comAnterior)}</ol>`
    : '<p class="trecho">Nenhum marco no mural ainda. O primeiro entra aqui no domingo em que o patrimônio passar dele.</p>';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mural de conquistas</title><style>${CSS}</style></head><body><main>
<header><h1>Mural de conquistas</h1><p>Patrimônio além da reserva de emergência · ${formatarData(hoje)}</p></header>
<p class="conclusao">${fraseDoMural({ trechos, proximo })}</p>
${lista}
${proximoBloco(proximo)}
<footer>Fonte: ${fonte} e jogo/historico.json (arquivos privados, só na sua máquina).</footer>
</main></body></html>`;
}
