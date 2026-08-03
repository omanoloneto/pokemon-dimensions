# 06 — Arquitetura Multi-Franquia (referência técnica)

## Convenção de nomes: `MON` é infraestrutura, `PKM` é franquia

O que é comum a todas as franquias usa o prefixo genérico **`MON`**; `PKM` sobrou **apenas** como o identificador da franquia Pokémon.

| Genérico (vale para todas) | Específico da franquia Pokémon |
|---|---|
| plugins `MON_*.js`, namespace `MON.*` | id de franquia `"PKM"` em `Franchises.json` e no campo `franchise` das espécies |
| `Game_Monster`, `Game_Human`, `$dataMonsters` | prefixo de mapa `D1_PKM_CoralTown`, switch `PORTAL_PKM` |
| métodos `monParty()`, `monAdd()`, `monDex` | dex regional `data/dex/KANTO.json` |
| `data/Monsters.json`, `data/MonItems.json`, `img/monsters/` | |

Ao criar código novo: se a regra vale para Digimon, Medabot ou Monster Rancher, ela é `MON`. Se só faz sentido para Pokémon, é dado de franquia, não código.

Como [02-franquias.md](02-franquias.md) vira código. Regra que governa tudo: **os monstros de todas as franquias vivem no mesmo `$dataMonsters` e usam o mesmo motor de batalha, captura, party e PC.** Franquia é um recorte de dados, não um segundo engine.

## Faixas de ID de espécie

| Franquia | IDs | Cadastradas | Arquivo-fonte |
|---|---|---|---|
| MON Pokémon | 1–649 | 649 | `data/Monsters.json` (base, intocado) |
| DGM Digimon | 650–799 | 101 | `data/species/DGM.json` — elenco de *Digimon Adventure* |
| MDB Medabots | 800–849 | 10 | `data/species/MDB.json` |
| MRA Monster Rancher | 850–899 | 13 | `data/species/MRA.json` |
| BKY Bucky | 900–919 | 20 | `data/species/BKY.json` — 12 espíritos + Troublemonsters |

IDs são **contíguos e sem sobreposição** — a franquia de um monstro é deduzível do ID, sem lookup extra. Buracos dentro de uma faixa são normais (faixa dimensionada com folga).

## Pipeline de dados

```
data/species/*.json  ─┐
                      ├─ node tools/build_species.js ─→ data/SpeciesExtra.json
data/moves/*.json    ─┘                              ─→ data/MovesExtra.json
                                                          │
                          MON_Franchise.install() ────────┘
                                    ↓
              $dataMonsters / $dataMoves / $dataItems2 (fundidos em runtime)
```

`build_species.js` é também o **validador**: reprova ID fora da faixa, ID duplicado, golpe inexistente em `levelMoves` e alvo de evolução quebrado. Rode-o sempre que mexer em dados de espécie.

O merge acontece em `MON.Franchise.install()`, chamado por alias de `Scene_Boot.onDatabaseLoaded` no jogo e manualmente no harness headless. É idempotente.

## MON_Franchise.js — a camada core

```js
MON.Franchise.ofSpecies(id) / .of(pokemon) / .idOf(pokemon)  // qual franquia
MON.Franchise.speciesOf("DGM")                               // espécies da faixa
MON.Franchise.captureRule(pokemon, itemName) -> {allowed, reason}
MON.Franchise.itemWorksOn(itemName, pokemon)
MON.Franchise.registerCaptureGate(fn)                        // gate extra (MON_Pacts usa)
MON.Franchise.throwText / .successText                       // texto temático da captura
```

Regras de captura vivem em **dados** (`data/Franchises.json`), não em código:

| Campo | Efeito |
|---|---|
| `capture.inField: false` | bloqueia captura em campo (Monster Rancher) |
| `capture.items: [...]` | itens que funcionam nessa franquia; Poké Bolas comuns só valem para quem não declara itens próprios |
| `capture.maxHpRate` | exige alvo abaixo desse % de HP (Medabots: ejetar a medalha) |
| `capture.requiresBadge` | delega ao gate registrado por `MON_Pacts` (Bucky) |
| `capture.throwText/successText/deniedText` | flavor por dimensão, com `{target}` e `{item}` |

Consequência prática: uma franquia nova é **um bloco de JSON + um plugin**, sem tocar em `MON_Battle.js`.

## Pontos de extensão no core (use estes; não edite os plugins base)

| Gancho | Onde | Para quê |
|---|---|---|
| `MON.Battle.registerVictoryHook(fn)` | MON_Battle | recompensa pós-vitória (drop de peça Medabot) |
| `MON.Franchise.registerCaptureGate(fn)` | MON_Franchise | condição extra de captura (emblema G.C.) |
| `MON.Battle.MOVE_EFFECTS` | MON_Battle | efeitos de golpe, via `Object.assign` do seu plugin |
| `MON.Battle.applySelfEffect` | MON_Battle | `{recoil}`, `{drain}`, `{selfKO}` — base do golpe Jibaku |
| alias de `Game_Monster.prototype.*` | MON_Monster | stats por peça, evolução condicional |

