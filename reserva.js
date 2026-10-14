// A reserva medida pelos dados de cada item, na ordem que faz sentido para o JV:
// - quem tem um aporte só, com data (as caixinhas), é medido por `taxaEquivalente`;
// - os cofrinhos recebem aporte toda semana, então "data do aporte" não existe neles: o jeito é
//   anotar o saldo de vez em quando e olhar a diferença entre dois snapshots.
// Módulo puro: sem rede e sem disco.
import { acumuladoEntre, compararComCdi, taxaEquivalente } from './indicadores.js';

const DIA = 86400000;

function diasEntre(de, ate) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA);
}

// Dias úteis depois de `de` e até `ate`: o CDI só rende de segunda a sexta.
function diasUteisDepois(de, ate) {
  let uteis = 0;
  const total = diasEntre(de, ate);
  for (let passo = 0; passo < total; passo += 1) {
    const dia = new Date(Date.parse(`${ate}T00:00:00Z`) - passo * DIA).getUTCDay();
    if (dia !== 0 && dia !== 6) uteis += 1;
  }
  return uteis;
}

// A referência do CDI para um intervalo: o que a série do BCB mostra na janela e, quando o CDI
// daquele dia ainda não foi publicado (o SGS publica com atraso), a última taxa diária da série
// contada nos dias úteis do intervalo. Sem série nenhuma, resta o CDI anual do painel.
// Devolve uma função pronta para o `medirItem`.
export function cdiParaComparar({ serie = [], cdiAnual = null } = {}) {
  const diaria = serie.at(-1)?.valor ?? null;
  return (de, ate) => {
    const doPeriodo = serie.length ? acumuladoEntre(serie, de, ate) : 0;
    if (doPeriodo) return doPeriodo;

    const uteis = diasUteisDepois(de, ate);
    if (uteis && diaria !== null) return (1 + diaria / 100) ** uteis - 1;

    const dias = diasEntre(de, ate);
    return dias > 0 && cdiAnual ? (1 + cdiAnual) ** (dias / 365) - 1 : null;
  };
}

// Junta o snapshot do dia na lista do item. O mesmo dia é substituído, não duplicado.
export function registrarSnapshot(historico = {}, nome, { data, saldo, investido = null }) {
  const ponto = { data, saldo: Number(saldo) };
  if (Number.isFinite(Number(investido))) ponto.investido = Number(investido);
  const lista = [...(historico[nome] ?? []).filter((antigo) => antigo?.data !== data), ponto].sort((a, b) =>
    a.data < b.data ? -1 : 1,
  );
  return { ...historico, [nome]: lista };
}

// Quanto o item rendeu entre o primeiro e o último snapshot.
// `cdiNoPeriodo` pode ser um número ou uma função `(de, ate) => fração`.
export function medirSnapshots(snapshots = [], { cdiNoPeriodo = null } = {}) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return null;

  const ordenados = [...snapshots].sort((a, b) => (a.data < b.data ? -1 : 1));
  const inicio = ordenados[0];
  const fim = ordenados.at(-1);
  const dias = diasEntre(inicio.data, fim.data);
  const saldoInicial = Number(inicio.saldo);
  const saldoFinal = Number(fim.saldo);
  if (!(dias > 0) || !(saldoInicial > 0) || !(saldoFinal > 0)) return null;

  // Com o total investido nas duas pontas, o que entrou de aporte sai da conta. Sem ele, o aporte
  // entra como se fosse rendimento — por isso `medidoComAportes` fica junto, para quem lê saber.
  const comAportes =
    Number.isFinite(Number(inicio.investido)) && Number.isFinite(Number(fim.investido));
  const aportes = comAportes ? Number(fim.investido) - Number(inicio.investido) : 0;
  const rendimento = saldoFinal - saldoInicial - aportes;

  // O capital não ficou parado no saldo inicial: a base é a média do dinheiro empregado no período.
  const base = (saldoInicial + (saldoFinal - rendimento)) / 2;
  if (!(base > 0)) return null;

  const total = rendimento / base;
  const cdi = typeof cdiNoPeriodo === 'function' ? cdiNoPeriodo(inicio.data, fim.data) : cdiNoPeriodo;
  return {
    dias,
    de: inicio.data,
    ate: fim.data,
    rendimento,
    aportes,
    medidoComAportes: comAportes,
    total,
    taxaAnual: (1 + total) ** (365 / dias) - 1,
    percentualDoCdi: cdi ? total / cdi : null,
  };
}

// Como medir um item da reserva: pela data do aporte, quando ela existe, e pelos snapshots quando
// não existe (ou quando não deu para medir pelo aporte).
// `cdiNoPeriodo` pode ser um número ou uma função `(de, ate) => fração`.
export function medirItem(item, historico = {}, { hoje, cdiNoPeriodo = null } = {}) {
  const doCdi = (de, ate) => (typeof cdiNoPeriodo === 'function' ? cdiNoPeriodo(de, ate) : cdiNoPeriodo);

  if (item?.dataAporte) {
    const porAporte = taxaEquivalente(item, hoje);
    if (porAporte) {
      return {
        ...porAporte,
        de: item.dataAporte,
        ate: hoje,
        // O principal é o saldo de hoje descontado o que ele já rendeu.
        rendimento: Number(item.saldo) * (porAporte.total / (1 + porAporte.total)),
        percentualDoCdi: compararComCdi(porAporte.total, doCdi(item.dataAporte, hoje)),
      };
    }
  }
  return medirSnapshots(historico[item?.nome], { cdiNoPeriodo });
}
