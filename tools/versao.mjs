// O nome da versão que o service worker guarda no aparelho sai do conteúdo da casca do site.
// Módulo puro: quem lê os arquivos do disco é o `publicar.mjs`.
import { createHash } from 'node:crypto';

// `arquivos`: [{ caminho, conteudo }], em qualquer ordem — a lista é ordenada aqui.
export function nomeDaVersao(arquivos = []) {
  const resumo = createHash('sha256');
  const ordenados = [...arquivos].sort((a, b) => (a.caminho < b.caminho ? -1 : 1));
  for (const { caminho, conteudo } of ordenados) {
    resumo.update(`${caminho}\0`);
    resumo.update(conteudo);
  }
  return `panorama-financeiro-${resumo.digest('hex').slice(0, 8)}`;
}

// Troca a linha da versão dentro do sw.js publicado. Se a linha não estiver lá, é melhor
// quebrar a publicação do que entregar um site que continua preso na versão velha.
export function trocarVersao(sw, versao) {
  const trocado = String(sw).replace(/const VERSAO = '[^']*';/, `const VERSAO = '${versao}';`);
  if (trocado === sw) throw new Error('não achei a linha "const VERSAO = ..." no sw.js');
  return trocado;
}
