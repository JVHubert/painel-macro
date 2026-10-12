// Leitura dos arquivos dos comandos locais: JSON com uma dica de erro e texto que pode faltar.
import { readFile } from 'node:fs/promises';

export async function lerJson(url, dica) {
  try {
    return JSON.parse(await readFile(url, 'utf8'));
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
