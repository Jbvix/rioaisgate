# Quando a barra de um porto vira dado: o que aprendi construindo o RioAISGate

**Rascunho para LinkedIn · Jossian Brito · TugLife Systems**

---

Há portos em que a pergunta mais cara não é “quantos navios passaram ontem?”, mas “*quando* passaram, de onde vinham e com qual padrão de tráfego?”. Na Barra da Guanabara, essa pergunta traduz **operação, logística e decisão** — enxergar a baía como um sistema vivo, não como um ponto no mapa.

Foi nesse contexto que nasceu o **RioAISGate**: um monitor de tráfego marítimo que combina dados AIS em tempo real, geofence inteligente, painel web e **alertas no Telegram** — grupo AISGATE e bot @AISgateBot em produção na Barra da Guanabara. Não é um produto fechado de prateleira; é uma **plataforma operacional em evolução** — e, como toda boa arquitetura bem calibrada, abre mais portas do que aquela para a qual foi desenhada.

Este texto não é um manual técnico. É um ensaio sobre **onde esse tipo de solução encontra terreno fértil** — no Rio, no Brasil e além.

---

## O problema invisível da “boca do porto”

O AIS (Automatic Identification System) existe há décadas. Milhares de embarcações transmitem posição, curso e velocidade o tempo todo. O desafio nunca foi a falta de dado; foi a **falta de significado**.

Ver centenas de alvos num mapa impressiona por cinco minutos. Depois, vira ruído. O que importa para quem opera é o **evento**: cruzou a barra? Entrou na baía? Saiu? Quanto tempo ficou na zona de abordagem? Esse navio segue o padrão habitual ou destoa do histórico?

O RioAISGate parte dessa distinção. Em vez de acumular trilhas infinitas, ele escuta o oceano, desenha uma zona de interesse (a Baía de Guanabara, da boca entre o Forte São João e o Forte Santa Cruz até o fundo da enseada) e **registra cruzamentos**: ENTRY e EXIT, com horário, posição e contexto. O mapa mostra o presente; o histórico constrói inteligência.

Construir isso em produção — React, Node, PostgreSQL, WebSocket, deploy em Railway e Netlify — foi menos glamour e mais engenharia de campo: jitter de GPS na linha da geofence, rajadas falsas após restart, custo de banco crescendo sem uso real. Cada incidente ensinou algo que nenhum slide de vendas antecipa.

---

## Criar geofences: do desenho no mapa ao evento no log

Antes de falar de mercado, vale explicar o **coração operacional** do RioAISGate: a geofence. No mundo terrestre, geofence é cercar uma loja ou um caminhão. No mar, é **traduzir uma área de interesse em regra de cruzamento** — e isso exige mais cuidado do que parece.

### O que desenhamos, na prática

No RioAISGate trabalhamos com **três camadas espaciais**, cada uma com um papel:

| Camada | Forma | Função |
|--------|--------|--------|
| **Caixa AIS** | Retângulo (bounding box) | Diz ao feed AIS *de onde* buscar embarcações — abordagem oceânica + baía |
| **Zona de abordagem** | Retângulo oceânico | Antecipa navios a caminho da barra (útil para alertas e contexto) |
| **Polígono da baía** | ~15 vértices, sentido horário | Define *dentro* vs *fora* — Forte São João, Forte Santa Cruz, costa de Niterói, fundo da enseada, Caju, Santos Dumont, fechamento na boca |

A baía não é um círculo no mapa. É um **polígono simplificado** ancorado em pontos que operadores reconhecem: fortalezas, pontas de costa, terminais. Simplificar é uma escolha consciente — menos vértices, mais estabilidade; mais vértices, mais fidelidade cartográfica, mais risco de falso cruzamento na linha.

