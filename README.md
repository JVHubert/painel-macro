# Painel macro

Selic, CDI, IPCA e dólar num painel que abre no celular, funciona offline e se atualiza sozinho duas vezes por dia.

A ideia é acompanhar a economia sem ler relatório: cada número vem com uma linha dizendo o que ele significa para quem está começando a poupar, e um simulador mostra quanto o imposto e a inflação comem do rendimento.

**Ver agora:** https://jvhubert.github.io/painel-macro/

Primeira vez configurando o Telegram? Siga o [COMO-CONFIGURAR-O-BOT.md](COMO-CONFIGURAR-O-BOT.md).

## Como funciona

| Arquivo | Papel |
|---|---|
| `indicadores.js` | contas puras: juros compostos, IPCA em 12 meses, juro real, tabela do imposto de renda, formatação |
| `relatorio.js` | texto do relatório semanal: semana ISO, perguntas, resultado por posição, comparação com o CDI |
| `carteira.example.json` | modelo dos seus dados (copie para `carteira.json`, que fica fora do git) |
| `PROMPT.md` | instruções para o seu professor de IA (colar no Gemini/ChatGPT) |
| `relatorios/` | histórico do que você recebeu, na sua máquina (fora do git) |
| `tools/coletar.mjs` | busca as APIs e grava `dados/indicadores.json` |
| `tools/relatorio.mjs` | monta e envia o relatório de domingo |
| `tools/notificar.mjs` | entrega no Telegram, senão no ntfy, senão na tela |
| `tools/gerar-icones.mjs` | desenha os PNGs do ícone escrevendo o PNG na mão (sem dependência) |
| `app.js` | tela: cartões, minigráfico e simulador |
| `sw.js` | guarda a casca no aparelho; o JSON vem da rede primeiro, com a cópia local de reserva |
| `.github/workflows/atualizar.yml` | duas vezes ao dia: coleta, testa, commita o JSON e publica |
| `.github/workflows/semanal.yml` | domingo 18h: monta, envia e arquiva o relatório |

HTML, CSS e JavaScript puros, sem etapa de build. O site **não** chama API nenhuma direto: ele lê o JSON que o robô já gerou. Isso resolve CORS, dispensa chave de API e deixa o painel abrir offline.

## De onde vêm os números

| Indicador | Fonte | Série |
|---|---|---|
| Meta Selic | Banco Central (SGS) | 432 |
| CDI | Banco Central (SGS) | 12 |
| IPCA mensal (o acumulado de 12 meses é composto aqui) | Banco Central (SGS) | 433 |
| Dólar, histórico | Banco Central (SGS) | 1 |
| Dólar, cotação do dia | AwesomeAPI (`USD-BRL`) | — |
| Ações da carteira | Yahoo Finance (`RENT3.SA`) | — |

Juro real = meta Selic ÷ IPCA em 12 meses. O CDI ao ano é a taxa diária anualizada em 252 dias úteis.

Conteúdo educativo. **Não é recomendação de investimento.**

## Relatório semanal

Todo domingo às 18h (Brasília) o workflow "Relatório semanal" monta e envia:

- **Macro** — Selic, CDI, IPCA 12 meses, juro real e dólar, com a variação da semana.
- **Carteira** — cada posição com preço atual, valor de mercado, seu resultado desde a compra e quanto o CDI teria rendido no mesmo período.
- **Reserva** — meses de custo cobertos e quanto falta para os 6 meses.
- **Aporte** — a meta mensal que você definiu.
- **Pergunta da semana** — uma das 12 gira a cada domingo, para estudar com o `PROMPT.md`.

Tudo isso fica arquivado em `relatorios/AAAA-MM-DD.md` na sua máquina. **Nada disso vai para o GitHub**: a carteira e os relatórios estão no `.gitignore`, e a sua cópia de segurança do histórico é o próprio Telegram.

### Cores (formatação condicional)

Telegram não aceita cor em texto, então a cor vira emoji — a faixa é sobre o número, não juízo de valor:

| Emoji | Faixa | Exemplo |
|---|---|---|
| 🔵 | +20% ou mais | sua ação subiu 31% na semana |
| 🟢 | positivo | rendimento de 13% ao ano |
| ⚪ | perto de zero (±1%) | dólar estável |
| 🟡 | negativo | imposto, inflação, prejuízo pequeno |
| 🔴 | −20% ou menos | queda forte |

No painel do site a mesma faixa é cor de verdade (azul, verde, cinza, mostarda, vermelho), com a legenda no rodapé. Taxas como Selic e CDI ficam sem cor de propósito: ali a variação em p.p. não é resultado seu. A reserva de emergência usa uma regra própria — a cor mostra o progresso até a meta de meses, não rentabilidade.

### Como preencher o `carteira.json`

Copie `carteira.example.json` para `carteira.json`. Esse arquivo está no `.gitignore`: fica só na sua máquina. Para o relatório do GitHub usar os mesmos dados, suba o conteúdo como secret:

```powershell
Get-Content carteira.json -Raw | & "C:\Program Files\GitHub CLI\gh.exe" secret set CARTEIRA_JSON
```

Sempre que mudar seus números, rode esse comando de novo (o arquivo local continua sendo a sua fonte de verdade).

