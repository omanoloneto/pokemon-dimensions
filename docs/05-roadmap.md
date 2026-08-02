# 05 — Roadmap Mestre

Estado de referência: **o engine está pronto; o jogo ainda não existe.** Este roadmap leva do hub de testes atual à v1.0 mobile.

## Estado atual (medido no repo)

**Engine (✅ — [roadmap-port-mz.md](roadmap-port-mz.md)):** 10 plugins PKM_* (~2.9k linhas), batalha 1v1 completa (status, estágios, precisão, troca, fuga), captura, EXP/evolução por nível, treinadores+insígnias, PC 16×30, mochila, Pokédex, áudio. 56 testes headless.

**Dados:** 649 espécies (Gen 1–5), 559 golpes (**57 com efeito implementado — ~10%**), 18 tipos, 527 itens, 29 tabelas de encontro (órfãs — chaveadas por mapId do XP), 60 treinadores definidos e não usados em mapa nenhum.

**Conteúdo real:** 2 mapas — Map001 (hub de testes, 8 eventos debug) e Map002 (Coral Town, tiles reais, **zero gameplay**). Sprites: só Pokémon (front/back/shiny/icons/footprints/alt). Áudio: 655 cries + RTP padrão do MZ.

**Lacunas conscientes** (decidido NÃO fazer na v1 — ver [01](01-visao-geral.md)): breeding, day/night, clima, duplas, held items, habilidades em batalha, multiplayer.

## Backlog de engine (priorizado)

| Item | Tam. | Marco | Nota |
|---|---|---|---|
| Touch UI: Pokédex e Storage (Q/W sem equivalente) | P | M1 | [04](04-producao-mobile.md) tem file:line |
| Teste de integridade de assets (JSON → arquivo existe) | P | M1 | Classe de crash já ocorrida |
| `schemaVersion` no save + export/import manual | P | M1 | Antes de qualquer release |
| Limpeza de cache de bitmaps (batalha/Pokédex) | P | M1 | iOS mata aba ~1.5GB |
| Smoke E2E Playwright no build web | M | M2 | Boot→captura→save→reload |
| Evolução ramificada com condição (Digimon) | M | M3 | Colunas + 1 `if` no hook |
| Encontros Water/Rod (dados já existem) | P | M4 | Engine só rola "Land" |
| TM ensina golpe (campo `machine` já existe) | M | M4 | |
| `priority` no turn order (campo existe, ignorado) | P | M4 | |
| Shiny nas cenas de batalha (pastas *_shiny) | P | M4 | Verificar uso real |
| Peças como equips nativos + drop pós-vitória (Medabots) | M | M5 | |
| Santuário de Discos (Monster Rancher) | P | M6 | Common event + 1 tela |
| Emblemas G.C. como gate de pacto (Bucky) | P | M7 | Reusa insígnias |
| MOVE_EFFECTS dos golpes usados pelas espécies obtíveis | contínuo | M2+ | Nunca os 559; só o que entra em jogo |

Tam.: P = dias, M = ~1 semana, G = mais que isso.

## Marcos (1 build jogável/mês; build que não roda em touch não conta)

### M0 ✅ — Engine port XP→MZ
Concluído ([roadmap-port-mz.md](roadmap-port-mz.md)).

### M1 — Mobile Playable + fundação de QA
- Touch nos gaps de Pokédex/Storage; `touchUI` conferido; build **web + PWA** no ar (hospedagem própria); passe de pngquant (342→~120MB); teste de integridade de assets; `schemaVersion`; limpeza de cache de bitmaps.
- **Aceite:** demo de teste atual jogável num Android low-end e num iPhone (PWA), save sobrevive a fechar o app, 56 testes verdes.

### M2 — Vertical Slice A: Dimensão Pokémon jogável
- Coral Town eventada pelo template de cidade ([03](03-mundo-e-narrativa.md)); Rota 1, Ginásio de Coral (**Chave 1**), Rota 2 + Fenda; encontros religados aos mapas novos; treinadores dos 60 usados em rota; E2E Playwright rodando.
- Dados: 18 Pokémon obtíveis balanceados (nv 3–16) + **1 Digimon capturável na Fenda** (o momento-trailer).
- **Aceite:** 45 min de jogo contínuo no celular sem debug menu; Digimon no time antes de qualquer portal.

