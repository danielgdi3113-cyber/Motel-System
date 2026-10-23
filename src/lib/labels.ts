import type {
  CleaningStatus,
  PaymentMethod,
  ReservationSource,
  ReservationStatus,
  Role,
  StayMode,
  SuiteStatus,
} from "@prisma/client";

export const suiteStatusLabel: Record<SuiteStatus, string> = {
  LIVRE: "Livre",
  OCUPADA: "Ocupada",
  LIMPEZA: "Limpeza",
  MANUTENCAO: "Manutenção",
  RESERVADA: "Reservada",
};

export const suiteStatusStyle: Record<SuiteStatus, string> = {
  LIVRE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  OCUPADA: "border-rose-500/50 bg-rose-500/10 text-rose-300",
  LIMPEZA: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  MANUTENCAO: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  RESERVADA: "border-sky-500/40 bg-sky-500/10 text-sky-300",
};

export const suiteStatusDot: Record<SuiteStatus, string> = {
  LIVRE: "bg-emerald-400",
  OCUPADA: "bg-rose-400",
  LIMPEZA: "bg-amber-400",
  MANUTENCAO: "bg-zinc-400",
  RESERVADA: "bg-sky-400",
};

export const modeLabel: Record<StayMode, string> = { PERIODO: "Período", PERNOITE: "Pernoite" };

export const paymentLabel: Record<PaymentMethod, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  DEBITO: "Débito",
  CREDITO: "Crédito",
};

export const roleLabel: Record<Role, string> = { ADMIN: "Administrador", RECEPCAO: "Recepção", CAMAREIRA: "Camareira" };

export const reservationStatusLabel: Record<ReservationStatus, string> = {
  PENDENTE: "Pendente",
  CONFIRMADA: "Confirmada",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
  NO_SHOW: "Não compareceu",
};

export const reservationStatusStyle: Record<ReservationStatus, string> = {
  PENDENTE: "bg-amber-500/15 text-amber-300",
  CONFIRMADA: "bg-sky-500/15 text-sky-300",
  CONCLUIDA: "bg-emerald-500/15 text-emerald-300",
  CANCELADA: "bg-zinc-500/15 text-zinc-400",
  NO_SHOW: "bg-rose-500/15 text-rose-300",
};

export const sourceLabel: Record<ReservationSource, string> = {
  SITE: "Site",
  WHATSAPP: "WhatsApp",
  TELEFONE: "Telefone",
  BALCAO: "Balcão",
};

export const cleaningStatusLabel: Record<CleaningStatus, string> = {
  PENDENTE: "Aguardando",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};
