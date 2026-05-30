# Relatórios de pausa de sessão

Ao **encerrar ou pausar** um bloco de trabalho no RioAISGate, gere um relatório curto e guarde-o localmente.

## Onde salvar

| O quê | Caminho | Versionado no Git? |
|-------|---------|-------------------|
| Modelo (copiar) | `docs/REPORT-SESSION-TEMPLATE.md` | Sim |
| Relatório da sessão | `reports/AAAA-MM-DD-pausa-rioaisgate.md` | **Não** (`reports/` está no `.gitignore`) |

## Como gerar

1. Copie `docs/REPORT-SESSION-TEMPLATE.md` para `reports/2026-05-30-pausa-rioaisgate.md` (use a data do dia).
2. Preencha: resumo, implementações, melhorias, correções, lições, pendências, variáveis Railway (sem senhas).
3. Opcional: peça ao agente Cursor *“gerar relatório de pausa”* — ele usa o template e grava em `reports/`.

## Nome do arquivo

```
reports/YYYY-MM-DD-pausa-rioaisgate.md
```

Exemplo desta sessão: `reports/2026-05-30-pausa-rioaisgate.md`

## Por que não versionar?

Relatórios podem conter notas operacionais, URLs internas e contexto pessoal. O **template** e este guia ficam no repositório; as **cópias preenchidas** ficam só na sua máquina (e backup OneDrive, se aplicável).
