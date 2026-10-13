// Leitura dos arquivos dos comandos locais: JSON com uma dica de erro e texto que pode faltar.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Onde ficam os dados pessoais: a pasta privada (DADOS_DIR) quando ela existe — é assim que o
// relatório do GitHub enxerga o diário e o estudo — senão a raiz do projeto, que é o normal aqui.
export function dadosUrl(caminho) {
  const pasta = process.env.DADOS_DIR;
  const raiz = pasta
    ? pathToFileURL(`${pasta.replace(/[\\/]+$/, '')}/`)
    : new URL('..', import.meta.url);
  return new URL(caminho, raiz);
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
