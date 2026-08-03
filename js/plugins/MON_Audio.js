//=============================================================================
// MON_Audio.js  — Fase 10
//=============================================================================
/*:
 * @target MZ
 * @plugindesc [MON v0.5.2] Áudio: cries dos Pokémon, BGM de batalha e fanfarra de
 * vitória. Arquivos ausentes são ignorados em silêncio (nunca quebram o jogo).
 * @author Pokémon Dimensions (port MZ)
 * @base MON_Core
 * @orderAfter MON_Battle
 *
 * @help MON_Audio.js
 *
 * Toca o "cry" de um Pokémon e a trilha de batalha/vitória. Antes de tocar,
 * verifica se o arquivo existe (no NW.js/playtest); se não existir, pula sem
 * erro — nada de "Failed to load audio/...".
 *
 * Arquivos:
 *   audio/se/Cries/001Cry.ogg, 004Cry.ogg, …   (cries, número de 3 dígitos)
 *   audio/bgm/<BGM de batalha>.ogg
 *   audio/me/<fanfarra de vitória>.ogg
 *
 * Os padrões usam os áudios que já vêm com todo projeto MZ
 * (Battle1/Battle2, Victory1/Victory2).
 *
 * @param cryFolder
 * @text Pasta dos cries (em se/)
 * @default Cries/
 * @param crySuffix
 * @text Sufixo do nome do cry
 * @default Cry
 * @param wildBgm
 * @text BGM de batalha selvagem
 * @default Battle1
 * @param trainerBgm
 * @text BGM de batalha de treinador
 * @default Battle2
 * @param victoryWildMe
 * @text Fanfarra vitória (selvagem)
 * @default Victory1
 * @param victoryTrainerMe
 * @text Fanfarra vitória (treinador)
 * @default Victory2
 */

var MON = MON || {};

(() => {
    "use strict";
    const P = PluginManager.parameters("MON_Audio");
    const num3 = (n) => String(n).padStart(3, "0");

    // cache de existência de arquivos; fora do NW.js assume que existe
    const _checked = {};
    function audioExists(relPath) {
        if (_checked[relPath] !== undefined) return _checked[relPath];
        let ok = true;
        try {
            if (Utils.isNwjs()) {
                const fs = require("fs");
                const path = require("path");
                const base = path.dirname(process.mainModule.filename);
                ok = fs.existsSync(path.join(base, relPath));
            }
        } catch (e) { ok = true; }
        _checked[relPath] = ok;
        return ok;
    }

    MON.Audio = {
        _savedBgm: null,

        playCry(speciesId) {
            if (!speciesId) return;
            const name = (P.cryFolder || "Cries/") + num3(speciesId) + (P.crySuffix || "Cry");
            if (!audioExists("audio/se/" + name + ".ogg")) return;
            AudioManager.playSe({ name, volume: 90, pitch: 100, pan: 0 });
        },
        playBattleBgm(isTrainer) {
            const name = isTrainer ? (P.trainerBgm || "Battle2") : (P.wildBgm || "Battle1");
            if (!audioExists("audio/bgm/" + name + ".ogg")) return;
            if (!this._savedBgm) this._savedBgm = AudioManager.saveBgm();
            AudioManager.playBgm({ name, volume: 90, pitch: 100, pan: 0 });
        },
        restoreBgm() {
            if (this._savedBgm) {
                AudioManager.replayBgm(this._savedBgm);
                this._savedBgm = null;
            }
        },
        playVictory(isTrainer) {
            const name = isTrainer ? (P.victoryTrainerMe || "Victory2") : (P.victoryWildMe || "Victory1");
            if (!audioExists("audio/me/" + name + ".ogg")) return;
            AudioManager.playMe({ name, volume: 90, pitch: 100, pan: 0 });
        }
    };
})();
