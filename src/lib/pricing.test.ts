import { describe, expect, it } from "vitest";
import { calculateStayPrice, overnightDeadline } from "./pricing";
import { fromZoned } from "./time";

const base = {
  periodHours: 2,
  periodPrice: 8000,
  extraHourPrice: 2500,
  overnightPrice: 18000,
  overnightEndHour: 12,
  toleranceMinutes: 15,
};
const tz = "America/Sao_Paulo";
const at = (d: number, h: number, m = 0) => fromZoned(2026, 10, d, h, m, tz);

describe("calculateStayPrice — período", () => {
  const checkIn = at(10, 14);

  it("cobra só o período dentro do tempo contratado", () => {
    const r = calculateStayPrice({ ...base, mode: "PERIODO", checkIn }, at(10, 15, 59), tz);
    expect(r.amount).toBe(8000);
    expect(r.extraHours).toBe(0);
  });

  it("respeita a tolerância", () => {
    const r = calculateStayPrice({ ...base, mode: "PERIODO", checkIn }, at(10, 16, 15), tz);
    expect(r.amount).toBe(8000);
  });

  it("cobra hora extra após a tolerância (fração conta como hora cheia)", () => {
    expect(calculateStayPrice({ ...base, mode: "PERIODO", checkIn }, at(10, 16, 16), tz).amount).toBe(10500);
    expect(calculateStayPrice({ ...base, mode: "PERIODO", checkIn }, at(10, 17, 15), tz).amount).toBe(10500);
    expect(calculateStayPrice({ ...base, mode: "PERIODO", checkIn }, at(10, 17, 16), tz).amount).toBe(13000);
  });

  it("informa quando o valor vai subir", () => {
    const r = calculateStayPrice({ ...base, mode: "PERIODO", checkIn }, at(10, 15), tz);
    expect(r.nextChargeAt.getTime()).toBe(at(10, 16, 15).getTime());
  });
});

describe("calculateStayPrice — pernoite", () => {
  it("prazo é o meio-dia seguinte para entrada à noite", () => {
    expect(overnightDeadline(at(10, 22), 12, tz).getTime()).toBe(at(11, 12).getTime());
  });

  it("prazo é o meio-dia do mesmo dia para entrada de madrugada", () => {
    expect(overnightDeadline(at(11, 2), 12, tz).getTime()).toBe(at(11, 12).getTime());
  });

  it("cobra pernoite e horas extras após o prazo", () => {
    const input = { ...base, mode: "PERNOITE" as const, checkIn: at(10, 22) };
    expect(calculateStayPrice(input, at(11, 11), tz).amount).toBe(18000);
    expect(calculateStayPrice(input, at(11, 13), tz).amount).toBe(20500);
  });
});
