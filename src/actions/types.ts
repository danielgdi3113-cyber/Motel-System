export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;

export class BusinessError extends Error {}

/** Executa a ação e converte erros de negócio em mensagem para o formulário. */
export async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { ok: true, message: message ?? undefined };
  } catch (e) {
    if (e instanceof BusinessError) return { error: e.message };
    if (e && typeof e === "object" && "issues" in e) {
      const issues = (e as { issues: { message: string }[] }).issues;
      return { error: issues[0]?.message ?? "Dados inválidos." };
    }
    // Deixa o Next tratar redirect/notFound
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { error: "Erro inesperado. Tente novamente." };
  }
}
