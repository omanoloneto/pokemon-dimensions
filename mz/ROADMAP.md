# Roadmap — Port para RPG Maker MZ

Ordem de execução priorizando chegar a uma **demo jogável** o quanto antes:
`1 → 2 → 4 → 5a → 6`, depois `3 → 7`, e por fim `8 → 9 → 10`.

| Fase | Tema | Status |
|------|------|--------|
| 0 | Fundação & Dados (compiladores PBS→JSON, Core, tabela de tipos) | ✅ |
| 0 | Pokédex | ✅ |
| 1 | Modelo do Pokémon individual (`Game_Pokemon`) | ✅ |
| 2 | Party & Tela de Resumo | ✅ |
| 4 | Overworld & Encontros selvagens | ✅ |
| 5a | Motor de Batalha — esqueleto jogável (1v1) | ✅ |
| 6 | Captura (Poké Ball + fórmula) | ✅ |
| 3 | Mochila & Itens | ⬜ |
| 5b | Batalha — efeitos de golpe, status, IA, clima | ⬜ |
| 7 | EXP, Nível & Evolução | ⬜ |
| 8 | PC / Boxes | ⬜ |
| 9 | Treinadores & Ginásios | ⬜ |
| 10 | Polimento, áudio, migração XP→MZ | ⬜ |

## Marcos
- 🟢 **Pokédex navegável** — Fase 0 ✅
- 🟡 **Demo de batalha** (andar → encontro → batalha 1v1 → captura) — Fases 1, 2, 4, 5a, 6
- 🟠 **Loop básico** (+ itens, EXP, evolução) — Fases 3, 7
- 🔵 **Jogo completo** (PC, ginásios, polimento) — Fases 8, 9, 10
