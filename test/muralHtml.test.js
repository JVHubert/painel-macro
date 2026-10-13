import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fraseDoMural, montarMural } from '../muralHtml.js';

const trecho = (extra) => ({
  marco: 25000,
  liberadoEm: '2026-07-05',
  valorLiberado: 5000,
  premio: 'Tatuagem',
  compradoEm: '2026-08-02',
  valorGasto: 4200,
  frase: 'valeu cada centavo',
  meses: 6,
  ...extra,
});

const proximo = (extra) => ({
  marco: 40000,
  falta: 8000,
  percentual: 0.5,
  valorPremio: 3000,
  premio: 'Mesa de som',
  meses: 14,
  fracaoDosJuros: 0.4,
  ...extra,
});

test('sem marco batido, a primeira tela diz quanto falta para o primeiro', () => {
  const frase = fraseDoMural({ trechos: [], proximo: proximo() });
  assert.match(frase, /Nenhum marco batido ainda: faltam R\$ 8\.000,00 para R\$ 40 mil\./);
  assert.match(frase, /São cerca de 14 meses no ritmo atual\./);
});

test('a frase mostra a aceleração quando o trecho encurta', () => {
  const acelerando = fraseDoMural({ trechos: [trecho(), trecho({ marco: 40000, meses: 3.2 })], proximo: proximo() });
  assert.match(acelerando, /2 marcos batidos: R\$ 40 mil\./);
  assert.match(acelerando, /O último trecho levou 3,2 meses\./);
  assert.match(acelerando, /E cada trecho está levando menos tempo que o anterior\./);

  const devagar = fraseDoMural({ trechos: [trecho(), trecho({ marco: 40000, meses: 9 })], proximo: proximo() });
  assert.ok(!devagar.includes('menos tempo'), 'sem encurtar, não promete aceleração');
});

test('o mural monta a linha do tempo com prêmio, frase e meses', () => {
  const html = montarMural({ trechos: [trecho()], proximo: proximo(), hoje: '2026-10-13' });

  assert.match(html, /<title>Mural de conquistas<\/title>/);
  assert.match(html, /R\$ 25 mil/);
  assert.match(html, /05\/07\/2026/);
  assert.match(html, /Tatuagem — R\$ 4\.200,00 gastos/);
  assert.match(html, /"valeu cada centavo"/);
  assert.match(html, /levou 6,0 meses desde o começo do jogo/);
  assert.match(html, /Próximo marco/);
  assert.match(html, /style="width:50\.0%"/);
  assert.match(html, /Prêmio: até R\$ 3\.000,00 → Mesa de som · nesse trecho, ~40% virá dos juros/);
});

test('mural vazio, ou sem próximo marco, não quebra', () => {
  const vazio = montarMural({ trechos: [], proximo: null, hoje: '2026-10-13' });
  assert.match(vazio, /Nenhum marco no mural ainda/);
  assert.match(vazio, /Você passou do último marco da lista/);

  const semPremio = montarMural({
    trechos: [],
    proximo: proximo({ premio: '', valorPremio: 0, meses: Infinity, fracaoDosJuros: null }),
    hoje: '2026-10-13',
  });
  assert.match(semPremio, /no ritmo atual não chega/);
  assert.match(semPremio, /prêmio ainda não escolhido/);
});
