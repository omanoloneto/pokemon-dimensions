# Pokémon Dimensions — Port para RPG Maker MZ

Reescrita gradual do projeto (originalmente Pokémon Essentials / RPG Maker XP, em
Ruby) para **RPG Maker MZ** (JavaScript). Esta pasta é independente do projeto XP
da raiz — nada aqui sobrescreve o jogo original.

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
| EXP/evolução, PC, treinadores           | ⬜ a fazer |

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
│   └── PKM_Bag.js            # mochila, itens, dinheiro (Fase 3)
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
   `PKM_Encounters` → `PKM_Battle` → `PKM_Bag`.
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

## Testes automatizados (lógica)

```bash
node mz/tools/test_harness.js   # Game_Pokemon, dano, captura e itens (19 testes)
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
