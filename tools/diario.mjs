// Diário de decisões: escreva a tese antes de decidir; a ferramenta cobra a revisão depois.
// Uso:
//   npm run diario                  → painel (o que falta preencher e o que venceu)
//   npm run diario -- novo "texto"  → cria o esqueleto de uma decisão nova
import { acumuladoDesde, hojeEmBrasilia } from '../indicadores.js';
import { lerEntradas, painelDoDiario, situacao } from '../caderno.js';
import { mensagemDeResposta } from '../comandos.js';
import { anotarDecisao } from './anotar.mjs';
import { dadosUrl, lerTexto } from './arquivos.mjs';
import { serieCdi, variacaoDesde } from './mercado.mjs';

const ARQUIVO = dadosUrl('diario/decisoes.md');
const HOJE = hojeEmBrasilia();
const EXEMPLO = 'diario/decisoes.example.md';

const [, , comando, ...resto] = process.argv;

if (comando === 'novo') {
  const titulo = resto.join(' ').trim();
  if (!titulo) {
    console.error('Diga o que você está decidindo: npm run diario -- novo "comprar mais RENT3"');
    process.exit(1);
  }
  const resultado = await anotarDecisao({ titulo, hoje: HOJE });
  if (resultado.recusada) {
    console.error(resultado.recusada);
    process.exit(1);
  }
  console.log(`Bloco criado em diario/decisoes.md:\n\n${resultado.bloco}`);
  console.log(mensagemDeResposta({ tipo: 'decisao', ...resultado }));
  process.exit(0);
}

const texto = await lerTexto(ARQUIVO);
const entradas = lerEntradas(texto);
const vencidas = entradas.filter((entrada) => situacao(entrada, HOJE).vencida);

// Fatos do mercado para as decisões vencidas: o CDI do período e, se houver ticker no
// título, quanto o ativo andou desde a data em que você decidiu.
const fatos = {};
if (vencidas.length) {
  const datas = vencidas.map((entrada) => entrada.data).sort();
  let serie = [];
  try {
    serie = await serieCdi(datas[0]);
  } catch (erro) {
    console.log(`::warning::CDI indisponível hoje (${erro.message})`);
  }
  for (const entrada of vencidas) {
    const fato = {};
    if (serie.length) fato.cdi = acumuladoDesde(serie, entrada.data);
    const ticker = entrada.titulo.match(/\b([A-Z]{4}\d{1,2})\b/)?.[1];
    if (ticker) {
      try {
        const movimento = await variacaoDesde(ticker, entrada.data);
        if (movimento) {
          fato.variacao = movimento.variacao;
          fato.variacaoSemana = movimento.variacaoSemana;
        }
      } catch (erro) {
        console.log(`::warning::${ticker} indisponível hoje (${erro.message})`);
      }
    }
    fatos[entrada.titulo] = fato;
  }
}

console.log(painelDoDiario({ texto, hoje: HOJE, fatos }));
if (!texto) console.log(`\nModelo: ${EXEMPLO}`);
