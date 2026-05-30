# Backup mensal — passo a passo (RioAISGate)

## O que fica onde

| O quê | Onde | Por quanto tempo |
|-------|------|------------------|
| Mapa ao vivo | Memória do backend | ~30 minutos |
| Eventos / estatísticas no app | Postgres `vessel_events` | **7 dias** (automático) |
| Posições AIS brutas | Postgres `vessel_positions` | **24 h** (1 gravação / 5 min por navio; mapa ao vivo não depende disso) |
| **Arquivo para guardar** | Pasta `backups/` no seu PC | **Você define** (OneDrive, etc.) |

Histórico longo = **backup mensal** em arquivo, não deixar tudo no banco.

---

## Passo a passo (primeira vez)

### 1. Abrir a conexão no Railway

1. Acesse [railway.app](https://railway.app) → projeto **rioaisgate**.
2. Clique no serviço **Postgres** (elefante).
3. Aba **Database** ou botão **Connect**.
4. Escolha **Public Network** (rede pública — funciona do seu PC).
5. Em **Variables** (do Postgres), copie **`DATABASE_URL`** inteira  
   — ou monte com **show** na senha do modal:
   - Host: `shuttle.proxy.rlwy.net`
   - Porta: `18529`
   - Usuário: `postgres`
   - Banco: `railway`

   Formato:

   ```text
   postgresql://postgres:SENHA@shuttle.proxy.rlwy.net:18529/railway
   ```

   **Não compartilhe essa URL** (tem senha).

### 2. Criar o arquivo `.env` no backend

1. No projeto, pasta: `rioaisgate\backend\`
2. Crie o arquivo **`backend\.env`** (se não existir).
3. Cole uma linha só:

   ```env
   DATABASE_URL=postgresql://postgres:SUA_SENHA@shuttle.proxy.rlwy.net:18529/railway
   ```

   Troque `SUA_SENHA` pela senha real (ou cole a `DATABASE_URL` copiada do Railway).

4. Salve. Esse arquivo **não vai para o Git** (já está no `.gitignore`).

### 3. Rodar o backup

No PowerShell:

```powershell
cd "c:\Users\jossi\OneDrive\Anexos\Documentos\Repository TugLife\rioaisgate\backend"
npm run backup
```

Aguarde mensagens como:

```text
[BACKUP] Contagem: vessels=… events=… positions=…
[BACKUP] Concluído com sucesso.
```

### 4. Onde ficam os arquivos

Pasta criada automaticamente, por exemplo:

```text
rioaisgate\backups\rioaisgate-2026-05-30T14-30-00\
  manifest.json          ← resumo (quantidades, data)
  vessels.jsonl          ← navios
  vessel_events.jsonl    ← entradas/saídas
  vessel_positions.jsonl ← posições (últimas 24h no banco)
```

### 5. Guardar cópia segura

1. Copie a pasta `rioaisgate-2026-05-30T…` inteira para:
   - OneDrive / Anexos, ou
   - Disco externo.
2. Opcional: renomeie para `backup-rioaisgate-2026-05`.

Nome fixo (opcional):

```powershell
node src/db/backup.js --out=../backups/backup-2026-05
```

---

## Todo mês (rotina)

| Quando | O que fazer |
|--------|-------------|
| **1× por mês** (ex.: dia 1) | Repetir passos 3–5: `npm run backup` + copiar pasta para OneDrive |
| Automático | Backend apaga eventos com mais de **30 dias** no Postgres |
| Opcional | Railway → Postgres → **Backups** (snapshot da plataforma) |

Coloque um lembrete no calendário: *“Backup RioAISGate”*.

---

## Reduzir `vessel_positions` no Railway (muitas páginas)

É a **mesma** base Postgres, tabela `vessel_positions` (trilhas AIS). Muitas páginas no painel = muitas linhas (~10 por página).

Limpeza imediata no **Postgres → Data → Query**:

```sql
-- Ver volume
SELECT COUNT(*) FROM vessel_positions;

-- Apagar trilhas com mais de 24 h (retenção padrão)
DELETE FROM vessel_positions WHERE recorded_at < NOW() - INTERVAL '24 hours';

-- Opcional: apagar pico antigo (ajuste o horário UTC do pico)
-- DELETE FROM vessel_positions WHERE recorded_at < '2026-05-30 02:00:00+00';
```

Depois do deploy com `AIS_POSITION_PERSIST_MINUTES=5`, o crescimento fica bem menor.

## Problemas comuns

| Erro | Solução |
|------|---------|
| `DATABASE_URL is not configured` | Falta o arquivo `backend\.env` ou a linha está errada |
| `password authentication failed` | Senha errada — copie de novo em Railway → Variables |
| `ETIMEDOUT` / timeout | Teste **Public Network**; firewall/VPN pode bloquear |
| Pasta `backups` vazia | Veja se apareceu `[BACKUP] Concluído` sem erro antes |

---

## Comandos úteis

```powershell
cd backend
npm run backup    # exportar tudo
npm run prune     # limpar no banco (só se quiser forçar agora)
```

Variáveis no Railway (serviço **backend**, opcional):

```env
EVENT_RETENTION_DAYS=30
POSITION_RETENTION_HOURS=24
```
