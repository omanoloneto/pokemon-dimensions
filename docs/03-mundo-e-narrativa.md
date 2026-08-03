# 03 — Mundo, Narrativa e Progressão

> **Reescrito contra a [Bíblia dos Doze Mundos v0.11](referencias/biblia-doze-mundos-v0.11.md).**
> A bíblia é a fonte da verdade. Este documento só traduz a bíblia em decisões de produção
> e registra o que o fangame acrescenta por conta própria.

## 0. Como ler este documento

Mesma separação que a bíblia faz em §1.2/§1.3:

- **[C §n]** — cânone da bíblia (seção citada). Não muda sem o dono.
- **[E]** — expansão do fangame. Decisão nossa, revisável, não pode contradizer o cânone.

## 1. O mundo-base: Continente dos Doze Mundos [C §2–§8]

- Os Doze Mundos **não são dimensões**: são doze países independentes de um mesmo continente **circular**, numerados como as horas de um relógio — Primas (1) até Doidicus (12). Cada país é uma fatia que vai do centro ao litoral.
- Cada mundo tem quatro direções estruturais: **borda interna** (para a Árvore), **borda externa** (oceano), **fronteira anterior** e **fronteira seguinte**. Isso mantém a orientação do jogador mesmo quando o bioma vira do avesso.
- Entre dois países há sempre uma **Faixa de Transição** — bioma, arquitetura e costumes se misturam. Serve para credibilidade, antecipação visual e **reuso de tileset dos dois vizinhos**.
- No centro, onde havia a Torre Pontiaguda (Mundo Zero), está a **Árvore de Amano**. Doze raízes saem do centro e criam os microclimas que permitem gelo e deserto vizinhos.
- Ao redor do tronco: **Clareira do Novo Zero** — sede do **Conselho dos Doze Mundos**, memorial das antigas Grandes Crianças, posto de pesquisa das raízes, mercado e caminhos radiais.
- Estamos no **Ano 7 da Nova Árvore**, dias depois do reencontro de Bucky e Spark no epílogo.
- **Jibaku absorveu os outros onze Espíritos.** Existe **um** Espírito.
- **O jogador é o sucessor de Bucky**, reconhecido como nova Grande Criança de Primas; sua responsabilidade se expande para os demais mundos e depois para as dimensões conectadas.
- A **primeira fenda** abre em Primas durante a sucessão: o despertar de Jibaku com um novo parceiro manda uma descarga pelas doze raízes. **A verdade completa é mistério da campanha.**
- **Dimensão Externa** é o termo para Pokémon, Digimon, Medabots, Monster Rancher e V-Monsters. **Fenda** é a ruptura temporária. **Mundo** continua sendo cada um dos doze países.

Consequência direta: **não existe "dimensão Bucky"**. Bucky é o mundo-base do jogo inteiro.

## 2. O que mudou em relação à versão anterior deste documento

A versão anterior foi escrita antes da bíblia. Cada elemento dela foi julgado:

