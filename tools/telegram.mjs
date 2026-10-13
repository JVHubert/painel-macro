// Lê o que chegou para o bot e responde os comandos /r, /d e /premio.
// Roda sozinho no workflow "Telegram" (a cada 20 minutos) e, para conferir, na sua máquina:
//   npm run telegram
// Nada do conteúdo aparece no log (regra S3): aqui só sai contagem.
import { mkdir, writeFile } from 'node:fs/promises';
import { acharBlocoDaSemana, tituloDaSemana } from '../caderno.js';
import { hojeEmBrasilia } from '../indicadores.js';
import { perguntaDaSemana, opcoesDaTrilha } from '../trilha.js';
import { interpretarComando, ehDoChat, mensagemDeResposta } from '../comandos.js';
import { anotarDecisao, anotarPremio, anotarResposta } from './anotar.mjs';
import { dadosUrl, lerJson, lerJsonOu, lerTexto } from './arquivos.mjs';
import { enviar } from './notificar.mjs';
import { baixar, enviar as sincronizar } from './sincronizar.mjs';

// Segredos locais em .env.local (fora do git): no GitHub as variáveis vêm dos secrets.
try {
  process.loadEnvFile(new URL('../.env.local', import.meta.url));
} catch {
  // Sem arquivo local: rodando no GitHub ou sem token configurado.
}

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const OFFSET = dadosUrl('telegram.json');
const ESTUDO = dadosUrl('estudo/respostas.md');
const CARTEIRA = dadosUrl('carteira.json');
const HOJE = hojeEmBrasilia();
const SEMANA = tituloDaSemana(HOJE);
// Em que nível da trilha o JV está vem do carteira.json (`trilha.nivelAtual`).
const TRILHA = opcoesDaTrilha(await lerJsonOu(CARTEIRA));

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
    const pergunta = perguntaDaSemana(HOJE, TRILHA);
    if (!pergunta) {
      return { tipo: 'resposta', recusada: 'Não achei a pergunta desta semana na trilha.' };
    }
    // Se a semana já tem bloco (mesmo no título antigo, só com o número), a resposta entra nele.
    const entradas = lerEntradas(await lerTexto(ESTUDO));
    const titulo = acharBlocoDaSemana(entradas, HOJE)?.titulo ?? SEMANA;
    return {
      tipo: 'resposta',
      ...(await anotarResposta({ titulo, pergunta, resposta: comando.resposta, hoje: HOJE })),
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
// Antes de anotar: o que já existe no repositório privado entra aqui (senão a resposta duplicaria).
await baixar();
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
if (respondidos) await sincronizar('dados: anotado pelo Telegram');