```json
{
  "receitaMensal": 5000,
  "custoMensal": 2350,
  "aporteMensal": 2000,
  "reserva": {
    "alvoMeses": 6,
    "detalhe": [
      { "nome": "Conta corrente", "saldo": 1960.70 },
      { "nome": "Caixinha X", "saldo": 12346.42, "rendimento": 1740.14, "dataAporte": "2025-06-29" },
      { "nome": "Cofrinho Y", "saldo": 7534.53, "taxaCDI": 1.20 }
    ]
  },
  "posicoes": [
    { "ticker": "RENT3", "quantidade": 7, "precoMedio": 49.40, "dataCompra": "2025-10-01" }
  ]
}
```

- `receitaMensal` − `custoMensal` vira o bloco "sobra do mês" (quanto pode ser aportado).
- Em `detalhe`, `rendimento` + `dataAporte` permitem medir a taxa anual e comparar com o CDI. Se você fez aporte novo depois da data informada, a medida perde validade — o relatório avisa disso.
- `taxaCDI` é o que o produto promete (`1.2` = 120% do CDI), para conferir depois se pagou mesmo.
- O total da reserva é a soma dos saldos (não precisa manter um total à mão).
- `dataCompra` da ação está na nota de corretagem; sem ela não dá para comparar com o CDI.

### Onde receber

**Telegram** (recomendado: fica no histórico, formata melhor e depois aceita comandos de volta):

1. No Telegram, fale com `@BotFather`, mande `/newbot` e guarde o token.
2. Mande qualquer mensagem para o seu próprio bot (ele não pode iniciar conversa).
3. Rode `npm run chat-id` — ele lê o token do `.env.local` e imprime o seu `chat_id`.
4. **Rodando na sua máquina:** cole o token e o chat_id em `.env.local` (arquivo que está no `.gitignore`, nunca sobe para o repositório). Copie o `.env.example` para começar.
5. **Rodando no GitHub:** crie os secrets `TELEGRAM_TOKEN` e `TELEGRAM_CHAT_ID` em **Settings → Secrets and variables → Actions**.
6. Rode o workflow "Relatório semanal" à mão uma vez para testar.

**ntfy** (reserva, sem criar conta): escolha um nome de tópico difícil de adivinhar, instale o app ntfy no celular e assine o tópico; coloque `NTFY_TOPIC` no `.env.local` ou nos secrets. Sem token nenhum, o workflow imprime o relatório no log.

O código tenta Telegram primeiro; se não estiver configurado, usa ntfy; se também não, imprime na tela. Falha de envio não derruba o workflow — o arquivo em `relatorios/` já está salvo.

> Token de bot no repositório é vazamento na certa: `.env.local` está no `.gitignore` justamente por isso. Se algum dia colar o token em um chat, revogue com `/revoke` no `@BotFather` e atualize o arquivo.

## Privacidade

Nada pessoal seu vive no repositório:

| Na sua máquina (fora do git) | No GitHub, como secret |
|---|---|
| `.env.local` — token do bot | `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` |
| `carteira.json` — seus números | `CARTEIRA_JSON` |
| `relatorios/` — histórico do que chegou | — (o histórico de verdade é o próprio Telegram) |

Quando mudar seus dados, atualize os dois lugares: o arquivo local e o secret. O que está no repositório é código, indicadores públicos e o `carteira.example.json` sem número nenhum.

Se um dia colar um token em lugar público (chat, print, issue), revogue no `@BotFather` com `/revoke` e atualize o `.env.local` e o secret — o valor antigo deixa de valer na hora.

## Para aprender com ele

1. Anote a meta Selic de hoje e o IPCA em 12 meses. Volte em um mês e explique o que mudou e por quê.
2. Rode o simulador mudando só o prazo (6 meses → 5 anos) e repare quanto a alíquota do imposto muda.
3. Compare o juro real com a rentabilidade que o seu banco oferece. Se o banco paga menos que o CDI, você já sabe o que perguntar a ele.
4. Responda a pergunta do relatório de domingo antes de usar a IA. Responder primeiro é o que faz a resposta colar — e o `PROMPT.md` já está configurado para só corrigir depois que você responder.

## Desenvolvimento

Requer Node.js 20+ (nenhuma dependência para instalar).

```sh
npm test          # contas de juros, imposto, formatação, relatório e montagem dos cartões
npm run coletar   # busca as APIs e regrava dados/indicadores.json
npm run relatorio # monta o relatório semanal (envia pelo canal configurado e salva em relatorios/)
npm run chat-id   # descobre o seu chat_id do Telegram (para o .env.local)
npm run serve     # http://localhost:8080
npm run publicar  # monta dist/site
npm run icones    # refaz os PNGs do ícone
```

No Windows, se o PowerShell bloquear os scripts do npm, use `npm.cmd test` (ou `node --test`).

Ao publicar uma mudança, aumente `VERSAO` em `sw.js` para os celulares baixarem a versão nova.

## Publicar

1. Suba o repositório como público e ligue o Pages em **Settings → Pages → Source: GitHub Actions**.
2. Faça merge na `main` (ou rode o workflow "Site (GitHub Pages)").
3. O workflow "Atualizar indicadores" cuida dos dados nos horários agendados — inclusive republicando o site, porque commit de robô não dispara outro workflow.

## Próximos passos

- Alerta por push (ntfy.sh ou bot do Telegram) quando o juro real passar de um valor escolhido.
- Ibovespa e FIIs — precisa de um token grátis da brapi.dev, daí o `coletar.mjs` ganha mais uma fonte.
- Aba de carteira: aportes, custo médio, rentabilidade contra o CDI e rebalanceamento por classe.

## Licença

MIT
