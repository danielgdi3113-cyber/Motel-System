import { db } from "./db";

export const DEFAULT_SETTINGS = {
  motelName: "Motel Aurora",
  slogan: "Privacidade, conforto e discrição.",
  whatsapp: "5511999999999",
  address: "Av. Exemplo, 1000 — São Paulo/SP",
  toleranceMinutes: "15",
};

export type Settings = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<Settings> {
  // Só as chaves conhecidas: segredos guardados na mesma tabela nunca saem daqui
  const rows = await db.setting.findMany({ where: { key: { in: Object.keys(DEFAULT_SETTINGS) } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...map } as Settings;
}

export async function getTolerance(): Promise<number> {
  const s = await getSettings();
  return Number.parseInt(s.toleranceMinutes, 10) || 0;
}
