// Os dados pessoais moram num repositório privado, clonado em `.privado/`. Todo comando que lê
// baixa antes (o que você anotou no Telegram entra aqui) e todo comando que escreve envia depois
// (o que você anotou no PC chega ao relatório do domingo). Offline, só avisa e segue.
// Uso: npm run sincronizar
import { spawnSync } from 'node:child_process';
import { pastaDeDados } from './arquivos.mjs';

const CLONE = new URL('../.privado/', import.meta.url);

function git(args) {
  const resultado = spawnSync('git', args, { cwd: CLONE, encoding: 'utf8' });
  return { ok: resultado.status === 0, saida: (resultado.stderr || resultado.stdout).trim() };
}

const REPO = 'https://github.com/JVHubert/painel-macro-dados.git';
const DESTINO = new URL('../.privado/', import.meta.url);

// Só no PC: os dados vivem no clone `.privado/` e o git é nosso. Quando é o workflow que aponta a
// pasta (DADOS_DIR), o checkout é fresco e quem salva é o próprio workflow — não mexemos no git.
export function sincronizaAqui() {
  return !process.env.DADOS_DIR && pastaDeDados().href.endsWith('/.privado/');
}

// Primeira vez na máquina: baixa o repositório privado para `.privado/`.
export async function clonar() {
  if (pastaDeDados().href.endsWith('/.privado/')) return { clonado: false };
  const resultado = spawnSync('git', ['clone', '--quiet', REPO, DESTINO.pathname], { encoding: 'utf8' });
  if (resultado.status !== 0) {
    const erro = (resultado.stderr || resultado.stdout).trim();
    console.log(`::warning::não consegui baixar o repositório privado: ${erro}`);
    return { clonado: false, motivo: erro };
  }
  return { clonado: true };
}

// Antes de ler: traz o que foi anotado em outro lugar (Telegram, GitHub, outra máquina).
export async function baixar() {
  if (!sincronizaAqui()) return { sincronizado: false, motivo: 'nada a sincronizar aqui' };

  const pull = git(['pull', '--rebase']);
  if (!pull.ok) {
    console.log(`::warning::não consegui atualizar os dados privados: ${pull.saida}`);
    return { sincronizado: false, motivo: pull.saida };
  }
  return { sincronizado: true };
}

// Depois de escrever: guarda o que mudou.
export async function enviar(mensagem = 'dados: anotado no PC') {
  if (!sincronizaAqui()) return { sincronizado: false, motivo: 'nada a sincronizar aqui' };

  git(['add', '-A']);
  const mudou = !git(['diff', '--cached', '--quiet']).ok;
  if (!mudou) return { sincronizado: true, mudou: false };

  const commit = git(['commit', '-m', mensagem]);
  if (!commit.ok) {
    console.log(`::warning::não consegui guardar os dados: ${commit.saida}`);
    return { sincronizado: false, motivo: commit.saida };
  }
  const push = git(['push']);
  if (!push.ok) {
    console.log(`::warning::os dados ficaram salvos aqui, mas não subiram: ${push.saida}`);
    return { sincronizado: false, motivo: push.saida };
  }
  return { sincronizado: true, mudou: true };
}

// Para os comandos que terminam no meio do caminho: guarda antes de sair.
export async function encerrar(mensagem, codigo = 0) {
  await enviar(mensagem);
  process.exit(codigo);
}

const executadoDireto = String(process.argv[1] ?? '')
  .replace(/\\/g, '/')
  .endsWith('tools/sincronizar.mjs');

if (executadoDireto) {
  await clonar();
  const baixou = await baixar();
  const enviou = await enviar('dados: atualiza o que foi anotado no PC');
  if (!sincronizaAqui()) {
    console.log('não achei o clone em .privado/ e não consegui baixar o repositório privado (sem internet?)');
  } else if (baixou.sincronizado && !enviou.mudou) {
    console.log('dados sincronizados (nada novo para enviar)');
  } else if (enviou.mudou) {
    console.log('dados sincronizados (enviei o que estava aqui)');
  }
}