| Elemento antigo | Destino | Justificativa |
|---|---|---|
| **Nexus** (hub de portais) | **Substituído** por **Raiz Clara** (hub operacional) + **Clareira do Novo Zero** (anel de estações de raiz) | A bíblia já tem os dois lugares, e Raiz Clara já lista exatamente as funções que inventamos para o Nexus: pesquisa das fendas, viagem rápida, encontro de gente de todos os mundos e "área que muda conforme novas dimensões são descobertas" [C §27.1]. Manter o Nexus seria duplicar cânone com nome pior. |
| Pokémon como **Dimensão 1** | **Substituído**: Primas é a região inicial; Pokémon é a **1ª Dimensão Externa** | O mundo-base são os Doze Mundos [C §2]. O jogador precisa conhecer o normal antes de a fenda quebrá-lo [C §13.1]. |
| **Bucky como D5** | **Dissolvido** no mundo-base | Bucky não é uma franquia visitada, é onde o jogo acontece. Os 6 mapas dela vão para Primas; os 12 espíritos e o Emblema G.C. viram a camada nativa/endgame (§6). |
| **O Unificador** (vilão) | **Cortado como pessoa**; a tese **sobrevive** como bloco político (§7) | A bíblia não tem vilão pós-epílogo e atribui as fendas à descarga de Jibaku, não a sabotagem [C §12]. Mas tem tensão real: "há resistência em recriar a estrutura autoritária da Torre" [C §7] e grupos que defendem controle rígido [C §13.11]. Trocar um cientista louco por uma facção legítima é mais barato (zero mapa novo) e mais fiel. |
| **Chaves Dimensionais** (14) | **Substituídas** por **Núcleos de Fenda** (10) + **Marcas G.C.** (12) | Ver §6. As duas coisas já existem no engine (`MON_Pacts`, sistema de insígnias) — a troca **remove** um sistema em vez de somar. |
| **Arauto** (mini-boss recorrente) | **Adaptado**: o **rival de Primas** e os **candidatos preteridos** | A bíblia já exige esses NPCs na vila [C §24.8]. O espelho do jogador fica literal: são as crianças que Jibaku não escolheu. Não precisamos inventar um capanga. |
| **Dimensão Zero** (dungeon-colagem) | **Adaptada**: **Coração da Árvore** | A ideia barata (colagem de tiles/músicas/monstros de todas as origens) continua válida — o lugar onde as doze raízes e todas as fendas convergem é justamente onde tudo se mistura errado. Muda o nome e a causa, não a produção. |
| **Folklora / "elo esquecido"** | **Preservado**, re-ancorado (§8) | Não contradiz nada: continua sendo Dimensão Externa e continua sendo a única com arte própria. |
| **Templates de cidade/rota/Marco, curva de nível, recorte de slice** | **Preservados**, realinhados (§9–§10) | São decisões de produção, não de ficção. Só mudam de endereço. |
| Nomenclatura `D1..D6`, `NEXUS_*`, `KEY_XX` | **Substituída** (§11) | Nada disso está implementado — a grep só encontra essas strings nos docs. Renomear agora é grátis. |

## 3. Geografia jogável e orçamento de mapas

Primas é dividida em cinco zonas [C §16]: **Terras da Raiz** (borda interna, Raiz Clara), **Bacia dos Primeiros Campos** (Vila Primeiro Passo, Cidade dos Porcos), **Serra de Rockside**, **Costa do Primeiro Vento** (adiada) e as **Faixas de Transição** (Passo do Degelo → Doidicus; Estrada dos Pomares Doces → Secandas).

Topologia a preservar mesmo comprimindo distâncias [C §17]: Doidicus → Passo do Degelo → Rockside → **Vila Primeiro Passo** → Cidade dos Porcos → Secandas; Vila Primeiro Passo → Raiz Clara → Árvore; Cidade dos Porcos → Porto Primeiro Vento.

| Bloco | Mapas | Obs. |
|---|---|---|
| **Primas — Vila Primeiro Passo** (+7 interiores prioritários) | 3 | 5 zonas num mapa só; template ampliado (§10) |
| Primas — Campo do Primeiro Sonho | 1 | **um mapa, dois estados** (antes/depois da fenda) [C §24.4] |
| Primas — Campos do Primeiro Sol + Bosque dos Vasos | 2 | |
| Primas — Cidade dos Porcos (+interiores) | 3 | |
| Primas — Trilha das Pedras Vivas | 1 | |
| Primas — Rockside City + Cratera Drago Rock | 2 | |
| Primas — Estrada da Raiz Clara + Raiz Clara | 2 | hub operacional |
| Primas — Passo do Degelo (faixa de transição) | 1 | Pomares Doces fica como saída bloqueada visível [C §32] |
| DE Pokémon | 7 | Coral Town (Map002) já existe, reaproveitada aqui |
| DE Digimon | 6 | |
| DE Medabots | 5 | |
| DE Monster Rancher | 5 | |
| DE Folklora (V-Monsters) | 6 | IP própria; §8 |
| Clareira do Novo Zero | 2 | Conselho + anel de estações de raiz |
| Coração da Árvore (final) | 3 | colagem instável |
| **Total** | **~49** | 12–16h |

