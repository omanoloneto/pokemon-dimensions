# 09 — Primas · Marco P0: Vila Primeiro Passo

Documento de execução do **Marco P0** da _Bíblia de Mundo: Os Doze Mundos e Primas v0.11_
(`docs/referencias/biblia-doze-mundos-v0.11.md`, seções 24 e 31).

O P0 pede: praça e rua principal de Vila Primeiro Passo, entrada sul, Colégio de Primas,
Campo do Primeiro Sonho vazio e um trecho curto dos Campos do Primeiro Sol.
Tudo isso foi construído em **um único mapa** — `data/Map003.json`.

---

## 1. Como reexecutar o gerador

```bash
node tools/build_map_vila.js
```

O comando reescreve `data/Map003.json` do zero e registra/atualiza a entrada do mapa em
`data/MapInfos.json` (preservando Map001 e Map002). O gerador é **determinístico**:
usa um PRNG com semente fixa (`0x50524d31`), nunca `Math.random`. Rodar duas vezes
produz bytes idênticos.

**O gerador é a fonte da verdade, não o JSON.** Para mudar a vila, edite
`tools/build_map_vila.js` e rode de novo; não edite `Map003.json` à mão (ele seria
sobrescrito na próxima execução). Editar o mapa no editor do MZ funciona, mas as
alterações se perdem se o gerador rodar depois — nesse caso, porte a mudança para o gerador.

Validação do projeto (não deve regredir):

```bash
node tools/build_species.js && node tools/test_harness.js   # 978 asserts, 0 falhas
```

---

## 2. Ficha técnica do mapa

| item | valor |
| --- | --- |
| arquivo | `data/Map003.json` |
| id / nome | 3 · "Vila Primeiro Passo" |
| tamanho | 80 × 92 tiles |
| tileset | 2 — "Exterior" (`Outside_A1..A5`, `Outside_B`, `Outside_C`) |
| construções | **31** (faixa pedida pela seção 24.7: 25–35) |
| eventos | 6 (ponto de partida + 5 placas) |
| região 1 | 73 tiles, só nos Campos do Primeiro Sol |

Camadas usadas (o `data` é `width * height * 6`):

- **z0** — solo base: grama, topo do barranco da colina, calçamento da praça, água.
- **z1** — sobreposições de solo (trilhas, capim alto, raiz branca, canteiros de plantio,
  tabuado das pontes, escadaria) **e** telhados/paredes/face do barranco.
- **z2** — props (`Outside_B`/`C`), cercas, torres, bancas.
- **z3** — props que ficam por cima (mostradores de relógio, chaminés, placas de loja).
- **z4** — sombra projetada a leste das paredes.
- **z5** — região.

### Autotiles

O gerador implementa as tabelas de forma do próprio MZ (`Tilemap.FLOOR_AUTOTILE_TABLE`
e `WALL_AUTOTILE_TABLE`, em `js/rmmz_core.js`) de forma invertida: a partir da vizinhança
de 8 tiles ele calcula o `shape` correto (0–47 para chão, 0–15 para parede/telhado).
São 45 formas distintas em uso — nada de `shape 0` em tudo, que é o que produz borda errada.

Convenção: `id = 2048 + kind * 48 + shape`; A1 começa no kind 0, A2 no 16, A3 no 48,
A4 no 80. As linhas ímpares de A4 (kinds 88–95, 104–111, 120–127) e todo o A3 usam a
tabela de parede.

---

## 3. Layout — a ferradura em torno da colina (seção 24.3)

```
                        y 2..21   CAMPO DO PRIMEIRO SONHO (vazio)
                                  arena de pedra ovalada, cercada de mata
                                          |
                        y 22..46  COLINA DO COLÉGIO  (planalto, x 18..62)
                                  Colégio · torre com relógio · casa de Bucky
                                  alojamento · campo de treino · mirante
                                          |  escadaria (x 38..41, y 46..50)
   y 40..67                         y 50..67                        y 40..67
   BAIRRO DE OFICINAS  ————  PRAÇA DO PRIMEIRO PASSO  ————  BAIRRO RESIDENCIAL
   (x 3..27)                 (x 29..51)                     (x 53..78)
                                          |
                        y 68..70  RIACHO (3 pontes: x 10..13, 38..42, 74..77)
                                          |
                        y 71..91  ENTRADA DOS VIAJANTES
                                  portão · moinho · estalagem · estábulos
                                                    \
                                     x 60..79, y 71..90  CAMPOS DO PRIMEIRO SOL
```

