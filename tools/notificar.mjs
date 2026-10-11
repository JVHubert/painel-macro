// Entrega o relatório no canal configurado: Telegram primeiro, ntfy depois, senão imprime na tela.
// Telegram: defina TELEGRAM_TOKEN e TELEGRAM_CHAT_ID (ver README).
// ntfy: defina NTFY_TOPIC (opcional: NTFY_SERVER, NTFY_TOKEN).
const LIMITE_TELEGRAM = 4000;

export async function enviar(texto, { titulo = 'Painel macro' } = {}) {
  const token = process.env.TELEGRAM_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (token && chat) return enviarTelegram(texto, { token, chat });

  const topico = process.env.NTFY_TOPIC;
  if (topico) return enviarNtfy(texto, { titulo, topico });

  console.log(texto);
  return { canal: 'tela' };
}

async function enviarTelegram(texto, { token, chat }) {
  const corpo =
    texto.length > LIMITE_TELEGRAM
      ? `${texto.slice(0, LIMITE_TELEGRAM)}\n\n[…cortado, o relatório completo está no repositório]`
      : texto;
  const resposta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: corpo, disable_web_page_preview: true }),
  });
  const devolvido = await resposta.json().catch(() => ({}));
  if (!resposta.ok || devolvido.ok === false) {
    throw new Error(`Telegram recusou (${resposta.status}): ${devolvido.description ?? 'sem detalhe'}`);
  }
  return { canal: 'telegram' };
}

async function enviarNtfy(texto, { titulo, topico }) {
  const servidor = (process.env.NTFY_SERVER ?? 'https://ntfy.sh').replace(/\/+$/, '');
  const cabecalhos = {
    // Cabeçalho HTTP não aceita acento.
    Title: titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  };
  if (process.env.NTFY_TOKEN) cabecalhos.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
  const resposta = await fetch(`${servidor}/${topico}`, {
    method: 'POST',
    headers: cabecalhos,
    body: texto,
  });
  if (!resposta.ok) throw new Error(`ntfy recusou (${resposta.status})`);
  return { canal: 'ntfy' };
}

// O relatório já ficou salvo em relatorios/, então falha de envio não derruba o trabalho.
export async function enviarSemDerrubar(texto, opcoes = {}) {
  try {
    const resultado = await enviar(texto, opcoes);
    console.log(`relatório enviado por ${resultado.canal}`);
    return resultado;
  } catch (erro) {
    console.log(`::warning::falha ao enviar (${erro.message}) — o texto ficou salvo em relatorios/`);
    console.log(texto);
    return { canal: 'erro', erro: erro.message };
  }
}