Primas sozinha come 15 mapas porque absorveu o hub (2) e a antiga dimensão Bucky (6). Se o calendário apertar, **o corte é nos mapas das Dimensões Externas**, nunca em Primas: Primas é a porta de entrada e a única região que a bíblia especifica sala por sala.

([01](01-visao-geral.md), [02](02-franquias.md) e [06](06-arquitetura-franquias.md) ainda usam "Nexus", "5 dimensões" e prefixo `D1_PKM_` — ajustar no próximo passe.)

## 4. O hub: Raiz Clara e a Clareira do Novo Zero

O argumento de design do hub-and-spoke continua de pé, e agora ele é **cânone em vez de invenção**: doze raízes saindo de um centro *são* o spoke. O jogador vê as conexões coexistindo, o backtracking custa N portas em vez de N² ligações, e uma estação de raiz apagada é uma barreira visual honesta.

- **Raiz Clara** [C §27] — assentamento na borda interna de Primas. Hub operacional do jogo: sede regional do Conselho, pesquisa das fendas, ponto de encontro de gente dos doze mundos e a área que **muda visivelmente a cada Dimensão Externa descoberta**. Chega-se por dentro de Primas, e a estrada começa bloqueada **por decisão política, não por pedra no caminho** [C §29.4].
- **Posto das Fendas** [E] — dentro de Raiz Clara, é onde os pesquisadores mantêm estabilizadas as passagens já abertas. É a "praça dos portais" do Nexus antigo, agora justificada: a bíblia já põe pesquisa de fendas ali.
- **Clareira do Novo Zero** [C §5] — o centro do continente. Conselho, memorial, alojamentos estrangeiros e o **anel de estações de raiz**, uma por mundo. É de lá que se alcança a raiz onde cada fenda externa está ancorada.
- **Estações de raiz** [C §11] — não são teletransporte livre desde o início; restauram-se aos poucos e viram viagem rápida depois de visitar a região. É o nosso sistema de fast travel, sem código novo além do menu de destinos.

## 5. Dimensões Externas: ancoragem e ordem

Cada fenda externa está ancorada à raiz de um mundo. Isso dá a cada desbloqueio um patrocinador diegético **sem obrigar a construir o país** — o jogador chega à estação de raiz daquele mundo, não à sua capital.

| # | Dimensão Externa | Raiz âncora | Por quê | Marcação |
|---|---|---|---|---|
| 1 | Pokémon | Primas (1) | A primeira fenda abre em Primas durante a sucessão | [C §12] |
| 2 | Digimon | Secandas (2) | Vizinho terrestre de Primas [C §3]; telepatia e portais psíquicos são o análogo nativo mais próximo de uma rede | [E] |
| 3 | Medabots | Undicus (11) | "Undicus será essencial para compreender Medabots e outras tecnologias dimensionais" | [C §13.11] |
| 4 | Monster Rancher | Doidicus (12) | Discos são arquivos; Doidicus é arqueologia de tecnologia antiga sob o gelo | [E sobre C §13.12] |
| 5 | V-Monsters (Folklora) | Novas (9) | Mundo da memória e da energia espiritual; "elo esquecido" é o vocabulário local para o mesmo fenômeno | [E sobre C §13.9] |

Ordem de desbloqueio: **Pokémon → Digimon → Medabots → Monster Rancher → Folklora → Coração da Árvore.** Critério herdado e ainda válido: reconhecimento decrescente + contraste temático alternado (natureza → digital → metal → rural → guerra desenhada à mão). Folklora fica por último porque é a única dimensão **original**: ela só pesa quando o jogador já tem quatro pontos de comparação.

Tensão de produção a registrar: Folklora é a **última a ser produzida** e — agora mais do que antes — a **única que pode aparecer em material público** ([05](05-roadmap.md), risco 2).

## 6. Progressão

