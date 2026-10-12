# Painel macro

Selic, CDI, IPCA e dólar num painel que abre no celular, funciona offline e se atualiza sozinho duas vezes por dia.

A ideia é acompanhar a economia sem ler relatório: cada número vem com uma linha dizendo o que ele significa para quem está começando a poupar, e um simulador mostra quanto o imposto e a inflação comem do rendimento.

**Ver agora:** https://jvhubert.github.io/painel-macro/

Primeira vez configurando o Telegram? Siga o [COMO-CONFIGURAR-O-BOT.md](COMO-CONFIGURAR-O-BOT.md).

## Como funciona

| Arquivo | Papel |
|---|---|
| `indicadores.js` | contas puras: juros compostos, IPCA em 12 meses, juro real, tabela do imposto de renda, formatação |
| `relatorio.js` | texto do relatório semanal: semana ISO, resultado por posição, comparação com o CDI |
| `trilha.js` | o currículo como dado: as perguntas de cada nível, com tipo, gabarito e a prova |
| `contexto.js` | monta o bloco que você cola no professor de IA: situação em faixas, trilha e diário |
| `carteira.example.json` | modelo dos seus dados (copie para `carteira.json`, que fica fora do git) |
| `PROMPT.md` | instruções para o seu professor de IA (colar no Gemini/ChatGPT) |
| `relatorios/` | histórico do que você recebeu, na sua máquina (fora do git) |
| `caderno.js` | lê, escreve e formata o diário e a trilha de estudo |
| `diario/decisoes.example.md` | modelo do diário (o seu fica fora do git) |
| `estudo/respostas.example.md` | modelo da trilha de estudo |
| `tools/diario.mjs` | cobra a tese antes de decidir e o resultado depois |
| `tools/estudo.mjs` | pergunta da semana, respostas e aproveitamento |
| `tools/mercado.mjs` | cotação da B3 e série do CDI (compartilhado) |
| `tools/coletar.mjs` | busca as APIs e grava `dados/indicadores.json` |
| `tools/relatorio.mjs` | monta e envia o relatório de domingo |
| `tools/notificar.mjs` | entrega no Telegram, senão no ntfy, senão na tela |
| `tools/gerar-icones.mjs` | desenha os PNGs do ícone escrevendo o PNG na mão (sem dependência) |
| `app.js` | tela: frase-resumo, cartões, minigráfico e simulador |
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

Juro real = CDI acumulado em 12 meses ÷ IPCA em 12 meses (os dois do mesmo período). O CDI ao ano é a taxa diária anualizada em 252 dias úteis.

Conteúdo educativo. **Não é recomendação de investimento.**

## O painel no celular

Abre em `https://jvhubert.github.io/painel-macro/` (ou `npm run serve` na sua máquina) e, depois da primeira visita, funciona offline. A ordem dos cartões é a que importa para quem poupa: **Juro real** primeiro, com a borda de destaque, porque é ele que diz quanto a renda fixa paga acima da inflação; depois Selic, CDI, IPCA e dólar. No topo, uma frase-resumo escrita por regras em `indicadores.js` — nada de IA. A fonte técnica (BACEN · SGS 432) fica no pé do cartão, em texto pequeno.

No simulador, o campo **% do CDI** (padrão 100) mostra um CDB que paga mais ou menos que o CDI cheio, e a linha "Na poupança seria" compara com a poupança no mesmo prazo. A poupança entra como 0,5% ao mês enquanto a Selic está acima de 8,5% ao ano (abaixo disso, 70% da Selic) e **sem a TR** — a nota embaixo do resultado diz isso. Quando a pergunta da semana é de simulação, o próprio simulador avisa, lendo a `trilha.js`.

## Relatório semanal

Todo domingo às 18h (Brasília) o workflow "Relatório semanal" monta e **envia uma imagem** no Telegram, com tabelas e cores de verdade:

- **Frase-resumo** no topo — o que a semana fez com o patrimônio e onde a reserva está.
- **Para esta semana** — até 3 ações decididas por regras (excedente da reserva, produto rendendo pouco, diário e estudo), a pergunta do estudo e o placar do aprendizado (contas certas das últimas 8 semanas, decisões com tese, revisadas).
- **Patrimônio** — total, variação estimada da semana e a barra de alocação (reserva × ações).
- **Reserva** — uma tabela só: onde está, saldo, o que rende e quanto isso é do CDI.
- **Carteira** — uma linha por papel (aplicado, hoje, resultado, % do patrimônio) e quanto o mesmo dinheiro teria rendido no CDI.
- **Sobra do mês** — sobra, aporte programado e o que sobra sem destino.
- **Macro** — Selic, CDI, IPCA 12 meses, juro real e dólar, sem cor, no fim.
- **Pergunta da semana** — vem da `trilha.js`: uma pergunta do nível atual por domingo, em ordem, começando pela n1-01, para estudar com o `PROMPT.md`.