No backend, cada posição AIS passa por um teste geométrico (*point-in-polygon*, ray-casting): o navio está dentro ou fora? A mudança de estado gera **ENTRY** (oceano → baía) ou **EXIT** (baía → oceano). Esse evento vai para o banco, para o WebSocket e para o log do painel — não a trilha bruta de cada ping.

### Como se cria uma geofence (fluxo de trabalho)

A criação não começa no código; começa na **pergunta de negócio**:

1. *Qual limite importa?* — barra, terminal, fundeadouro, campo offshore, canal de acesso.
2. *O que conta como “entrou”?* — centro do navio dentro do polígono, ou proximidade da linha?
3. *Quem precisa ser alertado?* — todos os alvos, só uma frota, só um MMSI?

Depois vem o **desenho**:

- **Referências cartográficas** — cartas náuticas, OpenSeaMap, imagem de satélite; vértices nos cantos operacionais reais.
- **Polígono fechado** — coordenadas `[lat, lon]`, mínimo três pontos, primeiro = último.
- **Caixa de ingestão AIS** — retângulo um pouco maior que a área, para não perder alvos antes do cruzamento.
- **Espelhamento frontend/backend** — o mapa mostra exatamente a mesma geometria que o motor de eventos avalia; o operador confia no que vê.

O RioAISGate inclui um **editor de geofence** (mapa interativo + JSON): clique para adicionar vértices, arraste para ajustar, duplo clique para remover, colar coordenadas de carta ou exportar o polígono para o backend. A geometria pode ser persistida no navegador para testes e calibração; em produção, a referência oficial fica no servidor — garantindo que todos vejam os mesmos ENTRY/EXIT.

### Calibrar é tão importante quanto desenhar

Uma geofence mal calibrada gera **ruído operacional**: cinquenta entradas e saídas fantasma às 21h45 porque o GPS oscilou na boca da barra ou o servidor reiniciou.

Aprendemos três regras na prática:

1. **Histerese** — exigir duas leituras AIS consecutivas concordantes antes de confirmar dentro/fora.
2. **Cooldown** — no mínimo dois minutos entre eventos do mesmo navio (evita “pisca-pisca” na fronteira).
3. **Warmup pós-restart** — ignorar cruzamentos nos primeiros minutos após deploy, quando o estado em memória ainda se reconstrói.

Isso transforma geofence de gimmick de mapa em **instrumento de confiança** — cada cruzamento documentado vira base para despacho, conciliação ou análise.

### Geofence por embarcação (watch)

Além da zona global da baía, o operador pode **vigiar um navio específico**: alerta sonoro no navegador quando *aquela* embarcação entra ou sai, conforme a posição atual e a regra escolhida (ENTRY, EXIT ou ambos). É geofence no nível do **interesse comercial**, não só da estatística agregada — “meu cliente cruzou a barra”.

No **painel web**, o alerta sonoro funciona enquanto a aba está aberta. No **Telegram**, o mesmo evento já chega **24h** — em grupo ou em chat privado com o bot — sem depender do navegador.

### Alertas por Telegram (em produção) e e-mail (próximo)

Um evento ENTRY/EXIT no RioAISGate nasce **estruturado**: MMSI, nome do navio (quando conhecido), tipo de evento, horário, posição, velocidade e curso. Esse pacote é gravado no Postgres, enviado pelo WebSocket ao mapa, publicado no log — e, desde a integração com o **@AISgateBot**, disparado para quem precisa saber fora do painel.

```
AIS → geofence (histerese) → EVENTO confirmado → quem precisa saber?
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
        Painel web              Telegram               E-mail
     (mapa + som)            (em produção)            (próximo)
```

#### Telegram — o que já está no ar

Implementamos o canal em **sprints**, do broadcast simples ao refinamento operacional:

