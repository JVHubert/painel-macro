// Manda os dados pessoais do PC para o repositório privado, que é o que o GitHub lê para
// gerar o relatório. Sem isso, o relatório de segunda seria feito com dados velhos.
// Uso: npm run enviar-dados
//
// O repositório privado fica clonado em .privado/ (não versionado). A pasta de dados que os
// outros comandos leem é a raiz do projeto; o clone só existe aqui para empacotar e enviar.
import { copyFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dadosUrl, lerTexto } from './arquivos.mjs';

const REPO = 'https://github.com/JVHubert/painel-macro-dados.git';
const CLONE = new URL('../.privado/', import.meta.url);
const ARQUIVOS = [
  'carteira.json',
  'diario/decisoes.md',
  'estudo/respostas.md',
  'jogo/historico.json',
  'jogo/mural.md',
];

function git(args) {
  const resultado = spawnSync('git', args, { cwd: CLONE, encoding: 'utf8' });
  if (resultado.status !== 0) {
    throw new Error(`git ${args.join(' ')} falhou: ${(resultado.stderr || resultado.stdout).trim()}`);
  }
  return resultado.stdout.trim();
}

// `git diff --cached --quiet` sai com 1 quando tem algo pronto para virar commit.
function temMudanca() {
  return spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: CLONE }).status !== 0;
}

const jaTemClone = await lerTexto(new URL('.git/HEAD', CLONE));
if (!jaTemClone) {
  await mkdir(CLONE, { recursive: true });
  try {
    git(['clone', REPO, '.']);
  } catch (erro) {
    console.error(`Não consegui baixar o repositório privado. ${erro.message}`);
    process.exit(1);
  }
}

// Copia o que existe aqui; arquivo que você não tem (ex.: decisões ainda não escritas) é pulado.
const copiados = [];
for (const caminho of ARQUIVOS) {
  const origem = dadosUrl(caminho);
  const conteudo = await lerTexto(origem);
  if (!conteudo) continue;
  const destino = new URL(caminho, CLONE);
  await mkdir(new URL('./', destino), { recursive: true });
  await copyFile(origem, destino);
  copiados.push(caminho);
}

if (!copiados.length) {
  console.log('Não achei nada para enviar (carteira.json, diário, estudo).');
  process.exit(0);
}

// Quem decide se mudou é o git, comparando conteúdo — a hora do arquivo engana logo após o clone.
git(['add', ...copiados]);
if (!temMudanca()) {
  console.log('Nada mudou desde o último envio.');
  process.exit(0);
}

git(['commit', '-m', 'dados: atualiza o que foi anotado no PC']);
try {
  git(['pull', '--rebase']);
  git(['push']);
} catch (erro) {
  console.error(`${erro.message}\nO envio parou no meio; rode de novo que ele continua daqui.`);
  process.exit(1);
}

// Só os nomes dos arquivos — nunca o conteúdo deles, que é o dado pessoal.
console.log(`Enviado para o repositório privado: ${copiados.join(', ')}.`);
