# Retenção, backup e recuperação

## Política de dados

| Dados | Padrão |
|---|---|
| Embarcações ativas no backend | Última atualização há até 30 minutos |
| Cache de posições no navegador | Até 2 horas; não comprova posição atual |
| Eventos de entrada/saída | 7 dias (`EVENT_RETENTION_DAYS`) |
| Posições brutas, se `AIS_SAVE_POSITIONS=true` | 6 horas e teto de 8.000 linhas |
| Assinaturas Telegram | Persistentes no PostgreSQL |

Os gráficos por hora e tipo consultam até 30 dias, mas só podem usar os registros ainda retidos. Aumentar a retenção não recupera registros já apagados. Defina o período conforme a necessidade de análise e capacidade do banco; o padrão permanece em 7 dias.

**Backup mensal não preserva todos os eventos de uma retenção de 7 dias.** Para arquivamento completo, agende backups antes da expiração, por exemplo diariamente, com monitoramento de falhas e cópia em armazenamento protegido fora do servidor. Posições brutas exigem frequência compatível com a retenção por hora e com o teto de linhas.

## Exportação JSONL

Em `backend`, `npm run backup` gera JSONL e um manifesto em `backups/rioaisgate-*`. É uma exportação para análise: não inclui assinaturas Telegram e não oferece uma visão transacional única durante gravações concorrentes. Não use essa exportação como única estratégia de recuperação.

Não envie backups ou credenciais ao Git. Proteja cópias por controle de acesso e criptografia do armazenamento.

## Backup completo PostgreSQL

Use `pg_dump` e `pg_restore` da mesma versão principal do servidor ou de versão compatível. Configure conexão por variáveis `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` e autenticação segura (`PGPASSFILE` com acesso restrito ou mecanismo do provedor). Não coloque senhas em argumentos ou scripts versionados.

Para banco externo, mantenha `PGSSLMODE=verify-full` e configure `PGSSLROOTCERT` quando o provedor exigir uma CA própria. O `pg_dump` usa libpq e não lê `backend/.env` automaticamente.

Com a conexão já configurada:

```bash
pg_dump --format=custom --no-owner --file=/caminho/seguro/rioaisgate.dump
pg_restore --list /caminho/seguro/rioaisgate.dump
```

O dump completo inclui esquema, eventos, posições, embarcações, assinaturas e sequências. A listagem confirma a legibilidade do arquivo, mas a restauração de teste é necessária para verificar a recuperação.

## Ensaio de recuperação em banco novo

Crie um banco vazio e isolado. Nunca aponte este procedimento ao banco de produção. Mantenha o backend e seus jobs de retenção desconectados do banco restaurado até concluir a validação.

```bash
createdb rioaisgate_recovery
pg_restore --exit-on-error --no-owner --no-acl --dbname=rioaisgate_recovery /caminho/seguro/rioaisgate.dump
psql --dbname=rioaisgate_recovery -c 'SELECT COUNT(*) FROM vessels; SELECT COUNT(*) FROM vessel_events; SELECT COUNT(*) FROM vessel_positions; SELECT COUNT(*) FROM telegram_subscriptions;'
```

Compare contagens e amostras com o momento do backup. Verifique também inserção de um evento no banco de ensaio para confirmar as sequências. Documente duração, resultado e idade do último backup recuperável. A recuperação não deve enviar alertas: deixe Telegram e AIS desligados no ensaio.

Antes de um corte real, planeje a interrupção das gravações, o ponto de recuperação e a política de retenção dos dados restaurados. O job de retenção roda ao iniciar o backend e pode remover eventos antigos restaurados.

## Validação realizada nesta alteração

Em bancos locais descartáveis com PostgreSQL 17: migração, inserção de eventos e assinatura Telegram, dump completo, restauração, conferência de registros e inserção com sequência preservada. A retenção de 7 dias também foi testada: removeu o evento de 8 dias e preservou o atual. Isso não valida backups existentes de produção nem sua automação.
