import React, { useEffect, useRef, useState } from 'react';
import { API_URL } from '../config';
import { requestJson } from '../utils/request.mjs';

export default function AisControl({ feedStatus, onChanged }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(feedStatus);
  const input = useRef(null);
  useEffect(() => { setStatus(feedStatus); }, [feedStatus]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  const paused = status?.manual_enabled === false;
  const unavailable = !status || status.api_unreachable;
  function togglePanel() { setOpen((value) => !value); setPin(''); setMessage(''); }
  async function submit(event) {
    event.preventDefault();
    if (busy || unavailable) return;
    setBusy(true); setMessage('');
    const submittedPin = pin;
    setPin('');
    try {
      const result = await requestJson(`${API_URL}/api/aisstream/toggle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AIS-Control-PIN': submittedPin },
        body: JSON.stringify({ enabled: paused }),
      });
      setStatus(result);
      setMessage(paused ? 'AIS reativado. A conexão será restabelecida automaticamente.' : 'AIS pausado para todos os usuários.');
      onChanged?.();
    } catch (error) {
      setMessage(error.status === 401 ? 'PIN incorreto. Confira e tente novamente.' : error.status === 429 ? 'Limite de tentativas atingido. Aguarde 15 minutos.' : error.status === 503 ? 'Controle indisponível. Verifique a configuração do PIN e da chave AIS no backend.' : 'Não foi possível confirmar a alteração. Confira o estado do feed antes de tentar novamente.');
      onChanged?.();
    } finally { setBusy(false); }
  }
  return (
    <section className="mx-3 mt-3 rounded-xl border border-navy-600 bg-navy-800/60">
      <button type="button" className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-white" aria-expanded={open} aria-controls="ais-control-panel" onClick={togglePanel} disabled={busy}>
        <span>Controle AIS</span><span className="text-xs text-white/65">{open ? 'Fechar −' : 'PIN +'}</span>
      </button>
      {open && <form id="ais-control-panel" onSubmit={submit} className="border-t border-navy-600 p-3 flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-white/75">{paused ? 'Feed pausado. Digite o PIN para reativar.' : 'Pausar interrompe o recebimento de novas posições e eventos para todos os usuários. O painel e o histórico continuam disponíveis.'}</p>
        <p className="text-xs text-white/60">Ao reiniciar o servidor, o AIS volta a ligar automaticamente.</p>
        <label htmlFor="ais-control-pin" className="text-sm text-white">PIN de controle</label>
        <input ref={input} id="ais-control-pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} disabled={busy} className="min-h-11 w-full min-w-0 rounded-lg border border-navy-600 bg-navy-900 px-3 text-base text-white" aria-describedby="ais-pin-help" />
        <p id="ais-pin-help" className="text-xs text-white/60">De 6 a 12 dígitos. O PIN é exigido a cada alteração.</p>
        <button type="submit" disabled={busy || unavailable} className={`rounded-lg px-3 py-2 text-sm font-semibold ${paused ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'}`}>{busy ? 'Aplicando…' : paused ? 'Ligar AIS com PIN' : 'Desligar AIS com PIN'}</button>
        {unavailable && <p className="text-xs text-amber-300">Aguarde a conexão com o servidor para usar o controle.</p>}
        {message && <p role="status" aria-live="polite" className="text-xs leading-relaxed text-amber-200">{message}</p>}
      </form>}
    </section>
  );
}
