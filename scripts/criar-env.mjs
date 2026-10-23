// Cria o arquivo .env perguntando a senha do PostgreSQL.
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

if (existsSync(".env")) {
  console.log("Arquivo .env já existe — mantendo a configuração atual.");
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Digite a senha do PostgreSQL que você criou na instalação: ");
rl.close();
const user = process.env.PGUSER || "postgres";

const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:5432/motel?schema=public`;
writeFileSync(".env", `DATABASE_URL="${url}"\nAUTH_SECRET="${randomBytes(32).toString("base64url")}"\n`);
console.log("Arquivo .env criado.");
