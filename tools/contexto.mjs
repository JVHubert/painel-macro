// Contexto para o professor de IA: um bloco pronto para colar, sem número exato.
// Uso: npm run contexto
import { hojeEmBrasilia } from '../indicadores.js';
import { lerEntradas } from '../caderno.js';
import { blocoDeContexto } from '../contexto.js';
import { dadosUrl, lerJson, lerTexto } from './arquivos.mjs';
import { baixar } from './sincronizar.mjs';

const CARTEIRA = dadosUrl('carteira.json');
const DIARIO = dadosUrl('diario/decisoes.md');
const ESTUDO = dadosUrl('estudo/respostas.md');

// Antes de ler: o diário e o estudo mais novos podem estar no Telegram.
await baixar();

const carteira = await lerJson(
  CARTEIRA,
  'Copie carteira.example.json para carteira.json e preencha seus dados (ele não vai para o git).',
);

const bloco = blocoDeContexto({
  data: hojeEmBrasilia(),
  receitaMensal: carteira.receitaMensal,
  custoMensal: carteira.custoMensal,
  aporteMensal: carteira.aporteMensal,
  reserva: carteira.reserva,
  posicoes: carteira.posicoes ?? [],
  respostas: lerEntradas(await lerTexto(ESTUDO)),
  decisoes: lerEntradas(await lerTexto(DIARIO)),
});

console.log(bloco);
// O aviso vai para a saída de erro: quem copia o bloco com `| clip` leva só o bloco.
console.error('\n(é este bloco que você cola no começo da conversa com o professor de IA)');
