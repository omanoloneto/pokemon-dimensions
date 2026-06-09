# Pokémon Dimensions — Port para RPG Maker MZ

Reescrita gradual do projeto (originalmente Pokémon Essentials / RPG Maker XP, em
Ruby) para **RPG Maker MZ** (JavaScript). Esta pasta é independente do projeto XP
da raiz — nada aqui sobrescreve o jogo original.

> 🧪 Para instalar e testar no MZ passo a passo, veja **[TESTING.md](TESTING.md)**.

## Status

| Sistema   | Estado        |
|-----------|---------------|
| Dados (Pokémon, golpes, tipos, itens, encontros → JSON) | ✅ |
| **Pokédex** (lista + ficha)             | ✅ |
| **Game_Pokemon** (IVs/EVs/natureza/stats) | ✅ Fase 1 |
| **Party & Resumo**                      | ✅ Fase 2 |
| **Encontros selvagens**                 | ✅ Fase 4 |
| **Batalha 1v1 + Captura**               | ✅ Fases 5a/6 |
| **Mochila, itens & dinheiro**           | ✅ Fase 3 |
| **EXP, nível, golpes & evolução**       | ✅ Fase 7 |
| **Status, estágios & efeitos de golpe** | ✅ Fase 5b |
| **Treinadores & insígnias**             | ✅ Fase 9 |
| **PC / caixas de armazenamento**        | ✅ Fase 8 |
| **Áudio, Pokédex+, migração XP→MZ**     | ✅ Fase 10 |

## Estrutura

```
mz/
├── data/                     # bancos compilados do PBS (gerados)
│   ├── Pokemon.json  Moves.json  Types.json  Items.json  Encounters.json
├── js/plugins/
│   ├── PKM_Core.js           # carrega dados, tabela de tipos, estado da Pokédex
│   ├── PKM_Pokemon.js        # classe Game_Pokemon (Fase 1)
│   ├── PKM_Pokedex.js        # cena da Pokédex
│   ├── PKM_Party.js          # equipe + telas de resumo (Fase 2)
│   ├── PKM_Encounters.js     # encontros no overworld (Fase 4)
│   ├── PKM_Battle.js         # batalha 1v1 + captura (Fases 5a/6)
│   ├── PKM_Bag.js            # mochila, itens, dinheiro (Fase 3)
│   ├── PKM_Trainers.js       # batalhas de treinador + insígnias (Fase 9)
│   ├── PKM_Storage.js        # PC: caixas de armazenamento (Fase 8)
│   └── PKM_Audio.js          # cries, BGM de batalha, vitória (Fase 10)
├── img/pokemon/front/        # (opcional) sprites <numero>.png, ex.: 001.png
└── tools/
    ├── compile_all.rb        # PBS → todos os data/*.json
    ├── compile_pbs.rb        # (legado) só Pokemon.json
    └── test_harness.js       # testes headless da lógica (node)
```

## Instalação num projeto MZ

1. Copie tudo de `data/` para a pasta `data/` do seu projeto MZ.
2. Copie todos os `js/plugins/PKM_*.js` para `js/plugins/`.
3. No **Gerenciador de Plugins**, adicione e ative **nesta ordem**:
   `PKM_Core` → `PKM_Pokemon` → `PKM_Pokedex` → `PKM_Party` →
   `PKM_Encounters` → `PKM_Battle` → `PKM_Bag` → `PKM_Trainers` →
   `PKM_Storage` → `PKM_Audio`.
4. (Opcional) Sprites frontais em `img/pokemon/front/` (`001.png`…). Sem imagem,
   a Pokédex mostra um placeholder "?".

## Testar a demo jogável (andar → encontro → batalha → captura)

1. Num evento, dê um inicial: comando `PKM_Party → Dar Pokémon` (ex.: CHARMANDER nv5).
2. Pinte a **Região 1** (editor de mapa) sobre tiles de grama de um mapa que
   exista em `Encounters.json` (ex.: mapa 5 = Route 1).
3. Ande na grama → encontro selvagem → batalha. Teste Lutar/Bola/Pokémon/Fugir.
   - Para forçar: comando `PKM_Encounters → Forçar Encontro` (PIDGEY nv7).

## Mochila (Fase 3)

- Dar item: comando `PKM_Bag → Dar Item` (ex.: POTION ×5, GREATBALL ×10).
- Abrir: comando `PKM_Bag → Abrir Mochila` (8 bolsos; remédios usáveis na equipe).
- Em batalha, o comando **Bola** agora usa as Poké Bolas da mochila (bônus por
  tipo: Great ×1.5, Ultra ×2, Master ×255). Sem `PKM_Bag`, usa uma Poké Ball comum.
- Começa com $3000; `PKM_Bag → Dar Dinheiro` ajusta.

## EXP, nível e evolução (Fase 7)

