// Lê o que chegou para o bot e responde os comandos /r e /d.
// Roda sozinho no workflow "Atualizar indicadores" (2×/dia) e, para conferir, na sua máquina:
//   npm run telegram
// Nada do conteúdo aparece no log (regra S3): aqui só sai contagem.
import { mkdir, writeFile } from 'node:fs/promises';
import { hojeEmBrasilia } from '../indicadores.js';
import { numeroDaSemana } from '../relatorio.js';
import { perguntaDaSemana } from '../trilha.js';
import { interpretarComando, ehDoChat, mensagemDeResposta } from '../comandos.js';
import { anotarDecisao, anotarPremio, anotarResposta } from './anotar.mjs';
import { dadosUrl, lerJson } from './arquivos.mjs';
import { enviar } from './notificar.mjs';

// Segredos locais em .env.local (fora do git): no GitHub as variáveis vêm dos secrets.
try {
  process.loadEnvFile(new URL('../.env.local', import.meta.url));
} catch {
  // Sem arquivo local: rodando no GitHub ou sem token configurado.
}

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const OFFSET = dadosUrl('telegram.json');
const HOJE = hojeEmBrasilia();
const SEMANA = String(numeroDaSemana(HOJE));

if (!TOKEN || !CHAT) {
  console.log('sem TELEGRAM_TOKEN e TELEGRAM_CHAT_ID: nada a fazer');
  process.exit(0);
}

async function lerOffset() {
  try {
    const guardado = await lerJson(OFFSET, '');
    return Number(guardado.offset) || 0;
  } catch {
    return 0;
  }
}

async function gravarOffset(valor) {
  await mkdir(new URL('./', OFFSET), { recursive: true });
  await writeFile(OFFSET, `${JSON.stringify({ offset: valor, atualizadoEm: new Date().toISOString() }, null, 2)}\n`, 'utf8');
}

async function executar(comando) {
  if (comando.tipo === 'resposta') {
    const pergunta = perguntaDaSemana(HOJE);
    if (!pergunta) {
      return { tipo: 'resposta', recusada: 'Não achei a pergunta desta semana na trilha.' };
    }
    return {
      tipo: 'resposta',
      ...(await anotarResposta({ titulo: SEMANA, pergunta, resposta: comando.resposta, hoje: HOJE })),
    };
  }
  if (comando.tipo === 'decisao') {
    return { tipo: 'decisao', ...(await anotarDecisao({ ...comando, hoje: HOJE })) };
  }
  if (comando.tipo === 'premio') {
    return { tipo: 'premio', ...(await anotarPremio({ ...comando, hoje: HOJE })) };
  }
  return comando;
}

const offset = await lerOffset();
const resposta = await fetch(
  `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${offset}&timeout=0`,
);
const corpo = await resposta.json().catch(() => ({}));
if (!resposta.ok || corpo.ok === false) {
  console.log(`::warning::o Telegram recusou a leitura (${resposta.status}): ${corpo.description ?? 'sem detalhe'}`);
  process.exit(0);
}

const atualizacoes = corpo.result ?? [];
let ultimoId = offset - 1;
let respondidos = 0;
let ignorados = 0;

for (const atualizacao of atualizacoes) {
  ultimoId = Math.max(ultimoId, atualizacao.update_id ?? 0);
  const mensagem = atualizacao.message;
  if (!mensagem?.text) continue;
  if (!ehDoChat(mensagem, CHAT)) {
    ignorados += 1;
    continue;
  }
  const resultado = await executar(interpretarComando(mensagem.text));
  await enviar(mensagemDeResposta(resultado));
  respondidos += 1;
}

if (ultimoId + 1 > offset) await gravarOffset(ultimoId + 1);
console.log(`${respondidos} comando(s) respondido(s), ${ignorados} mensagem(ns) de outra pessoa ignorada(s)`);
