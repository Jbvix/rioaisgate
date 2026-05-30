import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { API_URL } from '../config';
import { getDailyTrafficLabels } from '../utils/chartLabels';

const DAILY_DAYS = 7;

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, ArcElement
);

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: '#64748b' }, grid: { color: '#1d3a6e33' } },
    y: { ticks: { color: '#64748b' }, grid: { color: '#1d3a6e33' }, beginAtZero: true },
  },
};

const TYPE_COLORS = [
  '#0ea5e9','#22c55e','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#6366f1',
];

const SHIP_TYPE_LABELS = {
  null: 'Desconhecido', 20: 'WIG', 30: 'Pesca', 31: 'Pesca',
  32: 'Pesca', 33: 'Pesca', 34: 'Pesca', 35: 'Pesca',
  36: 'Pesca', 37: 'Pesca', 40: 'Alta Vel.', 50: 'Prático',
  51: 'SAR', 52: 'Rebocador', 53: 'Abastecedor', 55: 'Fiscalização',
  60: 'Passageiros', 61: 'Passageiros', 62: 'Passageiros', 63: 'Passageiros',
  64: 'Passageiros', 70: 'Carga', 71: 'Carga', 72: 'Carga',
  73: 'Carga', 74: 'Carga', 80: 'Tanque', 81: 'Tanque',
  82: 'Tanque', 83: 'Tanque', 84: 'Tanque', 90: 'Outros',
};

export default function Charts() {
  const [daily, setDaily] = useState([]);
  const [dailyMeta, setDailyMeta] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [shipTypes, setShipTypes] = useState([]);
  const [tab, setTab] = useState('daily');

  useEffect(() => {
    fetch(`${API_URL}/api/stats/daily?days=${DAILY_DAYS}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const dayKeys = [...new Set(data.map((r) => r.day?.split('T')[0]).filter(Boolean))].sort();
          setDaily(data);
          setDailyMeta({
            daysRequested: DAILY_DAYS,
            daysWithData: dayKeys.length,
            dataSince: dayKeys[0] ? `${dayKeys[0]}T12:00:00.000Z` : null,
          });
          return;
        }
        setDaily(data.rows || []);
        setDailyMeta(data.meta || null);
      })
      .catch(() => {});
    fetch(`${API_URL}/api/stats/hourly`).then(r => r.json()).then(setHourly).catch(() => {});
    fetch(`${API_URL}/api/stats/ship-types`).then(r => r.json()).then(setShipTypes).catch(() => {});
  }, []);

  const dailyChart = buildDailyChart(daily);
  const dailyLabels = getDailyTrafficLabels(dailyMeta, dailyChart?.labels?.length ?? 0);
  const hourlyChart = buildHourlyChart(hourly);
  const typeChart = buildTypeChart(shipTypes);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex gap-2 px-4 pt-3">
        {['daily', 'hourly', 'types'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1 rounded-full transition-all ${
              tab === t ? 'bg-ocean-600 text-white' : 'bg-navy-700 text-white/50 hover:text-white'
            }`}
          >
            {{ daily: 'Diário', hourly: 'Por hora', types: 'Tipos' }[t]}
          </button>
        ))}
      </div>
      <div className="flex-1 px-4 pb-4 min-h-0">
        {tab === 'daily' && dailyChart && (
          <div className="flex flex-col h-full min-h-0 gap-1">
            {dailyLabels.subtitle && (
              <p className="text-[11px] text-white/45 text-center shrink-0">{dailyLabels.subtitle}</p>
            )}
            <div className="flex-1 min-h-0">
              <Bar
                data={dailyChart}
                options={{
                  ...CHART_OPTS,
                  plugins: {
                    ...CHART_OPTS.plugins,
                    title: {
                      display: true,
                      text: dailyLabels.title,
                      color: '#94a3b8',
                      font: { size: 12 },
                    },
                  },
                }}
              />
            </div>
          </div>
        )}
        {tab === 'hourly' && hourlyChart && (
          <Bar data={hourlyChart} options={{ ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, title: { display: true, text: 'Distribuição por hora (30 dias)', color: '#94a3b8' } } }} />
        )}
        {tab === 'types' && typeChart && (
          <div className="flex items-center justify-center h-full">
            <div style={{ width: '240px', height: '240px' }}>
              <Doughnut data={typeChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 } } } } }} />
            </div>
          </div>
        )}
        {!daily.length && !hourly.length && !shipTypes.length && (
          <div className="flex items-center justify-center h-full text-white/30 text-sm">
            Dados históricos aparecerão aqui
          </div>
        )}
      </div>
    </div>
  );
}

function buildDailyChart(rows) {
  if (!rows.length) return null;
  const days = [...new Set(rows.map(r => r.day?.split('T')[0]))].sort();
  return {
    labels: days.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })),
    datasets: [
      {
        label: 'Entradas',
        data: days.map(d => rows.find(r => r.day?.startsWith(d) && r.event_type === 'ENTRY')?.count ?? 0),
        backgroundColor: '#22c55e99',
        borderColor: '#22c55e',
        borderWidth: 1,
      },
      {
        label: 'Saídas',
        data: days.map(d => rows.find(r => r.day?.startsWith(d) && r.event_type === 'EXIT')?.count ?? 0),
        backgroundColor: '#ef444499',
        borderColor: '#ef4444',
        borderWidth: 1,
      },
    ],
  };
}

function buildHourlyChart(rows) {
  if (!rows.length) return null;
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return {
    labels: hours.map(h => `${String(h).padStart(2, '0')}h`),
    datasets: [
      {
        label: 'Entradas',
        data: hours.map(h => rows.find(r => Number(r.hour) === h && r.event_type === 'ENTRY')?.count ?? 0),
        backgroundColor: '#22c55e99',
        borderColor: '#22c55e',
        borderWidth: 1,
      },
      {
        label: 'Saídas',
        data: hours.map(h => rows.find(r => Number(r.hour) === h && r.event_type === 'EXIT')?.count ?? 0),
        backgroundColor: '#ef444499',
        borderColor: '#ef4444',
        borderWidth: 1,
      },
    ],
  };
}

function buildTypeChart(rows) {
  if (!rows.length) return null;
  const grouped = {};
  rows.forEach(r => {
    const label = r.ship_type_label || SHIP_TYPE_LABELS[r.ship_type] || 'Desconhecido';
    grouped[label] = (grouped[label] || 0) + Number(r.count);
  });
  const labels = Object.keys(grouped);
  return {
    labels,
    datasets: [{
      data: labels.map(l => grouped[l]),
      backgroundColor: labels.map((_, i) => TYPE_COLORS[i % TYPE_COLORS.length] + 'cc'),
      borderColor: labels.map((_, i) => TYPE_COLORS[i % TYPE_COLORS.length]),
      borderWidth: 1,
    }],
  };
}
