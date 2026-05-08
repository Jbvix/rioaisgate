# RioAISGate — Monitor de Tráfego de Embarcações

Sistema de monitoramento em tempo real da entrada e saída de embarcações pela **Barra da Guanabara**, Rio de Janeiro.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite + Leaflet + OpenSeaMap + TailwindCSS |
| Backend | Node.js + Express + WebSocket |
| Dados AIS | [AISSTREAM.IO](https://aisstream.io) |
| Banco de dados | PostgreSQL |
| Deploy frontend | Netlify |
| Deploy backend | Railway |

## Arquitetura

```
AISSTREAM.IO (WebSocket)
       │
       ▼
  Backend (Railway)
  ├── Geofence Engine  ← detecta cruzamento da Barra
  ├── REST API         ← histórico e estatísticas
  └── WebSocket        ← push de eventos em tempo real
       │
       ▼
  Frontend (Netlify)
  ├── Mapa OpenSeaMap  ← posições das embarcações
  ├── Dashboard KPIs   ← entradas/saídas, tipos, tendências
  └── Log de eventos   ← histórico de cruzamentos
```

## Geofence — Barra da Guanabara

A zona de monitoramento cobre o canal de acesso à Baía de Guanabara entre o Forte São João (RJ) e o Forte Santa Cruz (Niterói), com um buffer de aproximação oceânica.

## Configuração

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm start
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Variáveis de Ambiente

### Backend (`.env`)

```
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/rioaisgate
AISSTREAM_API_KEY=sua_chave_aisstream
FRONTEND_URL=https://seu-app.netlify.app,http://localhost:5173
AIS_FEED_TIMEZONE=America/Sao_Paulo
# START e END iguais (ex.: 0 e 0) = feed AIS 24h. Para limitar ao horário comercial use 8 e 18.
AIS_FEED_START_HOUR=0
AIS_FEED_END_HOUR=0
LOG_LEVEL=info
```

No **Railway**, use os mesmos nomes no painel **Variables**. Se o projeto já tinha `AIS_FEED_START_HOUR=8` e `AIS_FEED_END_HOUR=18`, atualize ambos para **`0`** (horários iguais = AIS 24h) ou remova essas duas variáveis para aplicar o novo padrão do código após o deploy.

### Frontend (`.env`)

```
VITE_API_URL=https://seu-backend.railway.app
VITE_WS_URL=wss://seu-backend.railway.app
```

## Modelo de Gestão Estratégica

O sistema gera indicadores para tomada de decisão:

- **Fluxo diário** de embarcações por tipo (carga, tanque, passageiros, pesca)
- **Horários de pico** para otimização de praticagem e rebocadores
- **Tempo médio de trânsito** pela barra
- **Anomalias**: velocidade excessiva, ancoragem prolongada na zona de aproximação
- **Tendências semanais/mensais** para planejamento portuário
