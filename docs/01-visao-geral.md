# 01 — Visão Geral

## Pitch

**Pokémon Dimensions** é um monster collector 2D clássico (estilo Pokémon Gen 1/2) em que o multiverso está rachando: fendas conectam as dimensões de **Pokémon, Digimon, Medabots, Monster Rancher e Bucky (Jibaku-kun)**. O jogador cruza os mundos, monta uma equipe misturando monstros de todas as franquias no mesmo sistema de batalha, e impede que um vilão funda todas as dimensões numa só.

Momento-trailer: um Digimon na sua equipe de Pokémon **antes** de você atravessar o primeiro portal.

## Pilares de design

1. **Uma equipe, cinco mundos.** Qualquer monstro de qualquer franquia entra no mesmo time, mesmo cálculo de dano, mesma UI. A mistura é o produto.
2. **Cada dimensão joga diferente — com UM sistema novo.** Cada franquia ganha exatamente um sistema exclusivo que vende sua fantasia (ver [02-franquias.md](02-franquias.md)). Todo o resto reusa o engine existente.
3. **Clássico legível.** Batalha 1v1 por turnos, tabela de tipos única, sem camadas paralelas de regra. O conhecimento que o jogador traz de Pokémon vale no jogo inteiro.
4. **Mobile-first de verdade.** Roda no browser do celular (PWA). Build que não roda em touch não é entrega.

## Escopo macro

- Campanha de **10–15h**, ~39 mapas: hub Nexus + 5 dimensões + dungeon final.
- **12 Chaves Dimensionais** (análogo de insígnias, reusa sistema pronto).
- Dex-alvo da v1: Pokémon congelada no que já existe (649 espécies nos dados; obtíveis são um subconjunto por dimensão) + ~30 Digimon + ~10 Medabots + ~20 Monster Rancher + 12 espíritos de Bucky.
- Plataformas: **web (PWA)** primário; APK Android sideload; iOS só via PWA.

## O que este jogo NÃO é (não-escopo global da v1)

- Sem breeding, day/night, clima, batalhas em dupla, held items, habilidades ativas em batalha, multiplayer/troca.
- Sem monetização de nenhum tipo (decisão legal e de escopo — ver [04-producao-mobile.md](04-producao-mobile.md)).
- Sem recriar cada franquia por completo: cada dimensão é uma **destilação** (6–9 mapas), não um jogo inteiro daquela franquia.

## Princípios de produção

- **1 sistema novo por franquia, no máximo.** Se a fantasia pede dois, corta um.
- **Template primeiro:** cidade, rota e Marco seguem esqueletos fixos ([03-mundo-e-narrativa.md](03-mundo-e-narrativa.md)); conteúdo novo é preencher template, não inventar estrutura.
- **Dados antes de código:** espécies, golpes, encontros e treinadores vivem em JSON compilado; engine só ganha código quando dado não resolve.
- Os 56 testes headless nunca regridem; toda cena nova entra no checklist touch.
