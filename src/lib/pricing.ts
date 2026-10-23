import { fromZoned, localParts, TIMEZONE } from "./time";

export type PricingInput = {
  mode: "PERIODO" | "PERNOITE";
  checkIn: Date;
  periodHours: number;
  periodPrice: number;
  extraHourPrice: number;
  overnightPrice: number;
  overnightEndHour: number;
  toleranceMinutes: number;
};

export type PricingResult = {
  amount: number;
  baseAmount: number;
  extraHours: number;
  /** Horário em que termina o período contratado (antes da tolerância). */
  limitAt: Date;
  /** Próximo instante em que o valor aumenta. */
  nextChargeAt: Date;
};

const HOUR = 3_600_000;
const MIN = 60_000;

/** Prazo de saída do pernoite: próximo `endHour` local depois do check-in. */
export function overnightDeadline(checkIn: Date, endHour: number, tz = TIMEZONE): Date {
  const p = localParts(checkIn, tz);
  const sameDay = fromZoned(p.year, p.month, p.day, endHour, 0, tz);
  if (sameDay.getTime() > checkIn.getTime()) return sameDay;
  return fromZoned(p.year, p.month, p.day + 1, endHour, 0, tz);
}

export function calculateStayPrice(input: PricingInput, now: Date, tz = TIMEZONE): PricingResult {
  const tolerance = input.toleranceMinutes * MIN;
  const baseAmount = input.mode === "PERNOITE" ? input.overnightPrice : input.periodPrice;
  const limitAt =
    input.mode === "PERNOITE"
      ? overnightDeadline(input.checkIn, input.overnightEndHour, tz)
      : new Date(input.checkIn.getTime() + input.periodHours * HOUR);

  const overtime = now.getTime() - limitAt.getTime() - tolerance;
  const extraHours = overtime > 0 ? Math.ceil(overtime / HOUR) : 0;

  return {
    amount: baseAmount + extraHours * input.extraHourPrice,
    baseAmount,
    extraHours,
    limitAt,
    nextChargeAt: new Date(limitAt.getTime() + tolerance + extraHours * HOUR),
  };
}
