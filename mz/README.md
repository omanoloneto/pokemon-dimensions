# Pokémon Dimensions — Port para RPG Maker MZ

Reescrita gradual do projeto (originalmente Pokémon Essentials / RPG Maker XP, em
Ruby) para **RPG Maker MZ** (JavaScript). Esta pasta é independente do projeto XP
da raiz — nada aqui sobrescreve o jogo original.

## Status

| Sistema   | Estado        |
|-----------|---------------|
| Dados das espécies (PBS → JSON) | ✅ 648 Pokémon |
| **Pokédex** (lista + ficha)     | ✅ v0.1 |
| Batalha, mochila, party, PC, mapa | ⬜ a fazer |

## Estrutura

```
mz/
├── data/
│   └── Pokemon.json          # espécies compiladas do PBS (gerado)
├── js/plugins/
│   ├── PKM_Core.js           # núcleo: carrega dados + estado da Pokédex
│   └── PKM_Pokedex.js        # cena da Pokédex
├── img/pokemon/front/        # (opcional) sprites <numero>.png, ex.: 001.png
└── tools/
    └── compile_pbs.rb        # PBS/pokemon.txt → data/Pokemon.json
```

## Instalação num projeto MZ

1. Copie `data/Pokemon.json` para a pasta `data/` do seu projeto MZ.
2. Copie `js/plugins/PKM_Core.js` e `js/plugins/PKM_Pokedex.js` para `js/plugins/`.
3. No **Gerenciador de Plugins**, adicione e ative, **nesta ordem**:
   `PKM_Core` → `PKM_Pokedex`.
4. (Opcional) Coloque sprites frontais em `img/pokemon/front/` com nome de 3
   dígitos: `001.png`, `004.png`, etc. Sem imagem, mostra um placeholder "?".

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