A colina fica no meio; os dois braços da vila sobem por fora dela (x ≈ 10 a oeste,
x ≈ 68 a leste) e se fecham na praça, ao sul — é isso que dá a forma de ferradura,
aberta ao norte.

### Zona sul — Entrada dos Viajantes (y 71..91)

Portão aberto **sem muralha** (duas colunas de pedra em x 36 e x 44, y 85), estalagem
com placa "INN", posto de informações, abrigo de carroças, estábulos com paddock cercado
(x 46..57), casa do porteiro e o **Grande Moinho** (torre redonda + prédio de pedra) sobre
o remanso do riacho. Lampiões marcam a rua principal.

### Zona central — Praça do Primeiro Passo (x 29..51, y 50..67)

Calçamento de pedra arredondada. Fonte baixa de pedra (bacia de água com bordo de pedra)
no centro, com **entulho de coluna quebrada** ao lado — a pedra reaproveitada da Torre.
Duas bancadas de mercado de 4 módulos, quadro de avisos, medalhão cívico no piso,
lampiões e canteiros. No perímetro: loja de suprimentos, clínica comunitária,
edifício do conselho local (com **relógio sem ponteiros** no frontão) e casa de refeições.

### Zona leste — Bairro Residencial (x 53..78, y 40..67)

Oito casas familiares com paletas de telhado/parede diferentes, mais a casa do cuidador
de monstros. Vielas curtas (y 50..51, y 61, x 59..60, x 68..70) que sempre voltam à rua da
ferradura (y 59..60). Ao norte, a **área para monstros domésticos**: curral de terra batida
cercado, com feno, cocho e balde (x 70..78, y 32..39).

### Zona oeste — Bairro de Oficinas (x 3..27, y 40..67)

Carpintaria, oficina de carroças, depósito agrícola, ferraria (com chaminé), **reparo de
Relógios GC** (mostrador de relógio na fachada), serraria e casa do oficineiro. Pilhas de
tora, caixotes e barris no pátio. O terreno vago cercado em x 22..27, y 53..57 é o lugar
reservado para os **objetos deslocados pela fenda** no P1.

### Zona norte — Colina do Colégio (planalto x 18..62, y 22..46)

Barranco de 3 fileiras de rocha em toda a borda sul, com encosta irregular; a única
subida é a **escadaria de pedra** em x 38..41. Em cima: Colégio de Primas (corpo central de
13 tiles + duas alas), **torre com o relógio sem ponteiros** erguendo-se do telhado, pátio
em cruz, casa de Bucky com quintal cercado, alojamento dos candidatos, campo de treinamento
cercado com galpão, e o **mirante** com grade de ferro na borda norte, voltado para a
Árvore de Amano.

### Campo do Primeiro Sonho (x 24..60, y 2..21)

Gramado emoldurado por mata, com um anel de pedra fechado (elipse) marcando a área da
cerimônia. **Vazio**, como o P0 exige. A árvore das fitas dos sonhos marca a entrada
(x 46, y 18), junto à placa.

### Campos do Primeiro Sol (x 60..79, y 71..90)

Trecho curto: celeiro, três talhões cercados (hortaliça, trigo, terra arada), pomar e
capim alto. É a saída sudeste, futuro caminho para a Cidade dos Porcos.

---

## 4. Marcos visuais obrigatórios (seção 24.6)

| marco | onde | como foi feito |
| --- | --- | --- |
| torre do Colégio com relógio sem ponteiros | x 38, y 27..31 | torre redonda de `Outside_C` sobre o telhado + disco de pedra liso (tile 324) como mostrador vazio |
| grande moinho na entrada sul | x 17..26, y 75..81 | torre redonda + prédio de pedra com telhado de sapê, ao lado do remanso do riacho |
| raiz branca de Amano atravessando a lateral da praça | x 27..30, y 50..60 | faixa de autotile de rocha branca saindo do pé do barranco, com troncos e seixos claros por cima, cruzando a lateral oeste da praça |
| árvore das fitas dos sonhos | x 46..47, y 18..19 | árvore isolada com flores em volta, na boca do Campo do Primeiro Sonho |
| colina de Bucky visível de quase toda a vila | planalto y 22..46 | barranco de 3 fileiras atravessando o mapa inteiro no eixo leste-oeste; visível da praça, dos dois bairros e da entrada sul |

Bônus: um segundo relógio sem ponteiros no **edifício do conselho** (pedido pela seção 24.3)
e um terceiro na oficina de **reparo de Relógios GC**.

---

## 5. Caminhos e navegação

A praça oferece **quatro** saídas visíveis, satisfazendo o mínimo de três da seção 24.7:

1. **norte** — escadaria para a colina do Colégio;
2. **sul** — rua principal, ponte e entrada sul;
3. **oeste** — rua da ferradura para o Bairro de Oficinas e o braço oeste;
4. **leste** — rua da ferradura para o Bairro Residencial e o braço leste.

Três pontes de madeira cruzam o riacho (x 10..13, x 38..42, x 74..77), o que forma um
circuito fechado em vez de um corredor.

### Distâncias medidas (BFS sobre tiles passáveis)

Velocidade do MZ: ~3,75 tiles/s andando, ~7,5 correndo.

| trajeto | tiles | andando | correndo |
| --- | --- | --- | --- |
| entrada sul → praça | 35 | ~9 s | ~5 s |
| entrada sul → pátio do Colégio | 54 | ~14 s | ~7 s |
| entrada sul → Campo do Primeiro Sonho | 97 | ~26 s | ~13 s |
| entrada sul → ponta do braço oeste | 84 | ~22 s | ~11 s |
| entrada sul → ponta do braço leste | 84 | ~22 s | ~11 s |
| circuito completo (praça ↔ dois braços ↔ colina) | 274 | ~73 s | ~37 s |

**Desvio consciente da seção 24.7:** a bíblia pede 40–60 s para atravessar a área principal
sem parar. A travessia em linha (entrada sul → Campo do Primeiro Sonho) dá **26 s andando**;
só o percurso completo pela ferradura entra na faixa. Para atender o número ao pé da letra
o mapa precisaria de ~1,5× a altura atual, o que diluiria a densidade de construções.
Fica registrado como decisão a confirmar com o dono (ver §8).

---

## 6. Passabilidade e encontros

O gerador respeita as flags do tileset 2 (`data/Tilesets.json`): telhados, paredes,
face do barranco, cercas, árvores e água são intransponíveis; trilhas, calçamento,
escadaria, tabuado de ponte e capim alto são passáveis. Props de árvore 2×2 usam a
linha de cima com flag *star* (o jogador passa por trás da copa) e a de baixo bloqueando.

Uma verificação de caminhabilidade reimplementou `Game_Map.checkPassage` do MZ e rodou
uma BFS a partir da estrada da entrada sul (40, 90). **Resultado: os 21 pontos de interesse
são alcançáveis**, incluindo a exigência do P0 — dá para ir da entrada sul até o Campo do
Primeiro Sonho só por tiles passáveis. 4.711 dos ~4.849 tiles andáveis pertencem à
componente principal; o resto são frestas de 1 a 12 tiles dentro da mata da moldura,
invisíveis para o jogador.

**Região 1** (camada z5) só foi pintada no capim alto dos Campos do Primeiro Sol —
73 tiles, nenhum dentro da vila nem no Campo do Primeiro Sonho, que precisa ficar
seguro para a cerimônia. `MON_Encounters` usa a região 1 como gatilho
(`GRASS_REGION`, `js/plugins/MON_Encounters.js`).

> ### ⚠ Colisão de mapId a resolver
>
> `data/Encounters.json` **já tem** uma entrada para o mapId 3 — "Rota 1", densidade 25,
> com Pidgey / Rattata / Caterpie / Weedle. O `_meta` do arquivo reserva a faixa 2–19 para
> "D1 Pokémon (Kanto)" e descreve o mapa 3 como `D1_PKM_Route1 — a criar`.
>
> Consequência prática: assim que o jogo rodar, andar no capim alto dos Campos do Primeiro
> Sol **vai** disparar encontros com Pokémon de Kanto. Mecanicamente funciona; narrativamente
> contradiz a bíblia, que coloca Pokémon como **Dimensão Externa** que só chega pela primeira
> fenda (marco P1).
>
> Isso não é um bug do mapa: é o plano de numeração antigo (`Encounters.json._meta`,
> `docs/05-roadmap.md`) que precisa ser refeito, porque a bíblia v0.11 transformou os Doze
> Mundos no mundo-base do jogo. Duas saídas, a decidir pelo dono:
>
> 1. renumerar: Primas fica numa faixa própria e a faixa 2–19 continua sendo a D1 Pokémon; ou
> 2. manter o mapId 3 e reescrever a entrada 3 de `Encounters.json` para fauna nativa de Primas.
>
> `data/Encounters.json` e `docs/05-roadmap.md` estão fora do escopo deste marco e não foram
> tocados.

---

## 7. Eventos

Só o mínimo para navegar, como o P0 pede:

