# 04 — Produção: Release Web/Mobile, Assets, Legal e QA

Números medidos no repo: **939MB totais** — `img/` 395MB (`img/monsters/` = 342MB em ~4.770 PNGs), `audio/` 48MB (1.104 .ogg). Corescript MZ 1.6+ (decoder Vorbis embutido → .ogg funciona no iOS; saves via localforage/IndexedDB). Resolução 816×624.

## Pipeline de release

Fato base: MZ só exporta Windows/macOS/Web. **Não existe export nativo APK/IPA** — build mobile é o export web num container WebView (Capacitor é o padrão atual; Cordova decadente).

**Ordem recomendada:**

1. **Web + PWA em hospedagem própria** (canal primário) — resolve web, iOS e "Android sem instalar" de uma vez.
   - itch.io inviável: limite de 1.000 arquivos por upload HTML5 (temos ~6.000) e é onde a Nintendo dispara DMCA em massa.
   - Cloudflare Pages (20k arquivos, 25MB/arquivo) ou servidor próprio cabem.
   - Web baixa assets **sob demanda** — 939MB no servidor ≠ 939MB de download.
   - PWA (manifest + service worker): app instalável no Android e iOS por custo baixo.
2. **APK sideload via Capacitor** — pra quem quer app Android offline; aí o corte de assets vira obrigatório (meta: **<250MB** empacotado). Distribuir via site/Discord, não em loja.
3. **Google Play: não.** Review humano + IP de terceiros + identidade verificada = pior dos dois mundos. **iOS nativo/TestFlight: não perseguir** (review da Apple). iOS = PWA via Safari.
   - Gotcha iOS: Safari apaga IndexedDB (saves!) após **7 dias sem uso** em aba normal; PWA instalada na home screen é isenta. Instruir instalação como PWA + oferecer export/import manual de save.

## Adaptação mobile (gaps concretos no código)

- [MON_Codex.js:323-324](../js/plugins/MON_Codex.js#L323-L324) — ordenação/filtro usa `pageup`/`pagedown` (Q/W). **Sem equivalente touch.**
- [MON_Storage.js:250-251](../js/plugins/MON_Storage.js#L250-L251) — troca de box idem. **Sem equivalente touch.**
- MON_Battle/MON_Party já tratam `TouchInput` básico; MON_Bag herda tap/scroll de `Window_Selectable`. Validar tudo em device.
- Fix mínimo: setas/botões clicáveis nas cenas Pokédex e Storage + swipe horizontal pra trocar box. Alternativa: plugin de controles virtuais (Hakuen Mobile Controls).
- Conferir `touchUI` habilitado no ConfigManager (menu/cancel touch do core).
- Resolução: manter 816×624 com letterbox no primeiro release (opção barata); migrar pra 1280×720 só se teste real incomodar (exige revisar todas as janelas MON_*). Safe area/notch via `env(safe-area-inset-*)` no index.html.
- **Memória em runtime > peso em disco:** cache de bitmaps do MZ cresce sem limite; iOS Safari mata a aba ~1-1.5GB. Adicionar limpeza seletiva (`ImageManager.clear()`) ao sair de batalha/Pokédex. Budget: <800MB no iOS.

## Corte de assets (por prioridade)

1. **pngquant/oxipng em massa** nos sprites — quantização 256 cores ≈ lossless em sprite art; 342MB → ~110-130MB. Maior ganho, zero decisão de design.
2. Cortar `img/monsters/alt/` (84MB) do build se formas alternativas ficarem fora da v1.
3. Shinies (131MB): manter no servidor (web = sob demanda); fora do APK se apertar.
4. Áudio: BGM re-encodado ~96kbps (29→~15MB); deletar SE/BGM do RTP não referenciados nos JSON.
5. Atlas de ícones/footprints: só se um dia precisar do itch (limite de arquivos) — baixa prioridade.

## Realidade legal (factual; decisão é do dono)

- Nintendo/TPC emitem C&D/DMCA com regularidade: Pokémon Uranium, Prism, AM2R, **~550-600 fangames removidos do Game Jolt de uma vez**, takedowns recorrentes no itch.io. Padrão ativo. Ninguém contestou e venceu; a prática é cumprir imediatamente.
- O que atrai enforcement: **visibilidade** (trailer viral, imprensa), **monetização de qualquer tipo**, presença em plataformas grandes indexadas. Multi-franquia soma titulares (Bandai etc. — historicamente menos agressivos que Nintendo, mas cada franquia é mais um com direito de ação). Sprites/cries ripados são cópia direta de asset — camada acima de "inspirado em".
- Mitigações comuns na cena (reduzem probabilidade, **não são proteção legal**): zero monetização (nem doação/Patreon/ads), distribuição discreta (link em comunidade, hospedagem própria), marca fora do domínio/binário, disclaimer de não-afiliação, e plano decidido de antemão: **chegou C&D → cumpre e retira.**

## Cadência (1 dev + IA)

- **1 build jogável por mês**, sempre deployada no canal web interno. Build que não roda no celular não conta.
- Regra de WIP por ciclo: 1 feature de conteúdo + 1 item de débito técnico/QA. Nunca dois sistemas novos em paralelo.
- IA rende mais em: dados em massa (movesets, encontros, treinadores), porte de mapas, testes, auditoria de assets. Decisão de balanceamento de combate = playtest humano.
- Medir por release: testes headless (baseline 56, nunca regride), zero erro de console em playthrough de 15 min, FPS no device low-end de referência, peso do build + tempo até title em 4G, conteúdo implementado vs. planejado, tempo até a primeira captura (proxy de onboarding).

## QA

1. **Teste de integridade de assets (fazer já):** varrer `data/*.json` e validar que todo áudio/imagem referenciado existe. O crash de áudio ausente já aconteceu (commit `3fb6a23`) — classe de bug 100% prevenível.
2. **Smoke E2E (Playwright) no build web:** bootar → novo jogo → andar → batalha → captura → Pokédex/PC/mochila → salvar → recarregar → conferir. Pega crash de runtime que o harness de lógica não vê.
3. **Save compat:** definir `schemaVersion` no save **antes do primeiro release público**; guardar um save-fixture por release; teste que carrega fixtures antigos. Testar export/import manual (proteção contra eviction do Safari).
4. **Device matrix mensal (manual, 15 min):** 1 Android low-end (~3GB, browser+APK), 1 Android mid, 1 iPhone (PWA). FPS, alvos de toque das cenas MON_*, save sobrevive a fechar o app.
5. Cena custom nova → entra no checklist touch no mesmo PR.
