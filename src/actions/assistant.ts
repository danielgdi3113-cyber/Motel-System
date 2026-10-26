"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, ADMIN } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { API_KEY_SETTING, ASSISTANT_MODEL } from "@/lib/assistant/agent";
import { BusinessError, run, type ActionState } from "./types";

export async function saveApiKeyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(ADMIN);
  const res = await run(async () => {
    const key = String(form.get("apiKey") ?? "").trim();
    if (!key) {
      await db.setting.deleteMany({ where: { key: API_KEY_SETTING } });
      await audit(user.id, `Chave da API do assistente removida por ${user.name}`, true);
      return "Chave removida.";
    }
    if (!key.startsWith("sk-ant-")) throw new BusinessError('A chave deve começar com "sk-ant-".');
    // Confere a chave antes de salvar
    try {
      await new Anthropic({ apiKey: key, maxRetries: 0, timeout: 15_000 }).models.retrieve(ASSISTANT_MODEL);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new BusinessError("Chave inválida. Confira se copiou a chave inteira.");
      if (e instanceof Anthropic.PermissionDeniedError || e instanceof Anthropic.NotFoundError)
        throw new BusinessError("A chave não tem acesso ao modelo do assistente.");
      if (!(e instanceof Anthropic.APIConnectionError)) throw e;
      // Sem internet agora: salva mesmo assim; o erro aparecerá na primeira pergunta
    }
    await db.setting.upsert({ where: { key: API_KEY_SETTING }, create: { key: API_KEY_SETTING, value: key }, update: { value: key } });
    await audit(user.id, `Chave da API do assistente configurada por ${user.name}`, true);
    return "Chave salva. O assistente está pronto.";
  });
  revalidatePath("/painel/assistente");
  return res;
}

export async function deleteChatAction(form: FormData) {
  const user = await requireUser(ADMIN);
  await db.assistantChat.deleteMany({ where: { id: String(form.get("id")), userId: user.id } });
  redirect("/painel/assistente");
}
