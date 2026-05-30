import React from 'react';

const SECTIONS = [
  {
    title: 'Visão geral',
    body:
      'O RioAISGate monitora o tráfego de embarcações na Barra da Guanabara em tempo quase real, usando dados AIS. O mapa mostra posições, o painel lateral exibe estatísticas, eventos de entrada/saída da baía e gráficos históricos.',
  },
  {
    title: 'Indicador Live / Sem sinal',
    body:
      'Live (verde): feed AIS conectado e posições atualizando. Sem sinal: dentro da janela horária, mas sem conexão com o stream. API offline: backend indisponível. Standby: feed pausado fora da janela configurada no servidor.',
  },
  {
    title: 'Mapa',
    body:
      'Ícones verdes: embarcação dentro da baía. Azuis: fora da baía. Clique em um alvo para ver detalhes (MMSI, velocidade, tipo). O menu ☰ no canto superior direito altera a camada base (OSM, satélite, etc.) e a sobreposição OpenSeaMap.',
  },
  {
    title: 'Eventos (entrada / saída)',
    body:
      'Quando uma embarcação cruza o limite da baía, o sistema registra ENTRADA ou SAÍDA. A aba Eventos lista os cruzamentos recentes. Os totais do dia aparecem nos cartões no topo do painel.',
  },
  {
    title: 'Alerta por embarcação',
    body:
      'No detalhe de uma embarcação, ative o alerta de geofence para receber um som quando ela entrar ou sair da baía (conforme a posição atual: alerta na saída se estiver dentro, e na entrada se estiver fora).',
  },
  {
    title: 'Gráficos',
    body:
      'A aba Gráficos mostra tráfego diário (últimos 7 dias quando houver dados), distribuição por hora e tipos de embarcação. Se o banco tiver menos de 7 dias de histórico, aparece a legenda “Dados desde DD/MM/AAAA”.',
  },
  {
    title: 'Dados e retenção',
    body:
      'O mapa usa dados ao vivo em memória. O banco guarda eventos por cerca de 7 dias e posições brutas por 24 horas. Backups mensais em arquivo (.jsonl) podem ser feitos pelo operador conforme documentação do projeto.',
  },
];

export default function UserManual({ onClose }) {
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-navy-900 text-white">
      <header className="flex items-center justify-between px-5 py-4 border-b border-navy-700 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-ocean-400 tracking-wide">Manual do usuário</h1>
          <p className="text-xs text-white/45 mt-0.5">RioAISGate · TugLife Systems</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-ocean-600 hover:bg-ocean-500 text-sm font-medium transition-colors"
        >
          Voltar
        </button>
      </header>

      <div className="flex-1 overflow-y-auto dark-scroll px-5 py-6 max-w-2xl mx-auto w-full">
        {SECTIONS.map((s) => (
          <section key={s.title} className="mb-8 last:mb-0">
            <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ocean-400" />
              {s.title}
            </h2>
            <p className="text-sm text-white/70 leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
