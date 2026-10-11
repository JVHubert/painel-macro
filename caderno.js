// O caderno: diário de decisões e trilha de estudo.
// Um arquivo de texto que você edita à mão, com um bloco por entrada:
//
//   ## 2026-10-13 · Comprar mais RENT3
//   - tipo: compra
//   - valor: 500
//   - tese: ...
//   - espero: ...
//   - provacao: ...
//   - revisarEm: 2027-01-11
//   - revisado:
//
// Este módulo só lê, escreve e formata — sem rede e sem disco, testável com `node --test`.
import { deslocarDias, tabela } from './relatorio.js';
import { formatarData, formatarNumero, formatarPercentual, nivelDeResultado } from './indicadores.js';

export const CAMPOS_DECISAO = ['tipo', 'valor', 'tese', 'espero', 'provacao', 'revisarEm', 'revisado'];
export const CAMPOS_RESPOSTA = ['pergunta', 'resposta', 'corrigido'];
// Campos que você preenche depois (na revisão), então não contam como pendência.
export const CAMPOS_OPCIONAIS = ['revisado', 'corrigido'];
export const DIAS_PADRAO = 90;

export function lerEntradas(texto) {
  const entradas = [];
  let atual = null;
  for (const linha of String(texto ?? '').split('\n')) {
    const cabecalho = linha.match(/^##\s+(.*)$/);
    if (cabecalho) {
      const [data, ...resto] = cabecalho[1].split('·');
      atual = { data: data.trim(), titulo: resto.join('·').trim(), campos: {} };
      entradas.push(atual);
      continue;
    }
    const campo = linha.match(/^-\s*([^:]+):\s*(.*)$/);
    if (campo && atual) atual.campos[campo[1].trim()] = campo[2].trim();
  }
  return entradas;
}

export function criarBloco({ data, titulo, campos = {}, ordem = [] }) {
  const chaves = ordem.length ? ordem : Object.keys(campos);
  const linhas = [`## ${data} · ${titulo}`];
  for (const chave of chaves) linhas.push(`- ${chave}: ${campos[chave] ?? ''}`);
  return `${linhas.join('\n')}\n`;
}

export function adicionarBloco(texto, bloco) {
  const limpo = String(texto ?? '').trimEnd();
  return limpo ? `${limpo}\n\n${bloco}` : bloco;
}

export function faltando(entrada, campos) {
  return campos.filter((chave) => !entrada.campos[chave]);
}

export function diasAte(dataIso, hoje) {
  if (!dataIso) return null;
  const dias = (Date.parse(`${dataIso}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000;
  return Number.isFinite(dias) ? Math.round(dias) : null;
}

export function situacao(entrada, hoje, campos = CAMPOS_DECISAO) {
  const emFalta = faltando(
    entrada,
    campos.filter((chave) => !CAMPOS_OPCIONAIS.includes(chave)),
  );
  const revisado = Boolean(entrada.campos.revisado);
  const dias = diasAte(entrada.campos.revisarEm, hoje);
  return {
    pronta: emFalta.length === 0,
    emFalta,
    revisado,
    dias,
    vencida: !revisado && emFalta.length === 0 && dias !== null && dias <= 0,
  };
}

export function dataDeRevisao(hoje, dias = DIAS_PADRAO) {
  return deslocarDias(hoje, dias);
}

function linhaFato(entrada, fato) {
  if (!fato) return '';
  const partes = [];
  if (fato.variacaoSemana !== null && fato.variacaoSemana !== undefined) {
    partes.push(`ativo ${formatarPercentual(fato.variacaoSemana)} na semana`);
  }
  if (typeof fato.variacao === 'number') {
    partes.push(
      `desde a decisão ${formatarPercentual(fato.variacao)} ${nivelDeResultado(fato.variacao)?.emoji ?? ''}`.trim(),
    );
  }
  if (typeof fato.cdi === 'number') partes.push(`CDI no período ${formatarPercentual(fato.cdi)}`);
  if (typeof fato.variacao === 'number' && typeof fato.cdi === 'number') {
    const contra = fato.variacao - fato.cdi;
    partes.push(
      `${contra >= 0 ? 'acima' : 'abaixo'} do CDI em ${formatarNumero(Math.abs(contra) * 100, 1)} p.p.`,
    );
  }
  return partes.join(' · ');
}

export function painelDoDiario({ texto, hoje, fatos = {} }) {
  const entradas = lerEntradas(texto);
  if (!entradas.length) {
    return 'DIÁRIO VAZIO\nCrie a primeira com: npm run diario -- novo "o que você está decidindo"';
  }

  const linhas = ['DIÁRIO DE DECISÕES'];
  const situacoes = entradas.map((entrada) => ({ entrada, s: situacao(entrada, hoje) }));
  const esperando = situacoes.filter(({ s }) => !s.pronta);
  const vencidas = situacoes.filter(({ s }) => s.vencida);
  const abertas = situacoes.filter(({ s }) => s.pronta && !s.revisado && !s.vencida);
  const revisadas = situacoes.filter(({ s }) => s.revisado);

  if (esperando.length) {
    linhas.push('\nFALTANDO PREENCHER');
    for (const { entrada, s } of esperando) {
      linhas.push(`- ${formatarData(entrada.data)} ${entrada.titulo}`);
      linhas.push(`  falta: ${s.emFalta.join(', ')}`);
    }
  }

  if (vencidas.length) {
    linhas.push('\nHORA DE REVISAR');
    vencidas.forEach(({ entrada }, i) => {
      const fato = linhaFato(entrada, fatos[entrada.titulo]);
      linhas.push(`- ${formatarData(entrada.data)} ${entrada.titulo}`);
      if (entrada.campos.espero) linhas.push(`  você esperava: ${entrada.campos.espero}`);
      if (entrada.campos.provacao) linhas.push(`  provaria errado: ${entrada.campos.provacao}`);
      if (fato) linhas.push(`  o que aconteceu: ${fato}`);
      if (i === 0) linhas.push('  escreva em "revisado:" o que você aprendeu');
    });
  }

  if (abertas.length) {
    linhas.push('\nAGUARDANDO A DATA');
    for (const { entrada, s } of abertas) {
      linhas.push(
        `- ${formatarData(entrada.data)} ${entrada.titulo} (revisar em ${s.dias} dia${s.dias === 1 ? '' : 's'})`,
      );
    }
  }

  linhas.push(
    `\nPLACAR\n${tabela(
      [
        ['decisões registradas', String(entradas.length)],
        ['revisadas', String(revisadas.length)],
        ['esperando você escrever', String(esperando.length)],
        ['para revisar agora', String(vencidas.length)],
      ],
      { colunas: ['esq', 'dir'] },
    )}`,
  );
  return linhas.join('\n');
}

export function painelDoEstudo({ texto, hoje, numeroSemana, pergunta }) {
  const entradas = lerEntradas(texto);
  const situacoes = entradas.map((entrada) => ({
    entrada,
    s: situacao(entrada, hoje, CAMPOS_RESPOSTA),
  }));
  const respondidas = situacoes.filter(({ s }) => s.pronta);
  const semResposta = situacoes.filter(({ s }) => !s.pronta);

  const linhas = [
    `TRILHA DE ESTUDO — semana ${numeroSemana}`,
    `\nPergunta desta semana:\n${pergunta}`,
    '\nResponda com o PROMPT.md aberto e registre: npm run estudo -- novo',
  ];

  if (semResposta.length) {
    linhas.push('\nESPERANDO SUA RESPOSTA');
    for (const { entrada } of semResposta) linhas.push(`- semana ${entrada.titulo}`);
  }
  if (respondidas.length) {
    linhas.push('\nJÁ RESPONDIDAS');
    for (const { entrada } of respondidas.slice(-6)) {
      linhas.push(`- semana ${entrada.titulo}: ${entrada.campos.resposta}`);
    }
  }

  const aproveitamento = entradas.length ? Math.round((respondidas.length / entradas.length) * 100) : 0;
  linhas.push(
    `\nPLACAR\n${tabela(
      [
        ['semanas registradas', String(entradas.length)],
        ['respondidas', String(respondidas.length)],
        ['aproveitamento', `${aproveitamento}%`],
      ],
      { colunas: ['esq', 'dir'] },
    )}`,
  );
  return linhas.join('\n');
}
