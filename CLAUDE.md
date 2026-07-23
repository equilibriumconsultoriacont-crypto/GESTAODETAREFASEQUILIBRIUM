# Plataforma Equilíbrium

Sistema interno da **Equilíbrio Consultoria Contábil** (Rio Claro/SP) que substitui o "Acessórias".
Módulos: **Tarefas** (gestão de obrigações contábeis), **Portal do Cliente**, **Propostas**.

## Idioma e estilo de trabalho

- **Responda sempre em português do Brasil**, direto e breve.
- Fluxo preferido: fazer as perguntas de arquitetura **no começo**, depois executar tudo
  sequencialmente **sem pedir aprovação entre os passos**, e rodar os diagnósticos no fim.
- "teste cada passo" = validar com build/tsc/lógica a cada etapa, não só no final.

## Comandos

```bash
npm run dev        # tsx watch server/_core/index.ts
npm run build      # vite build + esbuild do servidor
npm run check      # tsc --noEmit
npm test           # vitest run
```

Checagem rápida de um arquivo isolado (mais rápido que o tsc inteiro):

```bash
# backend
npx esbuild server/routers.ts --bundle --platform=node --format=esm --packages=external --outfile=/tmp/b.js
# frontend
npx esbuild client/src/pages/X.tsx --bundle --platform=node --format=esm --packages=external \
  --outfile=/tmp/f.js --jsx=automatic --external:react --external:wouter --external:lucide-react \
  --external:sonner --external:recharts --external:@/*
```

O `tsc --noEmit` gera ruído conhecido de `process`/`console`/`__dirname`/`@types/node` — filtre.

## Deploy

- Push na branch `main` → **auto-deploy no Render**.
- Banco: **MySQL 8.4 no Aiven**.
- Após **qualquer mudança de schema**, rodar `POST /admin/setup` (a secret vem de env var).
  O endpoint é idempotente: cria tabelas e roda as migrações de backfill.

## Armadilhas já pagas (não repetir)

- **MySQL 8.4 não suporta `ADD COLUMN IF NOT EXISTS`.** Migrações usam guarda via
  `information_schema` + `INSERT IGNORE`, dentro do `ensureSchema()` em `server/_core/index.ts`
  (roda no boot, tem que ser idempotente).
- **Datas: usar UTC em todo lugar** (armazenamento e exibição, via `getUTC*`). Formatação local
  causava bug de "um dia a menos" em várias telas.
- **No OCR, casar PGDAS antes do DAS.** Se o DAS for testado primeiro, ele engole o PGDAS.
  DAS recalculado é detectado comparando "Pagar até" × "Data de Vencimento" — quando difere,
  a tarefa concluída é reaberta e o arquivo novo é disparado.
- **E-mail de acesso usa o e-mail do LOGIN, nunca o `client.email`** (o e-mail da empresa).
  Eles divergem com frequência; foi bug real (`resendClientAccess`).
- **Um e-mail pode acessar várias empresas** (tabela `client_user_access`).
  `resolvePortalClientId` é **async** e verifica o acesso — não presumir 1 usuário = 1 empresa.
- **Portal do Cliente só mostra tarefas com `sendToClient = true`.** Tarefas internas precisam
  ficar com a flag desligada.
- Entregabilidade de e-mail (iCloud principalmente) depende do domínio verificado no **Resend**
  (DKIM/DMARC) — é config de painel, não código. Diagnóstico em **Configurações → E-mail**.

## Gerador de propostas

`client/public/tools/gerador-propostas.html` é uma ferramenta **self-contained** (HTML+JS puro),
embutida como **iframe** em `client/src/pages/Proposals.tsx`, com ponte de armazenamento via
`postMessage` → tRPC. Foi mantida como iframe de propósito: a base já era testada e grande demais
pra reescrever em React sem ganho real.

Arquitetura interna: `PADRAO` (defaults) → `DB` → `P` (proposta atual) → blocos (`TIPOS`) →
renderizadores (`REND`) → `gerar()`/`htmlFinal()`. Cada `PRESET` tem `blocos[]` + `prep(p)` que
preenche o conteúdo.

**Como testar sem navegador** (o sandbox não abre browser): extrair o `<script>` principal para
um arquivo e rodar em Node com DOM mockado, chamando `novaProposta(preset)` + `htmlFinal()`, e
comparar a estrutura do `<body>` com um HTML de referência. Foi assim que se achou o bug do `nl2`.

- Bug já corrigido: `nl2()` escapava o HTML **antes** de trocar `\n` por `<br>`, então `<br>` e
  `<em>` apareciam como **texto literal** no título. Hoje `nl2` reabilita as tags de formatação,
  aceita Enter como quebra e `**texto**` como negrito.

## Segurança

- **Nunca commitar segredos.** Credenciais (banco, Resend, token do GitHub, secret do `/admin/setup`)
  vivem em variáveis de ambiente / painel do Render — não neste arquivo nem no repositório.

## Pendências conhecidas

- Tarefas antigas ainda estão com `sendToClient = true` por padrão; falta um update em massa
  (ou edição individual) pra esconder as internas do portal.
- O toggle `sendToClient` existe na criação de tarefa, mas ainda não na edição.
- Seletor de empresa no portal para usuários multi-empresa (parcial).
- Opção de `.ics` universal (Apple/Outlook) no e-mail de guia — só o link do Google Calendar existe.
- RBAC completo: 3 camadas (acesso ao módulo, nível dentro do módulo, escopo de dados).
