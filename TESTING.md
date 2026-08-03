# Guia de Teste no RPG Maker MZ — passo a passo

Como instalar e testar o port (Fases 0–10) num projeto MZ, do zero até a demo
jogável: dar inicial → Pokédex → encontro selvagem → batalha com status →
captura → EXP/evolução → mochila → treinador → PC.

> Pré-requisito: **RPG Maker MZ** instalado (Windows/Mac). Os plugins não rodam
> em Linux/headless — por isso este teste é feito por você na sua máquina.

---

## 1. Criar o projeto e copiar os arquivos

1. No RPG Maker MZ: **Arquivo → Novo Projeto** (ex.: `PKMDimensionsMZ`).
2. Feche o editor (para ele não sobrescrever arquivos).
3. Copie SOMENTE estes arquivos para o projeto (não copie a pasta inteira —
   sobrescrever os arquivos do próprio MZ como `Items.json`/`System.json` quebra
   o editor):
   - Estes 6 JSON → `<Projeto>/data/`:
     `Monsters.json`, `Moves.json`, `Types.json`, `MonItems.json`,
     `Encounters.json`, `Trainers.json`
   - `js/plugins/MON_*.js` → `<Projeto>/js/plugins/`

   > Neste repositório a raiz JÁ É o projeto MZ — os arquivos já estão no
   > lugar, nada a copiar. Este passo vale só para instalar em outro projeto.
4. (Opcional) Sprites: `img/monsters/front/001.png`… → `<Projeto>/img/monsters/front/`.
   Sem isso, a Pokédex mostra um placeholder "?".
5. (Opcional) Áudio: coloque cries em `audio/se/Cries/001Cry.ogg`…, e
   BGMs/MEs com os nomes configurados em `MON_Audio`.

Reabra o projeto no MZ.

---

## 2. Ativar os plugins NA ORDEM

**Ferramentas → Gerenciador de Plugins**, adicione e marque como **ON**, exatamente
nesta ordem (a ordem importa — dependências):

```
1. MON_Core
2. MON_Monster
3. MON_Codex
4. MON_Party
5. MON_Encounters
6. MON_Battle
7. MON_Bag
8. MON_Trainers
9. MON_Storage
10. MON_Audio
```

Salve (Ctrl+S).

> Nota: desde a v0.5.1 os plugins toleram qualquer ordem de carga (namespace
> defensivo), mas a ordem acima continua recomendada.

### Smoke test (liga?)
- **Playtest** (F12 / botão ▶). Se o jogo **abre no mapa inicial sem erro**, os
  dados carregaram. Se aparecer tela preta/erro, veja a seção **Solução de
  problemas**.
- Abra o **Console** (F8/F12 no playtest) para ver avisos.

---

## 3. Montar o mapa de teste

No mapa inicial, crie eventos (clique direito → Novo Evento). Em cada um,
**Disparo: Tecla de Ação** e adicione um comando **Plugin** (ou **Script**).

### Evento A — "Dar inicial + itens" (Disparo: Tecla de Ação)
- Comando de Plugin → `MON_Party` → **Dar Pokémon**: `CHARMANDER`, nível `5`
- Comando de Plugin → `MON_Party` → **Dar Pokémon**: `PIDGEY`, nível `4`
- Comando de Plugin → `MON_Bag` → **Dar Item**: `POTION`, `5`
- Comando de Plugin → `MON_Bag` → **Dar Item**: `POKEBALL`, `10`
- Comando de Plugin → `MON_Bag` → **Dar Item**: `GREATBALL`, `5`
- Mostrar Texto: "Recebeu Charmander, Pidgey e itens!"

> Use isto PRIMEIRO em cada playtest (a equipe/mochila começam vazias num save novo).

### Evento B — "Abrir Pokédex"
- Comando de Plugin → `MON_Codex` → **Abrir Pokédex**
  - (ou Script: `SceneManager.push(Scene_Codex)`)

### Evento C — "Abrir Equipe"
- Comando de Plugin → `MON_Party` → **Abrir Equipe**

### Evento D — "Abrir Mochila"
- Comando de Plugin → `MON_Bag` → **Abrir Mochila**

### Evento E — "Forçar encontro selvagem"
- Comando de Plugin → `MON_Encounters` → **Forçar Encontro**: `PIDGEY`, nível `6`

### Evento F — "Batalha de treinador"
- Comando de Plugin → `MON_Trainers` → **Batalha de Treinador**:
  - Tipo: `LEADER_Brock`  · Nome: `Brock`  · (fala ao perder, opcional)
- Depois: Comando de Plugin → `MON_Trainers` → **Dar Insígnia**: `KANTO_1`

### Evento G — "Abrir PC"
- Comando de Plugin → `MON_Storage` → **Abrir PC**

