# 06 — Arquitetura Multi-Franquia (referência técnica)

Como [02-franquias.md](02-franquias.md) vira código. Regra que governa tudo: **os monstros de todas as franquias vivem no mesmo `$dataPokemon` e usam o mesmo motor de batalha, captura, party e PC.** Franquia é um recorte de dados, não um segundo engine.

## Faixas de ID de espécie

| Franquia | IDs | Arquivo-fonte |
|---|---|---|
| PKM Pokémon | 1–649 | `data/Pokemon.json` (base, intocado) |
| DGM Digimon | 650–699 | `data/species/DGM.json` |
| MDB Medabots | 700–739 | `data/species/MDB.json` |
| MRA Monster Rancher | 740–779 | `data/species/MRA.json` |
| BKY Bucky | 780–791 | `data/species/BKY.json` |

IDs são **contíguos e sem sobreposição** — a franquia de um monstro é deduzível do ID, sem lookup extra. Buracos dentro de uma faixa são normais (faixa dimensionada com folga).

## Pipeline de dados

```
data/species/*.json  ─┐
                      ├─ node tools/build_species.js ─→ data/SpeciesExtra.json
data/moves/*.json    ─┘                              ─→ data/MovesExtra.json
                                                          │
                          PKM_Franchise.install() ────────┘
                                    ↓
              $dataPokemon / $dataMoves / $dataItems2 (fundidos em runtime)
```

`build_species.js` é também o **validador**: reprova ID fora da faixa, ID duplicado, golpe inexistente em `levelMoves` e alvo de evolução quebrado. Rode-o sempre que mexer em dados de espécie.

O merge acontece em `PKM.Franchise.install()`, chamado por alias de `Scene_Boot.onDatabaseLoaded` no jogo e manualmente no harness headless. É idempotente.

## PKM_Franchise.js — a camada core

```js
PKM.Franchise.ofSpecies(id) / .of(pokemon) / .idOf(pokemon)  // qual franquia
PKM.Franchise.speciesOf("DGM")                               // espécies da faixa
PKM.Franchise.captureRule(pokemon, itemName) -> {allowed, reason}
PKM.Franchise.itemWorksOn(itemName, pokemon)
PKM.Franchise.registerCaptureGate(fn)                        // gate extra (PKM_Pacts usa)
PKM.Franchise.throwText / .successText                       // texto temático da captura
```

Regras de captura vivem em **dados** (`data/Franchises.json`), não em código:

| Campo | Efeito |
|---|---|
| `capture.inField: false` | bloqueia captura em campo (Monster Rancher) |
| `capture.items: [...]` | itens que funcionam nessa franquia; Poké Bolas comuns só valem para quem não declara itens próprios |
| `capture.maxHpRate` | exige alvo abaixo desse % de HP (Medabots: ejetar a medalha) |
| `capture.requiresBadge` | delega ao gate registrado por `PKM_Pacts` (Bucky) |
| `capture.throwText/successText/deniedText` | flavor por dimensão, com `{target}` e `{item}` |

Consequência prática: uma franquia nova é **um bloco de JSON + um plugin**, sem tocar em `PKM_Battle.js`.

## Pontos de extensão no core (use estes; não edite os plugins base)

| Gancho | Onde | Para quê |
|---|---|---|
| `PKM.Battle.registerVictoryHook(fn)` | PKM_Battle | recompensa pós-vitória (drop de peça Medabot) |
| `PKM.Franchise.registerCaptureGate(fn)` | PKM_Franchise | condição extra de captura (emblema G.C.) |
| `PKM.Battle.MOVE_EFFECTS` | PKM_Battle | efeitos de golpe, via `Object.assign` do seu plugin |
| `PKM.Battle.applySelfEffect` | PKM_Battle | `{recoil}`, `{drain}`, `{selfKO}` — base do golpe Jibaku |
| alias de `Game_Pokemon.prototype.*` | PKM_Pokemon | stats por peça, evolução condicional |

Estado por monstro que o core já mantém para as franquias usarem: `_evoHistory` (com `devolve()`), `record()` com `wins`/`faints`/`friendship`, e `highestStat()`.

## Desvios conscientes do documento de design

1. **Medabots não usa o sistema de equipamento nativo do MZ.** O doc sugeriu equips nativos, mas os monstros são `Game_Pokemon`, não `Game_Actor` — traits de ator não se aplicam. As peças viraram slots próprios com alias de `stat()`. A fantasia (4 slots, peça dá golpe, drop pós-vitória) é idêntica; a implementação é que difere.
2. **Sprite ausente não pode derrubar o jogo.** `ImageManager.isReady()` do MZ lança "Failed to load" quando um bitmap em cache falha — e monstros de franquia nova ainda não têm sprite. Por isso `PKM.Core.loadSprite()` usa `Bitmap.load()` **fora do cache do ImageManager**, e as cenas caem no placeholder "?". Mesma classe do crash de áudio corrigido em `3fb6a23`.
3. **A Pokédex itera `PKM.Core.allSpeciesIds()`**, não `1..maxSpecies` — as faixas com folga deixam buracos que quebrariam a lista.

## Convenções para adicionar uma franquia nova

1. Faixa de IDs em `data/Franchises.json` + regras de captura.
2. `data/species/<KEY>.json` (e `data/moves/<KEY>.json` se precisar de golpes novos).
3. Itens de captura em `data/ItemsExtra.json` (`pocket: 3` para aparecerem na batalha).
4. Um plugin `PKM_<Sistema>.js` com o **único sistema novo** daquela franquia, ligado pelos ganchos acima.
5. Suíte em `tools/tests/<NN>-<franquia>.js`, carregada automaticamente pelo harness.
6. Registrar o plugin em `js/plugins.js` **na posição correta de dependência** (o arquivo é ordenado por dependência, não alfabeticamente).
