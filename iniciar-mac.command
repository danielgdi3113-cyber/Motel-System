#!/bin/bash
# Inicia o sistema no macOS. Dê dois cliques (na primeira vez: botão direito → Abrir).
cd "$(dirname "$0")" || exit 1

# Postgres.app e Homebrew não ficam no PATH quando o script é aberto pelo Finder
for dir in /Applications/Postgres.app/Contents/Versions/latest/bin /opt/homebrew/bin /usr/local/bin; do
  [ -d "$dir" ] && PATH="$dir:$PATH"
done
export PATH

erro() {
  echo ""
  echo "[ERRO] $1"
  echo ""
  read -r -p "Pressione Enter para fechar..."
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  erro "Node.js não encontrado. Instale a versão LTS em https://nodejs.org e rode de novo."
fi

if command -v pg_isready >/dev/null 2>&1 && ! pg_isready -q -h localhost -p 5432; then
  erro "O PostgreSQL não está ligado. Abra o Postgres.app e clique em Start (ou Initialize)."
fi

echo ""
echo "=== 1/4 Configuração ==="
if [ ! -f .env ]; then
  # Postgres.app e Homebrew aceitam o usuário do Mac sem senha
  DBUSER="${USER:-$(whoami)}"
  SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')
  printf 'DATABASE_URL="postgresql://%s@localhost:5432/motel?schema=public"\nAUTH_SECRET="%s"\n' "$DBUSER" "$SECRET" > .env
  echo "Arquivo .env criado (usuário do banco: $DBUSER)."
else
  echo "Arquivo .env já existe — mantendo a configuração atual."
fi

echo ""
echo "=== 2/4 Instalando dependências (a primeira vez leva alguns minutos) ==="
npm install --no-audit --no-fund || erro "Falha ao instalar as dependências. Veja a mensagem acima."
npx prisma generate || erro "Falha ao preparar o acesso ao banco."

echo ""
echo "=== 3/4 Preparando o banco de dados ==="
npx prisma migrate deploy || erro "Não consegui acessar o PostgreSQL. Confira se o Postgres.app está ligado (Start). Se você mudou usuário/senha do banco, apague o arquivo .env e rode de novo."
npm run db:seed || erro "O banco foi criado, mas os dados de exemplo não puderam ser carregados. Veja a mensagem acima."

echo ""
echo "=== 4/4 Iniciando o sistema ==="
echo "O navegador vai abrir em http://localhost:3000"
echo "Login: admin@motel.com / admin123"
echo "Para desligar, feche esta janela."
echo ""
(sleep 12 && command -v open >/dev/null && open "http://localhost:3000") &
npm run dev
