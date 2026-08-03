# 02 — Franquias: identidade mecânica

> **Status:** 5 dos 6 sistemas estão implementados; a **Barra de Elo** (V-Monsters)
> está especificada aqui e ainda não tem plugin. Detalhes técnicos, faixas de ID e
> desvios de implementação em [06-arquitetura-franquias.md](06-arquitetura-franquias.md).
> Elenco cadastrado: 649 Pokémon (Kanto recortado em `data/dex/KANTO.json`),
> 101 Digimon de *Adventure*, 10 Medabots + 40 peças, 13 Monster Rancher, 20 Bucky,
> **0 V-Monsters** (faixa 970–1069 reservada; a arte já existe na fonte).

Regra: **reusar o engine existente** (batalha 1v1, fórmula de dano/captura, evolução por nível, tabela de tipos data-driven) e permitir **no máximo UM sistema novo por franquia**.

## Resumo executivo

| Franquia | Sistema novo único | Captura temática | Tudo o resto |
|---|---|---|---|
| Pokémon | nenhum (baseline) | Poké Bola (fórmula de referência) | intacto |
| Digimon | evolução ramificada com condição | `Digi-Link` — "conexão de Digivice" | fórmula de captura idêntica, skin nova |
| Medabots | drop de peça pós-vitória | `Medal Case` — ejetar a Medalha em HP baixo | peças = equips nativos do MZ (trait Add Skill) |
| Monster Rancher | Santuário de Discos (item → sorteio → monstro) | **sem captura em campo** (identidade!) | treino = itens de stat; torneio = sequência de treinadores |
| Bucky | Emblemas G.C. como gate de 12 espíritos lendários | Pacto (fórmula de captura + flag de emblema) | Jibaku = skill de recoil/autodesmaio já suportada |
| V-Monsters | **Barra de Elo** — evolução definitiva decidida dentro da batalha | `V-Link` — **absorve os dados** do monstro enfraquecido | fórmula de captura idêntica; camada cyber é reskin de status/itens |

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

## 6. V-Monsters — Barra de Elo

**Fonte: IP própria do dono** (`vmonsters-forgotten-link`, Unity — arte desenhada à mão, trilha original, time creditado). É a única dimensão sem titular de terceiro; a consequência de produção disso está em [05](05-roadmap.md).

- **Fantasia:** o **V-Link** não é uma bola — é o aparelho que *comanda* o monstro em campo e **absorve os dados** de um V-Monster selvagem enfraquecido. O que cresce durante a luta não é vínculo abstrato: é uma barra visível. Trocar dano constrói o **elo**, e o elo cheio libera evoluir **no meio da batalha**.
- **Sistema novo:** **Barra de Elo** — medidor por monstro, zerado no início de cada batalha. A 100% o jogador escolhe entre os **ramos de evolução** da espécie; a forma nova entra com stats novos e **restaura HP**. **A forma conquistada é definitiva** — o V-Monster sai da luta evoluído e assim permanece.
- **Captura por absorção de dados:** a fórmula existente vale sem mudança (quanto mais ferido, mais fácil), mas o flavor é outro — o V-Link puxa os dados do alvo em vez de prendê-lo numa bola. Três tiers: `V-Link`, `V-Link Pro`, `V-Link MAX`.
- **Pontuação (números da fonte, `EvoGain`):** apanhar **+30**, atacar **+20**, crítico **+30** dos dois lados, defender **−5**. Consequência: **apanhar enche 1,5× mais rápido que bater** — a barra premia quem está segurando o turno, não quem já está ganhando. Mantido como está: é exatamente o que impede o elo de virar "quem tem vantagem evolui primeiro".
- **Teto por espécie, não 100 fixo** (`MaxEvo`; Kagenari = 150). Quem evolui cedo tem teto baixo, quem evolui tarde tem teto alto — balanceamento em dado, sem tocar em código.
- **Mapeamento no engine:** `MON.Battle.registerDamageHook(fn)` já existe e recebe `{attacker, defender, damage, crit, moveId}` a cada golpe que acerta. Um plugin `MON_Link.js` (prefixo MON — a barra é infraestrutura; VMO é só quem a usa) pontua os dois lados, devolve a mensagem de elo cheio e mantém a forma conquistada. **Zero edição em `MON_Battle.js`.**

