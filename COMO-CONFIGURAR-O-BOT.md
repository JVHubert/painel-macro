# Como configurar o bot do Telegram

Guia da instalação até o relatório chegando no domingo. Leva uns 10 minutos e só precisa ser feito uma vez.

Um bot do Telegram é um contato automático: **quem puxa conversa é sempre você**. O Telegram proíbe o bot de mandar a primeira mensagem, e é por isso que existe o passo "mande um oi" mais abaixo — sem ele todo envio falha com `chat not found`.

## Parte 1 — O bot (você já tem)

Você já criou o seu bot. Se precisar criar outro:

1. No Telegram, busque **@BotFather** (o oficial tem selo de verificado) e toque em **START**.
2. Mande `/newbot`.
3. Escolha o nome que aparece na conversa (ex.: `Painel macro`).
4. Escolha o usuário: precisa ser único no mundo e terminar em `bot` (ex.: `jv_painel_macro_bot`).
5. O BotFather responde com `Use this token to access the HTTP API:` e uma linha assim: `123456789:AAF...`. **Esse é o token** — toque e segure para copiar.

Opcional, para ficar apresentável: `/setdescription`, `/setuserpic`, `/setcommands`.

## Parte 2 — Abra a conversa com o bot

Este é o passo que quase todo mundo esquece.

1. No Telegram, busque o **nome do seu bot** (o que você escolheu na Parte 1).
2. Toque em **START** (ou `/start`). Se não aparecer o botão, toque no nome do bot e depois em **Iniciar**.
3. Mande qualquer mensagem: `oi`.

Sem isso, o envio falha com `400 Bad Request: chat not found`. Não é problema de token nem de código.

## Parte 3 — Descubra o seu chat_id

No PowerShell:

```powershell
cd C:\AI\painel-macro
npm.cmd run chat-id
```

Esperado:

```
123456789  (Seu Nome)

Copie esse número para TELEGRAM_CHAT_ID no .env.local.
```

Usa `npm.cmd` porque o PowerShell da sua máquina bloqueia o `npm.ps1`.

Sem o comando, dá para fazer na mão: abra no navegador
`https://api.telegram.org/bot<SEU_TOKEN>/getUpdates` e procure `"chat":{"id":123456789`.

Se aparecer "Nenhuma mensagem encontrada": você ainda não mandou o `oi` (Parte 2), ou mandou achando que era o bot e era outro chat. Mande de novo e rode o comando outra vez.

## Parte 4 — Salve na sua máquina

Abra `C:\AI\painel-macro\.env.local` no VS Code. O token já está lá; falta o id:

```
TELEGRAM_TOKEN=123456789:AAF...
TELEGRAM_CHAT_ID=123456789
```

Esse arquivo está no `.gitignore`: **ele nunca sobe para o GitHub**. Se você trocar o token, troque só essa linha.

## Parte 5 — Teste de verdade

```powershell
npm.cmd run relatorio
```

Esperado, em segundos: `relatório enviado por telegram` e a mensagem chegando no celular.

Se aparecer `relatório enviado por tela`, o `TELEGRAM_CHAT_ID` está vazio ou o `.env.local` não foi salvo.

## Parte 6 — Ligar o domingo no GitHub

Você já está logado no `gh` (conta **JVHubert**), então são 4 comandos.

```powershell
cd C:\AI\painel-macro
git init -b main
git add -A
git commit -m "painel macro: site, coleta diária e relatório semanal"
```

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" repo create painel-macro --public --source=. --remote=origin --push
```

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" secret set TELEGRAM_TOKEN
& "C:\Program Files\GitHub CLI\gh.exe" secret set TELEGRAM_CHAT_ID
```

(cada comando pede o valor; cole e dê Enter — a tela não mostra o que você colou, é normal)

Ligue o site no GitHub Pages (equivalente a Settings → Pages → Source: GitHub Actions):

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" api -X POST repos/JVHubert/painel-macro/pages -f build_type=workflow
```

Rode o relatório agora, à mão, para não esperar até domingo:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" workflow run "Relatório semanal"
```