- Ao vencer uma batalha, o Pokémon ativo ganha EXP (`baseExp × nível ÷ 7`),
  pode **subir de nível** (com aumento de stats e cura proporcional do HP),
  **aprender golpes** por nível (com fluxo de "esquecer golpe" quando já tem 4)
  e **evoluir** por nível (ex.: Bulbasaur → Ivysaur no nível 16).
- O selvagem encontrado é registrado como **visto** na Pokédex.
- A tela de resumo mostra EXP atual e EXP para o próximo nível.

## Profundidade de batalha (Fase 5b)

- **Condições de status**: veneno (1/8 HP/turno), veneno grave (TOX crescente),
  queimadura (1/8 HP + metade do dano físico), paralisia (25% trava + ½
  velocidade), sono (1–3 turnos), congelamento (20% descongela/turno).
- **Estágios de stat** (−6…+6): golpes como Swords Dance, Growl, Thunder Wave,
  Will-O-Wisp, Sleep Powder, Toxic, etc., além de efeitos secundários de golpes
  de dano (ex.: Ember 10% queima, Thunderbolt 10% paralisa, Body Slam 30%).
- **Precisão** afetada por estágios de precisão/evasão. Trocar de Pokémon zera
  os estágios. Imunidades por tipo (Fogo não queima, Gelo não congela, etc.).
- O registry `PKM.Battle.MOVE_EFFECTS` (em PKM_Battle.js) é data-driven — dá
  para adicionar mais golpes facilmente.

## Treinadores & ginásios (Fase 9)

- Iniciar: comando `PKM_Trainers → Batalha de Treinador` (tipo + nome), ou
  `PKM.Trainers.start("LEADER_Brock", "Brock", {defeatText:"..."} )` num evento.
- O oponente envia cada Pokémon em sequência; **não dá para capturar nem fugir**;
  ao vencer você recebe prêmio (`baseMoney × nível do último`) e EXP com bônus 1.5×.
- Insígnias: `$gameSystem.pkmGiveBadge("KANTO_1")`, `pkmHasBadge`, `pkmBadgeCount`,
  ou comando `PKM_Trainers → Dar Insígnia`.
- Dados de 60 treinadores e 75 tipos vêm do seu PBS.

## PC / armazenamento (Fase 8)

- 16 caixas × 30 espaços. Abra com o comando `PKM_Storage → Abrir PC`.
- Capturas com a equipe cheia vão automaticamente para a 1ª caixa com espaço
  (o array antigo de armazenamento é migrado para as caixas).
- Na cena: **Q/W** trocam de caixa; em um Pokémon → Retirar / Resumo / Mover /
  Soltar; em espaço vazio → Depositar (escolhe da equipe; mantém ≥1 na equipe).

## Polimento (Fase 10)

- **Áudio** (`PKM_Audio.js`, opcional): toca o *cry* do Pokémon ao aparecer/ser
  enviado, BGM de batalha (selvagem/treinador) e fanfarra de vitória — basta
  colocar os arquivos em `audio/se/Cries/`, `audio/bgm/`, `audio/me/`. Sem os
  arquivos, nada quebra.
- **Pokédex+**: ordenação (Nº / A-Z / capturados) e filtro (só vistos) com
  **Q/W**, e **cadeia de evolução** na ficha.
- **Flash de entrada** na batalha.
- **Migração XP→MZ** (`tools/migrate_xp.rb`): exporta nomes dos mapas e diálogos
  dos eventos do projeto XP para `tools/xp_content.json` (134 mapas, 429 eventos)
  — referência para reconstruir as cenas. Tilesets/layouts não são convertidos.

## Testes automatizados (lógica)

```bash
node mz/tools/test_harness.js   # todos os sistemas (56 testes)
ruby mz/tools/compile_all.rb    # recompila os data/*.json do PBS
ruby mz/tools/migrate_xp.rb     # exporta o conteúdo dos mapas do projeto XP
```

## Como usar

**Abrir a Pokédex** — comando de plugin `PKM_Pokedex → Abrir Pokédex`, ou em um
evento (Script):

```js
SceneManager.push(Scene_Pokedex);
```

**Registrar espécies** (em batalhas/encontros, por enquanto manual):

- Comandos de plugin `PKM_Core → Registrar Visto` / `Registrar Capturado`, ou
  via script:

```js
$gameSystem.pkmSetSeen(25);    // viu Pikachu
$gameSystem.pkmSetCaught(25);  // capturou Pikachu (revela a descrição)
```

Regras (como nos jogos oficiais): não vistos aparecem como `----------`;
vistos mostram nome/tipos/altura/peso; a **descrição** só é revelada após
**capturar**. O progresso é salvo junto com o save do jogo.

## Recompilar os dados

Se editar o `PBS/pokemon.txt`, regenere o JSON a partir da raiz do repositório:

```bash
ruby mz/tools/compile_pbs.rb
```

## Próximos passos sugeridos

- Filtros/ordenar a Pokédex (por região, tipo, alfabético).
- Tela de estatísticas-base e cadeia de evolução.
- Integrar `Registrar Visto/Capturado` automaticamente ao sistema de batalha
  (quando ele existir).
