# Sistema para motéis — guia para a Claude

Sistema web de gestão de motéis (recepção, caixa, estoque, reservas, limpeza, relatórios e Assistente IA). O dono do projeto não é programador: responda em **português do Brasil**, explique passo a passo e peça prints quando algo der errado. Ele usa **Windows** (o irmão usa Mac). Repositório: `danielgdi3113-cyber/Motel-System`.

## Stack e comandos
- Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Prisma 6 (`engineType = "client"` + `@prisma/adapter-pg`, sem engine nativa — evita erro de `.dll` no Windows) · PostgreSQL.
- `npm run dev` · `npm run build` · `npm test` (vitest, regras de cobrança) · `npm run lint` (tsc).
- Banco: `npx prisma migrate dev --name <nome>` após mudar `prisma/schema.prisma`; `npm run db:seed` (só roda em banco vazio; `-- --force` apaga tudo e recria dados de exemplo).
- Usuário final roda com `iniciar-windows.bat` / `iniciar-mac.command` (instalam, migram, semeiam e sobem o `next dev`). Publicação: Vercel + Neon via `scripts/vercel-build.sh` (ver README).

## Organização
- `src/actions/*` — server actions (regras de negócio). Padrão: `run(async () => …)` de `actions/types.ts` devolve `{ ok, message | error }`; erros esperados são `BusinessError`. Valide com zod.
- `src/lib/permissions.ts` — **fonte única de acesso por perfil** (ADMIN, RECEPCAO, CAMAREIRA). Menu, `middleware.ts` e páginas usam isso; toda página/ação também chama `requireUser(roles)`. Funcionários não podem ver relatórios, faturamento, custos, despesas nem configurações (fechamento de caixa é cego para eles).
- `src/lib/pricing.ts` — cobrança por período/pernoite com tolerância e hora extra (com testes). Preços são congelados no check-in.
- `src/lib/assistant/*` + `src/app/api/assistente/route.ts` — Assistente IA (só admin): Claude Opus 5.5 via tool runner da `@anthropic-ai/sdk`, ferramentas **somente leitura**, conversa salva em `AssistantChat` (histórico só cresce — não editar mensagens antigas). O relatório do período é calculado por código em `report.ts` (a IA só analisa). Chave: `ANTHROPIC_API_KEY` ou salva pela tela (setting `anthropicApiKey`, nunca exposta por `getSettings`).
- `src/lib/audit.ts` — registra ações para "Últimas ações" do dashboard; use em operações importantes.

## Convenções e armadilhas já resolvidas
- Dinheiro sempre em **centavos (Int)**; formate com `formatMoney`. Datas no fuso `America/Sao_Paulo` via helpers de `src/lib/time.ts` (nunca `new Date().setHours`).
- Botões que disparam ação com valores fixos: use `ActionButton` (`components/ui.tsx`) com campos ocultos — o valor do botão clicado (`name`/`value`) **não chega** às server actions.
- Cronômetros em client components: `useNow(fallback)` com um horário fixo vindo dos dados, para não gerar erro de hidratação.
- Modais que trocam de conteúdo conforme status precisam de `key={status}` para fechar ao mudar.
- Páginas do Next não podem exportar nada além do permitido (coloque rótulos em `src/lib/labels.ts`).
- Seed online: com `ADMIN_PASSWORD` definido, não cria senhas conhecidas.

## Próximos passos combinados (para vender a outros motéis)
1. Tela de primeiro uso (começar sem dados de exemplo: suítes, preços, equipe).
2. Emissão de NFC-e (integração com serviço como Focus NFe / PlugNotas).
3. Backup automático e teste de restauração.
4. LGPD: termos, política de privacidade e retenção de dados de clientes/placas.
5. Depois: Pix com QR Code/TEF, painel do dono do sistema, multi-cliente.
