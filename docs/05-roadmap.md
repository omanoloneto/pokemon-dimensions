# 05 — Roadmap Mestre

Estado de referência: **o engine está pronto; o jogo ainda não existe.** Este roadmap leva do hub de testes atual à v1.0 mobile.

> **Realinhado com a [Bíblia dos Doze Mundos v0.11](referencias/biblia-doze-mundos-v0.11.md).**
> O mundo-base do jogo passou a ser o Continente dos Doze Mundos; Pokémon, Digimon,
> Medabots, Monster Rancher e V-Monsters são **Dimensões Externas** ([03](03-mundo-e-narrativa.md)).
> A vertical slice deixou de ser "Coral Town + Rota 1" e passou a ser
> **Vila Primeiro Passo + Campos do Primeiro Sol + Cidade dos Porcos**.

## Estado atual (medido no repo)

**Engine (✅ — [roadmap-port-mz.md](roadmap-port-mz.md)):** 19 plugins MON_* (~6.4k linhas), batalha 1v1 completa (status, estágios, precisão, troca, fuga), captura, EXP/evolução por nível e ramificada, treinadores+insígnias, PC 16×30, mochila, Pokédex, áudio, humano como combatente.

**Franquias (✅ — [02](02-franquias.md), [06](06-arquitetura-franquias.md)):** camada multi-franquia + os **6** sistemas de dimensão, incluindo a **Barra de Elo** (`MON_Link.js`, entregue). **838 espécies** (649 Pokémon + 101 Digimon + 10 Medabots + 13 Monster Rancher + 20 Bucky + 35 V-Monsters + 10 humanos), 723 golpes, 40 Medapeças, 3 discos, dex de Kanto recortada. Baseline: **953 asserts, 0 falhas** — piso, não teto: a suíte cresce junto com o conteúdo.

**V-Monsters (✅ dados e arte):** IP própria do dono. `data/species/VMO.json` com 35 espécies na faixa 970–1069, `MON_Link.js` com a barra de elo, 3 V-Links em `data/ItemsExtra.json` e **sprites já convertidos** (`img/monsters/vmo` + entradas em `front`). Falta só o conteúdo de mapa (os 6 mapas de Folklora).

**Mundo-base (❌ — o buraco novo):** a faixa `BKY` (900–919) tem **12 espíritos + 8 Encrenqueiros "Turvo"** e **nenhuma criatura comum**. Primas precisa de ~10–12 nativos jogáveis (Chicky, Drago Rock, Fadas do Vaso e os papéis ecológicos da bíblia §23.2) com dados e sprites. Sem isso a vertical slice não existe.

**Dados:** 559 golpes base + 164 extras; **~77 com efeito implementado**; 18 tipos, 542 itens. 4 tabelas de encontro definidas e **nenhuma dispara** — Map001/Map002 estão com a camada de região zerada e `MON_Encounters` exige a Região 1 pintada. 60 treinadores definidos e não usados em mapa nenhum.

**Conteúdo real:** 2 mapas — Map001 (hub de testes, 8 eventos debug) e Map002 (**Coral Town**, tiles reais, zero gameplay). Com a virada, Coral Town deixa de ser a cidade inicial e passa a ser a **cidade de entrada da Dimensão Externa Pokémon** ([03](03-mundo-e-narrativa.md) §6.3) — o asset não se perde, muda de endereço e de faixa de nível (3–16 → 14–24).

**Sprites:** só Pokémon (front/back/shiny/icons/footprints/alt) e V-Monsters. **Digimon, Medabots, Monster Rancher e todo o mundo-base continuam sem arte.** Áudio: 655 cries + RTP padrão do MZ.

**Lacunas conscientes** (decidido NÃO fazer na v1 — ver [01](01-visao-geral.md)): breeding, day/night, clima, duplas, held items, habilidades em batalha, multiplayer.

## Backlog de engine (priorizado)