A imagem cabe em cerca de duas telas de celular. Diário e trilha de estudo só aparecem nas execuções feitas na sua máquina (os arquivos são privados).

Tudo fica arquivado em `relatorios/AAAA-MM-DD.png` (e `.md`, em texto) na sua máquina — nada disso vai para o GitHub. A sua cópia de segurança do histórico é o próprio Telegram.

Para conferir o relatório **sem que ele seja enviado** (por exemplo, depois de mexer no layout), rode `npm run relatorio -- --seco`: ele monta tudo, grava o `.md` e o `.png` em `relatorios/` e termina com `modo seco: nada enviado`.

### Cores (formatação condicional)

A imagem sai com **cor de verdade** (azul, verde, cinza, mostarda e vermelho) e colunas alinhadas. A faixa é sobre o número, não juízo de valor:

| Cor | Faixa |
|---|---|
| 🔵 azul | +20% ou mais |
| 🟢 verde | positivo |
| ⚪ cinza | perto de zero (±1%) |
| 🟡 mostarda | negativo |
| 🔴 vermelho | −20% ou menos |

A imagem é montada a partir de `relatorioHtml.js` e renderizada em PNG por `tools/imagem.mjs`, que usa o Chrome que já existe na máquina — não baixa navegador nenhum. Se o Chrome não estiver por perto (`CHROME=<caminho>` para apontar o seu), o relatório cai automaticamente para a versão em texto, com os mesmos números e o emoji no lugar da cor (o Telegram não aceita texto colorido em mensagem — por isso a imagem).

### Como preencher o `carteira.json`

Copie `carteira.example.json` para `carteira.json`. Esse arquivo está no `.gitignore`: fica só na sua máquina. Para o relatório do GitHub usar os mesmos dados, suba o conteúdo como secret:

```powershell
Get-Content carteira.json -Raw | & "C:\Program Files\GitHub CLI\gh.exe" secret set CARTEIRA_JSON
```

Sempre que mudar seus números, rode esse comando de novo (o arquivo local continua sendo a sua fonte de verdade). Sem esse secret, o relatório de domingo **para com erro** — é de propósito: sem carteira, ele sairia vazio.

