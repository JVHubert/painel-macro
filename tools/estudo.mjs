// Trilha de estudo: registra a resposta da pergunta da semana, corrige as de conta na hora
// e mostra o histórico (incluindo as revisões que venceram).
// Uso:
//   npm run estudo                → pergunta desta semana, revisões, o que falta e o placar
//   npm run estudo -- novo        → cria o bloco desta semana para responder no editor
//   npm run estudo -- responder 1126,83 → registra a resposta da semana e corrige na hora
//   npm run estudo -- revisar 1126,83   → o mesmo, para a revisão mais antiga que venceu
import { mkdir, writeFile } from 'node:fs/promises';
import {
  CAMPOS_RESPOSTA,
  MAXIMO_DE_REVISOES,
  adicionarBloco,
  criarBloco,
  historicoDeEstudo,
  lerEntradas,
  painelDoEstudo,
  revisoesDaSemana,
  revisoesFeitas,
} from '../caderno.js';
import { hojeEmBrasilia } from '../indicadores.js';
import { numeroDaSemana } from '../relatorio.js';
import { perguntaDaSemana, perguntaPorTexto } from '../trilha.js';
import { mensagemDeResposta } from '../comandos.js';
import { anotarResposta, gabaritoDaPergunta } from './anotar.mjs';
import { baixar, encerrar, enviar } from './sincronizar.mjs';
import { dadosUrl, lerTexto } from './arquivos.mjs';

const ARQUIVO = dadosUrl('estudo/respostas.md');
const PASTA = dadosUrl('estudo/');
const DIARIO = dadosUrl('diario/decisoes.md');
const HOJE = hojeEmBrasilia();
const SEMANA = String(numeroDaSemana(HOJE));
const PERGUNTA = perguntaDaSemana(HOJE);

async function escrever(texto) {
  await mkdir(PASTA, { recursive: true });
  await writeFile(ARQUIVO, texto, 'utf8');
}

const blocoDaSemana = (texto) =>
  lerEntradas(texto).find((entrada) => entrada.titulo === SEMANA) ?? null;

const [, , comando, ...resto] = process.argv;
// Antes de ler: o que foi anotado no Telegram (ou em outra m?quina) entra aqui.
await baixar();
const texto = await lerTexto(ARQUIVO);

if (comando === 'novo') {
  if (blocoDaSemana(texto)) {
    console.log(`A semana ${SEMANA} já está no arquivo — responda no editor: estudo/respostas.md`);
    console.log('Ou responda por aqui: npm run estudo -- responder <a sua resposta>');
    await encerrar('', 0);
  }
  const gabarito = await gabaritoDaPergunta(PERGUNTA);
  const bloco = criarBloco({
    data: HOJE,
    titulo: SEMANA,
    campos: {
      pergunta: PERGUNTA.texto,
      resposta: '',
      gabarito: gabarito === null ? '' : gabarito.toFixed(2),
      corrigido: '',
    },
    ordem: CAMPOS_RESPOSTA,
  });
  await escrever(adicionarBloco(texto, bloco));
  console.log(`Semana ${SEMANA} registrada em estudo/respostas.md:\n\n${bloco}`);
  if (gabarito !== null) {
    console.log(`Gabarito guardado (${gabarito.toFixed(2)}): a correção não muda depois.`);
  }
  console.log('Responda primeiro sem ajuda; depois peça a correção com o PROMPT.md aberto.');
  await encerrar('estudo: bloco da semana criado', 0);
}

if (comando === 'responder') {
  const resposta = resto.join(' ').trim();
  if (!resposta) {
    console.log('Escreva a sua resposta depois do comando. Exemplo: npm run estudo -- responder 1126,83');
    await encerrar('', 1);
  }
  // A trilha manda: se o bloco foi criado com a pergunta de antes, ela é atualizada aqui.
  const resultado = await anotarResposta({ titulo: SEMANA, pergunta: PERGUNTA, resposta, hoje: HOJE });
  console.log(mensagemDeResposta({ tipo: 'resposta', ...resultado }));
  if (resultado.recusada) await encerrar('', 1);
  console.log(`\nRegistrado no bloco "${SEMANA}" de estudo/respostas.md.`);
  await encerrar('estudo: resposta da semana anotada', 0);
}

if (comando === 'revisar') {
  const resposta = resto.join(' ').trim();
  if (!resposta) {
    console.log('Escreva a sua resposta depois do comando. Exemplo: npm run estudo -- revisar 1126,83');
    await encerrar('', 1);
  }
  const feitas = revisoesFeitas(lerEntradas(texto), SEMANA);
  if (feitas >= MAXIMO_DE_REVISOES) {
    console.log(`Você já fez as ${MAXIMO_DE_REVISOES} revisões desta semana. As outras voltam depois.`);
    await encerrar('', 0);
  }
  const revisao = revisoesDaSemana(historicoDeEstudo(lerEntradas(texto)), HOJE)[0];
  if (!revisao) {
    console.log('Nenhuma revisão esperando esta semana. Veja o quadro: npm run estudo');
    await encerrar('', 0);
  }
  const pergunta = perguntaPorTexto(revisao.pergunta);
  if (!pergunta) {
    console.log(`Não achei esta pergunta na trilha: ${revisao.pergunta}`);
    await encerrar('', 1);
  }
  console.log(`Revisão: ${revisao.pergunta}`);
  const resultado = await anotarResposta({
    titulo: `${SEMANA} · revisão ${feitas + 1}`,
    pergunta,
    resposta,
    gabaritoGuardado: revisao.gabarito,
    hoje: HOJE,
  });
  console.log(mensagemDeResposta({ tipo: 'resposta', ...resultado }));
  if (resultado.recusada) await encerrar('', 1);
  console.log(`\nRegistrado no bloco "${SEMANA} · revisão ${feitas + 1}" de estudo/respostas.md.`);
  await encerrar('estudo: revisão anotada', 0);
}

console.log(
  painelDoEstudo({
    texto,
    hoje: HOJE,
    numeroSemana: SEMANA,
    pergunta: PERGUNTA.texto,
    textoDoDiario: await lerTexto(DIARIO),
  }),
);
if (!texto) console.log('\nModelo: estudo/respostas.example.md');
