//=============================================================================
// MON_Codex.js
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.1] Sistema de Pokédex: lista navegável + ficha de detalhes
 * (tipos, categoria, altura/peso, descrição), com estado visto/capturado.
 * @author Pokémon Dimensions (port MZ)
 * @base MON_Core
 * @orderAfter MON_Core
 *
 * @help MON_Codex.js
 *
 * Abre a Pokédex. Espécies não vistas aparecem como "----------" e ficham com
 * "???". Espécies vistas mostram nome/tipos/altura/peso. A descrição completa
 * só aparece quando a espécie foi CAPTURADA (igual aos jogos oficiais).
 *
 * COMO ABRIR
 *   - Comando de plugin "Abrir Pokédex", ou
 *   - Em um evento (Script):  SceneManager.push(Scene_Codex);
 *
 * SPRITES (opcional)
 *   Coloque imagens em  img/monsters/front/<numero>.png  (ex.: 1.png).
 *   Se não houver imagem, um quadro de silhueta/placeholder é desenhado.
 *
 * @command open
 * @text Abrir Pokédex
 * @desc Abre a cena da Pokédex.
 */

var MON = MON || {};

(() => {
    "use strict";

    const FRONT_DIR = "img/monsters/front/";

    // Cores por tipo (hex) — usadas nos "badges" de tipo.
    const TYPE_COLORS = {
        NORMAL: "#9099a1", FIRE: "#ff6450", WATER: "#4d90d5", GRASS: "#63bb5b",
        ELECTRIC: "#f3d23b", ICE: "#74cec0", FIGHTING: "#ce4069", POISON: "#ab6ac8",
        GROUND: "#d97746", FLYING: "#8fa8dd", PSYCHIC: "#f97176", BUG: "#90c12c",
        ROCK: "#c7b78b", GHOST: "#5269ac", DRAGON: "#0a6dc4", DARK: "#5a5366",
        STEEL: "#5a8ea1", FAIRY: "#ec8fe6", "???": "#68a090"
    };
    const typeColor = (t) => TYPE_COLORS[t && t.toUpperCase()] || "#777777";
    const num3 = (n) => String(n).padStart(3, "0");

    //=========================================================================
    // Window_CodexList — lista de todas as espécies
    //=========================================================================
    function Window_CodexList() { this.initialize(...arguments); }
    Window_CodexList.prototype = Object.create(Window_Selectable.prototype);
    Window_CodexList.prototype.constructor = Window_CodexList;

    Window_CodexList.prototype.initialize = function(rect) {
        Window_Selectable.prototype.initialize.call(this, rect);
        this._detailWindow = null;
        this._order = MON.Core.allSpeciesIds();
        this.refresh();
        this.select(0);
        this.activate();
    };
    Window_CodexList.prototype.setOrder = function(ids) {
        this._order = ids;
        this.refresh();
        this.select(0);
        this.callUpdateHelp();
    };
    Window_CodexList.prototype.maxItems = function() {
        return this._order ? this._order.length : 0;
    };
    Window_CodexList.prototype.speciesId = function(index) {
        return this._order[index] || 1;
    };
    Window_CodexList.prototype.currentSpeciesId = function() {
        return this.speciesId(this.index());
    };
    Window_CodexList.prototype.setDetailWindow = function(w) {
        this._detailWindow = w;
        this.callUpdateHelp();
    };
    Window_CodexList.prototype.callUpdateHelp = function() {
        if (this._detailWindow) {
            this._detailWindow.setSpeciesId(this.currentSpeciesId());
        }
    };
    Window_CodexList.prototype.drawItem = function(index) {
        const id = this.speciesId(index);
        const sp = MON.Core.species(id);
        if (!sp) return;
        const rect = this.itemLineRect(index);
        const seen = $gameSystem.monIsSeen(id);
        const caught = $gameSystem.monIsCaught(id);

        // marcador de capturado (poké ball "●")
        this.changeTextColor(caught ? "#ff5959" : ColorManager.normalColor());
        this.contents.drawText(caught ? "●" : "○", rect.x, rect.y, 28, rect.height, "left");

        // número
        this.changeTextColor(ColorManager.normalColor());
        this.drawText("Nº" + num3(id), rect.x + 30, rect.y, 64, "left");

        // nome ou silhueta
        const name = seen ? sp.name : "----------";
        this.changePaintOpacity(seen);
        this.drawText(name, rect.x + 100, rect.y, rect.width - 100, "left");
        this.changePaintOpacity(true);
        this.resetTextColor();
    };

    //=========================================================================
    // Window_CodexDetail — ficha da espécie selecionada
    //=========================================================================
    function Window_CodexDetail() { this.initialize(...arguments); }
    Window_CodexDetail.prototype = Object.create(Window_Base.prototype);
    Window_CodexDetail.prototype.constructor = Window_CodexDetail;

    Window_CodexDetail.prototype.initialize = function(rect) {
        Window_Base.prototype.initialize.call(this, rect);
        this._id = 0;
        this._bitmap = null;
    };
    Window_CodexDetail.prototype.setSpeciesId = function(id) {
        if (this._id === id) return;
        this._id = id;
        this.loadSprite();
        this.refresh();
    };
    Window_CodexDetail.prototype.loadSprite = function() {
        this._bitmap = null;
        if (!$gameSystem.monIsSeen(this._id)) return;
        const bmp = MON.Core.loadSprite(FRONT_DIR, num3(this._id));
        if (bmp) bmp.addLoadListener(() => { this._bitmap = bmp; this.refresh(); });
    };
    Window_CodexDetail.prototype.refresh = function() {
        this.contents.clear();
        const sp = MON.Core.species(this._id);
        if (!sp) return;
        const seen = $gameSystem.monIsSeen(this._id);
        const caught = $gameSystem.monIsCaught(this._id);

        const pad = 8;
        const boxW = 200;
        const boxH = 200;
        const boxX = pad;
        const boxY = pad;

        // moldura do sprite
        this.contents.fillRect(boxX, boxY, boxW, boxH, "rgba(255,255,255,0.06)");
        this.contents.strokeRect ?
            this.contents.strokeRect(boxX, boxY, boxW, boxH, "#ffffff") : null;
        if (seen && this._bitmap && this._bitmap.width > 0) {
            const b = this._bitmap;
            const scale = Math.min(boxW / b.width, boxH / b.height, 2);
            const dw = Math.floor(b.width * scale);
            const dh = Math.floor(b.height * scale);
            this.contents.blt(b, 0, 0, b.width, b.height,
                boxX + (boxW - dw) / 2, boxY + (boxH - dh) / 2, dw, dh);
        } else {
            // placeholder: "?" central
            this.contents.fontSize = 96;
            this.changeTextColor("#888888");
            this.contents.drawText("?", boxX, boxY, boxW, boxH, "center");
            this.resetFontSettings();
        }

        // coluna de texto à direita do quadro
        const tx = boxX + boxW + 16;
        const tw = this.contentsWidth() - tx - pad;
        let ty = boxY;

        // número + nome
        this.changeTextColor(ColorManager.systemColor());
        this.drawText("Nº" + num3(sp.id), tx, ty, 90, "left");
        this.changeTextColor(ColorManager.normalColor());
        this.contents.fontSize = 26;
        this.drawText(seen ? sp.name : "???", tx + 92, ty, tw - 92, "left");
        this.resetFontSettings();
        ty += this.lineHeight();

        // categoria + selo da dimensão de origem (e atributo, nas franquias que usam)
        if (seen) {
            const fr = MON.Franchise && MON.Franchise.of({ speciesId: sp.id, species: () => sp });
            const kind = sp.category ? (fr && fr.id !== "PKM" ? sp.category : "Pokémon " + sp.category) : "";
            if (kind) this.drawText(kind, tx, ty, tw, "left");
            const tag = [fr && fr.id !== "PKM" ? fr.name : null, sp.attribute].filter(Boolean).join(" · ");
            if (tag) {
                this.changeTextColor(ColorManager.systemColor());
                this.drawText(tag, tx, ty, tw, "right");
                this.changeTextColor(ColorManager.normalColor());
            }
        }
        ty += this.lineHeight();

        // tipos (badges coloridos)
        if (seen) {
            this.drawTypeBadge(sp.type1, tx, ty);
            if (sp.type2 && sp.type2 !== sp.type1) {
                this.drawTypeBadge(sp.type2, tx + 110, ty);
            }
        }
        ty += this.lineHeight() + 6;

        // altura / peso
        if (seen) {
            this.changeTextColor(ColorManager.systemColor());
            this.drawText("Altura", tx, ty, 100, "left");
            this.drawText("Peso", tx + 150, ty, 100, "left");
            this.changeTextColor(ColorManager.normalColor());
            ty += this.lineHeight();
            this.drawText(sp.height.toFixed(1) + " m", tx, ty, 130, "left");
            this.drawText(sp.weight.toFixed(1) + " kg", tx + 150, ty, 130, "left");
        }

        // descrição (largura total, abaixo do quadro) — só se capturado
        let dy = boxY + boxH + 16;
        this.changeTextColor(ColorManager.normalColor());
        const entry = caught ? (sp.entry || "")
            : (seen ? "Capture este Pokémon para revelar a descrição da Pokédex."
                    : "Dados ainda não registrados.");
        this.drawWrappedText(entry, pad, dy, this.contentsWidth() - pad * 2);

        // cadeia de evolução (se visto)
        if (seen && sp.evolutions && sp.evolutions.length) {
            const ey = this.contentsHeight() - this.lineHeight() * 2;
            this.changeTextColor(ColorManager.systemColor());
            this.drawText("Evolução:", pad, ey, 120, "left");
            this.changeTextColor(ColorManager.normalColor());
            const txt = sp.evolutions.map(ev => this.evoLabel(ev)).join(", ");
            this.drawText(txt, pad + 120, ey, this.contentsWidth() - pad * 2 - 120, "left");
        }

        // rodapé: ordenação + contadores
        const fy = this.contentsHeight() - this.lineHeight();
        this.changeTextColor(ColorManager.systemColor());
        if (this._sortLabel) this.drawText(this._sortLabel, pad, fy, 280, "left");
        this.drawText(
            "Vistos: " + $gameSystem.monSeenCount() +
            "   Capturados: " + $gameSystem.monCaughtCount(),
            pad, fy, this.contentsWidth() - pad * 2, "right");
        this.resetTextColor();
    };
    Window_CodexDetail.prototype.setSortLabel = function(label) { this._sortLabel = label; this.refresh(); };
    Window_CodexDetail.prototype.evoLabel = function(ev) {
        const sp = MON.Core.speciesByInternal ? MON.Core.speciesByInternal(ev.into) : null;
        const name = sp ? sp.name : ev.into;
        if (ev.method === "Level" || ev.method === "LevelMale" || ev.method === "LevelFemale") {
            return name + " (Nv " + ev.param + ")";
        }
        return name + " (" + ev.method + (ev.param ? " " + ev.param : "") + ")";
    };

    Window_CodexDetail.prototype.drawTypeBadge = function(type, x, y) {
        if (!type) return;
        const w = 100, h = 28;
        this.contents.fillRect(x, y + 2, w, h, typeColor(type));
        this.changeTextColor("#ffffff");
        this.contents.fontSize = 18;
        this.contents.drawText(type.toUpperCase(), x, y + 2, w, h, "center");
        this.resetFontSettings();
    };

    // Quebra de texto simples por palavras.
    Window_CodexDetail.prototype.drawWrappedText = function(text, x, y, maxW) {
        const words = String(text).split(/\s+/);
        let line = "";
        let cy = y;
        const flush = () => {
            if (line) this.drawText(line, x, cy, maxW, "left");
            cy += this.lineHeight();
            line = "";
        };
        for (const w of words) {
            const test = line ? line + " " + w : w;
            if (this.textWidth(test) > maxW && line) {
                flush();
                line = w;
            } else {
                line = test;
            }
        }
        flush();
    };

    //=========================================================================
    // Scene_Codex
    //=========================================================================
    window.Scene_Codex = function() { this.initialize(...arguments); };
    Scene_Codex.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_Codex.prototype.constructor = Scene_Codex;

    const SORT_MODES = [
        { key: "num",    label: "Ordem: Nº" },
        { key: "name",   label: "Ordem: A-Z" },
        { key: "caught", label: "Ordem: Capturados" },
        { key: "seenOnly", label: "Filtro: Só vistos" }
    ];

    Scene_Codex.prototype.create = function() {
        Scene_MenuBase.prototype.create.call(this);
        this._sortMode = 0;
        this.createDetailWindow();
        this.createListWindow();
        this._listWindow.setDetailWindow(this._detailWindow);
        this.applySort();
    };
    Scene_Codex.prototype.applySort = function() {
        const max = MON.Core.maxSpecies();
        let ids = [];
        for (let i = 1; i <= max; i++) ids.push(i);
        const mode = SORT_MODES[this._sortMode].key;
        if (mode === "name") {
            ids.sort((a, b) => {
                const na = MON.Core.species(a).name, nb = MON.Core.species(b).name;
                return na < nb ? -1 : na > nb ? 1 : 0;
            });
        } else if (mode === "caught") {
            ids.sort((a, b) => (($gameSystem.monIsCaught(b) ? 1 : 0) - ($gameSystem.monIsCaught(a) ? 1 : 0)) || (a - b));
        } else if (mode === "seenOnly") {
            ids = ids.filter(i => $gameSystem.monIsSeen(i));
            if (ids.length === 0) ids = [1];
        }
        this._detailWindow.setSortLabel(SORT_MODES[this._sortMode].label + "  (Q/W muda)");
        this._listWindow.setOrder(ids);
    };
    Scene_Codex.prototype.update = function() {
        Scene_MenuBase.prototype.update.call(this);
        if (this._listWindow.active) {
            if (Input.isTriggered("pagedown")) { this._sortMode = (this._sortMode + 1) % SORT_MODES.length; this.applySort(); SoundManager.playCursor(); }
            else if (Input.isTriggered("pageup")) { this._sortMode = (this._sortMode + SORT_MODES.length - 1) % SORT_MODES.length; this.applySort(); SoundManager.playCursor(); }
        }
    };
    Scene_Codex.prototype.listWindowRect = function() {
        const ww = 360;
        const wh = this.mainAreaHeight();
        return new Rectangle(0, this.mainAreaTop(), ww, wh);
    };
    Scene_Codex.prototype.detailWindowRect = function() {
        const x = 360;
        const ww = Graphics.boxWidth - x;
        const wh = this.mainAreaHeight();
        return new Rectangle(x, this.mainAreaTop(), ww, wh);
    };
    Scene_Codex.prototype.createListWindow = function() {
        this._listWindow = new Window_CodexList(this.listWindowRect());
        this._listWindow.setHandler("cancel", this.popScene.bind(this));
        this._listWindow.setHandler("ok", () => this._listWindow.activate());
        this.addWindow(this._listWindow);
    };
    Scene_Codex.prototype.createDetailWindow = function() {
        this._detailWindow = new Window_CodexDetail(this.detailWindowRect());
        this.addWindow(this._detailWindow);
    };

    //=========================================================================
    // Comando de plugin
    //=========================================================================
    PluginManager.registerCommand("MON_Codex", "open", () => {
        SceneManager.push(Scene_Codex);
    });
})();
