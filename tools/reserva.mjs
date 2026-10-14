// Snapshots da reserva: anota o saldo de hoje de cada item e mostra o que ele rendeu desde o
// snapshot anterior. É assim que os cofrinhos de aporte semanal (sem data única) são medidos.
// Uso: npm run reserva
import { mkdir, writeFile } from 'node:fs/promises';
import { formatarData, formatarNumero, formatarPercentual, hojeEmBrasilia } from '../indicadores.js';
import { tabela } from '../relatorio.js';
import { cdiParaComparar, medirItem, registrarSnapshot } from '../reserva.js';
import { dadosUrl, lerJson, lerJsonOu } from './arquivos.mjs';
import { serieCdi } from './mercado.mjs';
import { baixar, encerrar } from './sincronizar.mjs';

const CARTEIRA = dadosUrl('carteira.json');
const HISTORICO = dadosUrl('reserva-historico.json');
const PAINEL = new URL('../dados/indicadores.json', import.meta.url);
const HOJE = hojeEmBrasilia();
const curto = (dataIso) => (dataIso ? formatarData(dataIso).slice(0, 5) : '–');

// Antes de ler e de escrever: o que foi anotado em outra máquina (ou no Telegram) entra aqui.
await baixar();

const carteira = await lerJson(
  CARTEIRA,
  'Copie carteira.example.json para carteira.json e preencha seus dados (ele não vai para o git).',
);
const itens = carteira.reserva?.detalhe ?? [];
if (!itens.length) {
  console.log('Não achei nenhum item em reserva.detalhe do carteira.json.');
  await encerrar('', 1);
}

let historico = await lerJsonOu(HISTORICO);
// Quem tem data de aporte é medido por ela: não precisa de snapshot (e não sujaria o histórico).
for (const item of itens.filter((cada) => !cada.dataAporte)) {
  historico = registrarSnapshot(historico, item.nome, {
    data: HOJE,
    saldo: item.saldo,
    investido: item.investido,
  });
}
await mkdir(new URL('./', HISTORICO), { recursive: true });
await writeFile(HISTORICO, `${JSON.stringify(historico, null, 2)}\n`, 'utf8');

// O CDI de todos os períodos sai de uma consulta só, desde a data mais antiga que interessa
// (inclui as datas de aporte, que são mais antigas que os snapshots).
const datas = [
  ...Object.values(historico)
    .flat()
    .map((ponto) => ponto.data),
  ...itens.map((item) => item.dataAporte),
]
  .filter(Boolean)
  .sort();
const painel = await lerJsonOu(PAINEL);
const cdiAnual = (painel?.indicadores?.find((cartao) => cartao.id === 'cdi')?.valor ?? 0) / 100;
let serie = [];
try {
  serie = await serieCdi(datas[0]);
} catch (erro) {
  console.log(`::warning::CDI indisponível hoje (${erro.message}) — a comparação usa o CDI do painel`);
}
const cdiNoPeriodo = cdiParaComparar({ serie, cdiAnual });

const linhas = [['onde', 'saldo', 'desde', 'rendeu', 'prometido', 'entregou', 'ao ano']];
const semMedicao = [];
const primeiros = [];
const curtos = [];
const parados = [];
for (const item of itens) {
  const medido = medirItem(item, historico, { hoje: HOJE, cdiNoPeriodo });
  const lista = historico[item.nome] ?? [];
  if (item.taxaCDI && lista.length >= 2 && lista.at(-1).saldo === lista.at(-2).saldo) parados.push(item.nome);
  const prometido = item.taxaCDI ? `${formatarPercentual(item.taxaCDI, 0)} do CDI` : '–';
  if (!medido) {
    if (lista.length < 2) primeiros.push(item.nome);
    else semMedicao.push(item.nome);
    linhas.push([item.nome, formatarNumero(item.saldo, 2), '–', '–', prometido, '–', '–']);
    continue;
  }
  if (!item.dataAporte && medido.dias < 7) curtos.push(item.nome);
  linhas.push([
    item.nome,
    formatarNumero(item.saldo, 2),
    `${curto(medido.de)} (${medido.dias}d)`,
    formatarNumero(medido.rendimento, 2),
    prometido,
    formatarPercentual(medido.percentualDoCdi, 0),
    formatarPercentual(medido.taxaAnual),
  ]);
}

console.log(`RESERVA — snapshot de ${formatarData(HOJE)}\n`);
console.log(tabela(linhas, { colunas: ['esq', 'dir', 'esq', 'dir', 'dir', 'dir', 'dir'] }));
console.log(
  '\nprometido é a taxa que o banco anuncia; entregou é o que o saldo rendeu no período medido.\n' +
    'diferença grande costuma ser taxa antiga, aporte novo no meio ou imposto já descontado no app.',
);
if (primeiros.length) {
  console.log(`\nprimeiro snapshot: ${primeiros.join(', ')} — a medição aparece quando houver o segundo.`);
}
if (curtos.length) {
  console.log(`\nmenos de uma semana de histórico (${curtos.join(', ')}): o número oscila; com o tempo ele firma.`);
}
if (semMedicao.length) {
  console.log(`\nsem medição: ${semMedicao.join(', ')} — confira o saldo no carteira.json.`);
}
if (parados.length) {
  console.log(
    `\nsaldo igual ao do snapshot anterior (${parados.join(', ')}): se mudou no app, atualize o carteira.json antes de rodar de novo.`,
  );
}

await encerrar(`dados: reserva de ${HOJE}`, 0);