| Entrega | O que faz |
|---------|-----------|
| **Grupo AISGATE** | Chat privado de turno; todos os ENTRY/EXIT confirmados chegam automaticamente |
| **Bot @AISgateBot** | Comandos `/watch`, `/unwatch`, `/list`, `/status` |
| **Vigia por MMSI** | `/watch 710123456 entry` — só entradas daquele navio, naquele chat |
| **Deep link** | Cada alerta traz link para o mapa já focado na embarcação (`?mmsi=…&lat=…&lon=…`) |
| **/mute e /unmute** | Silencia alertas por chat sem perder as vigias cadastradas |

Exemplo de mensagem real no grupo:

> 🟢 **ENTRY** — Entrada na baía  
> **Navio:** MAERSK MONTE AZUL (563051700)  
> **Horário:** 08/06, 09:38 BRT · **SOG:** 13,1 kn  
> **Pos:** -22,9780, -43,1294  
> [Ver no mapa](https://riogateais.netlify.app)

**Links operacionais:**

- Painel: [riogateais.netlify.app](https://riogateais.netlify.app)
- Grupo AISGATE (convite privado): [t.me/+BJ9lJFeVqR00NmEx](https://t.me/+BJ9lJFeVqR00NmEx)
- Bot: [@AISgateBot](https://t.me/AISgateBot)

A API Bot do Telegram (`sendMessage` via HTTP) custa pouco na escala operacional típica e não exige homologação pesada — ideal para **piloto com cliente** ou **grupo interno de coordenação**. As mesmas regras do painel se aplicam: histerese, cooldown e warmup **antes** de qualquer notificação.

#### E-mail (próximo sprint)

Ideal para **registro formal** e times que vivem na caixa de entrada:

- *“MV EXEMPLO (MMSI 710xxxxxx) — ENTRY na Baía de Guanabara — 06:14 BRT — SOG 8,4 kn — posição -22,91 / -43,15”*
- Listas por cliente, terminal ou frota; cópia para arquivo e auditoria.
- Integração típica: **Resend**, **SendGrid** ou **Amazon SES** — mesma interface de notificação já usada pelo Telegram.

#### Webhook e integrações (roadmap)

Para portos e sistemas internos, um **POST JSON** no evento (`ENTRY`/`EXIT`) pode acionar Slack, Teams, ordens de serviço ou CRM — sem depender de canal de mensagem.

#### Como o operador configura hoje

1. **Todos os cruzamentos** — entrar no grupo AISGATE (broadcast automático).
2. **Um navio específico** — no Telegram: `/watch MMSI entry|exit|both` (grupo ou chat privado com o bot).
3. **Silenciar temporariamente** — `/mute 30` ou `/mute 120` (minutos).
4. **No painel** — alerta sonoro por embarcação (enquanto a aba estiver aberta).

E-mail e webhook seguem o mesmo evento confirmado; a camada de entrega é plugável.

#### Por que histerese importa ainda mais aqui

Enviar dezenas de alertas falsos às 21h45 — no Telegram ou no e-mail — destrói confiança mais rápido que um gráfico errado. Por isso só disparamos notificações **depois** das mesmas garantias da produção: duas leituras AIS concordantes, cooldown por navio, warmup após restart. Alerta externo herda a **mesma calibração** da geofence.

#### Benefícios dos alertas externos

- **Resposta imediata** por Telegram — grupo de turno ou vigia individual por MMSI, com link direto ao mapa.
- **Operação 24h** — vigias e broadcast no backend; não depende de painel aberto.
- **Registro formal** por e-mail (próximo) — auditoria e conciliação com horário e posição.
- **Integração** via webhook — evento estruturado em qualquer fluxo digital.
- **Mesma calibração** da geofence — histerese, cooldown e warmup antes de qualquer notificação.

Automatizar o cruzamento da geofence não substitui o julgamento humano — **antecipa** a decisão com dado objetivo: horário, posição e tipo de evento no momento do cruzamento.

Modelo de receita natural: alertas incluídos no plano base + pacotes por volume de MMSI monitorados.

---

### Oportunidades na *criação* de geofences

Desenhar zonas customizadas abre mercados que um mapa genérico não alcança:

- **Multi-zona** — barra + terminal Caju + Ilha do Governador + área de fundeio; cada polígono com KPIs próprios.
- **Geofence aninhada** — abordagem oceânica → canal da barra → baía → berço; medir tempo em cada etapa (ETA refinado, SLA de praticagem).
- **Áreas restritas ou sensíveis** — zonas de segurança, parques, instalações críticas; alerta de aproximação ou permanência.
- **Projetos sob demanda** — cliente envia carta ou KML; TugLife desenha, calibra e entrega painel em semanas, não meses.
- **Self-service futuro** — painel admin para salvar polígonos no banco, versionar e ativar por temporada (regatas, obra, bloqueio de canal).

A geofence deixa de ser “configuração de TI” e vira **produto configurável** — o mesmo motor AIS, geometrias diferentes, eventos diferentes.

Quem avalia solução marítima deveria perguntar: *“Posso desenhar minha área? Quem calibra a linha da barra? Como vocês evitam falso positivo? Posso receber o alerta no Telegram ou e-mail?”* Se a resposta for vaga, o mapa é enfeite.

---

## Benefícios

- **Evento em vez de ruído** — ENTRY/EXIT com horário, posição, velocidade e curso; mapa ao vivo sem depender de trilhas infinitas.
- **Despacho antecipado** — aproximação real substitui ETA genérico; janela operacional visível antes do atracação.
- **Métricas e SLA** — tempo entre barra, fundeio, terminal ou berço; gráficos e KPIs a partir do histórico de cruzamentos.
- **Menos coordenação manual** — painel centralizado + alertas automáticos no Telegram (grupo AISGATE e vigias por MMSI); fim de copiar do mar para planilha ou chat.
- **Histórico auditável** — log de passagens para conciliação, retrospectiva e estudos de fluxo.
- **Confiança operacional** — geofence calibrada (histerese, cooldown, warmup) evita rajada de falsos eventos na fronteira.
- **Custo sob controle** — persistência só do que gera valor (eventos, estatísticas); trilhas brutas opcionais ou limitadas.
- **Integração aberta** — API REST, WebSocket e webhook sobre o mesmo evento confirmado.

---

## Oportunidades de aplicação

**Outras áreas e geometrias**

- Replicar o motor para **outras baías, estuários, hidrovias ou terminais** — Itaguaí, Sepetiba, Santos, Amazônia, Tietê-Paraná: muda o polígono, não a lógica.
- **Multi-zona** — barra, terminal, fundeadouro ou ilha; cada polígono com KPIs próprios.
- **Geofence aninhada** — abordagem → canal → baía → berço; medir tempo em cada etapa.
- **Áreas sensíveis** — zonas de segurança, parques ou instalações críticas; alerta de aproximação ou permanência.
- **Campos exclusivos** — polígonos em torno de plataformas ou áreas de manobra.

**Operação e inteligência**

- Estudos de **capacidade de canal** e padrões de tráfego a partir de estatísticas agregadas.
- Detecção de **padrões anômalos** — horário atípico, permanência prolongada na abordagem.
- **Retrospectiva** — “quem estava na área às 14h?” para simulação, exercícios ou análise pós-evento.
- Complemento leve à gestão de tráfego — sem substituir VTS certificado; multiplica a capacidade de olhar.

**Eventos e experiência**

- Contagem e log de embarcações durante **regatas, desfiles ou operações especiais**.
- Dashboard público ou semi-público (com anonimização quando necessário).
- Mapa ao vivo + KPIs como camada digital sobre o mar urbano.

**Produto e escala**

- **White-label** — mesma stack, geometria e regras por cliente ou região.
- **Projetos sob demanda** — carta ou KML → polígono calibrado → painel em semanas.
- **Self-service futuro** — polígonos versionados no banco, ativados por temporada ou obra.
- Modelos: SaaS por área monitorada, licença on-premise ou projeto customizado.

---
## Arquitetura modular

O RioAISGate foi desenhado como sistema **modular**:

| Camada | Papel |
|--------|--------|
| Ingestão AIS | Feed configurável (bbox, horário, reconexão) |
| Motor geofence | Polígonos, zonas de abordagem, histerese e regras de cruzamento |
| Editor / desenho | Mapa interativo, JSON, exportação para backend |
| Notificações | **Telegram** (produção), e-mail e webhook (camada sobre eventos ENTRY/EXIT) |
| API + WebSocket | Integração com terceiros |
| Frontend | Mapa, KPIs, log de eventos |

Isso permite **white-label** para outras regiões: desenhar polígono, definir caixa AIS, calibrar histerese, conectar integrações.

---

## O que a produção ensinou

Nenhuma oportunidade acima se sustenta se o sistema cair às 21h45 ou inventar cinquenta eventos na boca da barra porque o GPS oscilou três metros. Lições que transformamos em produto:

1. **Geofence com histerese** — confirmar dentro/fora antes de disparar ENTRY/EXIT; desenho ancorado em marcos reais (fortes, terminais).
2. **Criação e calibração** — polígono + caixa AIS + editor visual; cooldown e warmup evitam rajada falsa na linha.
3. **Separação entre “ao vivo” e “histórico”** — mapa em memória; banco só para o que gera valor (eventos, estatísticas).
4. **Retenção e custo** — dados brutos de posição crescem rápido; política clara evita surpresa na fatura cloud.
5. **Healthcheck e resiliência** — feed AIS reconecta; backend sobrevive a picos sem derrubar o processo.
6. **Notificação plugável** — o mesmo evento confirmado alimenta mapa, Postgres, WebSocket e Telegram; e-mail e webhook entram na mesma camada sem duplicar lógica de geofence.

Quem avalia solução marítima deveria perguntar não “vocês têm mapa?”, mas “como vocês tratam **falso positivo na geofence**, **custo de persistência** e **entrega do alerta fora do painel**?”.

---

## Convite

O RioAISGate está **no ar em produção**: mapa da Baía de Guanabara, embarcações ao vivo, gráficos de entradas e saídas, log de eventos — e alertas automáticos no **Telegram** (grupo AISGATE + bot @AISgateBot com vigias por MMSI e link direto ao mapa).

Não é só demonstração de mapa; é **operação**: cruzamento confirmado vira mensagem no celular em segundos.

Se você enxerga uma baía, um canal ou um terminal como **infraestrutura crítica**, há espaço para aplicar essa arquitetura ao problema específico. A barra é um polígono; o que muda é a pergunta de negócio por trás dela.

Estou aberto a trocar ideias, pilotos e parcerias.

**Jossian Brito**  
TugLife Systems  

🗺 [riogateais.netlify.app](https://riogateais.netlify.app)  
💬 [Grupo AISGATE](https://t.me/+BJ9lJFeVqR00NmEx) · [@AISgateBot](https://t.me/AISgateBot)

---

### Sugestões para publicação no LinkedIn

- **Título sugerido:** *Quando a barra de um porto vira dado: geofence, Telegram e alertas que chegam no celular*
- **Título alternativo:** *Do mapa ao grupo de Telegram: como o RioAISGate transforma cruzamento AIS em evento operacional*
- **Hashtags:** `#Maritime #PortTech #AIS #Geofence #Telegram #AISGATE #Inovação #RioDeJaneiro #TugLife #LogísticaPortuária #SmartPorts`
- **Imagem de capa:** screenshot do mapa RioAISGate **ou** captura de alerta ENTRY/EXIT no grupo AISGATE
- **CTA final:** link do painel + convite ao grupo AISGATE + pergunta sobre o use case do leitor (*“Qual zona você monitoraria?”*)
