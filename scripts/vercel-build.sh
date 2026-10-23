#!/bin/bash
# Build na Vercel: prepara o banco (Neon) e compila o site.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERRO: DATABASE_URL não definido. Conecte o banco Neon na aba Storage do projeto na Vercel." >&2
  exit 1
fi
if [ -z "${AUTH_SECRET:-}" ] || [ ${#AUTH_SECRET} -lt 16 ]; then
  echo "ERRO: defina AUTH_SECRET (mínimo 16 caracteres) em Settings → Environment Variables." >&2
  exit 1
fi

# Migrações e seed usam a conexão direta (sem pooler), quando a Neon fornece uma
DIRECT="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"

npx prisma generate
DATABASE_URL="$DIRECT" npx prisma migrate deploy

# Primeiro deploy: cria suítes, produtos e dados de exemplo (ignora se já houver usuários)
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "AVISO: ADMIN_PASSWORD não definido — o admin terá a senha de exemplo admin123. Troque assim que entrar." >&2
fi
DATABASE_URL="$DIRECT" SEED_HISTORY_DAYS="${SEED_HISTORY_DAYS:-120}" npx prisma db seed

npx next build
