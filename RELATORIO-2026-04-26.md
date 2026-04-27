# Relatorio de Progresso - 2026-04-26

## Resumo do dia

Hoje o foco principal foi estabilizar o ambiente em producao (Railway + Netlify), corrigir falhas de conectividade entre frontend/backend, normalizar o pipeline de banco de dados e evoluir a experiencia do mapa com controles interativos.

## Correcoes criticas realizadas

- Resolvido erro de CORS/WS entre frontend Netlify e backend Railway com ajuste de origens permitidas no backend.
- Corrigido problema de deploy/healthcheck no Railway:
  - removida migracao do `CMD` do Dockerfile.
  - migracao movida para `preDeployCommand` no `railway.toml`.
- Diagnosticado e resolvido problema de banco:
  - `DATABASE_URL` ausente no runtime do servico backend.
  - apos ajustar variavel no Railway, endpoints de estatistica/eventos voltaram a responder `200`.
- Eliminada cascata de erros 404/CORS causada por dominio/deploy desatualizado.

## Implementacoes feitas

### 1) Controle de feed AIS (liga/desliga)

- Adicionado controle manual de feed AIS no backend:
  - endpoints de status e toggle do AIS stream.
  - suporte a override manual sem perder logica de agenda.
- Adicionado botao **Ligar/Desligar** no frontend, ao lado do indicador **Live**.

### 2) Janela de operacao programada (08h-18h)

- Implementada logica de janela horaria para o AIS stream:
  - variaveis de ambiente para timezone e horario inicial/final.
  - start/stop automatico do feed conforme horario configurado.

### 3) Editor de geofence

- Implementado editor visual no mapa:
  - clique para adicionar vertices.
  - arrastar para ajustar.
  - duplo clique para remover.
- Implementado editor JSON com validacao.
- Adicionados controles: aplicar JSON, copiar coordenadas e resetar.

### 4) Persistencia da geofence

- Adicionado botao **Salvar** no editor.
- Geofence salva em `localStorage`.
- Geofence carregada automaticamente na abertura do app.
- Validacao de integridade do poligono ao carregar/salvar.

### 5) Camadas de mapa e UX de controles

- Adicionadas camadas:
  - OpenStreetMap
  - Satelite
  - Relevo
  - Light
  - Dark
- Toggle de sobreposicao OpenSeaMap.
- Reorganizacao de controles com **menu hamburguer**.
- Editor de geofence convertido para **painel lateral interativo**.

### 6) Informacoes no hover dos alvos

- Exibicao de dados da embarcacao ao passar o mouse no marcador:
  - nome, MMSI, tipo, bandeira, velocidade, proa, rumo, status nav, posicao e estado dentro/fora da baia.

## Melhorias operacionais e de observabilidade

- Melhorias no tratamento de erro (API/DB) para facilitar diagnostico.
- Ajustes em documentacao e exemplos de variaveis de ambiente.
- Validacoes repetidas com build/lint para garantir estabilidade das alteracoes.

## Estado atual ao encerrar

- Backend em producao respondendo:
  - `/api/health` -> `200`
  - `/api/stats/today` -> `200`
  - `/api/events` -> `200`
  - endpoints de graficos -> `200`
- WebSocket conectado.
- Mapa funcional com alvos e controles novos.
- Fluxo de geofence editavel e persistente.

## Licoes aprendidas

- Em Railway, separar claramente:
  - **migracao** (pre-deploy) e
  - **startup da aplicacao** (start command)
  evita falhas de healthcheck e downtime.
- Erro de CORS pode mascarar falhas reais de rota/deploy (404/500).
- Confirmar variaveis em runtime (`DATABASE_URL`) e fundamental antes de depurar SQL.
- Erros vazios (`{"error":""}`) atrasam muito o diagnostico: sempre retornar mensagens de erro com contexto.
- Para app com ingestao continua (AIS), desligar servico para economizar pode causar perda de historico/eventos.

## Proximos passos sugeridos

- Proteger endpoint de toggle AIS com token administrativo.
- Persistir preferencias de camadas (menu mapa) no `localStorage`.
- Adicionar endpoint de administracao para salvar geofence no backend/banco (em vez de somente localStorage do navegador).
- Refinar tratamento de outliers de velocidade/heading no stream AIS.
