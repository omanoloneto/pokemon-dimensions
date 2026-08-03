# 07 — Batalha em Times (3v3 com humanos em campo)

Substitui o 1v1 estilo Pokémon clássico. Decisões do dono do projeto, travadas:

1. **Layout lado a lado** — time do jogador à **esquerda**, adversário à **direita**. Sem sprite de costas: todos são vistos de lado, encarando o time oposto.
2. **Até 3 unidades por lado**, simultâneas em campo.
3. **Humanos são combatentes completos** — têm HP, stats e ações próprias, podem ser atacados e derrotados. Na prática o time do jogador é **o humano + 2 monstros**.
4. **Time inimigo simétrico** — treinador humano + 2 monstros. Encontro selvagem é de 1 a 3 monstros, sem humano.
5. **Fim de batalha** quando as 3 unidades de um lado caem (ativos *e* reserva). Unidade caída sai e a reserva entra. Se o humano do jogador cai mas os monstros seguem de pé, **a batalha continua**.

## Arquitetura

O motor antigo tinha a regra de combate presa dentro da cena (`this._player` vs `this._enemy`). Com 6 unidades isso duplicaria regra em todo lugar, então a lógica foi extraída:

```
PKM_Field.js      campo em times — puro, headless, testável
PKM_Human.js      Game_Human (estende Game_Pokemon)
PKM_Battle.js     fórmulas puras (PKM.Battle.*) + Scene_PkmBattle (só render e input)
```

**A cena não decide nada de combate.** Ela pergunta ao campo quem age, em que ordem e contra quem, manda `PKM.Battle.executeMove` resolver, e desenha o resultado.

### `PKM.Field` — o campo

```js
const field = PKM.Field.create({ allies, foes, isTrainer, trainer });
PKM.Field.activeUnits(field, PKM.Field.ALLY)   // de pé, em campo
PKM.Field.slots(field, side)                   // inclui caídos (a cena desenha)
PKM.Field.validTargets(field, unit)            // inimigos de pé
PKM.Field.resolveTarget(field, unit, target)   // redireciona se o alvo morreu
PKM.Field.turnOrder(actions)                   // prioridade > velocidade > moeda
PKM.Field.outcome(field)                       // null | "win" | "lose"
PKM.Field.fillEmptySlots(field, side)          // reserva entra no lugar do caído
PKM.Field.pickAction(field, unit)              // IA do lado inimigo
```

Lados: `ALLY` (esquerda) e `FOE` (direita). `MAX_ACTIVE = 3`.

Ação não-golpe (item, troca, fuga, captura) tem prioridade 6, acima de qualquer golpe — mesma convenção do Pokémon clássico.

### `Game_Human` — por que estende `Game_Pokemon`

Herança deliberada: o motor inteiro (dano, tabela de tipos, status, estágios de stat, ordem de turno, campo) passa a tratar humano e monstro pela **mesma interface**, sem um segundo sistema de combate. O humano difere só no que importa:

| | Monstro | Humano |
|---|---|---|
| Nome exibido | espécie/apelido | nome da pessoa (`className` guarda a classe) |
| Capturável | conforme a franquia | nunca (faixa HUM tem `inField: false`) |
| Evolui | sim | não |
| Shiny | 1/4096 | não |

As "espécies" da faixa **HUM (920–969)** são **classes de personagem** — Treinador, DigiEscolhido, Medafighter, Criador, Grande Criança — e definem stats e ações. O avatar do jogador vive em `$gameParty.pkmSetAvatar(human)`, e `pkmBattleTeam()` devolve o avatar seguido dos monstros de pé.

## Sprites

Não existem sprites de costas neste layout, e o repositório só tem `img/pokemon/front/`. A cena usa **front dos dois lados**, espelhando horizontalmente o time da esquerda para que os lados se encarem.

Carregamento **obrigatoriamente** por `PKM.Core.loadSprite()`, que usa `Bitmap.load()` fora do cache do `ImageManager`: as classes humanas e as franquias novas ainda não têm arte, e um bitmap ausente no cache derrubaria a cena inteira via `ImageManager.throwLoadError` (a mesma classe do crash de áudio corrigido em `3fb6a23`).

## O que foi preservado do motor antigo

Nada disso podia regredir na virada para times: EXP, nível, aprender golpe e evolução no fim da batalha; `runVictoryHooks` (drop de peça Medabot); `recordWin`/`recordFaint` (condições de digievolução dependem deles); captura com as regras por franquia (`PKM.Franchise.captureRule`, item-chave não consumido); prêmio em dinheiro, texto de derrota, insígnias e áudio.