### 6.1 O que substitui as Chaves Dimensionais

Duas moedas, ambas rodando em sistema **já implementado**:

| Moeda | Onde se ganha | Quantos | Função |
|---|---|---|---|
| **Núcleo de Fenda** [E] | Marco de cada Dimensão Externa | 10 (2 × 5) | Estabiliza a passagem em Raiz Clara; sobe o teto de obediência; ≤1 desbloqueio de campo por dimensão |
| **Marca de Grande Criança** [C §8] | Primas (GC_01) + as outras onze no endgame (§7) | 12 | Reconhecimento de cada mundo; **gate do pacto** com o espírito daquele mundo |

Os dois primeiros reconhecimentos de Primas (Colégio de Primas e Arena da Pedreira, em Rockside) entram no mesmo slot de insígnia dos Núcleos: **12 gates de progressão ao todo** (2 em Primas + 10 externos).

O número 12, que a versão anterior descartou por "não ter função mecânica", **passa a ter duas**: 12 gates de progressão e 12 Marcas de mundo — e `MON_Pacts.js` já implementa `GC_01..GC_12` exatamente assim. Voltar de 14 para 12 apaga um sistema em vez de criar um.

### 6.2 Os doze espíritos e o Espírito único

Cânone: Jibaku absorveu os outros onze; existe um só Espírito [C §1.2]. Os dados, porém, têm doze espíritos (`BKY` 900–911) e o plugin de pactos gira em torno deles.

Reconciliação [E]: os onze não voltam a ser criaturas independentes. Eles afloram como **ecos** — manifestações que o próprio Jibaku projeta, e que só se estabilizam quando o jogador carrega a Marca do mundo correspondente. Firmar o pacto com um eco não separa nada de Jibaku: **acalma** Jibaku. Isso resolve três coisas de uma vez:

- não contradiz "Jibaku é o único remanescente";
- explica a **instabilidade de Jibaku** que Spark já demonstra na cerimônia [C §30, etapa 3];
- amarra o endgame ao mistério das fendas, que a bíblia manda deixar em aberto até o fim [C §12].

**Monstros Encrenqueiros** [C §9.4]: resíduo da toxina antiga, raro, restrito a cavernas profundas e túneis lacrados [C §23.3]. Cânone diz que uma criatura Encrenqueira **pode ser curada e não é outra espécie** — o que se encaixa no dado existente: os oito "Turvo" (912–919) são criaturas de **outras origens** corrompidas depois das fendas, já barrados na captura. Alinhamento a fazer: quem vence um Encrenqueiro **cura**, não coleciona.

### 6.3 Curva de nível

| Bloco | Selvagens | Gates | Time ao sair |
|---|---|---|---|
| Primas (Mundo 1) | 3–14 | 12 / 16 | ~16–18 |
| DE Pokémon | 14–24 | 19 / 23 | ~26–28 |
| DE Digimon | 24–32 | 29 / 34 | ~34–36 |
| DE Medabots | 32–40 | 37 / 42 | ~42–44 |
| DE Monster Rancher | 40–47 | 45 / 49 | ~48–50 |
| DE Folklora | 47–52 | 51 / 53 | ~53–55 |
| Coração da Árvore | 52–56 | ecos 56 · final 58 | 56–58 |

Degraus de ~10 níveis por bloco: renovam parte da equipe sem invalidar favoritos. **Exceção deliberada em Monster Rancher → Folklora (~2 níveis)**, herdada e ainda válida: Folklora vende um sistema novo, não uma troca de time — o jogador chega com a equipe de endgame formada e o que muda é *como* ele luta. Manter o degrau empurraria o fecho para a casa dos 65 e obrigaria a reescalar o Coração da Árvore inteiro.

Coral Town, que fora desenhada como cidade-tutorial de nível 3–16, passa a ser a **cidade de entrada da DE Pokémon (14–24)**. As 4 tabelas de encontro dela ainda não disparam em mapa nenhum, então re-tunar é editar dado, não refazer trabalho.

### 6.4 Ponto de virada — trânsito livre

