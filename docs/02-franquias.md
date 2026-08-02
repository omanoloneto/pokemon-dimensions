# 02 — Franquias: identidade mecânica

> **Status:** os 5 sistemas estão implementados. Detalhes técnicos, faixas de ID e
> desvios de implementação em [06-arquitetura-franquias.md](06-arquitetura-franquias.md).
> Elenco cadastrado: 649 Pokémon (Kanto recortado em `data/dex/KANTO.json`),
> 101 Digimon de *Adventure*, 10 Medabots + 40 peças, 13 Monster Rancher, 20 Bucky.

Regra: **reusar o engine existente** (batalha 1v1, fórmula de dano/captura, evolução por nível, tabela de tipos data-driven) e permitir **no máximo UM sistema novo por franquia**.

## Resumo executivo

| Franquia | Sistema novo único | Captura temática | Tudo o resto |
|---|---|---|---|
| Pokémon | nenhum (baseline) | Poké Bola (fórmula de referência) | intacto |
| Digimon | evolução ramificada com condição | `Digi-Link` — "conexão de Digivice" | fórmula de captura idêntica, skin nova |
| Medabots | drop de peça pós-vitória | `Medal Case` — ejetar a Medalha em HP baixo | peças = equips nativos do MZ (trait Add Skill) |
| Monster Rancher | Santuário de Discos (item → sorteio → monstro) | **sem captura em campo** (identidade!) | treino = itens de stat; torneio = sequência de treinadores |
| Bucky | Emblemas G.C. como gate de 12 espíritos lendários | Pacto (fórmula de captura + flag de emblema) | Jibaku = skill de recoil/autodesmaio já suportada |

## 1. Pokémon — dimensão âncora

- É o contrato padrão: capturar enfraquecendo, XP/nível, evoluir, 6 no time, PC. **Zero sistema novo.**
- Sabor de dimensão, se precisar: variantes regionais (linha nova na tabela de espécies, custo ~zero).
- **Não fazer:** habilidades, held items, clima, duplas. Não expandir a dex — congelar e gastar esforço nas outras franquias, que são o diferencial.

## 2. Digimon — digievolução ramificada

- **Fantasia:** o mesmo Rookie vira Champions diferentes conforme o cuidado; vínculo > posse.
- **Sistema novo:** linha de evolução vira lista `[{to, level, condition}]`, com `condition` lida do save (nº de desmaios do monstro, vitórias, stat mais alto, item na mochila). Ex.: Agumon Lv16 → Greymon se desmaiou <3 vezes, senão → Tyrannomon. Implementação: colunas novas na tabela + um `if` no hook de evolução existente.
- **De-digivolve:** item chave que reverte a espécie (mesma operação de evolução, alvo anterior). Sem estado temporário em batalha.
- Atributos Vaccine/Data/Virus: **tag de flavor na Dex, sem efeito de combate.**
- **Não fazer:** digievolução temporária mid-batalha, care mistakes de V-Pet, DNA/Jogress, mais de 2 ramos por estágio.

## 3. Medabots — a Medalha é o monstro

- **Fantasia:** Medalha = alma/XP; corpo = 4 peças trocáveis (cabeça, braços, pernas), cada uma com ataque e stats; Robattle aposta peças.
- **Reuso máximo:** peças são **equipamentos nativos do MZ** — 4 slots, traits `Add Skill` + `Parameter`. Medalha carrega nível/XP no sistema existente. Progressão = colecionar peças, não evoluir.
- **Sistema novo:** drop de 1 peça do loadout do Medabot inimigo ao vencer (tabela de loot no fim da batalha).
- **Não fazer:** HP por parte / dano localizado (segundo sistema de combate inteiro), Medaforce, catálogo acima de ~10 modelos × 4 peças na v1.

## 4. Monster Rancher — monstros nascem de discos

- **Fantasia:** monstro não se captura no mato; é **gerado de um disco** num santuário (eco dos CDs físicos do original).
- **Sistema novo:** **Santuário de Discos** — `Disco` é colecionável (baús, NPCs, drops); levá-lo ao Santuário consome e gera monstro via `speciesPool` + pesos (common event, ~1 tela). A fórmula de captura existente vira a rolagem de raridade (input = raridade do disco em vez de HP).
- Encontros selvagens nesta dimensão dão XP/dinheiro/discos — **nunca captura**. Treino de fazenda = NPC que aplica itens de stat (Protein/Iron já suportados). Torneio = "Circuito da Fazenda", 4 lutas de treinador em sequência.
- **Não fazer:** lifespan/morte de monstro, fusão/combinação, calendário de semanas.

## 5. Bucky (Jibaku-kun) — camada de meta-progressão

Lore (confirmada): 12 mundos + o Mundo Zero; cada mundo guardado por uma **Grande Criança (G.C.)** com um **espírito** parceiro esférico e explosivo ("jibaku" = autodestruição), usado contra **Troublemonsters** — fauna enlouquecida que se combate, não se coleciona.

- **Fantasia:** vínculo único e vitalício — o oposto do "gotta catch 'em all".
- **Mapeamento:** os espíritos são **12 lendários** na tabela existente (stats altos, sem linha evolutiva). Golpe assinatura Jibaku = dano altíssimo + recoil pesado ou autodesmaio (Double-Edge/Explosion) — só linhas de skill, zero código.
- **Sistema novo:** **Emblema de G.C.** — derrotar o guardião de cada dimensão dá um emblema (insígnia reusada 1:1); só com o emblema daquele mundo o espírito aceita o pacto (fórmula de captura + catch rate baixíssimo). Os 12 espíritos são o **endgame que costura o multiverso**; o Mundo Zero é a "Elite Four".
- Bucky é UMA dimensão-hub com câmaras/altares, não 12 overworlds. Troublemonsters = espécies das outras franquias com palette swap "corrompido" + boost de stats (chefes baratos).
- **Não fazer:** companheiro fora da party, dupla G.C.+espírito em batalha, dezenas de Troublemonsters originais.

## Tabela de tipos unificada

**Decisão: os tipos Pokémon existentes (chart do `Types.json`, já 18×18 no jogo) são a língua franca universal. Nenhuma camada extra de combate.**

- Toda espécie de toda franquia recebe 1–2 tipos na tabela **já existente**. Zero engine novo; o jogador usa o que já sabe ("Greymon é Fogo, Metabee é Aço/Elétrico").
- Mapeamentos naturais: Medabots → sempre Aço + secundário pela função; Digimon → pelo elemento visual; Monster Rancher → pela raça (Suezo=Psíquico, Tiger=Elétrico/Gelo, Golem=Pedra); espíritos de Bucky → tipo do seu mundo.
- Por que não o triângulo Vaccine>Virus>Data como camada ativa: dobra a matriz mental do jogador, exige UI nova e balanceamento em duas dimensões — ganho pequeno, custo alto. A identidade Digimon já está na evolução ramificada.
- Plano B (só se playtest pedir): atributo Digimon como modificador plano ×1.15, nunca segunda tabela.
