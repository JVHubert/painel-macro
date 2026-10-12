// Trilha de estudo: registra a resposta da pergunta da semana, corrige as de conta na hora
// e mostra o histórico.
// Uso:
//   npm run estudo                → pergunta desta semana, o que falta responder e o placar
//   npm run estudo -- novo        → cria o bloco desta semana para responder no editor
//   npm run estudo -- responder 1126,83 → registra a resposta e corrige na hora
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  CAMPOS_RESPOSTA,
  adicionarBloco,
  corrigirConta,
  criarBloco,
  definirCampos,
  lerEntradas,
  lerNumeroBr,
  painelDoEstudo,
  textoDaCorrecao,
} from '../caderno.js';
import { hojeEmBrasilia } from '../indicadores.js';
import { numeroDaSemana } from '../relatorio.js';
import { perguntaDaSemana } from '../trilha.js';
import { lerJson } from './arquivos.mjs';

const ARQUIVO = new URL('../estudo/respostas.md', import.meta.url);
const PASTA = new URL('../estudo/', import.meta.url);
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
  const existente = blocoDaSemana(texto);
  if (existente?.campos.resposta) {
    console.log(`A semana ${SEMANA} já tem resposta registrada (${existente.campos.resposta}).`);
    console.log('Para trocar, edite estudo/respostas.md.');
    process.exit(1);
  }

  // A trilha manda: se o bloco foi criado com a pergunta de antes, ela é atualizada aqui.
  const campos = {
    pergunta: PERGUNTA.texto,
    resposta,
    gabarito: existente?.campos.gabarito ?? '',
    corrigido: '',
  };
  const guardado = lerNumeroBr(existente?.campos.gabarito ?? '');
  const gabarito = PERGUNTA.tipo === 'conta' ? (guardado ?? (await gabaritoDaPergunta(PERGUNTA))) : null;
  const correcao = corrigirConta(resposta, gabarito, PERGUNTA.tolerancia);

  let mensagem;
  if (PERGUNTA.tipo === 'conta') {
    if (correcao) {
      campos.gabarito = gabarito.toFixed(2);
      campos.corrigido = correcao.certo ? 'certo' : 'errado';
      mensagem = textoDaCorrecao({ certo: correcao.certo, gabarito, dica: PERGUNTA.dica });
    } else {
      mensagem =
        'Resposta guardada, mas não consegui conferir: ' +
        (gabarito === null
          ? 'o gabarito não saiu hoje (rode `npm run coletar`).'
          : 'não entendi o número que você escreveu.');
    }
  } else {
    mensagem =
      'Resposta guardada. Peça a correção com o PROMPT.md aberto e escreva o resultado em "corrigido:" (certo, parcial ou errado).';
  }

  const atualizado = definirCampos(texto, { titulo: SEMANA, campos, ordem: CAMPOS_RESPOSTA });
  await escrever(
    atualizado ?? adicionarBloco(texto, criarBloco({ data: HOJE, titulo: SEMANA, campos, ordem: CAMPOS_RESPOSTA })),
  );
  console.log(mensagem);
  console.log(`\nRegistrado na semana ${SEMANA} de estudo/respostas.md.`);
  process.exit(0);
}

console.log(painelDoEstudo({ texto, hoje: HOJE, numeroSemana: SEMANA, pergunta: PERGUNTA.texto }));
if (!texto) console.log('\nModelo: estudo/respostas.example.md');