Depois do **6º gate** (fim da DE Digimon, ~50% da campanha): **estações de raiz restauradas** — as passagens já visitadas ficam abertas e a viagem rápida liga as regiões conhecidas. Antes disso, voltar é permitido; avançar só na ordem. É o mesmo evento do "Nexus restaurado", com causa canônica [C §11].

## 7. Arco narrativo — 3 atos

**Premissa:** o despertar de Jibaku com um novo parceiro abriu fendas pelas doze raízes. Ninguém sabe por quê, e o Conselho precisa decidir o que fazer com um mundo que voltou a ter um centro de poder.

**Antagonismo — o movimento da Nova Torre** [E, derivado de C §7 e §13.11]. Não é um vilão, é um bloco político com argumento defensável: *"Sem a Torre não há resposta rápida. As fendas provam isso. Vamos usar a Árvore como a Torre foi usada — desta vez direito."* Querem centralizar as raízes e as fendas sob um comando único. O jogador é a peça que eles precisam (é o sucessor) e a prova contra eles (uma equipe de origens misturadas funciona **sem** comando único). O nome do movimento é decisão em aberto (§12).

- **Ato 1 — "A Primeira Fenda"** (Primas, ~3–4h). Chegada à Vila Primeiro Passo; Colégio, candidatos e uma tarefa comunitária que exige **compreender um monstro, não derrotá-lo**; Bucky, Spark e Jibaku; cerimônia no Campo do Primeiro Sonho interrompida pela fenda; Jibaku escolhe o jogador; a vila vira sua versão de emergência; viagem à Cidade dos Porcos [C §30]. Fecho: o Conselho convoca o novo G.C. a Raiz Clara, e a passagem da DE Pokémon é a primeira a se estabilizar.
- **Ato 2 — "As Raízes"** (Raiz Clara + Dimensões Externas, ~7–9h). Loop por dimensão: problema local causado pela fenda → 2 Núcleos → duelo com o **rival de Primas** ou um **candidato preterido** recrutado pela Nova Torre (equipe mista, espelho do jogador). Cada dimensão perde algo visível para a fenda; cada retorno muda Raiz Clara. No meio do ato, estações de raiz restauradas. Fecho em Folklora, onde o discurso da Nova Torre soa razoável (§8).
- **Ato 3 — "O Coração da Árvore"** (~2–3h). A Nova Torre tenta assumir o anel de estações de raiz na Clareira do Novo Zero. Gauntlet contra as **antigas Grandes Crianças** — que não são inimigas: cada duelo entrega a **Marca** daquele mundo [C §8]. Com as doze Marcas, o jogador entra na árvore e estabiliza os ecos; o mistério da descarga fecha aqui. Resolução: as fendas continuam existindo, controladas e abertas — pós-game de captura livre.

Isso mantém a estrutura de produção do arco antigo (loop por dimensão, mini-boss recorrente, gauntlet, dungeon final de colagem) e troca a motivação de "impedir a fusão" por "provar que conexão não exige centro", que é a tese que a bíblia já deixou montada.

## 8. Folklora (V-Monsters) — última Dimensão Externa

Única dimensão de **IP própria** do dono ([02](02-franquias.md)). Ancorada na raiz de Novas; níveis 47–52; sistema local = **Barra de Elo**.

A fonte (`vmonsters-forgotten-link`) é um jogo **em produção**, não cânone fechado. O que não existe lá é decisão nova e fica marcado:

| Elemento | Na fonte | Aqui |
|---|---|---|
| Continente **Folklora** | sim | usado como está |
| Guerra **Norte × Sul** | sim — sem nome de facção nem líder | conflito local do Ato 2; **batizar as facções continua em aberto** |
| Dois protagonistas de visões opostas | sim — sem nome | viram **dois NPCs rivais**, um por facção |
| **V-Link** e barra de elo | sim | sistema da dimensão (`MON_Link.js`, implementado) |
| Camada cyber (Lag, Virus, glitch) | sim | reskin de status/itens existentes |
| Múltiplos finais / escolha de protagonista | sim | **não portado** — o avatar é o sucessor de Bucky e a campanha tem um final |
| Captura de V-Monsters | **não existe** | **invenção do fangame** (V-Links) |
| O que é o **"elo esquecido"** | só o título; **sem sinopse** | **invenção do fangame:** é o mesmo fenômeno que as raízes de Amano regulam — Folklora tinha nome para as fendas antes de qualquer um dos Doze Mundos |