Estado por monstro que o core já mantém para as franquias usarem: `_evoHistory` (com `devolve()`), `record()` com `wins`/`faints`/`friendship`, e `highestStat()`.

## Métodos de evolução suportados

O engine original só entendia `Level`, `LevelMale` e `LevelFemale` — o que deixava **40 das 151 espécies de Kanto com evolução morta** (Pikachu→Raichu e as 7 do Eevee incluídas). `MON_Evolution.js` cobre agora:

| Método | Como funciona aqui |
|---|---|
| `Level`, `LevelMale`, `LevelFemale` | inalterado (regressão zero verificada em 25.311 comparações) |
| `Item` (pedras) | usar a pedra pela mochila dispara a evolução |
| `Happiness`, `HappinessDay`, `HappinessNight` | amizade do `record()`; sem ciclo dia/noite no jogo, Day/Night caem no mesmo critério |
| `HasMove` | evolui se conhece o golpe indicado |
| `Trade`, `TradeItem` | sem troca entre jogadores (fora de escopo): item **Cabo Link** cria o vínculo |
| `Location` | lê o mapa atual; os ids entram quando os mapas existirem |
| desconhecido | **falha fechada** — nunca evolui |

O lookup usa apenas chaves próprias (`hasOwnProperty`): sem isso um `method: "toString"` resolveria pela cadeia de protótipo e evoluiria errado, e `"valueOf"` derrubava a batalha.

## Desvios conscientes do documento de design

1. **Medabots não usa o sistema de equipamento nativo do MZ.** O doc sugeriu equips nativos, mas os monstros são `Game_Monster`, não `Game_Actor` — traits de ator não se aplicam. As peças viraram slots próprios com alias de `stat()`. A fantasia (4 slots, peça dá golpe, drop pós-vitória) é idêntica; a implementação é que difere.
   - **Peça tem prioridade sobre golpe de nível, e o deslocado vai para a "bancada"** (`_monBenchedMoves`), voltando quando a peça sai. Sem prioridade, nenhum Medabot da faixa de D3 entrava em batalha com um único golpe de Medapeça (os 4 slots já vinham cheios da curva de nível); sem a bancada, montar uma peça apagaria golpe de forma permanente, já que o port não tem reaprendiz.
   - **O bônus de peça escala com o nível** (`2 × valor × nível / 100`, a mesma fórmula do resto do jogo). Bônus plano valia +40% no nv30 e +25% no nv50 — a franquia enfraquecia sozinha ao longo da campanha.
   - **Inimigos nascem montados** com o loadout do próprio modelo (alias de `initialize`), senão o drop pós-vitória seria código morto: encontros e treinadores criam monstros com `new Game_Monster(...)` e nunca teriam peças.
2. **O Santuário deriva o monstro INTEIRO da seed** — natureza, gênero, shiny, habilidade e os 6 IVs saem do mesmo PRNG, não do construtor. Sem isso, "o disco define o monstro" era falso e o save-scumming de IV/shiny ficava livre justamente no sistema que existe para impedi-lo.
2. **Sprite ausente não pode derrubar o jogo.** `ImageManager.isReady()` do MZ lança "Failed to load" quando um bitmap em cache falha — e monstros de franquia nova ainda não têm sprite. Por isso `MON.Core.loadSprite()` usa `Bitmap.load()` **fora do cache do ImageManager**, e as cenas caem no placeholder "?". Mesma classe do crash de áudio corrigido em `3fb6a23`.
3. **A Pokédex itera `MON.Core.allSpeciesIds()`**, não `1..maxSpecies` — as faixas com folga deixam buracos que quebrariam a lista.
4. **Busca de espécie por nome é insensível a caixa.** `NIDORANfE` e `NIDORANmA` são os únicos `internalName` não-maiúsculos do banco e caíam calados no fallback: o treinador Douglas entrava em batalha com **dois Bulbasaurs** no lugar dos Nidoran. Nome desconhecido agora avisa no console em vez de falhar em silêncio.

## Convenções para adicionar uma franquia nova

1. Faixa de IDs em `data/Franchises.json` + regras de captura.
2. `data/species/<KEY>.json` (e `data/moves/<KEY>.json` se precisar de golpes novos).
3. Itens de captura em `data/ItemsExtra.json` (`pocket: 3` para aparecerem na batalha).
4. Um plugin `MON_<Sistema>.js` com o **único sistema novo** daquela franquia, ligado pelos ganchos acima.
5. Suíte em `tools/tests/<NN>-<franquia>.js`, carregada automaticamente pelo harness.
6. Registrar o plugin em `js/plugins.js` **na posição correta de dependência** (o arquivo é ordenado por dependência, não alfabeticamente).
