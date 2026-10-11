// Descobre o chat_id de quem mandou mensagem para o bot (para configurar o Telegram).
// Uso: npm run chat-id — depois de mandar qualquer mensagem para o seu bot.
try {
  process.loadEnvFile(new URL('../.env.local', import.meta.url));
} catch {
  // sem arquivo local: usa o que estiver no ambiente
}

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
  console.error('Falta TELEGRAM_TOKEN no .env.local (ou no ambiente).');
  process.exit(1);
}

const resposta = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const corpo = await resposta.json();
if (!corpo.ok) {
  console.error(`O Telegram recusou: ${corpo.description ?? resposta.status}`);
  process.exit(1);
}

const conversas = new Map();
for (const atualizacao of corpo.result ?? []) {
  const mensagem = atualizacao.message ?? atualizacao.edited_message ?? atualizacao.channel_post;
  const chat = mensagem?.chat;
  if (chat) conversas.set(String(chat.id), chat.first_name ?? chat.title ?? chat.username ?? 'sem nome');
}

if (!conversas.size) {
  console.log('Nenhuma mensagem encontrada. Mande um "oi" para o seu bot no Telegram e rode de novo.');
  process.exit(0);
}

for (const [id, nome] of conversas) {
  console.log(`${id}  (${nome})`);
}
console.log('\nCopie esse número para TELEGRAM_CHAT_ID no .env.local.');
