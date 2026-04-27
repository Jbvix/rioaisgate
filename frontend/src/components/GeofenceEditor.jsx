import React, { useEffect, useMemo, useState } from 'react';

function formatPolygonForCode(points) {
  return `const GUANABARA_BAY_POLYGON = ${JSON.stringify(points, null, 2)};`;
}

export default function GeofenceEditor({
  polygon,
  defaultPolygon,
  onChange,
  onSave,
  onClose,
}) {
  const [rawValue, setRawValue] = useState(JSON.stringify(polygon, null, 2));
  const [message, setMessage] = useState('');
  const formattedCode = useMemo(() => formatPolygonForCode(polygon), [polygon]);

  useEffect(() => {
    setRawValue(JSON.stringify(polygon, null, 2));
  }, [polygon]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(formattedCode);
      setMessage('Coordenadas copiadas.');
    } catch {
      setMessage('Nao foi possivel copiar automaticamente.');
    }
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed) || parsed.length < 3) {
        setMessage('O poligono precisa ter no minimo 3 pontos.');
        return;
      }
      const normalized = parsed.map((p) => [Number(p[0]), Number(p[1])]);
      if (normalized.some((p) => Number.isNaN(p[0]) || Number.isNaN(p[1]))) {
        setMessage('Todos os pontos precisam ser [lat, lon] numericos.');
        return;
      }
      onChange(normalized);
      setMessage('Poligono atualizado.');
    } catch {
      setMessage('JSON invalido.');
    }
  }

  function resetPolygon() {
    onChange(defaultPolygon);
    setRawValue(JSON.stringify(defaultPolygon, null, 2));
    setMessage('Poligono resetado para o padrao.');
  }

  function savePolygon() {
    const ok = onSave?.(polygon);
    if (ok === false) {
      setMessage('Falha ao salvar geofence.');
      return;
    }
    setMessage('Geofence salva com sucesso.');
  }

  return (
    <div className="h-full w-full overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Editor de Geofence</h3>
        <button className="text-xs text-white/60 hover:text-white" onClick={onClose}>
          Fechar
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-white/60">
        Clique no mapa para adicionar pontos, arraste os pontos vermelhos e use duplo clique para remover.
      </p>

      <div className="mt-2 text-xs text-white/80">Pontos: {polygon.length}</div>

      <textarea
        className="mt-2 h-48 w-full rounded-md border border-navy-600 bg-navy-900 p-2 font-mono text-[11px] text-white/90 focus:outline-none"
        value={rawValue}
        onChange={(e) => setRawValue(e.target.value)}
      />

      <div className="mt-2 flex gap-2">
        <button className="rounded bg-ocean-500 px-2 py-1 text-xs text-white hover:bg-ocean-400" onClick={applyJson}>
          Aplicar JSON
        </button>
        <button className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500" onClick={savePolygon}>
          Salvar
        </button>
        <button className="rounded bg-navy-600 px-2 py-1 text-xs text-white hover:bg-navy-500" onClick={copyCode}>
          Copiar para backend
        </button>
        <button className="rounded bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-500" onClick={resetPolygon}>
          Resetar
        </button>
      </div>

      {message && <div className="mt-2 text-[11px] text-emerald-300">{message}</div>}
    </div>
  );
}