| Item | Tam. | Marco | Nota |
|---|---|---|---|
| **Espécies nativas dos Doze Mundos (~12) + sprites** | G | M2 | Bloqueador nº 1 da slice; ver risco 1 |
| **Encontro não hostil** (3 saídas antes da batalha) | P | M2 | Requisito de cânone, não sabor ([03](03-mundo-e-narrativa.md) §10) |
| **Estado pós-fenda por switch** (props/colisão numa área-base) | P | M2 | Nunca dois mapas; modelo para o resto do jogo |
| **Pintar a Região 1 nos mapas novos** — sem isso nenhum encontro dispara | P | M2 | Herdado; agora nos mapas de Primas |
| Touch UI: Pokédex e Storage (Q/W sem equivalente) | P | M1 | [04](04-producao-mobile.md) tem file:line |
| Teste de integridade de assets (JSON → arquivo existe) | P | M1 | Classe de crash já ocorrida |
| `schemaVersion` no save + export/import manual | P | M1 | Antes de qualquer release |
| Limpeza de cache de bitmaps (batalha/Pokédex) | P | M1 | iOS mata aba ~1.5GB |
| Origem do jogador (12 mundos) — só diálogo + item inicial | P | M2 | Cânone §1.3; prólogo próprio está fora da v1 |
| Smoke E2E Playwright no build web | M | M3 | Boot→captura→save→reload |
| **Estações de raiz** (viagem rápida por destino já visitado) | P | M5 | Substitui "Nexus restaurado" |
| Encontros Water/Rod (dados já existem) | P | M4 | Engine só rola "Land" |
| TM ensina golpe (campo `machine` já existe) | M | M4 | |
| `priority` no turn order (campo existe, ignorado) | P | M4 | |
| Shiny nas cenas de batalha (pastas *_shiny) | P | M4 | Verificar uso real |
| **UI de montagem de Medapeças** (só há comando de plugin) | M | M6 | Jogador não troca peça pelo menu |
| Fonte de discos no mundo (baús, NPCs, drops) | P | M7 | Santuário sem entrada de discos |
| **Eventos que concedam Marca G.C. e Emblema** | P | M9 | API pronta (`MON_Pacts`), ninguém chama |
| Cura de Monstro Encrenqueiro pós-vitória | P | M9 | Cânone §9.4: cura-se, não coleciona |
| MOVE_EFFECTS dos golpes usados pelas espécies obtíveis | contínuo | M2+ | Nunca os 559; só o que entra em jogo |
| ~~Barra de Elo — `MON_Link.js`~~ | — | ✅ | |
| ~~`data/species/VMO.json` + conversão da arte de Folklora~~ | — | ✅ | 35 espécies, sprites convertidos |
| ~~Evolução ramificada, peças + drop, Santuário de Discos, gate de pacto~~ | — | ✅ | |

Tam.: P = dias, M = ~1 semana, G = mais que isso.

## Marcos (1 build jogável/mês; build que não roda em touch não conta)

Numeração de gates conforme [03](03-mundo-e-narrativa.md) §6.1: **12 no total** — 2 em Primas, 2 por Dimensão Externa.

### M0 ✅ — Engine port XP→MZ
Concluído ([roadmap-port-mz.md](roadmap-port-mz.md)).

### M1 — Mobile Playable + fundação de QA
- Touch nos gaps de Pokédex/Storage; `touchUI` conferido; build **web + PWA** no ar (hospedagem própria); passe de pngquant (342→~120MB); teste de integridade de assets; `schemaVersion`; limpeza de cache de bitmaps.
- **Aceite:** demo de teste atual jogável num Android low-end e num iPhone (PWA), save sobrevive a fechar o app, suíte headless verde (953 asserts).

### M2 — Vertical Slice A: **Primas jogável** (bíblia P0→P2)
- Mapas: Vila Primeiro Passo + 4 interiores prioritários; Campo do Primeiro Sonho nos dois estados; Campos do Primeiro Sol; Bosque dos Vasos; núcleo da Cidade dos Porcos.
- Dados: **~10 espécies nativas de Primas** (nv 3–14) com sprites + a primeira criatura externa capturável; encontros religados; treinadores dos 60 usados em rota.
- Sistemas: encontro não hostil, estado pós-fenda por switch, **gate 1 = Colégio de Primas**, origem do jogador como sabor.
- Sequência: chegada → Colégio e candidatos → Bucky/Spark/Jibaku → cerimônia → fenda → emergência → viagem à Cidade dos Porcos (bíblia §30).
- **Aceite:** 60–90 min de jogo contínuo no celular sem debug menu; a criatura externa entra no time aos ~45 min; a missão da Cidade dos Porcos resolve-se **sem batalha obrigatória**.

### M3 — Vertical Slice B: **a fenda de Pokémon** → **DEMO**
- Raiz Clara em versão mínima (Posto das Fendas); passagem estabilizada; **Coral Town reaproveitada** + Rota 1 + Ginásio (**gates 3–4**); 18 Pokémon obtíveis rebalanceados para 14–24; E2E Playwright rodando; cutscene de fechamento.
- **Antecipação de Folklora:** 1 mapa-vitrine. Fora do fluxo da demo — existe só para haver material público exibível (risco 2).
- A demo **pula Rockside**: o gate 2 entra em M4 e passa a preceder a fenda no jogo final. Inserção prevista, não dívida.
- **Aceite:** demo 90–120 min completa no celular; equipe mista (nativo + Pokémon) atravessando a fenda; distribuição interna (URL privada) para playtest.

### M4 — Primas completa (bíblia P3) + dívidas de engine
- Trilha das Pedras Vivas, Rockside City (**gate 2 — Arena da Pedreira**), Cratera Drago Rock, Estrada da Raiz Clara, Raiz Clara completa, Passo do Degelo; saída bloqueada para Secandas visível no mapa.
- Dívidas: TMs, Water/Rod, `priority`, shiny visual, MOVE_EFFECTS dos golpes em uso.
- **Aceite:** Ato 1 inteiro jogável do início, sem eventos de teste no build; a bíblia §32 (critérios de aceitação de Primas) passa item a item.

