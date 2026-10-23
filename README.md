# Sistema para motéis

Sistema web completo para gestão de motéis: mapa de suítes em tempo real, check-in/check-out com cobrança automática, consumo e estoque, caixa, reservas online e fila de limpeza.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL 16

## Módulos

| Módulo | O que faz |
| --- | --- |
| **Mapa de suítes** (`/painel`) | Painel em tempo real com status de cada suíte (livre, ocupada, limpeza, manutenção, reservada), cronômetro, valor parcial, placa e alerta de hora extra. Atualiza sozinho a cada 15 s, então vários terminais ficam sincronizados. |
| **Locação** (`/painel/locacoes/:id`) | Check-in por período ou pernoite, lançamento de consumo, desconto, pagamento dividido (Pix, débito, crédito, dinheiro) com cálculo de troco, e cancelamento (só admin). |
| **Produtos e estoque** (`/painel/produtos`) | Cadastro com preço/custo/margem, entrada e ajuste de estoque, alerta de estoque mínimo e histórico de movimentações. Venda baixa o estoque automaticamente; remover item estorna. |
| **Caixa** (`/painel/caixa`) | Abertura com fundo de troco, sangria/suprimento, totais por forma de pagamento, fechamento com conferência (esperado × contado) e histórico. O check-out exige caixa aberto. |
| **Reservas** (`/painel/reservas`) | Reservas do site (pendentes) e da recepção (WhatsApp/telefone/balcão), confirmação com mensagem pronta para WhatsApp, check-in direto da reserva, controle de não comparecimento. |
| **Limpeza** (`/painel/limpeza`) | Fila automática gerada no check-out, iniciar/concluir com tempo de limpeza, envio para manutenção. Tela pensada para o celular da camareira. |
| **Relatórios** (`/painel/relatorios`) | Faturamento por dia, ticket médio, taxa de ocupação, entradas por horário, receita por categoria e forma de pagamento, produtos mais vendidos e lucro bruto. |
| **Suítes e preços** (`/painel/suites`) | Categorias com preço do período, hora extra e pernoite (horários configuráveis), comodidades e suítes. |
| **Configurações** (`/painel/configuracoes`) | Dados do motel, WhatsApp, tolerância de hora extra e usuários da equipe. |
| **Site público** (`/`, `/reservar`) | Vitrine das suítes com preços e disponibilidade em tempo real, e reserva online sem cadastro (com código e confirmação pelo WhatsApp). |

### Perfis de acesso

- **Administrador:** tudo.
- **Recepção:** mapa, locações, reservas, caixa, produtos (entrada de estoque) e limpeza.
- **Camareira:** só a fila de limpeza.

## Regras de cobrança

- **Período:** preço fixo pelas primeiras _N_ horas da categoria. Passado o período e a tolerância (15 min por padrão), cada hora extra iniciada é cobrada inteira.
- **Pernoite:** preço fixo até o horário de saída da categoria (padrão: 12h do dia seguinte; entrando de madrugada, 12h do mesmo dia). Depois disso, hora extra.
- Os preços ficam **congelados no check-in**: mudar a tabela não afeta quem já está na suíte.
- O valor final é sempre **recalculado no servidor** no check-out.
- A lógica está em `src/lib/pricing.ts`, com testes em `src/lib/pricing.test.ts`.

Valores monetários são armazenados em centavos (inteiros) e os horários seguem o fuso `America/Sao_Paulo` (variável `MOTEL_TIMEZONE`).

## Como rodar

Pré-requisitos: Node.js 20+ e Docker (ou um PostgreSQL próprio).

```bash
# 1. Banco de dados
docker compose up -d

# 2. Dependências e variáveis
npm install
cp .env.example .env        # troque AUTH_SECRET por uma string longa e aleatória

# 3. Tabelas e dados de demonstração
npx prisma migrate deploy
npm run db:seed

# 4. Rodar
npm run dev                 # http://localhost:3000
```

### Usuários de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | admin@motel.com | admin123 |
| Recepção | recepcao@motel.com | recepcao123 |
| Camareira | camareira@motel.com | camareira123 |

O seed cria 3 categorias, 12 suítes, 15 produtos, 30 dias de histórico (para os relatórios), suítes ocupadas, em limpeza e em manutenção, e reservas futuras. Para recriar: `npm run db:seed -- --force` (**apaga todos os dados**).

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm test` | Testes (regras de cobrança) |
| `npm run lint` | Checagem de tipos |
| `npm run db:migrate` | Cria uma nova migration após alterar `prisma/schema.prisma` |
| `npm run db:studio` | Interface visual do banco |

## Estrutura

```
prisma/
  schema.prisma        # modelo de dados
  seed.ts              # dados de demonstração
src/
  actions/             # server actions (regras de negócio, validação com zod)
  app/
    page.tsx           # site público
    reservar/          # reserva online
    login/
    painel/            # sistema interno (protegido por middleware + checagem de perfil)
  components/          # UI compartilhada
  lib/                 # preço, fuso horário, dinheiro, sessão, caixa
  middleware.ts        # bloqueia /painel sem sessão
```

## Produção

- Defina `DATABASE_URL` e um `AUTH_SECRET` forte (`openssl rand -base64 32`).
- `npm run build && npx prisma migrate deploy && npm start` — o build usa `output: "standalone"`, pronto para container.
- Use HTTPS (o cookie de sessão é `secure` em produção).
- O limite de tentativas da reserva pública é em memória (por instância). Com várias instâncias, troque por Redis.

## Próximos passos sugeridos

- Emissão de NFC-e e integração com maquininha/TEF e Pix dinâmico (QR Code no check-out).
- Notificações em tempo real via WebSocket/SSE no lugar do polling.
- Leitura automática de placa (LPR) na portaria.
- Bot de WhatsApp para reservas e confirmações automáticas.
- Pedidos de cardápio pelo QR Code da suíte.
