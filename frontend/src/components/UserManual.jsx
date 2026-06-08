import React from 'react';

const LINKS = {
  panel: 'https://riogateais.netlify.app',
  telegramGroup: 'https://t.me/+BJ9lJFeVqR00NmEx',
  telegramBot: 'https://t.me/AISgateBot',
};

const linkClass =
  'text-ocean-400 hover:text-ocean-300 underline underline-offset-2 decoration-ocean-500/40';

const SECTIONS = [
  {
    title: 'Visão geral',
    body:
      'O RioAISGate monitora o tráfego de embarcações na Barra da Guanabara em tempo quase real, usando dados AIS. O mapa mostra posições, o painel lateral exibe estatísticas, eventos de entrada/saída da baía e gráficos históricos. O sistema cobre o canal entre o Forte São João (RJ) e o Forte Santa Cruz (Niterói), com buffer de aproximação oceânica.',
  },
  {
    title: 'Início e carregamento',
    body:
      'Ao abrir o painel, uma tela de boas-vindas carrega embarcações, eventos e a conexão em tempo real (mínimo ~15 segundos). Você pode abrir este manual durante o carregamento pelo botão na splash. Após entrar, o mapa sincroniza via WebSocket; se o sinal AIS estiver ativo, as posições atualizam assim que cada embarcação transmite.',
  },
  {
    title: 'Indicador Live / Sem sinal',
    body: 'No canto superior do painel, o ponto colorido indica o estado do feed AIS:',
    items: [
      'Live (verde): feed conectado e recebendo posições.',
      'Sem sinal (âmbar): dentro da janela horária, mas sem conexão com o stream — o servidor tenta reconectar.',
      'Standby (azul): feed pausado fora da janela configurada no servidor (ex.: horário comercial).',
      'API offline (vermelho): backend indisponível — verifique o deploy no Railway.',
    ],
  },
  {
    title: 'Mapa',
    body:
      'Ícones verdes: embarcação dentro da baía. Azuis: fora da baía. Clique em um alvo para ver detalhes (nome, MMSI, velocidade, tipo, bandeira). O menu ☰ no canto superior direito altera a camada base (mapa, satélite, etc.) e a sobreposição OpenSeaMap (boias, faróis, profundidades).',
    items: [
      'Links externos (ex.: alerta Telegram) abrem o mapa já focado na embarcação: ?mmsi=…&lat=…&lon=…',
      'Embarcações sem sinal há mais de ~30 min saem da lista ativa; no navegador podem permanecer em cache por até 2 h.',
    ],
  },
  {
    title: 'Painel lateral',
    body: 'Use as abas no menu à esquerda:',
    items: [
      'Eventos — cruzamentos recentes (ENTRADA / SAÍDA) com horário e posição.',
      'Embarcações — lista de alvos ativos; clique para abrir o detalhe.',
      'Gráficos — tráfego diário, distribuição por hora e tipos de embarcação.',
      'Cartões no topo — totais do dia (entradas, saídas, embarcações únicas, ativas na área).',
    ],
  },
  {
    title: 'Eventos (entrada / saída)',
    body:
      'Quando uma embarcação cruza o limite da baía, o sistema registra ENTRADA ou SAÍDA. Para evitar falsos alarmes na boca da barra, o cruzamento exige duas leituras AIS consecutivas na mesma direção. Eventos iguais do mesmo navio respeitam um intervalo mínimo de ~2 minutos. A aba Eventos lista os cruzamentos recentes; os totais do dia aparecem nos cartões no topo.',
  },
  {
    title: 'Alerta sonoro no navegador',
    body:
      'No painel lateral, o botão Som na barra toca um sinal em toda ENTRADA e SAÍDA confirmada na geofence (ligado por padrão). Tom agudo = entrada; tom grave = saída. Clique uma vez no painel para o navegador liberar o áudio.',
    items: [
      'Som na barra — todos os cruzamentos (preferência salva no navegador).',
      'Por embarcação — no detalhe do navio, alerta só naquele MMSI (entrada, saída ou ambos conforme posição atual).',
      'Fora da baía → vigia individual alerta na ENTRADA; dentro → na SAÍDA.',
    ],
  },
  {
    title: 'Grupo AISGATE (Telegram)',
    body:
      'Grupo privado oficial de alertas do RioAISGate. Aqui chegam as notificações automáticas quando embarcações cruzam a geofence da Barra da Guanabara (ENTRY / EXIT), com link direto para o mapa.',
    links: [
      { label: 'Entrar no grupo (convite privado)', href: LINKS.telegramGroup },
      { label: 'Bot @AISgateBot', href: LINKS.telegramBot },
      { label: 'Painel web', href: LINKS.panel },
    ],
    quote:
      'Alertas automáticos ENTRY/EXIT na Barra da Guanabara — RioAISGate.\n' +
      'Dados AIS em tempo real · Bot @AISgateBot · Mapa: riogateais.netlify.app\n' +
      'TugLife Systems',
    items: [
      'Grupo privado — use o link de convite para entrar.',
      'Broadcast: todos os cruzamentos confirmados são publicados no grupo.',
      'Para vigiar um navio específico, use @AISgateBot com /watch (no grupo ou em chat privado).',
    ],
  },
  {
    title: 'Bot Telegram (@AISgateBot)',
    body:
      'O bot envia alertas formatados (navio, MMSI, horário, velocidade, posição) e aceita comandos no grupo AISGATE ou em chat privado.',
    links: [
      { label: 'Entrar no grupo AISGATE (convite)', href: LINKS.telegramGroup },
      { label: 'Bot @AISgateBot', href: LINKS.telegramBot },
    ],
    items: [
      '/start — ajuda e lista de comandos.',
      '/watch MMSI entry — vigia só entradas desse navio (use exit ou both).',
      '/unwatch MMSI — remove a vigia.',
      '/list — vigias ativas neste chat.',
      '/status — feed AIS, embarcações ativas e se alertas estão silenciados.',
      '/mute [min] — silencia alertas (padrão 30 min; ex.: /mute 120 para 2 h).',
      '/unmute — reativa alertas.',
      'Exemplo: /watch 563051700 both',
    ],
  },
  {
    title: 'Taxa de atualização',
    body:
      'A frequência das posições no mapa depende do transmissor AIS de cada navio (padrão internacional), não do RioAISGate. Em movimento, navios Classe A costumam transmitir a cada poucos segundos; parados ou lentos, a cada alguns minutos. O painel recebe cada transmissão em tempo real via WebSocket. A lista REST é atualizada a cada ~45 s como reforço.',
  },
  {
    title: 'Dados e retenção',
    body:
      'O mapa usa dados ao vivo em memória no servidor. O banco PostgreSQL guarda metadados das embarcações e eventos de cruzamento por cerca de 7 dias. Trilhas brutas de posição (histórico minuto a minuto) ficam desligadas por padrão — o mapa e os alertas não dependem delas. Backups mensais em arquivo (.jsonl) podem ser feitos pelo operador conforme a documentação do projeto.',
  },
  {
    title: 'Suporte',
    body: 'Desenvolvido por Jossian Brito · TugLife Systems. Entre no grupo privado AISGATE para alertas coletivos ou use o bot para vigias individuais.',
    links: [
      { label: 'Painel web', href: LINKS.panel },
      { label: 'Grupo AISGATE (convite)', href: LINKS.telegramGroup },
      { label: 'Bot @AISgateBot', href: LINKS.telegramBot },
    ],
  },
];

export default function UserManual({ onClose }) {
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-navy-900 text-white">
      <header className="flex items-center justify-between px-5 py-4 border-b border-navy-700 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-ocean-400 tracking-wide">Manual do usuário</h1>
          <p className="text-xs text-white/45 mt-0.5">RioAISGate · TugLife Systems · jun/2026</p>
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
            {s.links?.length > 0 && (
              <p className="mt-2 text-sm leading-relaxed flex flex-wrap gap-x-3 gap-y-1">
                {s.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {link.label}
                  </a>
                ))}
              </p>
            )}
            {s.quote && (
              <pre className="mt-3 p-3 rounded-lg bg-navy-800/80 border border-navy-600/60 text-xs text-white/60 whitespace-pre-wrap leading-relaxed font-sans">
                {s.quote}
              </pre>
            )}
            {s.items?.length > 0 && (
              <ul className="mt-2 space-y-1.5 text-sm text-white/65 leading-relaxed list-disc list-inside marker:text-ocean-500/80">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