### (Opcional) Encontros ao andar na grama
- Pinte a **Região 1** (aba **R** do editor de mapa) sobre tiles de grama.
- Só dispara encontro se o **ID do mapa** existir em `Encounters.json`
  (ex.: mapa 5 = Route 1, mapa 2 = Lappet Town/água). Como o mapa inicial novo
  provavelmente não está lá, prefira o **Evento E** para testar a batalha, ou
  ajuste o parâmetro do `MON_Encounters`.

---

## 4. Roteiro de teste (checklist)

Rode o **Evento A** primeiro, depois:

**Pokédex (B)**
- [ ] Lista abre; ✗/✗ vira ●/nome conforme visto/capturado.
- [ ] **Q/W** trocam ordenação (Nº / A-Z / capturados / só vistos).
- [ ] Ficha mostra tipos, altura/peso e **evolução** (Charmander → Charmeleon Nv 16).
- [ ] Descrição só aparece após **capturar**.

**Equipe & Resumo (C)**
- [ ] Lista a equipe com barra de HP; abrir um mostra stats, golpes, EXP.

**Mochila (D)**
- [ ] 8 bolsos (Q/W ou setas). Em **Remédios**, usar **Potion** num Pokémon
      ferido cura +20; não deixa usar com HP cheio.

**Batalha selvagem (E)**
- [ ] Flash de entrada; "Um Pidgey selvagem apareceu!".
- [ ] **Lutar** → escolher golpe → dano/eficácia/crítico/desmaio.
- [ ] **Bola** → escolher Poké/Great Ball → chacoalhadas → captura ou escapa.
- [ ] **Pokémon** → trocar; **Fugir** → foge/falha.
- [ ] Ao vencer: ganha EXP; se subir de nível, aprende golpe / pode evoluir.
- [ ] Status: use Charmander com **Ember** e confira "Foi super eficaz!" em Bug/Grass,
      e a chance de queimadura.

**Treinador (F)**
- [ ] "Brock quer batalhar!"; envia **Geodude** e depois **Onix** (shiny).
- [ ] **Bola/Fugir bloqueados** ("não dá para capturar/fugir").
- [ ] Ao vencer: prêmio em dinheiro (confira na Mochila) e insígnia.

**PC (G)**
- [ ] Caixa com grade; **Q/W** trocam de caixa.
- [ ] Em espaço vazio → **Depositar** (escolhe da equipe; mantém ≥1).
- [ ] Num Pokémon → **Retirar / Resumo / Mover / Soltar**.
- [ ] Capture com a equipe cheia → vai para o PC ("enviado ao PC").

**Save/Load**
- [ ] Salve, recarregue: equipe, Pokédex, mochila, dinheiro, caixas e insígnias
      persistem (tudo é serializado no save do MZ).

---

## 5. Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Tela preta / erro ao abrir | Falta um `*.json` em `data/`, ou ordem dos plugins | Confira os 6 JSON em `data/` e a ordem da seção 2 |
| `$dataMonsters is null` no console | `MON_Core` desativado ou abaixo dos outros | `MON_Core` deve ser o 1º e estar ON |
| `Scene_PkmBattle is not defined` | `MON_Battle` desativado/fora de ordem | Ative `MON_Battle` antes de `MON_Trainers`/`MON_Audio` |
| Acentos estranhos (ç, ã) | Fonte do projeto sem esses glifos | Use a fonte padrão do MZ (tem acentuação) |
| Avisos de áudio no console | Arquivos de cry/BGM ausentes | Normal — é opcional, não quebra nada |
| Encontro não dispara na grama | Mapa não está em `Encounters.json` ou região ≠ 1 | Use o Evento E, ou ajuste `grassRegionId` no plugin |
| Janela cortando texto | Resolução/escala diferentes | Me avise o que cortou que eu ajusto o layout |

---

## 6. Limitações conhecidas (por design, nesta versão)

- **Sprites de batalha**: a batalha usa janelas/barras de HP (sem sprites animados
  dos Pokémon) — coloque imagens em `img/monsters/front/` para a Pokédex.
- **Golpes de status**: só os do registry `MON.Battle.MOVE_EFFECTS` têm efeito;
  os demais golpes de status dizem "ainda não tem efeito". É fácil expandir.
- **Itens de treinador / IA avançada**: a IA escolhe golpes aleatoriamente e não
  usa itens (Full Restore etc.) ainda.
- **Migração de mapas XP**: só o conteúdo textual foi exportado
  (`tools/xp_content.json`); tilesets/layouts precisam ser refeitos no MZ (48px).

---

## 7. Como me reportar um problema

Quando algo não funcionar, me mande:
1. A mensagem do **Console** (F8/F12), se houver.
2. Qual **passo do checklist** falhou e o que aconteceu.
3. (Se for visual) um print da tela.

Com isso eu corrijo o plugin e atualizo a branch.
