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

## Telegram — Grupo AISGATE

| Recurso | Link |
|---|---|
| Painel web | [riogateais.netlify.app](https://riogateais.netlify.app) |
| Grupo AISGATE (convite privado) | [t.me/+BJ9lJFeVqR00NmEx](https://t.me/+BJ9lJFeVqR00NmEx) |
| Bot | [@AISgateBot](https://t.me/AISgateBot) |

Grupo privado de alertas operacionais: notificações automáticas quando embarcações cruzam a geofence (**ENTRY** / **EXIT**), com deep link para o mapa.

**Descrição sugerida do grupo (campo Descrição no Telegram):**

```
Alertas automáticos ENTRY/EXIT na Barra da Guanabara — RioAISGate.
Dados AIS em tempo real · Bot @AISgateBot · Mapa: riogateais.netlify.app
TugLife Systems
```

**Mensagem fixada sugerida:**

```
⚓ Bem-vindo ao AISGATE

Aqui chegam os alertas automáticos do RioAISGate quando navios cruzam a Barra da Guanabara (ENTRY / EXIT).

🗺 Painel: https://riogateais.netlify.app
🤖 Bot: @AISgateBot
   /watch 710123456 both — vigia um navio
   /list · /status · /mute · /unmute

Grupo privado · uso operacional · TugLife Systems
```

Comandos do bot: `/start`, `/watch`, `/unwatch`, `/list`, `/status`, `/mute`, `/unmute`. Detalhes em `docs/TELEGRAM-BOT-SPRINTS.md` e no manual do usuário (splash → **Manual do usuário**).

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
# Feed AIS sempre ativo 24h; não há janela de pausa.
LOG_LEVEL=info
# Telegram (alertas ENTRY/EXIT)
TELEGRAM_ALERTS_ENABLED=true
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_POLLING=true
TELEGRAM_BROADCAST=true
TELEGRAM_CHAT_IDS=
```

No **Railway**, configure `AISSTREAM_API_KEY` no backend. O feed opera 24h e ignora as antigas variáveis `AIS_FEED_START_HOUR` e `AIS_FEED_END_HOUR`. `AIS_FEED_TIMEZONE` continua definindo o fuso das mensagens Telegram. O feed pode ser pausado ou reativado no botão **Controle AIS**, com um PIN de 6 a 12 dígitos configurado somente no backend em `AIS_CONTROL_PIN`. `AIS_ADMIN_TOKEN` não é usado.

O cliente AIS reconecta após quedas, limita a espera de conexão a 30 segundos e verifica conexões sem resposta com ping/pong. Os arquivos Railway usam reinício `ALWAYS`. Na hospedagem, desative **Serverless/App Sleeping**, quando disponível, e use recursos/plano que mantenham o serviço em execução. O código não impede indisponibilidade do provedor, da rede ou da hospedagem. Essas mudanças só chegam à produção após deploy.

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

## Segurança e verificações de desenvolvimento

- O feed AIS inicia ativo 24h, sem janela de horário. **Controle AIS** abre um painel para pausar/reativar mediante PIN. A alteração afeta todos os usuários, mas mantém painel e histórico disponíveis. A pausa é temporária em memória: reiniciar o backend volta a ativar o feed.
- Configure `AIS_CONTROL_PIN` com 6 a 12 dígitos aleatórios em Railway → serviço backend → Variables. Use preferencialmente 12 dígitos, guarde com segurança e nunca coloque em `VITE_*`, Git ou logs. O navegador não armazena o PIN; cada comando exige nova digitação. Não há PIN padrão.
- `POST /api/aisstream/toggle` recebe `{ "enabled": false }` (pausar) ou `true` (reativar), com cabeçalho `X-AIS-Control-PIN`. Use HTTPS fora do desenvolvimento local. PIN incorreto retorna 401; controle não configurado retorna 503; após cinco falhas por endereço em 15 minutos retorna 429. O limite fica em memória por instância; múltiplas réplicas exigem um limitador compartilhado para manter o mesmo limite global. Atrás de proxy, endereços podem compartilhar o limite; não se confia em `X-Forwarded-For` arbitrário.
- PostgreSQL externo usa TLS com validação de certificado e hostname. Se necessário, configure `PGSSLROOTCERT` com o caminho de uma CA confiável. `sslmode=require` não desativa a validação. URLs com certificados de cliente (`sslcert`/`sslkey`) são rejeitadas explicitamente; não se reduz a verificação para contornar falhas. Conexões locais e Railway privado mantêm o transporte local/interno existente; `sslmode=disable` é uma opção explícita apenas para redes confiáveis.
- `/api/health/live` indica que o processo responde. `/api/health` é prontidão: retorna 503 e `ok:false` quando o banco está indisponível. Ajuste monitores conforme a finalidade; falha no feed AIS é reportada separadamente.
- `limit` e `days` devem ser inteiros positivos dentro do limite de cada rota; valores fora do intervalo retornam 400.

```bash
npm test --prefix backend
npm test --prefix frontend
npm run build --prefix frontend
```

Os testes usam dados simulados e não enviam mensagens Telegram. A interface abre após as consultas iniciais, com prazo de 8 segundos por requisição, sem espera artificial. Ela diferencia falha de consulta e ausência de dados, informa cache de posições e oferece nova tentativa. Os gráficos carregam sob demanda.

Retenção e recuperação: consulte [backups/README.md](backups/README.md). Não houve alteração automática de credenciais, retenção configurada ou serviços de produção.

### Layout responsivo

O painel abre como gaveta em celular/tablet (abaixo de 1024 px) e permanece ao lado do mapa em desktop. A largura se adapta à tela; telas baixas e modo paisagem usam rolagem do painel inteiro para manter detalhes e abas acessíveis. Controles do painel têm área mínima de toque de 44 px. Gráficos se ajustam ao espaço disponível e o mapa recalcula seu tamanho ao mudar de orientação ou breakpoint. As margens consideram áreas seguras do dispositivo.

Validação local com dados simulados: 320×568, 360×640, 390×844, 568×320, 844×390, 768×1024, 1024×768, 1280×800, 1440×900 e 640×450; navegação entre abas, detalhes com nome longo, gráficos e menu de camadas, sem rolagem horizontal. Tiles cartográficos externos não fazem parte dessa validação.
