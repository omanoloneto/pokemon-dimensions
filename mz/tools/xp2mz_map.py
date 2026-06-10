#!/usr/bin/env python3
"""Converte um mapa XP (dump de xp_dump_map.rb) em mapa MZ completo:
- coleta só os tiles usados (autotiles "assados" em estáticos, frame 0)
- reempacota em folhas B-E de 768x768 (48px, upscale nearest 1.5x)
- gera MapNNN.json (camadas z0-z2), entrada em Tilesets.json (passabilidade,
  prioridade->estrela, bush/counter) e MapInfos.json

Uso: python3 mz/tools/xp2mz_map.py <map_id> [mz_map_id]
"""
import json, sys, unicodedata
from PIL import Image

ROOT = "."
MZ = "mz"
TILE = 32

# tabela clássica de composição de autotile do RMXP: 48 variantes -> 4 minitiles
# (TL,TR,BL,BR), índices 1-based numa grade 6x8 de minitiles de 16px
AUTOTILE_PARTS = [
    [27,28,33,34],[5,28,33,34],[27,6,33,34],[5,6,33,34],
    [27,28,33,12],[5,28,33,12],[27,6,33,12],[5,6,33,12],
    [27,28,11,34],[5,28,11,34],[27,6,11,34],[5,6,11,34],
    [27,28,11,12],[5,28,11,12],[27,6,11,12],[5,6,11,12],
    [25,26,31,32],[25,6,31,32],[25,26,31,12],[25,6,31,12],
    [15,16,21,22],[15,16,21,12],[15,16,11,22],[15,16,11,12],
    [29,30,35,36],[29,30,11,36],[5,30,35,36],[5,30,11,36],
    [39,40,45,46],[5,40,45,46],[39,6,45,46],[5,6,45,46],
    [25,30,31,36],[15,16,45,46],[13,14,19,20],[13,14,19,12],
    [17,18,23,24],[17,18,11,24],[41,42,47,48],[5,42,47,48],
    [37,38,43,44],[37,6,43,44],[13,18,19,24],[13,14,43,44],
    [37,42,43,48],[17,18,47,48],[13,18,43,48],[1,2,7,8],
]

