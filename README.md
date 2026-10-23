# Sistema para motéis

Sistema web completo para gestão de motéis: mapa de suítes em tempo real, check-in/check-out com cobrança automática, consumo e estoque, caixa, reservas online e fila de limpeza.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL 16

## Módulos

O menu segue as mesmas seções de sistemas de motel tradicionais (Operação, Caixa, Relatórios, Estoque, Clientes, Colaboradores).

### Operação
| Módulo | O que faz |
| --- | --- |
| **Recepção (mapa)** | Status de cada suíte em tempo real (livre, ocupada, limpeza, manutenção, reservada), cronômetro, valor parcial, placa e alerta de hora extra. Atualiza a cada 15 s. |
| **Locação** | Check-in por período ou pernoite, consumo, desconto, pagamento dividido com troco, **pendura** (deixar o restante pendente para um cliente) e cancelamento (só admin). Placas bloqueadas não entram. |
| **Painel de reservas** | Reservas do site e da recepção, confirmação por WhatsApp, check-in direto da reserva. |
| **Venda avulsa** | Venda sem suíte (balcão, portaria, delivery) com carrinho, desconto, pagamento dividido e pendura. |
| **Lista de espera** | Fila de clientes aguardando suíte, com tempo de espera e aviso quando a categoria desejada vaga. |
| **Serviços de quarto** | Quadro da cozinha/copa: pedidos novos → preparando → entregues. Pedido cancelado estorna conta e estoque. |
| **Limpeza** | Fila automática do check-out; a camareira pode mandar a suíte para manutenção, o que abre um chamado. |
| **Manutenções** | Chamados com prioridade, suíte/equipamento, custo e solução; pode bloquear e liberar a suíte. |
| **Pendências** | Contas a receber (pendura), com vencimento e recebimento parcial. |
| **Equipamentos** | Patrimônio por suíte (TV, ar, frigobar...) com situação e chamados abertos. |

### Caixa e relatórios
| Módulo | O que faz |
| --- | --- |
| **Caixa / turno** | Abertura, sangria, suprimento e fechamento. Funcionários fazem **fechamento cego** (não veem o valor esperado nem o faturamento). |
| **Pag. de fornecedores / Adiantamento salarial** | Despesas do caixa; só as pagas em dinheiro saem da gaveta. |
| **Dashboard** | Faturamento, despesas, ticket e tempo médio, RevPAR, margem, situação das suítes, movimento do turno por usuário, resultados 24h/7d/30d e por turno, histórico de 12 meses, dia da semana, andamento do mês/ano com projeção, usuários online e últimas ações. |
| **Relatório de faturamento / Movimentos do caixa** | Faturamento por dia, horário, categoria e produto; todas as entradas e saídas de um período. |

### Estoque, clientes e equipe
| Módulo | O que faz |
| --- | --- |
| **Mercadorias / Entrada rápida** | Cadastro com custo e margem, alerta de mínimo; entrada de uma nota inteira de uma vez. |
| **Cardápio** | Escolhe o que aparece no cardápio digital público (`/cardapio`, para QR Code na suíte). |
| **Veículos / Pessoas / Empresas** | Placas registradas no check-in com histórico de visitas e bloqueio; clientes e fornecedores. |
| **Funcionários** | Cada funcionário com o próprio login e perfil. |
| **Comunicação interna** | Recados para toda a equipe ou para uma pessoa, com aviso de não lidas. |
| **Trocar minha senha** | Cada usuário troca a própria senha. |

### Perfis de acesso

As regras ficam em `src/lib/permissions.ts` e são aplicadas no menu, no middleware (bloqueia a URL digitada direto) e em cada página/ação.

| | Administrador | Recepção | Camareira |
| --- | :-: | :-: | :-: |
| Mapa, locações, reservas, venda avulsa, espera, serviços, pendências, equipamentos | ✅ | ✅ | — |
| Limpeza, manutenções, comunicação interna, trocar senha | ✅ | ✅ | ✅ |
| Caixa (abrir, sangria, suprimento, fechar) | ✅ | ✅ cego | — |
| Faturamento do caixa, dashboard, relatórios | ✅ | — | — |
| Fornecedores, adiantamentos | ✅ | — | — |
| Custo e margem dos produtos, cardápio | ✅ | — | — |
| Funcionários, suítes e preços, configurações | ✅ | — | — |

## Regras de cobrança

- **Período:** preço fixo pelas primeiras _N_ horas da categoria. Passado o período e a tolerância (15 min por padrão), cada hora extra iniciada é cobrada inteira.
- **Pernoite:** preço fixo até o horário de saída da categoria (padrão: 12h do dia seguinte; entrando de madrugada, 12h do mesmo dia). Depois disso, hora extra.
- Os preços ficam **congelados no check-in**: mudar a tabela não afeta quem já está na suíte.
- O valor final é sempre **recalculado no servidor** no check-out.
- A lógica está em `src/lib/pricing.ts`, com testes em `src/lib/pricing.test.ts`.

Valores monetários são armazenados em centavos (inteiros) e os horários seguem o fuso `America/Sao_Paulo` (variável `MOTEL_TIMEZONE`).

## Como rodar no Windows (jeito fácil)

1. Instale o **Node.js LTS**: https://nodejs.org
2. Instale o **PostgreSQL**: https://www.postgresql.org/download/windows/ — anote a senha que você criar.
3. Baixe o código (botão verde **Code → Download ZIP** no GitHub) e descompacte.
4. Dê dois cliques em **`iniciar-windows.bat`** e digite a senha do PostgreSQL quando pedir.

O navegador abre em http://localhost:3000. Para desligar, feche a janela preta.

## Como rodar (Docker / Linux / Mac)

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
