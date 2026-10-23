import type { Stay } from "@prisma/client";
import { calculateStayPrice } from "./pricing";

/** Valor atual de uma locação aberta (quarto + consumo). */
export function stayTotals(
  stay: Pick<Stay, "mode" | "checkIn" | "periodHours" | "periodPrice" | "extraHourPrice" | "overnightPrice" | "overnightEndHour">,
  consumptionAmount: number,
  toleranceMinutes: number,
  now = new Date(),
) {
  const room = calculateStayPrice({ ...stay, toleranceMinutes }, now);
  return { room, consumptionAmount, subtotal: room.amount + consumptionAmount };
}