| id | nome | posição |
| --- | --- | --- |
| 1 | Ponto de Partida | (40, 88) |
| 2 | Placa da Entrada | (37, 86) |
| 3 | Quadro de Avisos | (36, 57) |
| 4 | Placa da Colina | (39, 50) |
| 5 | Placa do Campo | (50, 20) |
| 6 | Placa dos Campos | (62, 82) |

Todos são gatilho "toque do jogador", sem gráfico e com prioridade "abaixo do
personagem" — servem de sinalização, não de obstáculo.

> **Falta ligar o início do jogo à vila.** `data/System.json` ainda aponta
> `startMapId: 1`. Para começar em Vila Primeiro Passo é preciso mudar a posição
> inicial para o mapa 3 em (40, 88) — pelo editor do MZ (Database → System → Player's
> Starting Position) ou editando `System.json`. Esse arquivo está fora do escopo
> deste marco e não foi tocado.

---

## 8. O que falta para o Marco P1

1. **Sete interiores prioritários** (seção 24.5): Colégio, estalagem, clínica, loja de
   suprimentos, oficina, casa de Bucky, edifício do conselho. As portas já estão
   posicionadas; falta criar os mapas e os eventos de transferência.
2. **Campo do Primeiro Sonho decorado**: bandeiras dos doze mundos, palco, arquibancadas
   de madeira, fitas dos sonhos, barracas de comida. A arena de pedra já está no lugar
   como base reutilizável.
3. **Versão pós-fenda** do mesmo mapa: solo rachado em padrão circular, objetos
   deslocados (o terreno vago do bairro de oficinas já está reservado), vegetação
   externa, barreiras improvisadas. Deve ser feita como estados sobre esta base,
   não como um mapa novo.
4. **NPCs principais** (seção 24.8): Bucky, Spark, Jibaku, conselho, responsável pelo
   Colégio, médico, comerciante, mecânico de Relógios GC, candidatos, rival, moradores.
5. **Primeira batalha** e resolução da colisão de mapId descrita em §6 — hoje o mapa 3
   herda a tabela de encontros da "Rota 1" de Kanto.
6. **Posição inicial do jogador** em `data/System.json` (ver §7).
7. **Escala**: decidir se o mapa cresce para atender os 40–60 s de travessia da
   seção 24.7 ou se o número é revisado (ver §5).
8. **Árvore de Amano no horizonte**: o mirante existe, mas a árvore em si precisaria
   de um parallax ou de arte dedicada — não há tile de RTP que sirva.
9. **Áudio**: `autoplayBgm` está desligado e nenhum BGM/BGS foi definido.

---

## Correções aplicadas após a revisão adversarial

A primeira versão do mapa abria no editor mas **não era jogável**: 11 das 31 portas
não tinham como ser alcançadas a pé. As correções entraram no gerador, não no JSON,
para valerem em qualquer layout futuro.

| Defeito | Correção |
|---|---|
| 11 portas inalcançáveis (3 delas dos 7 prédios prioritários da §24.5) | `openDoorways()` limpa o obstáculo à frente da porta e assenta calçada; `carveDoorPaths()` abre trilha até a rua quando ainda falta caminho |
| Clínica comunitária sobreposta por uma casa | lotes residenciais realocados; a fileira sul saiu de cima do riacho |
| 23 props sobre telhados (poste, caixote, cerca) | `clearRoofProps()` limpa as camadas de objeto sobre telhado, preservando a chaminé |
| Relógio sem ponteiros desenhado no telhado | `fixClockFaces()` move o marco para a fachada |
| Região 1 encostando na vila | recuada; começa em y=71, já nos Campos do Primeiro Sol |
| **Pokémon de Kanto apareciam antes da primeira fenda** | tabela do mapId 3 removida de `data/Encounters.json` — Dimensões Externas só chegam no Marco P1 |
| Não havia como entrar na vila | `data/System.json` passa a iniciar o jogo no mapa 3, em (40, 88) |

**A verificação virou parte do gerador.** `node tools/build_map_vila.js` reimplementa
`Game_Map.checkPassage` do MZ, roda BFS a partir do ponto inicial e **falha com exit 1**
se qualquer porta ficar inalcançável — o mapa quebrado não chega a ser escrito.

Detalhe que custou caro e vale registrar: o MZ decide passagem pela **camada mais alta
que não seja "estrela"**, não pela combinação das camadas. Verificar com um "and" de
todas as camadas dá falso negativo em toda ponte, porque a água por baixo é
intransponível.

Estado atual: **30 construções, 4.772 tiles caminháveis, todas as portas alcançáveis**,
saída determinística (mesmo sha1 entre execuções).