### Por que isso não colide com a digievolução ramificada do Digimon

| | DGM — digievolução ramificada | VMO — Barra de Elo |
|---|---|---|
| Quando | fora da batalha, ao subir de nível | dentro da batalha, com a barra cheia |
| Gatilho | histórico do monstro (desmaios, vitórias, stat, item) | dano trocado no turno |
| Quem escolhe | o sistema, pela condição | **o jogador, na hora** |
| Duração | permanente (só o De-digivolve reverte) | permanente, sem volta |
| Custo | colunas na tabela + `if` no hook de evolução | 1 barra + menu de 2 opções |

As duas são permanentes; o que as separa é **quando e quem decide**. No Digimon o sistema resolve sozinho, fora da batalha, por histórico do monstro. No V-Monsters é o jogador quem escolhe o ramo, no meio da luta, com a barra que ele encheu apanhando — o custo é ter aguentado o turno. Uma é progressão automática; a outra é decisão sob pressão.

- **Captura temática:** **V-Link / V-Link Pro / V-Link MAX** (`catchBonus` 1 / 2 / 3,5, pocket 3) — fórmula de captura padrão, verbo "vinculado". ⚠️ **A fonte não tem captura implementada**: lá o V-Link comanda, não prende. Coleção em Folklora é **invenção do fangame**, para a dimensão caber no contrato do multiverso.
- **Camada digital como reskin, nunca como sistema:** status **Lag** → Paralisia; tipo **Virus** → Sombrio/Venenoso na tabela unificada; **Malware Cleaner / Code Purifier / Neural Reset** → curativos de status existentes com nome novo; glitch → animação. Custo ~zero, identidade preservada.

**Riscos de escopo / o que NÃO fazer**

- **Não portar a batalha em tempo real.** A fonte é real-time com barra de turnos; aqui é por turnos, 3v3 ([07](07-batalha.md)) — a ordem de turno já entrega o "quem age primeiro" do tutorial original.
- **Não portar os 14 tipos de Folklora** (1,5× / 0,65×; Wild, Ghost, Dark, Mechanical, Arcane e Virus super efetivos contra si mesmos; Virus neutro contra tudo). Seria a segunda matriz que a tabela unificada existe para impedir. V-Monster recebe 1–2 tipos do chart de 18, como todo mundo.
- **Não criar EP como recurso separado** — PP já ocupa esse lugar.
- **Máximo 2 ramos por evolução**, mesmo teto do DGM. A fonte chega a 3 formas alternativas para a mesma base (Quillara); entram as duas melhores, o resto vira arte de reserva.
- **Elo não persiste entre batalhas**, não vira item e não sobe de nível. Elo permanente = DGM com outro nome.
- **Sem escolha de protagonista, campanha dupla ou múltiplos finais** — a narrativa é a do Nexus ([03](03-mundo-e-narrativa.md)).
- **Elenco:** a fonte tem **16 linhas base + 19 formas alternativas** de arte pronta. Alvo v1: **~16 espécies** na faixa 970–1069 (100 slots, folga de sobra); o excedente é pós-game.

## Tabela de tipos unificada

**Decisão: os tipos Pokémon existentes (chart do `Types.json`, já 18×18 no jogo) são a língua franca universal. Nenhuma camada extra de combate.**

- Toda espécie de toda franquia recebe 1–2 tipos na tabela **já existente**. Zero engine novo; o jogador usa o que já sabe ("Greymon é Fogo, Metabee é Aço/Elétrico").
- Mapeamentos naturais: Medabots → sempre Aço + secundário pela função; Digimon → pelo elemento visual; Monster Rancher → pela raça (Suezo=Psíquico, Tiger=Elétrico/Gelo, Golem=Pedra); espíritos de Bucky → tipo do seu mundo; V-Monsters → tradução direta do tipo de Folklora (Aquatic→Água, Plant→Planta, Mechanical→Aço, Arcane→Psíquico, Virus→Sombrio/Venenoso).
- Por que não o triângulo Vaccine>Virus>Data como camada ativa: dobra a matriz mental do jogador, exige UI nova e balanceamento em duas dimensões — ganho pequeno, custo alto. A identidade Digimon já está na evolução ramificada.
- Plano B (só se playtest pedir): atributo Digimon como modificador plano ×1.15, nunca segunda tabela.
