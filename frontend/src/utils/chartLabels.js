/** dd/mm/aaaa (pt-BR) */
export function formatChartDate(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Título e legenda do gráfico diário quando há menos dias no banco que o período pedido.
 */
export function getDailyTrafficLabels(meta, rowCount = 0) {
  const requested = meta?.daysRequested ?? 7;
  const daysWithData = meta?.daysWithData ?? rowCount;
  const sinceLabel = formatChartDate(meta?.dataSince);

  if (!sinceLabel && daysWithData === 0) {
    return { title: `Tráfego últimos ${requested} dias`, subtitle: null };
  }

  if (daysWithData >= requested) {
    return { title: `Tráfego últimos ${requested} dias`, subtitle: null };
  }

  const dayWord = daysWithData === 1 ? 'dia' : 'dias';
  return {
    title: 'Tráfego por dia',
    subtitle: `Dados desde ${sinceLabel} (${daysWithData} ${dayWord} com registros no banco)`,
  };
}