def slug(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return "".join(c for c in s if c.isalnum())

def load_image(path):
    return Image.open(path).convert("RGBA")

def autotile_variant(img, variant):
    """compõe a variante 32x32 de um autotile XP (frame 0)."""
    if img.height <= TILE:                      # autotile simples de 1 tile
        return img.crop((0, 0, TILE, TILE))
    frame = img.crop((0, 0, 96, 128))           # frame 0 de animados
    out = Image.new("RGBA", (TILE, TILE))
    for q, part in enumerate(AUTOTILE_PARTS[variant]):
        i = part - 1
        sx, sy = (i % 6) * 16, (i // 6) * 16
        dx, dy = (q % 2) * 16, (q // 2) * 16
        out.paste(frame.crop((sx, sy, sx + 16, sy + 16)), (dx, dy))
    return out

def main():
    xp_id = int(sys.argv[1]) if len(sys.argv) > 1 else 22
    mz_id = int(sys.argv[2]) if len(sys.argv) > 2 else xp_id

    dump = json.load(open(f"{MZ}/tools/xp_map_{xp_id}.json", encoding="utf-8"))
    w, h = dump["width"], dump["height"]
    layers = dump["layers"]
    passages, priorities = dump["passages"], dump["priorities"]
    name = dump["name"]
    prefix = slug(name) or f"Map{xp_id}"

    tileset_img = load_image(f"Graphics/Tilesets/{dump['tilesetName']}.png")
    autotiles = []
    for an in dump["autotileNames"]:
        autotiles.append(load_image(f"Graphics/Autotiles/{an}.png") if an else None)

    # --- coleta ids usados e produz os 32x32 ---
    used = sorted({t for layer in layers for t in layer if t >= 48})
    if len(used) > 1023:
        sys.exit(f"ERRO: {len(used)} tiles únicos (> 1023). Divida o mapa.")
    tiles, newid = {}, {}
    for i, tid in enumerate(used, start=1):     # id 0 fica transparente
        if tid >= 384:
            n = tid - 384
            sx, sy = (n % 8) * TILE, (n // 8) * TILE
            tiles[i] = tileset_img.crop((sx, sy, sx + TILE, sy + TILE))
        else:
            at = autotiles[tid // 48 - 1]
            tiles[i] = autotile_variant(at, tid % 48) if at else Image.new("RGBA", (TILE, TILE))
        newid[tid] = i

    # --- folhas B-E: 16x16 tiles; ids 0-127 metade esquerda, 128-255 direita ---
    n_sheets = (len(used) // 256) + 1
    sheets = [Image.new("RGBA", (512, 512)) for _ in range(n_sheets)]
    for i, img in tiles.items():
        local, sheet = i % 256, i // 256
        col = (local % 8) + (8 if local >= 128 else 0)
        row = (local % 128) // 8
        sheets[sheet].paste(img, (col * TILE, row * TILE))
    sheet_names = []
    for si, sh in enumerate(sheets):
        nm = f"{prefix}_{'BCDE'[si]}"
        sh.resize((768, 768), Image.NEAREST).save(f"{MZ}/img/tilesets/{nm}.png")
        sheet_names.append(nm)

    # --- Tilesets.json: flags ---
    tilesets = json.load(open(f"{MZ}/data/Tilesets.json", encoding="utf-8"))
    flags = [0] * 8192
    for tid, i in newid.items():
        p = passages[tid] if tid < len(passages) else 0
        f = p & 0x0F                            # 4 direções: mesmos bits no MZ
        if p & 0x40: f |= 0x40                  # bush
        if p & 0x80: f |= 0x80                  # counter
        if tid < len(priorities) and priorities[tid] > 0:
            f |= 0x10                           # prioridade -> estrela (acima do jogador)
        flags[i] = f
    ts_names = ["", "", "", "", ""] + sheet_names + [""] * (4 - len(sheet_names))
    ts_id = len(tilesets)
    tilesets.append({"id": ts_id, "flags": flags, "mode": 1, "name": name,
                     "note": "", "tilesetNames": ts_names})
    json.dump(tilesets, open(f"{MZ}/data/Tilesets.json", "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    # --- MapNNN.json ---
    data = [0] * (w * h * 6)
    for z in range(3):
        for i, tid in enumerate(layers[z]):
            data[z * w * h + i] = newid.get(tid, 0)
    mzmap = {
        "autoplayBgm": False, "autoplayBgs": False, "battleback1Name": "",
        "battleback2Name": "", "bgm": {"name": "", "pan": 0, "pitch": 100, "volume": 90},
        "bgs": {"name": "", "pan": 0, "pitch": 100, "volume": 90},
        "disableDashing": False, "displayName": name, "encounterList": [],
        "encounterStep": 30, "height": h, "note": "", "parallaxLoopX": False,
        "parallaxLoopY": False, "parallaxName": "", "parallaxShow": True,
        "parallaxSx": 0, "parallaxSy": 0, "scrollType": 0,
        "specifyBattleback": False, "tilesetId": ts_id, "width": w,
        "data": data, "events": [None],
    }
    json.dump(mzmap, open(f"{MZ}/data/Map{mz_id:03d}.json", "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    # --- MapInfos.json ---
    infos = json.load(open(f"{MZ}/data/MapInfos.json", encoding="utf-8"))
    while len(infos) <= mz_id:
        infos.append(None)
    infos[mz_id] = {"id": mz_id, "expanded": False, "name": name,
                    "order": mz_id, "parentId": 0, "scrollX": w * 24, "scrollY": h * 24}
    json.dump(infos, open(f"{MZ}/data/MapInfos.json", "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    # ponto de chegada sugerido: tile passável mais central
    best = None
    for y in range(h // 2 - 5, h // 2 + 6):
        for x in range(w // 2 - 5, w // 2 + 6):
            i0 = newid.get(layers[0][y * w + x], 0)
            i1 = newid.get(layers[1][y * w + x], 0)
            if i0 and flags[i0] & 0x0F == 0 and (not i1 or flags[i1] & 0x0F == 0):
                best = (x, y); break
        if best: break
    print(f"OK: '{name}' {w}x{h} -> Map{mz_id:03d}.json | {len(used)} tiles | "
          f"folhas: {', '.join(sheet_names)} | tileset id {ts_id} | chegada sugerida: {best}")

main()
