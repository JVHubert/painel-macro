// Trilha de estudo: registra a resposta da pergunta da semana e mostra o histórico.
// Uso:
//   npm run estudo        → pergunta desta semana, o que falta responder e o placar
//   npm run estudo -- novo → cria o bloco desta semana para você responder
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CAMPOS_RESPOSTA, adicionarBloco, criarBloco, lerEntradas, painelDoEstudo } from '../caderno.js';
import { hojeEmBrasilia } from '../indicadores.js';
import { numeroDaSemana, perguntaDaSemana } from '../relatorio.js';

const ARQUIVO = new URL('../estudo/respostas.md', import.meta.url);
const PASTA = new URL('../estudo/', import.meta.url);
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

const [, , comando] = process.argv;
const texto = await ler();

if (comando === 'novo') {
  const jaExiste = lerEntradas(texto).some((entrada) => entrada.titulo === SEMANA);
  if (jaExiste) {
    console.log(`A semana ${SEMANA} já está no arquivo — responda no editor: estudo/respostas.md`);
    process.exit(0);
  }
  const bloco = criarBloco({
    data: HOJE,
    titulo: SEMANA,
    campos: { pergunta: PERGUNTA, resposta: '', corrigido: '' },
    ordem: CAMPOS_RESPOSTA,
  });
  await mkdir(PASTA, { recursive: true });
  await writeFile(ARQUIVO, adicionarBloco(texto, bloco), 'utf8');
  console.log(`Semana ${SEMANA} registrada em estudo/respostas.md:\n\n${bloco}`);
  console.log('Responda primeiro sem ajuda; depois peça a correção com o PROMPT.md aberto.');
  process.exit(0);
}

console.log(painelDoEstudo({ texto, hoje: HOJE, numeroSemana: SEMANA, pergunta: PERGUNTA }));
if (!texto) console.log('\nModelo: estudo/respostas.example.md');
