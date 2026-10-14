import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cdiParaComparar, medirItem, medirSnapshots, registrarSnapshot } from '../reserva.js';

// O CDI de um dia útil, em fração (13,65% ao ano em 252 dias úteis).
const CDI_DIA = 0.00050788;

test('o snapshot do mesmo dia substitui o anterior, sem duplicar', () => {
  const com12 = registrarSnapshot({}, 'Cofrinho A', { data: '2026-10-12', saldo: 5000 });
  const com13 = registrarSnapshot(com12, 'Cofrinho A', { data: '2026-10-13', saldo: 5002.7 });
  const corrigido = registrarSnapshot(com13, 'Cofrinho A', { data: '2026-10-13', saldo: 5002.8 });

  assert.equal(com12['Cofrinho A'].length, 1, 'não mexe no histórico recebido');
  assert.equal(corrigido['Cofrinho A'].length, 2);
  assert.deepEqual(
    corrigido['Cofrinho A'].map((ponto) => ponto.data),
    ['2026-10-12', '2026-10-13'],
  );
  assert.equal(corrigido['Cofrinho A'].at(-1).saldo, 5002.8);
});

test('medirSnapshots olha a diferença entre o primeiro e o último', () => {
  const medido = medirSnapshots(
    [
      { data: '2026-10-12', saldo: 5000 },
      { data: '2026-10-13', saldo: 5002.7 },
    ],
    { cdiNoPeriodo: CDI_DIA },
  );

  assert.equal(medido.dias, 1);
  assert.ok(Math.abs(medido.rendimento - 2.7) < 1e-9);
  assert.ok(Math.abs(medido.percentualDoCdi - 1.063) < 0.01, '0,054% no dia é ~106% do CDI do dia');
  assert.ok(medido.taxaAnual > 0.2 && medido.taxaAnual < 0.24, 'um dia bom vira 22% ao ano');
});

test('sem dois snapshots de dias diferentes não há o que medir', () => {
  assert.equal(medirSnapshots([]), null);
  assert.equal(medirSnapshots([{ data: '2026-10-13', saldo: 5002.7 }]), null);
  assert.equal(
    medirSnapshots([
      { data: '2026-10-13', saldo: 5002.7 },
      { data: '2026-10-13', saldo: 5003.2 },
    ]),
    null,
  );
  assert.equal(medirSnapshots([{ data: '2026-10-12', saldo: 0 }, { data: '2026-10-13', saldo: 10 }]), null);
});

test('com o total investido nas duas pontas, o aporte do período sai do rendimento', () => {
  const medido = medirSnapshots([
    { data: '2026-10-12', saldo: 5000, investido: 1000 },
    { data: '2026-10-13', saldo: 5051.02, investido: 1050 },
  ]);

  assert.equal(medido.aportes, 50);
  assert.equal(medido.medidoComAportes, true);
  assert.ok(Math.abs(medido.rendimento - 1.02) < 1e-9, 'os R$ 50 que entraram não são rendimento');
});

test('medirItem prefere a data do aporte e cai nos snapshots quando ela não existe', () => {
  const caixinha = { nome: 'Caixinha X', saldo: 2469.28, investido: 2000, dataAporte: '2025-06-29' };
  const porAporte = medirItem(caixinha, {}, { hoje: '2026-10-13', cdiNoPeriodo: () => 0.192 });

  assert.equal(porAporte.dias, 471);
  assert.ok(Math.abs(porAporte.rendimento - 469.28) < 0.01);
  assert.equal(porAporte.medidoComAportes, undefined, 'quem tem data não passa por snapshot');
  assert.ok(Math.abs(porAporte.percentualDoCdi - 1.222) < 0.01, 'a caixinha entregou ~120% do CDI');

  const cofrinho = { nome: 'Cofrinho B', saldo: 10004.7, taxaCDI: 1.4 };
  const historico = {
    'Cofrinho B': [
      { data: '2026-10-12', saldo: 10000 },
      { data: '2026-10-13', saldo: 10004.7 },
    ],
  };
  const porSnapshot = medirItem(cofrinho, historico, { hoje: '2026-10-13', cdiNoPeriodo: CDI_DIA });
  assert.ok(Math.abs(porSnapshot.rendimento - 4.7) < 1e-9);
  assert.ok(Math.abs(porSnapshot.percentualDoCdi - 0.925) < 0.01);

  assert.equal(medirItem({ nome: 'Conta corrente', saldo: 1500 }, {}, { hoje: '2026-10-13' }), null);
});

test('a referência do CDI usa a série quando ela cobre a janela e a taxa diária quando não', () => {
  const serie = [
    { data: '2026-10-08', valor: 0.050788 },
    { data: '2026-10-09', valor: 0.050788 },
  ];
  const cdi = cdiParaComparar({ serie, cdiAnual: 0.1365 });

  assert.ok(Math.abs(cdi('2026-10-08', '2026-10-09') - (1.00050788 ** 2 - 1)) < 1e-12, 'a série manda');

  // O CDI de 13/10 ainda não foi publicado: vale a última taxa diária, contada no dia útil.
  assert.ok(Math.abs(cdi('2026-10-12', '2026-10-13') - 0.00050788) < 1e-12);

  // Sem série nenhuma, resta o CDI anual do painel esticado pelos dias corridos.
  const semSerie = cdiParaComparar({ serie: [], cdiAnual: 0.1365 });
  const corridos = 1.1365 ** (1 / 365) - 1;
  assert.ok(Math.abs(semSerie('2026-10-12', '2026-10-13') - corridos) < 1e-12);
  assert.equal(cdiParaComparar({ serie: [] })('2026-10-12', '2026-10-13'), null);
});
