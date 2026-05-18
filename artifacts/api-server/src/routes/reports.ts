import { Router, type IRouter } from "express";
import { db, reservationsTable } from "@workspace/db";

const router: IRouter = Router();

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MAX_EVENTS_PER_DAY = 2;

function getServiceType(pack: string): string {
  if (pack.startsWith("Workshop")) return "Workshops";
  if (["Decoração Externa", "Catering / Brunch", "Animação", "Aluguer de Insuflável"].includes(pack)) {
    return "Serviços externos";
  }
  return "Festas no espaço";
}

function computePaymentStatus(totalPrice: number, amountPaid: number): "paid" | "partial" | "unpaid" {
  if (amountPaid >= totalPrice) return "paid";
  if (amountPaid > 0) return "partial";
  return "unpaid";
}

function parseExtras(extras: string | null) {
  if (!extras) return [];
  return extras
    .split(";")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const priceMatch = raw.match(/\+([0-9]+(?:[.,][0-9]+)?)\s*€/);
      const revenue = priceMatch ? Number(priceMatch[1].replace(",", ".")) : 0;
      return {
        name: raw.replace(/\s*\(\+[0-9]+(?:[.,][0-9]+)?\s*€\)/, "").trim(),
        revenue,
      };
    });
}

router.get("/reports", async (req, res): Promise<void> => {
  const now = new Date();
  const yearParam = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
  const monthParam = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;

  const allRows = await db.select().from(reservationsTable);

  const monthlyMap: Record<string, { count: number; revenue: number; paid: number; pending: number; year: number; monthNum: number }> = {};
  const packMap: Record<string, { count: number; revenue: number }> = {};
  const serviceTypeMap: Record<string, { count: number; revenue: number }> = {};
  const paymentStatusMap: Record<string, { count: number; revenue: number; pending: number }> = {};
  const extraMap: Record<string, { count: number; revenue: number }> = {};
  const occupancyByDate: Record<string, number> = {};

  let selectedCount = 0;
  let selectedRevenue = 0;
  let selectedPaid = 0;
  let selectedPending = 0;

  let prevCount = 0;
  let prevRevenue = 0;

  const prevMonth = monthParam === 1 ? 12 : monthParam - 1;
  const prevYear = monthParam === 1 ? yearParam - 1 : yearParam;

  for (const row of allRows) {
    const total = parseFloat(row.totalPrice as unknown as string);
    const paid = parseFloat(row.amountPaid as unknown as string);
    const remaining = Math.max(0, total - paid);
    const serviceType = getServiceType(row.pack);
    const paymentStatus = computePaymentStatus(total, paid);

    const dateParts = row.eventDate.split("-");
    const rowYear = parseInt(dateParts[0]);
    const rowMonth = parseInt(dateParts[1]);

    const key = `${rowYear}-${String(rowMonth).padStart(2, "0")}`;
    if (!monthlyMap[key]) {
      monthlyMap[key] = { count: 0, revenue: 0, paid: 0, pending: 0, year: rowYear, monthNum: rowMonth };
    }
    monthlyMap[key].count++;
    monthlyMap[key].revenue += total;
    monthlyMap[key].paid += paid;
    monthlyMap[key].pending += remaining;

    if (rowYear === yearParam && rowMonth === monthParam) {
      selectedCount++;
      selectedRevenue += total;
      selectedPaid += paid;
      selectedPending += remaining;

      if (!packMap[row.pack]) {
        packMap[row.pack] = { count: 0, revenue: 0 };
      }
      packMap[row.pack].count++;
      packMap[row.pack].revenue += total;

      if (!serviceTypeMap[serviceType]) {
        serviceTypeMap[serviceType] = { count: 0, revenue: 0 };
      }
      serviceTypeMap[serviceType].count++;
      serviceTypeMap[serviceType].revenue += total;

      if (serviceType !== "Serviços externos") {
        occupancyByDate[row.eventDate] = (occupancyByDate[row.eventDate] ?? 0) + 1;
      }

      if (!paymentStatusMap[paymentStatus]) {
        paymentStatusMap[paymentStatus] = { count: 0, revenue: 0, pending: 0 };
      }
      paymentStatusMap[paymentStatus].count++;
      paymentStatusMap[paymentStatus].revenue += total;
      paymentStatusMap[paymentStatus].pending += remaining;

      for (const extra of parseExtras(row.extras)) {
        if (!extraMap[extra.name]) {
          extraMap[extra.name] = { count: 0, revenue: 0 };
        }
        extraMap[extra.name].count++;
        extraMap[extra.name].revenue += extra.revenue;
      }
    }

    if (rowYear === prevYear && rowMonth === prevMonth) {
      prevCount++;
      prevRevenue += total;
    }
  }

  const totalBookings = selectedCount;
  const serviceTypeStats = Object.entries(serviceTypeMap)
    .map(([serviceType, data]) => ({
      serviceType,
      count: data.count,
      percentage: totalBookings > 0 ? Math.round((data.count / totalBookings) * 1000) / 10 : 0,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.count - a.count);

  const packStats = Object.entries(packMap)
    .map(([pack, data]) => ({
      pack,
      count: data.count,
      percentage: totalBookings > 0 ? Math.round((data.count / totalBookings) * 1000) / 10 : 0,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.count - a.count);

  const paymentStatusStats = Object.entries(paymentStatusMap)
    .map(([status, data]) => ({
      status,
      count: data.count,
      percentage: totalBookings > 0 ? Math.round((data.count / totalBookings) * 1000) / 10 : 0,
      revenue: data.revenue,
      pending: data.pending,
    }))
    .sort((a, b) => b.count - a.count);

  const extraStats = Object.entries(extraMap)
    .map(([extra, data]) => ({
      extra,
      count: data.count,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.count - a.count);

  const daysInMonth = new Date(yearParam, monthParam, 0).getDate();
  const usedSlots = Object.values(occupancyByDate).reduce((sum, count) => sum + Math.min(count, MAX_EVENTS_PER_DAY), 0);
  const maxSlots = daysInMonth * MAX_EVENTS_PER_DAY;
  const occupancyStats = {
    bookedDays: Object.keys(occupancyByDate).length,
    fullDays: Object.values(occupancyByDate).filter((count) => count >= MAX_EVENTS_PER_DAY).length,
    usedSlots,
    availableSlots: Math.max(0, maxSlots - usedSlots),
    maxSlots,
    occupancyRate: maxSlots > 0 ? Math.round((usedSlots / maxSlots) * 1000) / 10 : 0,
  };

  const monthlyTrend = Object.entries(monthlyMap)
    .map(([key, data]) => ({
      month: MONTH_NAMES[data.monthNum - 1],
      year: data.year,
      monthNum: data.monthNum,
      reservationCount: data.count,
      revenue: data.revenue,
      paid: data.paid,
      pending: data.pending,
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthNum - b.monthNum;
    });

  let bestMonth = { month: "N/A", revenue: 0 };
  for (const entry of monthlyTrend) {
    if (entry.revenue > bestMonth.revenue) {
      bestMonth = { month: `${entry.month} ${entry.year}`, revenue: entry.revenue };
    }
  }

  const avgRevenuePerBooking = selectedCount > 0 ? Math.round((selectedRevenue / selectedCount) * 100) / 100 : 0;

  const insights: string[] = [];

  if (packStats.length > 0) {
    insights.push(`Pack mais popular: ${packStats[0].pack} (${packStats[0].count} reservas, ${packStats[0].percentage}%)`);
  }

  if (serviceTypeStats.length > 0) {
    insights.push(`Categoria com mais reservas: ${serviceTypeStats[0].serviceType} (${serviceTypeStats[0].count} reservas)`);
  }

  if (selectedPending > 0) {
    insights.push(`Tem €${selectedPending.toFixed(2)} em pagamentos pendentes este mês`);
  }

  if (prevCount > 0 && selectedCount > 0) {
    const diff = selectedCount - prevCount;
    if (diff > 0) {
      insights.push(`Este mês tem mais ${diff} reserva${diff > 1 ? "s" : ""} que o mês anterior`);
    } else if (diff < 0) {
      insights.push(`Este mês tem menos ${Math.abs(diff)} reserva${Math.abs(diff) > 1 ? "s" : ""} que o mês anterior`);
    } else {
      insights.push("Mesmo número de reservas que o mês anterior");
    }
  }

  if (prevRevenue > 0 && selectedRevenue > 0) {
    const revenueChange = ((selectedRevenue - prevRevenue) / prevRevenue) * 100;
    if (revenueChange > 0) {
      insights.push(`Receita aumentou ${revenueChange.toFixed(1)}% em relação ao mês anterior`);
    } else if (revenueChange < 0) {
      insights.push(`Receita diminuiu ${Math.abs(revenueChange).toFixed(1)}% em relação ao mês anterior`);
    }
  }

  if (selectedCount === 0) {
    insights.push("Nenhuma reserva registada para o mês selecionado");
  }

  if (bestMonth.revenue > 0) {
    insights.push(`Melhor mês: ${bestMonth.month} com €${bestMonth.revenue.toFixed(2)} de receita`);
  }

  res.json({
    selectedMonth: {
      reservationCount: selectedCount,
      revenue: selectedRevenue,
      paid: selectedPaid,
      pending: selectedPending,
      avgRevenuePerBooking,
    },
    previousMonth: {
      reservationCount: prevCount,
      revenue: prevRevenue,
    },
    occupancyStats,
    serviceTypeStats,
    paymentStatusStats,
    extraStats,
    packStats,
    monthlyTrend,
    bestMonth,
    insights,
  });
});

export default router;
