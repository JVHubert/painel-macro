// Trilha de estudo: registra a resposta da pergunta da semana, corrige as de conta na hora
// e mostra o histórico (incluindo as revisões que venceram).
// Uso:
//   npm run estudo                → pergunta desta semana, revisões, o que falta e o placar
//   npm run estudo -- novo        → cria o bloco desta semana para responder no editor
//   npm run estudo -- responder 1126,83 → registra a resposta da semana e corrige na hora
//   npm run estudo -- revisar 1126,83   → o mesmo, para a revisão mais antiga que venceu
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  CAMPOS_RESPOSTA,
  MAXIMO_DE_REVISOES,
  adicionarBloco,
  corrigirConta,
  criarBloco,
  definirCampos,
  historicoDeEstudo,
  lerEntradas,
  lerNumeroBr,
  painelDoEstudo,
  revisoesDaSemana,
  revisoesFeitas,
  textoDaCorrecao,
} from '../caderno.js';
import { hojeEmBrasilia } from '../indicadores.js';
import { numeroDaSemana } from '../relatorio.js';
import { perguntaDaSemana, perguntaPorTexto } from '../trilha.js';
import { lerJson, lerTexto } from './arquivos.mjs';

const ARQUIVO = new URL('../estudo/respostas.md', import.meta.url);
const PASTA = new URL('../estudo/', import.meta.url);
const DIARIO = new URL('../diario/decisoes.md', import.meta.url);
const PAINEL = new URL('../dados/indicadores.json', import.meta.url);
const HOJE = hojeEmBrasilia();
const SEMANA = String(numeroDaSemana(HOJE));
const PERGUNTA = perguntaDaSemana(HOJE);

async function ler() {
  try {
    return await readFile(ARQUIVO, 'utf8');
  } catch {
    return '';
  }
}

async function escrever(texto) {
  await mkdir(PASTA, { recursive: true });
  await writeFile(ARQUIVO, texto, 'utf8');
}

// O gabarito das perguntas de conta pode depender do painel do dia (juro real, CDI).
async function gabaritoDaPergunta(pergunta) {
  if (pergunta.tipo !== 'conta') return null;
  const painel = await lerJson(PAINEL, 'Rode `npm run coletar` primeiro.');
  const valor = pergunta.gabarito(painel);
  return Number.isFinite(valor) ? valor : null;
}

const blocoDaSemana = (texto) =>
  lerEntradas(texto).find((entrada) => entrada.titulo === SEMANA) ?? null;

const blocoDoTitulo = (texto, titulo) =>
  lerEntradas(texto).find((entrada) => entrada.titulo === titulo) ?? null;

// Grava a resposta de uma pergunta (a da semana ou uma revisão) e devolve a frase da correção.
async function registrarResposta({ texto, titulo, pergunta, resposta, gabaritoGuardado = null }) {
  const existente = blocoDoTitulo(texto, titulo);
  if (existente?.campos.resposta) {
    console.log(`O bloco "${titulo}" já tem resposta registrada (${existente.campos.resposta}).`);
    console.log('Para trocar, edite estudo/respostas.md.');
    process.exit(1);
  }

  const campos = {
    pergunta: pergunta.texto,
    resposta,
    gabarito: existente?.campos.gabarito ?? '',
    corrigido: '',
  };
  const guardado = gabaritoGuardado ?? lerNumeroBr(existente?.campos.gabarito ?? '');
  const gabarito =
    pergunta.tipo === 'conta' ? (guardado ?? (await gabaritoDaPergunta(pergunta))) : null;
  const correcao = corrigirConta(resposta, gabarito, pergunta.tolerancia);

  if (pergunta.tipo !== 'conta') {
    console.log(
      'Resposta guardada. Peça a correção com o PROMPT.md aberto e escreva o resultado em "corrigido:" (certo, parcial ou errado).',
    );
  } else if (correcao) {
    campos.gabarito = gabarito.toFixed(2);
    campos.corrigido = correcao.certo ? 'certo' : 'errado';
    console.log(textoDaCorrecao({ certo: correcao.certo, gabarito, dica: pergunta.dica }));
  } else {
    console.log(
      'Resposta guardada, mas não consegui conferir: ' +
        (gabarito === null
          ? 'o gabarito não saiu hoje (rode `npm run coletar`).'
          : 'não entendi o número que você escreveu.'),
    );
  }

  const atualizado = definirCampos(texto, { titulo, campos, ordem: CAMPOS_RESPOSTA });
  await escrever(
    atualizado ?? adicionarBloco(texto, criarBloco({ data: HOJE, titulo, campos, ordem: CAMPOS_RESPOSTA })),
  );
  console.log(`\nRegistrado no bloco "${titulo}" de estudo/respostas.md.`);
  process.exit(0);
}

const [, , comando, ...resto] = process.argv;
const texto = await ler();

if (comando === 'novo') {
  if (blocoDaSemana(texto)) {
    console.log(`A semana ${SEMANA} já está no arquivo — responda no editor: estudo/respostas.md`);
    console.log('Ou responda por aqui: npm run estudo -- responder <a sua resposta>');
    process.exit(0);
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
  process.exit(0);
}

if (comando === 'responder') {
  const resposta = resto.join(' ').trim();
  if (!resposta) {
    console.log('Escreva a sua resposta depois do comando. Exemplo: npm run estudo -- responder 1126,83');
    process.exit(1);
  }
  // A trilha manda: se o bloco foi criado com a pergunta de antes, ela é atualizada aqui.
  await registrarResposta({ texto, titulo: SEMANA, pergunta: PERGUNTA, resposta });
}

if (comando === 'revisar') {
  const resposta = resto.join(' ').trim();
  if (!resposta) {
    console.log('Escreva a sua resposta depois do comando. Exemplo: npm run estudo -- revisar 1126,83');
    process.exit(1);
  }
  const feitas = revisoesFeitas(lerEntradas(texto), SEMANA);
  if (feitas >= MAXIMO_DE_REVISOES) {
    console.log(`Você já fez as ${MAXIMO_DE_REVISOES} revisões desta semana. As outras voltam depois.`);
    process.exit(0);
  }
  const revisao = revisoesDaSemana(historicoDeEstudo(lerEntradas(texto)), HOJE)[0];
  if (!revisao) {
    console.log('Nenhuma revisão esperando esta semana. Veja o quadro: npm run estudo');
    process.exit(0);
  }
  const pergunta = perguntaPorTexto(revisao.pergunta);
  if (!pergunta) {
    console.log(`Não achei esta pergunta na trilha: ${revisao.pergunta}`);
    process.exit(1);
  }
  console.log(`Revisão: ${revisao.pergunta}`);
  await registrarResposta({
    texto,
    titulo: `${SEMANA} · revisão ${feitas + 1}`,
    pergunta,
    resposta,
    gabaritoGuardado: revisao.gabarito,
  });
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
