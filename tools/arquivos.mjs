// Leitura dos arquivos dos comandos locais: JSON com uma dica de erro e texto que pode faltar.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const CLONE = new URL('../.privado/', import.meta.url);

const existeClone = () => existsSync(new URL('.git/', CLONE));

// Onde ficam os dados pessoais. Ordem: a pasta que o workflow aponta (DADOS_DIR), o clone do
// repositório privado (`.privado/`, o normal no PC) e a raiz do projeto — que é onde os arquivos
// viviam antes e continua valendo para quem ainda não migrou.
export function pastaDeDados({ ddir = process.env.DADOS_DIR, temClone = existeClone() } = {}) {
  const configurada = String(ddir ?? '').trim();
  if (configurada) {
    const caminho = configurada.replace(/[\\/]+$/, '');
    const absoluto = /^([A-Za-z]:[\\/]|[\\/])/.test(caminho);
    return absoluto ? pathToFileURL(`${caminho}/`) : new URL(`${caminho}/`, RAIZ);
  }
  return temClone ? CLONE : RAIZ;
}

export function dadosUrl(caminho, opcoes = {}) {
  return new URL(caminho, pastaDeDados(opcoes));
}

export async function lerJson(url, dica) {
  try {
    // Alguns editores gravam UTF-8 com marca de ordem (BOM) e o JSON.parse tropeça nela.
    const texto = String(await readFile(url, 'utf8')).replace(/^\uFEFF/, '');
    return JSON.parse(texto);
  } catch (erro) {
    throw new Error(`${url.pathname} indisponível (${erro.message}). ${dica}`);
  }
}

// Arquivos privados (diário e estudo): quando não existem, o comando segue sem eles.
export async function lerTexto(url) {
  try {
    return await readFile(url, 'utf8');
  } catch {
    return '';
  }
}

// Listas em arquivo que nasce vazio (o histórico do jogo): ausente ou quebrado vira lista vazia.
export async function lerLista(url) {
  const texto = (await lerTexto(url)).replace(/^\uFEFF/, '');
  if (!texto.trim()) return [];
  try {
    const conteudo = JSON.parse(texto);
    return Array.isArray(conteudo) ? conteudo : [];
  } catch {
    return [];
  }
}
