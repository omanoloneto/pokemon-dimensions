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

## 5. Doze Mundos (Bucky/Jibaku-kun) — camada de meta-progressão

> **Fonte canônica:** [`referencias/biblia-doze-mundos-v0.11.md`](referencias/biblia-doze-mundos-v0.11.md), documento de direção do dono. Continuidade do mangá, **Ano 7 da Nova Árvore**.
> Abaixo, **[bíblia]** marca o que vem do documento e **[expansão]** o que o fangame inventou para caber no motor.

### 5.1 O que a bíblia fixou (e o que isso invalidou)

- **[bíblia 2, 12]** Os Doze Mundos **não são uma dimensão entre outras**: são doze países de um mesmo continente circular, o **mundo-base** do jogo. Pokémon, Digimon, Medabots, Monster Rancher e V-Monsters são **Dimensões Externas**, que chegam por **fendas**. A primeira fenda abre em Primas, durante a sucessão de Bucky.
- **[bíblia 5]** No centro, onde havia a Torre Pontiaguda (Mundo Zero), hoje está a **Árvore de Amano**. **Mundo Zero não existe mais como lugar visitável** — existe a Clareira do Novo Zero, sobre as ruínas.
- **[bíblia 1.2, 8]** **Jibaku absorveu os outros onze Espíritos e é o único Espírito remanescente.** O modelo "uma Grande Criança + um Espírito por mundo" tornou-se inviável. ⚠️ Isso **invalidou a premissa antiga de colecionar 12 espíritos**.
- **[bíblia 8]** O jogador é o **sucessor direto de Bucky**, reconhecido como nova Grande Criança de Primas. Herda Jibaku, o Relógio GC e a responsabilidade — não um título eterno.
- **[bíblia 9.4]** **Monstro Encrenqueiro é estado, não espécie**: criatura alterada pela antiga toxina da Árvore do Zero, hoje rara, e **curável**. ⚠️ Isso invalidou "Troublemonster = espécie própria e permanente".
- **[bíblia 10]** O **Relógio GC** é o aparelho herdado, convertido por Undicus: registra criaturas, mostra mapas e **identifica resíduo de toxina**. Ele **não consegue classificar** as criaturas das fendas — é assim que o jogo estabelece que elas são externas.

### 5.2 Ecos de Raiz — o que sobrou dos onze Espíritos

**[expansão]** Os onze Espíritos absorvidos não sumiram sem deixar rastro: a energia deles escoou pelas **doze raízes de Amano** ([bíblia 4]) e cada mundo que perdeu o seu ficou com um **Eco de Raiz** — um lendário alojado na raiz que atravessa aquele país.

Por que essa saída e não "Monstros-Guia lendários" ou "guardiões das raízes" puros: ela é a única que **explica a ausência em vez de ignorá-la**. O eco existe *porque* houve fusão, e **Primas não tem eco** — o Espírito dele continua vivo e anda com o jogador. A geografia do relógio vira a estrutura de coleção sem recriar o sistema que a bíblia declarou inviável.

- **Jibaku é único e não-capturável.** O gate barra a captura dele em qualquer situação, mesmo com os doze Selos. Ele é herdado por evento, não pactuado.
- Onze ecos, um por mundo, na ordem do relógio. O **Selo é a posição do mundo**: `GC_01` Primas … `GC_12` Doidicus.

| id | espécie | tipo | mundo | selo | por que ali |
|---|---|---|---|---|---|
| 900 | **Jibaku** | Fogo | Primas | — (herdado) | terra natal de Bucky [bíblia 13.1] |
| 901 | Bambi | Psíquico | Secandas | `GC_02` | tradição psíquica [bíblia 13.2] |
| 907 | Petrac | Pedra | Trios | `GC_03` | montanhas e escadarias esculpidas [bíblia 13.3] |
| 905 | Gelac | Gelo | Tetras | `GC_04` | o eco que se recusou a derreter: o país mais resistente às reformas [bíblia 13.4] |
| 906 | Terrac | Terra | Pentas | `GC_05` | desertos e irrigação [bíblia 13.5] |
| 904 | Voltac | Elétrico | Hexas | `GC_06` | amplificadores e tecnologia sonora [bíblia 10] |
| 910 | Umbrac | Sombrio | Seteras | `GC_07` | ninjutsu e a sombra da obediência cega [bíblia 13.7] |
| 902 | Aquac | Água | Octas | `GC_08` | potência marítima [bíblia 13.8] |
| 909 | Fantac | Fantasma | Novas | `GC_09` | identidade contemplativa e de memória [bíblia 13.9] |
| 903 | Verdac | Planta | Dicas | `GC_10` | floresta tropical, raízes visíveis [bíblia 13.10] |
| 908 | Ferrac | Aço | Undicus | `GC_11` | fábricas, robôs, motores [bíblia 13.11] |
| 911 | **Dragac** | Dragão | Doidicus | `GC_12` | o eco mais antigo, sob o gelo, com o povo perdido [bíblia 13.12] |

Stats, curvas e golpes das doze espécies são os mesmos de antes — mudou só a lore. **Dragac continua o endgame**: dorme até os outros **dez** pactos estarem firmados (era "onze"; o número agora sai de `echoes().length - 1`, não de constante).

### 5.3 Sistema novo único: o pacto

