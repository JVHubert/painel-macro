// Anota o que o JV mandou: resposta do estudo e decisão do diário. O mesmo caminho serve para o
// terminal (npm run estudo / npm run diario) e para o Telegram (/r e /d).
import { mkdir, writeFile } from 'node:fs/promises';
import {
  CAMPOS_DECISAO,
  CAMPOS_RESPOSTA,
  adicionarBloco,
  corrigirConta,
  criarBloco,
  dataDeRevisao,
  definirCampos,
  lerEntradas,
  lerNumeroBr,
  situacao,
} from '../caderno.js';
import { dadosUrl, lerJson, lerTexto } from './arquivos.mjs';

const PAINEL = new URL('../dados/indicadores.json', import.meta.url);

async function escrever(url, texto) {
  await mkdir(new URL('./', url), { recursive: true });
  await writeFile(url, texto, 'utf8');
}

// O gabarito das perguntas de conta pode depender do painel do dia (juro real, CDI).
export async function gabaritoDaPergunta(pergunta) {
  if (pergunta.tipo !== 'conta') return null;
  const painel = await lerJson(PAINEL, 'Rode `npm run coletar` primeiro.');
  const valor = pergunta.gabarito(painel);
  return Number.isFinite(valor) ? valor : null;
}

// Grava a resposta de uma pergunta (a da semana ou uma revisão) no bloco de título indicado.
// Devolve o que aconteceu, para o terminal imprimir e o bot responder:
//   { guardada: true, certo, gabarito, dica }  → conta corrigida
//   { guardada: true, conceito: true }         → guardada para o professor corrigir
//   { guardada: true, aviso }                  → guardada, mas sem conseguir conferir
//   { recusada }                               → nada foi escrito
export async function anotarResposta({ titulo, pergunta, resposta, gabaritoGuardado = null, hoje }) {
  const arquivo = dadosUrl('estudo/respostas.md');
  const texto = await lerTexto(arquivo);
  const existente = lerEntradas(texto).find((entrada) => entrada.titulo === titulo) ?? null;
  if (existente?.campos.resposta) {
    return { recusada: `O bloco "${titulo}" já tem resposta registrada. Para trocar, edite estudo/respostas.md.` };
  }

  const campos = {
    pergunta: pergunta.texto,
    resposta,
    gabarito: existente?.campos.gabarito ?? '',
    corrigido: '',
  };
  const guardado = gabaritoGuardado ?? lerNumeroBr(existente?.campos.gabarito ?? '');
  const gabarito = pergunta.tipo === 'conta' ? (guardado ?? (await gabaritoDaPergunta(pergunta))) : null;
  const correcao = corrigirConta(resposta, gabarito, pergunta.tolerancia);

  if (pergunta.tipo !== 'conta') {
    await gravarResposta(arquivo, texto, titulo, campos, hoje);
    return { guardada: true, conceito: true };
  }
  if (!correcao) {
    await gravarResposta(arquivo, texto, titulo, campos, hoje);
    return {
      guardada: true,
      aviso:
        gabarito === null
          ? 'o gabarito não saiu hoje (rode `npm run coletar`).'
          : 'não entendi o número que você escreveu.',
    };
  }

  campos.gabarito = gabarito.toFixed(2);
  campos.corrigido = correcao.certo ? 'certo' : 'errado';
  await gravarResposta(arquivo, texto, titulo, campos, hoje);
  return { guardada: true, certo: correcao.certo, gabarito, dica: pergunta.dica };
}

async function gravarResposta(arquivo, texto, titulo, campos, hoje) {
  const atualizado = definirCampos(texto, { titulo, campos, ordem: CAMPOS_RESPOSTA });
  await escrever(
    arquivo,
    atualizado ?? adicionarBloco(texto, criarBloco({ data: hoje, titulo, campos, ordem: CAMPOS_RESPOSTA })),
  );
}

// Cria a decisão no diário (o que o `npm run diario -- novo` e o /d do Telegram fazem).
export async function anotarDecisao({ titulo, tese = '', espero = '', provacao = '', hoje }) {
  const nome = String(titulo ?? '').trim();
  if (!nome) return { recusada: 'Diga o que você está decidindo.' };

  const arquivo = dadosUrl('diario/decisoes.md');
  const texto = await lerTexto(arquivo);
  if (lerEntradas(texto).some((entrada) => entrada.titulo === nome)) {
    return { recusada: `Já existe uma decisão chamada "${nome}" no diário.` };
  }

  const campos = {
    tipo: '',
    valor: '',
    tese,
    espero,
    provacao,
    revisarEm: dataDeRevisao(hoje),
    revisado: '',
  };
  const bloco = criarBloco({ data: hoje, titulo: nome, campos, ordem: CAMPOS_DECISAO });
  await escrever(arquivo, adicionarBloco(texto, bloco));

  return {
    bloco,
    titulo: nome,
    faltando: situacao({ data: hoje, titulo: nome, campos }, hoje).emFalta,
    revisarEm: campos.revisarEm,
  };
}