### M3 — Vertical Slice B: Nexus + Digimon → **DEMO**
- Nexus (praça + interior), Vila File, Rota de Dados, Torre de Dados (**Chave 2**, boss Arauto); **evolução ramificada** implementada; 10 Digimon obtíveis; item Digi-Link; cutscene de fechamento da demo.
- **Aceite:** demo 90–120 min completa no celular; um Rookie evolui pra ramos diferentes em saves diferentes; distribuição interna (URL privada) pra playtest.

### M4 — D1+D2 completas + dívidas de engine
- Mapas restantes das duas dimensões (Chaves 3–6... total 6), dex regional fechada, TMs, Water/Rod, priority, shiny visual, MOVE_EFFECTS dos golpes em uso.
- **Aceite:** Ato 1 + começo do Ato 2 jogáveis do início, sem eventos de teste no build.

### M5 — D3 Medabots
- 6 mapas, Arena Robattle (Chaves 7–8), **sistema de peças (equips) + drop**, ~10 modelos × 4 peças, Medal Case, Arauto 2. **Trânsito livre** (evento Nexus restaurado — 6ª chave).
- **Aceite:** loop "vence Robattle → ganha peça → remonta Medabot" funcionando; viagem rápida ativa.

### M6 — D4 Monster Rancher
- 6 mapas, Santuário de Discos, ~20 espécies geráveis, discos espalhados nas dimensões anteriores (backtracking), Circuito da Fazenda, Santuário de Pedra (Chaves 9–10), Arauto 3.
- **Aceite:** nenhum encontro capturável na dimensão; toda aquisição via disco; economia de discos revisada em playtest.

### M7 — D5 Bucky + endgame aberto
- 6 mapas (dimensão-hub com câmaras), Templo Elemental (Chaves 11–12), **12 espíritos lendários** com gate de Emblema G.C., golpes Jibaku (recoil/autodesmaio), Troublemonsters (reskins corrompidos como chefes).
- **Aceite:** caçada dos 12 espíritos jogável cruzando todas as dimensões.

### M8 — Dimensão Zero + release 1.0
- 3 mapas-colagem, gauntlet de Arautos, Unificador (equipe com 1 ás por franquia), pós-game de captura livre, passe de balanceamento da curva inteira, corte final de assets, **APK Capacitor <250MB**, página de download discreta.
- **Aceite:** campanha 10–15h completa; device matrix ([04](04-producao-mobile.md)) verde; plano de resposta a C&D decidido e escrito.

## Riscos (top 5)

1. **Sprites e dados das outras franquias** — hoje só existem assets de Pokémon. Cada dimensão exige aquisição/curadoria de sprites (rips de fã dos jogos de DS/GBA), padronização 48px e dados de espécie/golpe. É o maior custo desconhecido; atacar já em M2 (o Digimon da Fenda força o pipeline inteiro cedo). Mitigação: dex pequenas por dimensão (30/10/20/12).
2. **Legal** — multi-franquia soma titulares; visibilidade e monetização são os gatilhos. Mitigações e plano de resposta em [04](04-producao-mobile.md).
3. **Performance mobile** — memória (cache de bitmaps) mais que peso. Budget e limpeza em M1; medir todo release.
4. **Scope creep de sistemas** — a regra "1 sistema novo por franquia" ([02](02-franquias.md)) é o contrato. Pedido de sistema extra → corta ou troca.
5. **Pipeline de segunda identidade visual** — tilesets Digimon na slice validam conversão/estilo; se falhar, replanejar antes de D3–D5.

## Métricas por release

Testes headless (≥56, nunca regride) · zero erro de console em 15 min de play · FPS no low-end de referência · peso do build e tempo até title em 4G · mapas/treinadores/espécies implementados vs. planejados · tempo até a primeira captura.
