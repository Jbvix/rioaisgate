/** Data dd/mm/aa + hora (fuso do navegador) */
export function formatOccurredAt(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${date} ${time}`;
}