### M5 — Dimensão Externa Digimon
- 6 mapas, Torre de Dados (**gates 5–6**), 10 Digimon obtíveis, item Digi-Link, duelo com o rival de Primas. **Estações de raiz restauradas** (6º gate) = trânsito livre.
- **Aceite:** um Rookie evolui para ramos diferentes em saves diferentes; viagem rápida ativa entre destinos visitados.

### M6 — Dimensão Externa Medabots
- 5 mapas, Arena Robattle (**gates 7–8**), **UI de montagem de peças**, ~10 modelos × 4 peças, Medal Case.
- **Aceite:** loop "vence Robattle → ganha peça → remonta Medabot" funcionando pelo menu.

### M7 — Dimensão Externa Monster Rancher
- 5 mapas, Santuário de Discos, ~20 espécies geráveis, discos espalhados nas áreas anteriores (backtracking), Circuito da Fazenda, Santuário de Pedra (**gates 9–10**).
- **Aceite:** nenhum encontro capturável na dimensão; toda aquisição via disco; economia de discos revisada em playtest.

### M8 — Dimensão Externa Folklora (V-Monsters)
- 6 mapas (2 cidades de facção, fronteira, 2 rotas, Torre do V-Link — **gates 11–12**), V-Links na loja, emissário da Nova Torre (o que negocia em vez de invadir).
- Dados, plugin e sprites já existem: este marco é **conteúdo de mapa**, não sistema.
- **Aceite:** um V-Monster enche a barra apanhando e evolui no meio da luta escolhendo entre 2 ramos — em qualquer time, **inclusive fora de Folklora**.

### M9 — Centro do continente + release 1.0
- Clareira do Novo Zero (Conselho + anel de estações de raiz); gauntlet das antigas Grandes Crianças = **Marcas GC_01..GC_12**; Coração da Árvore (3 mapas-colagem); **12 espíritos** como ecos gated por Marca; cura de Encrenqueiro; pós-game de captura livre; passe de balanceamento da curva inteira; corte final de assets; **APK Capacitor <250MB**; página de download discreta.
- **Aceite:** campanha 12–16h completa; caçada dos doze ecos cruzando as áreas já visitadas; device matrix ([04](04-producao-mobile.md)) verde; plano de resposta a C&D decidido e escrito.

### Efeito da virada no calendário
A antiga dimensão Bucky (M7) **desapareceu como marco**: seus 6 mapas foram para Primas (M2/M4) e seus sistemas — Marca, Emblema, pactos, golpes Jibaku, Encrenqueiros — para o endgame (M9). O número de marcos não mudou. O custo real da virada está concentrado em **M2**, que virou o marco mais pesado do projeto: precisa de mapas do zero (não há mais Coral Town para reaproveitar na largada) **e** de um elenco nativo que não existe.

## Riscos (top 5)

1. **Arte do mundo-base — novo risco nº 1.** Antes, o buraco de sprites começava em Digimon (M3). Agora começa na primeira tela do jogo: Primas precisa de ~10–12 criaturas nativas com front/back/ícone, e a faixa `BKY` só tem espíritos e Encrenqueiros. Não há rip de fã pronto para a fauna comum de Jibaku-kun na escala necessária. Mitigações: manter o elenco da slice em ~10; usar as três espécies já ancoradas pelo cânone (Chicky, Drago Rock, Fadas do Vaso) como âncora de estilo; tratar arte encomendada/desenhada como item de M2, não de M9. **Se o elenco nativo não fechar, M2 não sai** — é o único item do roadmap com essa propriedade.
2. **Sprites das Dimensões Externas** — Digimon, Medabots e Monster Rancher continuam sem arte (aquisição, curadoria, padronização 48px). Mitigação inalterada: dex pequenas por dimensão (10/10/20/16). Alívio real: **V-Monsters já está resolvido** (arte do dono, convertida).
3. **Legal — a exposição aumentou.** A porta de entrada do jogo agora é IP licenciada (Bucky/Jibaku-kun, Enoki Films), não mais um hub original. Consequência prática: **nenhum screenshot de Primas é material público seguro** — o que restringe ainda mais o material exibível a Folklora e aos elementos de arte própria, e torna o mapa-vitrine de M3 mais necessário, não menos. Mitigações e plano de resposta em [04](04-producao-mobile.md).
4. **Performance mobile** — memória (cache de bitmaps) mais que peso. Budget e limpeza em M1; medir todo release.
5. **Scope creep de mundo.** Doze países cabem na ficção, não no calendário. O contrato da v1 é: **um mundo jogável (Primas) + cinco Dimensões Externas + o centro**; os outros onze existem como faixa de transição, NPC no Conselho e Marca no Ato 3. Pedido de país jogável extra → vira v1.1.

## Métricas por release

Testes headless (piso **953 asserts**, nunca regride) · zero erro de console em 15 min de play · FPS no low-end de referência · peso do build e tempo até title em 4G · mapas/treinadores/espécies implementados vs. planejados · tempo até a primeira captura · tempo até a primeira criatura externa no time.