```json
{
  "receitaMensal": 7000,
  "custoMensal": 4000,
  "aporteMensal": 1000,
  "reserva": {
    "alvoMeses": 6,
    "detalhe": [
      { "nome": "Conta corrente", "saldo": 2500.00 },
      { "nome": "Caixinha X", "saldo": 10000.00, "rendimento": 1200.00, "dataAporte": "2025-06-30" },
      { "nome": "Cofrinho Y", "saldo": 4500.00, "taxaCDI": 1.20 }
    ]
  },
  "posicoes": [
    { "ticker": "RENT3", "quantidade": 100, "precoMedio": 30.00, "dataCompra": "2025-10-01" }
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

## Diário de decisões e trilha de estudo

São as duas ferramentas que fecham o ciclo de aprendizado: uma cobra a **tese antes**
da decisão, a outra guarda a sua **resposta antes** da correção.

### Diário de decisões (`npm run diario`)

```powershell
npm run diario -- novo "tirar a Caixinha X para CDB ou Tesouro"
npm run diario
```

O comando cria um bloco em `diario/decisoes.md` (arquivo fora do git) e você preenche no editor:

```
## 2026-10-11 · Tirar a Caixinha X (80% do CDI) para CDB ou Tesouro
- tipo: renda fixa
- valor: 10000.00
- tese: 80% do CDI num produto que prometia mais
- espero: achar taxa real acima de 6% ao ano
- provacao: se o Tesouro IPCA+ estiver pagando menos que 5% real
- revisarEm: 2027-01-09
- revisado:
```

- `valor` é quanto está em jogo (use `0` quando não for dinheiro).
- `provacao` é o que provaria que você estava errado — é o campo que separa decisão de palpite.
- Quando chega a data em `revisarEm`, o painel mostra a sua tese **ao lado do fato**: quanto o
  ativo andou desde então (se o título citar um ticker) e quanto o CDI rendeu no mesmo período.
- Aí você escreve em `revisado` o que aprendeu e a decisão sai da fila.

### Trilha de estudo (`npm run estudo`)

```powershell
npm run estudo -- novo                  # cria o bloco desta semana com a pergunta
npm run estudo -- responder 1126,83     # registra a resposta e corrige na hora
npm run estudo -- revisar 7,3           # responde a revisão mais antiga que venceu
npm run estudo
```

A pergunta da semana é a mesma que chega no relatório de domingo. Responda **primeiro sem
ajuda**, registre em `estudo/respostas.md` e só depois peça a correção com o `PROMPT.md`
aberto. O painel mostra o aproveitamento das semanas. Antes de abrir a conversa com o
professor de IA, rode `npm run contexto` e cole o bloco que ele imprime.

Nas perguntas de conta o sistema confere sozinho (`responder` aceita `1126,83` ou `1126.83`,
com ou sem `R$`) e guarda o gabarito no bloco, com 1% de tolerância: "certo (gabarito …)" ou
"errado — gabarito …. Dica: …". Nas de conceito, quem corrige é o professor, e você escreve o
resultado em `corrigido:`.

**A matéria volta.** A pergunta que você errou reaparece depois de um tempo — no máximo duas por
semana, as mais antigas primeiro:

| Último resultado | Volta em |
|---|---|
| errado | 1 semana |
| parcial | 3 semanas |
| certo | 8 semanas (duas certas seguidas e a pergunta aposenta) |

As revisões aparecem no `npm run estudo` com o motivo, e você responde com
`npm run estudo -- revisar <a sua resposta>` — que usa o mesmo gabarito guardado da primeira vez.

O **placar** fecha o quadro nos dois lugares: no `npm run estudo` e numa linha do relatório de
domingo, abaixo do "Para esta semana". Ele conta só as contas das últimas 8 semanas
(`contas certas 6/8 (75%)`) e soma o diário inteiro (`decisões com tese 2 · revisadas 1`) — é o
que a formatura cobra.

Ordem sugerida para os primeiros blocos (um por semana, no ritmo da pergunta que chega):

1. juros compostos e a diferença entre taxa nominal e taxa real
2. Selic, CDI e por que quase todo mundo recebe um pedaço do CDI
3. IPCA e o que a inflação faz com quem guarda dinheiro parado
4. renda fixa: liquidez, FGC e marcação a mercado
5. imposto de renda regressivo: por que o tempo joga a seu favor
6. reserva de emergência: quanto é o suficiente e o que sobra depois dela
7. risco: volatilidade, concentração e o que uma queda de 30% significa na prática
8. fundos, ETFs e FIIs: quando fazem sentido e quando só complicam

## Privacidade

Nada pessoal seu vive no repositório:

| Na sua máquina (fora do git) | No GitHub, como secret |
|---|---|
| `.env.local` — token do bot | `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID` |
| `carteira.json` — seus números | `CARTEIRA_JSON` |
| `relatorios/` — histórico do que chegou | — (o histórico de verdade é o próprio Telegram) |
| `diario/decisoes.md` e `estudo/respostas.md` — suas teses e respostas | — |

Quando mudar seus dados, atualize os dois lugares: o arquivo local e o secret. O que está no repositório é código, indicadores públicos e o `carteira.example.json` sem número nenhum.

Se um dia colar um token em lugar público (chat, print, issue), revogue no `@BotFather` com `/revoke` e atualize o `.env.local` e o secret — o valor antigo deixa de valer na hora.

## Para aprender com ele

1. Anote a meta Selic de hoje e o IPCA em 12 meses. Volte em um mês e explique o que mudou e por quê.
2. Rode o simulador mudando só o prazo (6 meses → 5 anos) e repare quanto a alíquota do imposto muda.
3. Compare o juro real com a rentabilidade que o seu banco oferece. Se o banco paga menos que o CDI, você já sabe o que perguntar a ele.
4. Responda a pergunta do relatório de domingo antes de usar a IA. Responder primeiro é o que faz a resposta colar — e o `PROMPT.md` já está configurado para só corrigir depois que você responder.

## Desenvolvimento

Requer Node.js 22+ (o renderizador da imagem usa `puppeteer-core`, que pede Node 22.12 ou mais novo).

```sh
npm install       # só para o render da imagem (puppeteer-core usa o seu Chrome)
npm test          # contas de juros, imposto, formatação, relatório e HTML
npm run coletar   # busca as APIs e regrava dados/indicadores.json
npm run relatorio # monta o relatório, salva em relatorios/ e envia (imagem, senão texto)
npm run relatorio -- --seco # igual, mas monta e salva sem enviar nada (para conferir)
npm run diario    # diário de decisões: o que falta escrever e o que venceu
npm run estudo    # pergunta da semana, respostas e aproveitamento
npm run contexto  # bloco de contexto para colar no professor de IA (sem número exato)
npm run chat-id   # descobre o seu chat_id do Telegram (para o .env.local)
npm run serve     # http://localhost:8080
npm run publicar  # monta dist/site
npm run icones    # refaz os PNGs do ícone
```

No Windows, se o PowerShell bloquear os scripts do npm, use `npm.cmd test` (ou `node --test`).

A versão do `sw.js` publicado é calculada na hora de publicar, a partir do conteúdo dos arquivos do site (`tools/versao.mjs`): não precisa aumentar nada à mão — mudou um arquivo, o celular baixa a versão nova na próxima abertura.

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
