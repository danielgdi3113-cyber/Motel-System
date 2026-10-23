import type { PaymentMethod, StayMode } from "@prisma/client";
import { createPrismaClient } from "../src/lib/db";
import bcrypt from "bcryptjs";
import { calculateStayPrice } from "../src/lib/pricing";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { startOfLocalDay } from "../src/lib/time";

const db = createPrismaClient();
const HOUR = 3_600_000;

// Gerador determinístico para dados de demonstração reproduzíveis
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

async function main() {
  const existing = await db.user.count();
  if (existing > 0 && !process.argv.includes("--force")) {
    console.log("Banco já possui dados. Use `npm run db:seed -- --force` para recriar.");
    return;
  }

  // Limpa na ordem das dependências
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.internalMessage.deleteMany(),
    db.payment.deleteMany(),
    db.pending.deleteMany(),
    db.saleItem.deleteMany(),
    db.sale.deleteMany(),
    db.maintenanceTicket.deleteMany(),
    db.equipment.deleteMany(),
    db.waitlistEntry.deleteMany(),
    db.vehicle.deleteMany(),
    db.person.deleteMany(),
    db.company.deleteMany(),
    db.cashMovement.deleteMany(),
    db.cleaningTask.deleteMany(),
    db.consumption.deleteMany(),
    db.roomServiceOrder.deleteMany(),
    db.stockMovement.deleteMany(),
    db.stay.deleteMany(),
    db.reservation.deleteMany(),
    db.cashSession.deleteMany(),
    db.suite.deleteMany(),
    db.suiteCategory.deleteMany(),
    db.product.deleteMany(),
    db.user.deleteMany(),
    db.setting.deleteMany(),
  ]);

  await db.setting.createMany({ data: Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })) });

  const hash = (p: string) => bcrypt.hash(p, 10);
  const admin = await db.user.create({
    data: { name: "Administrador", email: "admin@motel.com", passwordHash: await hash("admin123"), role: "ADMIN" },
  });
  const recep = await db.user.create({
    data: { name: "Carla Recepção", email: "recepcao@motel.com", passwordHash: await hash("recepcao123"), role: "RECEPCAO" },
  });
  const maid = await db.user.create({
    data: { name: "Joana Camareira", email: "camareira@motel.com", passwordHash: await hash("camareira123"), role: "CAMAREIRA" },
  });

  const categories = await Promise.all(
    [
      {
        name: "Standard",
        description: "Conforto essencial com cama queen, ar-condicionado e garagem privativa.",
        amenities: ["Garagem privativa", "Ar-condicionado", "Smart TV", "Frigobar"],
        periodPrice: 7900,
        extraHourPrice: 2000,
        overnightPrice: 15900,
        sortOrder: 1,
        suites: ["101", "102", "103", "104", "105", "106"],
      },
      {
        name: "Luxo",
        description: "Hidromassagem para dois, iluminação cênica e som ambiente.",
        amenities: ["Hidromassagem", "Iluminação cênica", "Som bluetooth", "Smart TV 55\""],
        periodPrice: 12900,
        extraHourPrice: 3000,
        overnightPrice: 24900,
        sortOrder: 2,
        suites: ["201", "202", "203", "204"],
      },
      {
        name: "Master",
        description: "Nossa suíte mais completa: piscina aquecida, sauna, pole dance e teto espelhado.",
        amenities: ["Piscina aquecida", "Sauna", "Pole dance", "Teto espelhado", "Cromoterapia"],
        periodHours: 3,
        periodPrice: 24900,
        extraHourPrice: 5000,
        overnightPrice: 44900,
        sortOrder: 3,
        suites: ["301", "302"],
      },
    ].map(({ suites, ...c }) =>
      db.suiteCategory.create({
        data: { ...c, suites: { create: suites.map((number) => ({ number })) } },
        include: { suites: true },
      }),
    ),
  );
  const allSuites = categories.flatMap((c) => c.suites.map((s) => ({ ...s, category: c })));

  const productData: [string, string, number, number, number, number][] = [
    // nome, categoria, preço, custo, estoque, mínimo
    ["Água mineral 500ml", "Bebidas", 600, 150, 80, 20],
    ["Refrigerante lata", "Bebidas", 800, 300, 60, 20],
    ["Cerveja long neck", "Bebidas", 1400, 550, 72, 24],
    ["Energético", "Bebidas", 1800, 800, 24, 8],
    ["Espumante nacional", "Bebidas", 8900, 3500, 12, 4],
    ["Vinho tinto", "Bebidas", 9900, 4200, 10, 4],
    ["Dose de whisky", "Bebidas", 2500, 900, 40, 10],
    ["Porção de batata frita", "Cozinha", 3900, 1200, 999, 0],
    ["Porção de frango a passarinho", "Cozinha", 4900, 1800, 999, 0],
    ["Lanche natural", "Cozinha", 2200, 800, 30, 8],
    ["Tábua de frios", "Cozinha", 6900, 2800, 15, 5],
    ["Chocolate", "Conveniência", 900, 350, 40, 10],
    ["Preservativo (3 un.)", "Conveniência", 1200, 400, 50, 15],
    ["Kit higiene", "Conveniência", 1500, 500, 25, 10],
    ["Decoração romântica", "Serviços", 15000, 4000, 999, 0],
  ];
  const products = await Promise.all(
    productData.map(([name, category, price, cost, stock, minStock]) =>
      db.product.create({ data: { name, category, price, cost, stock, minStock } }),
    ),
  );
  await db.stockMovement.createMany({
    data: products.map((p) => ({ productId: p.id, type: "ENTRADA" as const, quantity: p.stock, reason: "Estoque inicial", userId: admin.id })),
  });

  // --- Histórico: 30 dias de operação ---
  const now = Date.now();
  const tolerance = 15;
  const methods: PaymentMethod[] = ["PIX", "PIX", "PIX", "CREDITO", "CREDITO", "DEBITO", "DINHEIRO"];
  const sellable = products.filter((p) => p.category !== "Serviços");

  const HISTORY_DAYS = 395;
  for (let d = HISTORY_DAYS; d >= 1; d--) {
    const dayStart = startOfLocalDay(new Date(now - d * 24 * HOUR)).getTime();
    const cash = await db.cashSession.create({
      data: { openedAt: new Date(dayStart + 8 * HOUR), openingAmount: 20000, openedById: recep.id, status: "FECHADO" },
    });
    let cashIn = 0;
    const dow = new Date(dayStart + 12 * HOUR).getUTCDay();
    const weekend = dow === 0 || dow === 5 || dow === 6 ? 1.35 : 1;
    const growth = 0.8 + 0.2 * (1 - d / HISTORY_DAYS); // cresce ao longo do ano
    const staysToday = Math.round((12 + Math.floor(rand() * 10)) * weekend * growth);
    for (let i = 0; i < staysToday; i++) {
      const suite = pick(allSuites);
      // Concentra entradas entre 18h e 3h
      const hourOffset = rand() < 0.7 ? 18 + rand() * 9 : 8 + rand() * 16;
      const checkIn = new Date(dayStart + hourOffset * HOUR);
      const mode: StayMode = hourOffset >= 20 && hourOffset < 26 && rand() < 0.3 ? "PERNOITE" : "PERIODO";
      const durationH = mode === "PERNOITE" ? 9 + rand() * 4 : suite.category.periodHours - 0.5 + rand() * 2.5;
      const checkOut = new Date(Math.min(checkIn.getTime() + durationH * HOUR, now - HOUR));
      if (checkOut <= checkIn) continue;
      const c = suite.category;
      const room = calculateStayPrice(
        { mode, checkIn, periodHours: c.periodHours, periodPrice: c.periodPrice, extraHourPrice: c.extraHourPrice, overnightPrice: c.overnightPrice, overnightEndHour: c.overnightEndHour, toleranceMinutes: tolerance },
        checkOut,
      ).amount;

      const items = Array.from({ length: Math.floor(rand() * 4) }, () => ({ p: pick(sellable), q: 1 + Math.floor(rand() * 2) }));
      const consumption = items.reduce((s, x) => s + x.p.price * x.q, 0);
      const total = room + consumption;
      const method = pick(methods);
      if (method === "DINHEIRO") cashIn += total;

      await db.stay.create({
        data: {
          suiteId: suite.id,
          mode,
          status: "FECHADA",
          checkIn,
          checkOut,
          plate: rand() < 0.8 ? `${String.fromCharCode(65 + Math.floor(rand() * 26))}${String.fromCharCode(65 + Math.floor(rand() * 26))}${String.fromCharCode(65 + Math.floor(rand() * 26))}${Math.floor(rand() * 10)}${String.fromCharCode(65 + Math.floor(rand() * 10))}${Math.floor(rand() * 90 + 10)}` : "",
          periodHours: c.periodHours,
          periodPrice: c.periodPrice,
          extraHourPrice: c.extraHourPrice,
          overnightPrice: c.overnightPrice,
          overnightEndHour: c.overnightEndHour,
          roomAmount: room,
          consumptionAmount: consumption,
          total,
          openedById: recep.id,
          closedById: recep.id,
          consumptions: {
            create: items.map((x) => ({ productId: x.p.id, quantity: x.q, unitPrice: x.p.price, createdById: recep.id, createdAt: checkIn })),
          },
          payments: { create: [{ method, amount: total, cashSessionId: cash.id, createdAt: checkOut }] },
          cleaningTasks: {
            create: [{ suiteId: suite.id, status: "CONCLUIDA", assignedToId: maid.id, createdAt: checkOut, startedAt: new Date(checkOut.getTime() + 5 * 60_000), finishedAt: new Date(checkOut.getTime() + (20 + rand() * 20) * 60_000) }],
          },
        },
      });
    }
    const expected = 20000 + cashIn;
    await db.cashSession.update({
      where: { id: cash.id },
      data: { closedAt: new Date(Math.min(dayStart + 32 * HOUR, now - 7 * HOUR)), closedById: recep.id, expectedAmount: expected, declaredAmount: expected },
    });
  }

  // --- Estado atual ---
  const openCash = await db.cashSession.create({ data: { openingAmount: 20000, openedById: recep.id, openedAt: new Date(now - 6 * HOUR) } });
  const occupied = [
    { n: "101", mins: 45, mode: "PERIODO" as const, plate: "QWE4R21" },
    { n: "103", mins: 150, mode: "PERIODO" as const, plate: "BRA2E19" },
    { n: "201", mins: 80, mode: "PERIODO" as const, plate: "" },
    { n: "202", mins: 20, mode: "PERNOITE" as const, plate: "RIO7A55" },
    { n: "301", mins: 100, mode: "PERIODO" as const, plate: "SPX1D88" },
  ];
  for (const o of occupied) {
    const s = allSuites.find((x) => x.number === o.n)!;
    const c = s.category;
    await db.suite.update({ where: { id: s.id }, data: { status: "OCUPADA" } });
    const stay = await db.stay.create({
      data: {
        suiteId: s.id,
        mode: o.mode,
        plate: o.plate,
        checkIn: new Date(now - o.mins * 60_000),
        periodHours: c.periodHours,
        periodPrice: c.periodPrice,
        extraHourPrice: c.extraHourPrice,
        overnightPrice: c.overnightPrice,
        overnightEndHour: c.overnightEndHour,
        openedById: recep.id,
      },
    });
    if (o.n === "201" || o.n === "301") {
      const beer = products.find((p) => p.name.startsWith("Cerveja"))!;
      await db.consumption.create({ data: { stayId: stay.id, productId: beer.id, quantity: 2, unitPrice: beer.price, createdById: recep.id } });
      await db.product.update({ where: { id: beer.id }, data: { stock: { decrement: 2 } } });
    }
  }
  // Algumas vendas no caixa atual
  for (let i = 0; i < 6; i++) {
    await db.payment.create({ data: { cashSessionId: openCash.id, method: pick(methods), amount: 7900 + Math.floor(rand() * 10) * 1000, createdAt: new Date(now - (5 - i) * 50 * 60_000) } });
  }

  for (const n of ["104", "203"]) {
    const s = allSuites.find((x) => x.number === n)!;
    await db.suite.update({ where: { id: s.id }, data: { status: "LIMPEZA" } });
    await db.cleaningTask.create({
      data: n === "104"
        ? { suiteId: s.id, createdAt: new Date(now - 8 * 60_000) }
        : { suiteId: s.id, status: "EM_ANDAMENTO", assignedToId: maid.id, createdAt: new Date(now - 25 * 60_000), startedAt: new Date(now - 18 * 60_000) },
    });
  }
  const s106 = allSuites.find((x) => x.number === "106")!;
  await db.suite.update({ where: { id: s106.id }, data: { status: "MANUTENCAO", notes: "Ar-condicionado com ruído — técnico agendado." } });

  // Clientes, fornecedores e veículos
  const joao = await db.person.create({ data: { name: "João Pereira", phone: "11955554444", document: "123.456.789-00" } });
  await db.person.create({ data: { name: "Cliente frequente (M.)", phone: "11944443333", notes: "Prefere a suíte 301" } });
  const distrib = await db.company.create({ data: { name: "Distribuidora de Bebidas Central", document: "12.345.678/0001-90", contact: "Marcos", phone: "1133334444", isSupplier: true, isCustomer: false } });
  await db.company.create({ data: { name: "Lavanderia Express", isSupplier: true, isCustomer: false, contact: "Ana" } });
  await db.company.create({ data: { name: "Eventos XYZ Ltda", document: "98.765.432/0001-10", isCustomer: true } });
  await db.vehicle.createMany({
    data: [
      { plate: "QWE4R21", model: "Onix", color: "Prata", personId: joao.id },
      { plate: "BRA2E19", model: "Corolla", color: "Preto" },
      { plate: "XYZ9A99", model: "Gol", color: "Branco", blocked: true, notes: "Danos à suíte 104 em 08/2026" },
    ],
  });
  await db.pending.create({ data: { personId: joao.id, description: "Suíte 201 — check-out", amount: 8500, createdById: recep.id, dueDate: new Date(now + 5 * 24 * HOUR) } });

  // Equipamentos e manutenção
  for (const s of allSuites) {
    await db.equipment.createMany({
      data: [
        { name: "Smart TV", code: `TV-${s.number}`, suiteId: s.id },
        { name: "Ar-condicionado", code: `AC-${s.number}`, suiteId: s.id, status: s.number === "106" ? "DEFEITO" : "OK" },
        { name: "Frigobar", code: `FB-${s.number}`, suiteId: s.id },
        ...(s.category.name !== "Standard" ? [{ name: "Hidromassagem", code: `HM-${s.number}`, suiteId: s.id }] : []),
      ],
    });
  }
  const ac106 = await db.equipment.findFirst({ where: { code: "AC-106" } });
  await db.maintenanceTicket.create({
    data: { title: "Ar-condicionado com ruído", suiteId: s106.id, equipmentId: ac106?.id, priority: "ALTA", createdById: recep.id, description: "Barulho alto ao ligar. Técnico agendado." },
  });
  await db.maintenanceTicket.create({
    data: { title: "Lâmpada do banheiro queimada", suiteId: allSuites.find((x) => x.number === "203")!.id, priority: "BAIXA", createdById: maid.id },
  });

  // Despesas do mês
  await db.cashMovement.create({
    data: { cashSessionId: openCash.id, type: "PAGAMENTO_FORNECEDOR", amount: 45000, method: "PIX", companyId: distrib.id, description: "Cervejas e refrigerantes", document: "NF 8812", userId: admin.id },
  });

  // Pedido de serviço de quarto em andamento (suíte 301)
  const stay301 = await db.stay.findFirst({ where: { status: "ABERTA", suite: { number: "301" } } });
  if (stay301) {
    const fries = products.find((p) => p.name.startsWith("Porção de batata"))!;
    const order = await db.roomServiceOrder.create({ data: { stayId: stay301.id, createdById: recep.id, notes: "Bem crocante" } });
    await db.consumption.create({ data: { stayId: stay301.id, productId: fries.id, quantity: 1, unitPrice: fries.price, createdById: recep.id, orderId: order.id } });
  }

  // Lista de espera, recados e ações recentes
  await db.waitlistEntry.create({ data: { name: "Casal no carro prata", plate: "FGH3J45", categoryId: categories.find((c) => c.name === "Master")!.id, createdAt: new Date(now - 12 * 60_000) } });
  await db.internalMessage.create({ data: { authorId: admin.id, body: "Lembrete: inventário do frigobar na sexta à noite.", readByIds: [admin.id] } });
  await db.user.update({ where: { id: recep.id }, data: { lastSeenAt: new Date(now) } });
  await db.auditLog.createMany({
    data: [
      { userId: maid.id, action: "Iniciada a limpeza da suíte 203 por Joana Camareira", createdAt: new Date(now - 18 * 60_000) },
      { userId: recep.id, action: "Check-in na suíte 202 (placa RIO7A55) por Carla Recepção", createdAt: new Date(now - 20 * 60_000) },
      { userId: recep.id, action: "Carla Recepção entrou no sistema (IP 192.168.0.12)", createdAt: new Date(now - 6 * HOUR) },
      { userId: recep.id, action: "Caixa aberto por Carla Recepção com R$ 200,00", createdAt: new Date(now - 6 * HOUR) },
    ],
  });

  // Reservas futuras
  const luxo = categories.find((c) => c.name === "Luxo")!;
  const master = categories.find((c) => c.name === "Master")!;
  await db.reservation.createMany({
    data: [
      { code: "AMR7K2", categoryId: luxo.id, customerName: "Rafael", phone: "11988887777", scheduledAt: new Date(now + 2 * HOUR), mode: "PERIODO", status: "CONFIRMADA", source: "WHATSAPP" },
      { code: "BX9PQ4", categoryId: master.id, customerName: "Juliana & Pedro", phone: "11977776666", scheduledAt: new Date(now + 26 * HOUR), mode: "PERNOITE", status: "PENDENTE", source: "SITE", notes: "Aniversário de namoro — decoração com pétalas" },
      { code: "CZ3LM8", categoryId: categories[0].id, customerName: "M.", phone: "11966665555", scheduledAt: new Date(now + 50 * HOUR), mode: "PERIODO", status: "PENDENTE", source: "SITE" },
    ],
  });

  console.log("Seed concluído.");
  console.log("  admin@motel.com / admin123");
  console.log("  recepcao@motel.com / recepcao123");
  console.log("  camareira@motel.com / camareira123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