- **Selo de Raiz** (`GC_01`..`GC_12`) — insígnia reusada 1:1, guardada em `$gameSystem`, registrada no Relógio GC. É o reconhecimento daquele país: sem ele o eco local recusa. `GC_01` vem da cerimônia de sucessão em Primas; os outros onze, de cada mundo. **[expansão]** quem concede é o antigo Grande Criança / conselho local ([bíblia 7, 8]), não um chefe a derrotar — por isso a API é `recognizeInWorld()`, não mais `defeatGreatChild()`.
- **Relógio GC** — o item `GCEMBLEM` (pocket 3, `catchBonus` 12, `keepOnUse`). É o aparelho que se ergue para firmar o pacto e não se gasta no arremesso.
- **Economia:** eco a 1 de HP = 23% por arremesso; 35% com paralisia; 47% dormindo; intacto ~8%. Preparado sai em ~2 arremessos, despreparado passa de 9 — o pacto é desafio de **preparo**, não de repetição. Dragac (`catchRate` 3) é metade disso.
- **Fantasia:** vínculo único e vitalício — o oposto do "gotta catch 'em all".
- Golpe assinatura **Jibaku** = dano altíssimo + recuo pesado ou autodesmaio, só linhas de skill sobre `recoil`/`drain`/`selfKO` já existentes. Os auto-destrutivos ficam acima do nível 47 de propósito: eco selvagem com `selfKO` se derrubaria sozinho e tornaria o pacto impossível.

### 5.4 Encrenqueiros: estado curável — e o desvio de implementação

**[bíblia 9.4]** "Uma criatura que se torna Encrenqueira pode ser curada; ela não constitui uma espécie diferente."

**Desvio assumido:** o MZ não tem *estado de espécie*, e mudar a espécie em tempo de execução já é uma operação suportada (`evolveInto`). Então as 8 linhas `912-919` continuam existindo na tabela, mas **deixaram de ser espécies e passaram a ser o estado corrompido de outra criatura**:

- o campo `corruptedFrom` é o **caminho de volta** — ele aponta a criatura de verdade que está por baixo da toxina;
- `MON.Pacts.purify(monster)` faz esse caminho reusando o mesmo `evolveInto` da evolução, **sem motor novo**: mesmo indivíduo, mesmo nível, espécie de volta ao normal;
- o gate de captura **nega** a captura de Encrenqueiro com o motivo canônico — *"isso não se captura, se cura"* — e o desfecho de campo é a cura, não a coleção;
- curado, o monstro volta a seguir as regras da **própria franquia** (um Greymon curado é capturável com Digi-Link).

**[expansão]** Os 8 casos catalogados são criaturas de Dimensões Externas que caíram em ruínas lacradas onde o resíduo ainda existe ([bíblia 23.3]: resíduo só em cavernas profundas e áreas seladas). A bíblia previa que moradores *confundissem* uma criatura estrangeira com um Encrenqueiro ([bíblia 25.6]); aqui a confusão às vezes é verdade.

### 5.5 Não fazer

- **Não** recriar "uma Grande Criança + um Espírito por mundo": a bíblia declarou o modelo inviável.
- **Não** tornar Jibaku capturável, duplicável ou opcional. Um só, herdado.
- **Não** tratar Encrenqueiro como troféu de Dex nem criar dezenas deles: a bíblia diz que **novos casos são raros**.
- **Não** ressuscitar o Mundo Zero como área jogável; o centro é a Clareira do Novo Zero.
- **Não** colocar companheiro fora da party nem dupla G.C.+espírito em batalha.

### 5.6 Pendências de cânone (fora do escopo deste documento)

1. **`docs/03-mundo-e-narrativa.md`** já foi reescrito contra a bíblia e a §6.2 dele deixa em aberto exatamente o conflito que esta seção resolve ("os dados têm doze espíritos e o plugin gira em torno deles"). Falta trocar lá: *espírito de cada mundo* → **Eco de Raiz**, *Marca de Grande Criança* → **Selo de Raiz**, 12 → **11 ecos + Jibaku herdado**, e registrar que a cura do Encrenqueiro já está implementada (`MON.Pacts.purify`).
2. **`docs/05-roadmap.md`, marco M7** ainda descreve "6 mapas (dimensão-hub com câmaras), Templo Elemental (Chaves 11–12), 12 espíritos lendários com gate de Emblema G.C." — tudo pré-bíblia. Reordenação de produção pendente (Primas é a primeira região jogável, não um hub de câmaras).
3. **A linha de Bucky no resumo executivo** (topo deste documento) ainda diz "Emblemas G.C. como gate de 12 espíritos lendários"; o correto é "Selo de Raiz + Relógio GC como gate de 11 Ecos de Raiz".
4. **`data/ItemsExtra.json`**: `GCEMBLEM` ainda se chama "Emblema G.C." e sua descrição fala em "espírito de um mundo". Deveria virar "Relógio GC" / "eco de um mundo".
5. **`data/Franchises.json`**: o `deniedText` de BKY ("falta o emblema deste mundo") e o `successText` ("aceitou você como Grande Criança") precisam do vocabulário novo; e `dimension: "Dimensão dos Doze Mundos"` contradiz a bíblia, que faz dos Doze Mundos o mundo-base, não uma dimensão.

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