**Gancho de enredo:** o emissário da Nova Torre não precisa abrir fenda aqui. Ele oferece às duas facções a arma que encerraria a guerra, e o comando único chega como **proposta de paz**. É onde a tese soa razoável — por isso Folklora fica logo antes do Coração da Árvore.

**Escopo:** 6 mapas — 1 cidade por facção, a fronteira, 2 rotas e o Marco (**Torre do V-Link**, Núcleos 9–10). Sem overworld de guerra e sem batalha em massa: a guerra é cenário e NPC, não sistema.

## 9. Vertical slice / demo

O recorte muda de dono: não é mais "1,5 dimensão + Nexus", é **Primas até a Cidade dos Porcos** — exatamente o que a bíblia libera em §30 e produz em §31 (P0→P2). A fantasia que a slice precisa provar deixou de ser "duas franquias no mesmo time" e passou a ser mais barata e mais forte: **uma criatura externa no meio de gente que nunca viu uma.**

| # | Mapa | Marco da bíblia | Status |
|---|---|---|---|
| 1 | Vila Primeiro Passo — praça, entrada sul, Colina do Colégio | P0 | novo |
| 2 | Interiores: Colégio, estalagem, clínica, loja | P1 | novo |
| 3 | Campo do Primeiro Sonho — estados normal e pós-fenda | P0/P1 | novo |
| 4 | Campos do Primeiro Sol | P0/P2 | novo |
| 5 | Bosque dos Vasos | P2 | novo |
| 6 | Cidade dos Porcos — mercado, clínica, estufa, hospedaria | P2 | novo |

- **~12 capturáveis:** ~10 nativos de Primas + a criatura externa da fenda. **Nenhum nativo existe hoje nos dados** — é o maior custo da virada ([05](05-roadmap.md), risco 1).
- **Marco obrigatório aos ~45 min:** a fenda no Campo do Primeiro Sonho e a primeira criatura externa entrando no time.
- **Marco 1 (gate 1) = Colégio de Primas**, a prova final dos candidatos: valida o template de Marco dentro do recorte da bíblia.
- Missão longa da Cidade dos Porcos: **a criatura dimensional não digere a comida local** [C §25.6]. Ensina cuidado, comércio e convivência sem uma única batalha obrigatória.
- Duração 90–120 min. A slice valida: pipeline de mapa novo do zero, estado duplo de mapa, encontro **não hostil**, esqueleto de Marco, primeira captura externa.
- Corte após a chegada à Cidade dos Porcos, com Raiz Clara como destino anunciado.

A prova de mistura cross-franquia sai da slice e vira a **Demo (Slice B)**: a fenda de Pokémon aberta, Coral Town reaproveitada e o primeiro Núcleo.

## 10. Templates de produção

### Cidade (~30×25 tiles; interiores 13×10)

| Componente | Qtd | Regra |
|---|---|---|
| Clínica / centro de cura (skin por região) | 1 | A ≤5 tiles da entrada principal |
| Loja | 1 | Estoque = tier do bloco (tabela única de preços) |
| Marco (prédio do gate) | 0–1 | Só em cidades-chave |
| Casas com NPC | 3–5 | 1 lore, 1 dica mecânica, **1 presença deslocada** |
| Sidequest | 1 | Buscar/entregar ou batalha opcional; prêmio = item de captura ou TM |
| NPC utilitário | 1 | Avaliador/renomeador (varia por bloco) |
| Saídas | 2–3 | Anterior, próxima, 1 opcional pós-virada |