Depois de um minuto, para ver se passou:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" run list --limit 5
```

O painel fica em **https://jvhubert.github.io/painel-macro/** e dá para instalar no celular do mesmo jeito do Afinador (três pontinhos ⋮ → **Instalar app**).

## Parte 7 — Conferir que está agendado

- Em **Actions**, o workflow "Relatório semanal" deve aparecer na coluna da esquerda. O cron `0 21 * * 0` é **domingo às 18h de Brasília** (o GitHub usa UTC).
- Agendamento do GitHub pode atrasar alguns minutos quando o serviço está cheio. Não é bug seu.
- **Importante:** o GitHub desativa workflows agendados depois de 60 dias sem nenhuma atividade no repositório. O "Atualizar indicadores" roda duas vezes por dia e mantém isso vivo sozinho.

## Onde ficam os seus dados (repositório privado)

Os seus dados **nunca vão para o repositório público**. Eles ficam em dois lugares:

1. **Na sua máquina** — `carteira.json`, `diario/decisoes.md` e `estudo/respostas.md`, que é onde
   você edita (e onde as ferramentas leem por padrão).
2. **Num repositório privado**, `https://github.com/JVHubert/painel-macro-dados` — a sua cópia de
   segurança, e o que o relatório de domingo lê quando roda no GitHub. Ele já está criado, com os
   três arquivos dentro. Só você tem acesso.

Para o GitHub conseguir ler esse repositório, falta **você** criar um token (eu não tenho como criar
token na sua conta):

1. Abra https://github.com/settings/personal-access-tokens/new (ou, no site: seu avatar → Settings →
   Developer settings → Personal access tokens → Fine-grained tokens → Generate new token).
2. **Token name:** `painel-macro-dados`. **Expiration:** 1 ano.
3. **Repository access:** marque *Only select repositories* e escolha **painel-macro-dados**.
4. **Permissions → Repository permissions → Contents:** escolha **Read and write**.
5. **Generate token** e copie o valor (começa com `github_pat_` e aparece uma única vez).
6. Na pasta do projeto, rode o comando abaixo, cole o token quando ele pedir e aperte Enter (nada
   aparece na tela enquanto você cola — é de propósito):

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" secret set DADOS_TOKEN --repo JVHubert/painel-macro
```

   O mesmo pelo site: https://github.com/JVHubert/painel-macro/settings/secrets/actions →
   **New repository secret** → Name `DADOS_TOKEN` → Secret: o token → **Add secret**.

Feito isso, o relatório de domingo passa a ler o diário e a trilha do repositório privado — é assim
que o placar e os itens do diário aparecem na imagem. Sem o token, o relatório continua saindo,
apenas sem essas partes pessoais.

O `CARTEIRA_JSON` continua valendo como reserva, para o caso de o repositório privado não responder:

```powershell
Get-Content carteira.json -Raw | & "C:\Program Files\GitHub CLI\gh.exe" secret set CARTEIRA_JSON
```

O `carteira.example.json` no repositório público é só o modelo, sem número nenhum. **Quando você
mudar a carteira, o diário ou o estudo aqui no PC, me avise:** eu subo para o repositório privado
(na próxima parte isso vira um comando).

## Problemas comuns

| O que aparece | Causa | O que fazer |
|---|---|---|
| `401 Unauthorized` | token errado, revogado ou com espaço sobrando | copie de novo do BotFather e cole sem espaço |
| `400 chat not found` | você nunca mandou mensagem para o bot | Parte 2 |
| `relatório enviado por tela` | `TELEGRAM_CHAT_ID` vazio | Partes 3 e 4 |
| `403 Forbidden: bot was blocked` | você bloqueou o bot | desbloquear no Telegram |
| Chega na sua máquina mas não no GitHub | secrets não criados no repositório | Parte 6, `gh secret set` |
| O workflow não roda no domingo | agendamento desativado por 60 dias sem atividade | Actions → "Relatório semanal" → **Enable workflow** |
| `Nenhuma mensagem encontrada` no `chat-id` | o `oi` não foi enviado | Parte 2 |
| `403 Proibido` ao buscar cotação | o Yahoo bloqueou temporariamente | roda de novo mais tarde; o relatório segue com os outros dados |

## Segurança

- O token é a senha do bot. Não cole em chat, print, issue ou código.
- Se vazar: `/revoke` no @BotFather gera outro na hora — troque no `.env.local` e no secret do GitHub.
- Quem tem o token pode mandar mensagem em nome do bot, mas **não** entra na sua conta do Telegram nem lê suas conversas.
- O bot é seu, mas é público no sentido de que qualquer pessoa pode encontrar o seu bot pelo nome e mandar `/start`. Ele não responde nada e não envia nada para ninguém que você não tenha configurado como `chat_id`.

## Resumo do que roda sozinho depois disso

| Quando | O que |
|---|---|
| todo dia, 09h e 18h | coleta Selic, CDI, IPCA, dólar e publica o painel |
| domingo, 18h | chega a imagem do relatório no Telegram (macro + carteira + reserva + pergunta da semana) |
| a cada merge na `main` | confere os testes e republica o site |
