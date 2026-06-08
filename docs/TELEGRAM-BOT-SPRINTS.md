# Bot Telegram — plano de SPRINTS (RioAISGate)

Alertas automáticos quando uma embarcação cruza a geofence da Baía de Guanabara (**ENTRY** / **EXIT**).

---

## Visão geral

| Sprint | Objetivo | Status |
|--------|----------|--------|
| **S1** | Broadcast fixo — todos os eventos para `TELEGRAM_CHAT_IDS` | Concluído |
| **S2** | Assinaturas no Postgres + bot `/watch` / `/unwatch` por MMSI | Concluído |
| **S3** | Link mapa, `/mute`, rate limit, painel admin opcional | Pendente |
| **S4** | E-mail paralelo (mesma interface `notifications/`) | Pendente |

Integração única: após `recordEvent` confirmado em `vesselTracker.js` → `notifyGeofenceEvent()`.

---

## Sprint 1 — Broadcast fixo (MVP)

### Entregáveis

- [x] `backend/src/notifications/telegram.js` — envio via API HTTP
- [x] `backend/src/notifications/index.js` — roteador
- [x] Hook em `recordEventAsync`
- [x] Variáveis em `.env.example`
- [x] `npm run telegram:test` — mensagem de teste
- [x] `npm run telegram:chat-id` — descobrir `chat_id`

### Configuração (Railway / `.env`)

```env
TELEGRAM_ALERTS_ENABLED=true
TELEGRAM_BOT_TOKEN=123456789:AAF...
TELEGRAM_CHAT_IDS=-1001234567890
AIS_FEED_TIMEZONE=America/Sao_Paulo
FRONTEND_URL=https://riogateais.netlify.app
```

### Passo a passo BotFather

1. Telegram → [@BotFather](https://t.me/BotFather) → `/newbot` → copiar **token**.
2. Criar grupo → adicionar o bot → tornar **administrador** (enviar mensagens).
3. Enviar uma mensagem qualquer no grupo.
4. Local: `cd backend && npm run telegram:chat-id` (com `TELEGRAM_BOT_TOKEN` no `.env`).
5. Copiar `chat_id` para `TELEGRAM_CHAT_IDS`.
6. `npm run telegram:test` → deve aparecer mensagem no grupo.
7. Deploy Railway com as variáveis → aguardar ENTRY/EXIT real ou simular.

### Critério de aceite S1

- [ ] Mensagem de teste chega no grupo
- [ ] Log `[EVENT]` no backend seguido de `[TELEGRAM] sent` (ou warn se desligado)
- [ ] Falha de rede Telegram **não** derruba o processo AIS

---

## Sprint 2 — Watch por embarcação

### Entregáveis

- [x] Tabela `telegram_subscriptions` (migrate)
- [x] `telegramBot.js` — polling de comandos
- [x] `/start`, `/watch`, `/unwatch`, `/list`, `/status`
- [x] Notificar chats inscritos no MMSI + filtro ENTRY/EXIT
- [x] `TELEGRAM_BROADCAST=false` → apenas assinaturas; `true` → broadcast + assinaturas

### Configuração S2

```env
TELEGRAM_ALERTS_ENABLED=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_POLLING=true
TELEGRAM_BROADCAST=false
```

No Telegram (chat privado com o bot ou grupo): `/watch 710123456 entry`

### Critério de aceite S2

- [ ] `/watch 710123456 entry` → só ENTRY desse MMSI para aquele chat
- [ ] Com `TELEGRAM_BROADCAST=false`, chat sem `/watch` não recebe eventos

---

## Sprint 3 — Refinamento

- Deep link `FRONTEND_URL/?mmsi=…`
- `/mute 30m`, rate limit por chat
- Documentação operacional

---

## Sprint 4 — E-mail

- `notifications/email.js` + Resend/SES
- Mesmo hook `notifyGeofenceEvent`

---

*Atualizar a coluna Status ao concluir cada sprint.*