A **presença deslocada** é a marca do jogo e agora funciona nos dois sentidos: nas cidades dos Doze Mundos é uma criatura ou objeto vindo de uma Dimensão Externa; nas Dimensões Externas é um viajante dos Doze Mundos. Toda cidade tem uma.

**Exceção — template ampliado (~45×40):** Vila Primeiro Passo e Cidade dos Porcos. A bíblia exige 5 zonas / 4–5 distritos, **7 interiores** cada, 25–35 construções aparentes, travessia de 40–60s e **três caminhos visíveis a partir da praça** [C §24.3, §24.7, §25.3]. Não cabe no template padrão e não deve caber: são as duas cidades que definem a identidade da região.

### Rota (~35×30 tiles; 3–5 min de travessia)

| Componente | Qtd | Regra |
|---|---|---|
| Zonas de encontro | 2–3 manchas | 4–6 espécies, 1 rara (5%) |
| Encontro **não hostil** | ≥1 por rota de Primas | Fugir, observar, pedir comida, bloquear passagem [C §9] |
| Treinadores | 3–4 | 2 obrigatórios, 1–2 evitáveis; nível = topo da faixa selvagem +1 |
| Itens visíveis | 2 | Caminho + desvio curto |
| Item escondido | 1 | Sempre 1 por rota |
| Bloqueio de campo | 0–1 | Atalho travado pelo desbloqueio do bloco |
| Micro-marco visual | 1 | Placa, ruína, raiz branca, fenda inativa |

O encontro não hostil é requisito de cânone, não sabor: Primas ensina que **observar comportamento vale tanto quanto lutar** [C §23] e a primeira tarefa do jogo tem de ser compreender um monstro [C §30]. Custo: um common event com três saídas antes da batalha.

### Marco (prédio do gate)

Entrada → 2–3 lacaios temáticos → puzzle leve de 1 sala (opcional nos dois primeiros) → boss → evento de gate → saída. **Um evento comum parametrizado serve para os 12 Marcos.**

### Estado pós-fenda de mapa

Uma área-base, estados por props/efeitos/colisão — **nunca dois mapas** [C §24.4]. O Campo do Primeiro Sonho é o primeiro caso e o modelo dos demais; a vila inteira também muda de estado depois da fenda [C §30, etapa 6].

## 11. Convenções

- Mapas: `M01_PRI_VilaPrimeiroPasso`, `M01_PRI_CamposPrimeiroSol`, `M01_PRI_RaizClara`, `DE_PKM_CoralTown`, `DE_DGM_VilaFile`, `DE_VMO_Folklora`, `Z_ClareiraNovoZero`, `Z_Arvore_1`. Prefixo `M01..M12` para mundos, `DE_` para Dimensões Externas, `Z_` para o centro.
- Switches: `GATE_01..12`, `FENDA_PKM..VMO`, `ACT_1..3`, `RAIZ_TRAVEL`, `POSFENDA_<AREA>`.
- Marcas de Grande Criança **não são switches**: `GC_01..GC_12` vivem em `$gameSystem` via `MON_Pacts.js`.
- Ordem de produção: **vertical slice antes de qualquer mapa de Dimensão Externa** — ela valida o pipeline de mapa novo, o estado duplo e o template de Marco. Exceção: **um mapa-vitrine de Folklora sai cedo**, por ser o único material exibível publicamente ([05](05-roadmap.md), risco 2).

## 12. Decisões em aberto

No espírito de [C §33] — nenhuma delas bloqueia o blockout de Primas:

- espécie exata da primeira criatura dimensional (a bíblia deixa aberto; o fangame quer um Pokémon reconhecível);
- nome do movimento da Nova Torre e das duas facções de Folklora;
- quantos candidatos aparecem na cerimônia e quantos viram duelistas recorrentes;
- se a origem do jogador (qualquer um dos doze mundos [C §1.3]) é só diálogo + item inicial ou tem prólogo próprio — **na v1, só sabor**;
- quais das onze antigas Grandes Crianças ganham duelo próprio no Ato 3 e quais só aparecem.
