#!/usr/bin/env python3
"""
slice.py — Convierte las "hojas de presentación" de sprites (generadas por IA)
de las mascotas Broot y Nix en tiras de animación listas para la app.

Entrada : carpeta con las hojas PNG 1536x1024 tal como vienen en los zips
          (Broot/Broot/*.png y Nix/Nix/*.png).
Salida  : public/mascotas/<pet>/<stage>/<anim>.webp  (tira horizontal, 128px/frame)
          public/mascotas/<pet>/<stage>/retrato.webp (1 frame representativo)
          public/mascotas/manifest.json

Uso:
    pip install pillow numpy scipy
    python3 scripts/sprites/slice.py --src <carpeta_con_Broot_y_Nix> \
        [--out public/mascotas] [--debug <carpeta_debug>] [--only broot/jr]

Cómo funciona (resumen):
  1. Cada hoja se describe a mano en SHEETS: por cada fila de animación, la
     banda vertical donde están los personajes (SIN los números de frame que
     van debajo) y el rango horizontal de la rejilla (SIN la celda de etiqueta).
     Las coordenadas se calibraron mirando cada hoja; las hojas no son rejillas
     regulares, así que NO se asume espaciado igual: dentro de la banda, los
     cortes entre frames se buscan en las columnas con menos "personaje"
     alrededor de la posición esperada.
  2. Quitar fondo ("matting"). Tres métodos según la hoja:
     - "light": fondo claro (degradado, tinte, cuadros de ajedrez pintados).
        Los personajes tienen un contorno oscuro cerrado. Se inunda desde el
        borde del recorte todo lo que no sea contorno oscuro y se parezca al
        color de fondo local (estimado por convolución normalizada, así sigue
        degradados y halos suaves). Lo que queda encerrado por el contorno es
        personaje. Destellos, lágrimas y zzz (colores saturados distintos del
        fondo) sobreviven porque no se parecen al fondo.
     - "alpha": la hoja trae un canal alfa útil (siluetas ya recortadas);
        se usa el alfa con umbral.
     - "alpha+light": alfa parcial (celdas semitransparentes): se combina.
  3. Normalización por mascota+etapa: todas las animaciones de una etapa
     comparten lienzo, escala y línea de suelo. La escala de cada hoja se
     iguala por el tamaño del cuerpo principal (raíz del área del componente
     más grande, mediana de todos sus frames), y cada frame se ancla por el
     centroide horizontal y el borde inferior del cuerpo principal.
  4. Se empaqueta cada animación en una tira WebP con alfa.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

CELL = 128          # tamaño de frame de salida
MARGIN = 4          # margen interior del lienzo de 128 (px de salida)
WEBP_QUALITY = 85

# ---------------------------------------------------------------------------
# Configuración de hojas.
# Cada fila: (anim_id, y0, y1, x0, x1, n_frames)
#   y0..y1 = banda de personajes (excluye el número impreso debajo)
#   x0..x1 = rejilla de frames (excluye la celda de etiqueta)
# Varias filas con el mismo anim_id se concatenan en orden (animaciones de
# 20/24 frames repartidas en 2-3 filas).
# ---------------------------------------------------------------------------
SHEETS = []  # se rellena en sheets_config.py-like bloque de abajo


def S(pet, stage, file, method, rows, **kw):
    SHEETS.append(dict(pet=pet, stage=stage, file=file, method=method, rows=rows, **kw))


# ============================ NIX ==========================================
S("nix", "huevo", "Nix/Nix/NixEgg_NixJr.png", "light", [
    ("idle", 205, 340, 250, 1512, 8),
])
S("nix", "jr", "Nix/Nix/NixEgg_NixJr.png", "light", [
    ("caminar_derecha", 392, 512, 272, 1512, 6),
    ("caminar_izquierda", 552, 665, 272, 1512, 6),
    ("caminar_frente", 705, 818, 272, 1512, 6),
    ("caminar_atras", 858, 975, 272, 1512, 6),
])
S("nix", "jr", "Nix/Nix/NixJr_HappySad.png", "light", [
    ("feliz", 128, 229, 172, 1512, 8),
    ("alegria", 250, 362, 172, 1512, 8),
    ("celebracion", 385, 490, 172, 1512, 8),
    ("triste", 657, 751, 172, 1512, 8),
    ("llorar", 772, 871, 172, 1512, 8),
    ("cansado", 893, 985, 172, 1512, 8),
])
S("nix", "jr", "Nix/Nix/NixJr_SleepTrain.png", "light", [
    ("dormir", 240, 366, 12, 1524, 10),
    ("dormir", 403, 540, 12, 1524, 10),
    ("entrenar", 668, 802, 12, 1524, 12),
    ("entrenar", 838, 975, 12, 1524, 12),
])
S("nix", "pro", "Nix/Nix/NixPro_HappySad.png", "light", [
    ("feliz", 238, 367, 15, 1522, 10),
    ("feliz", 405, 542, 15, 1522, 10),
    ("triste", 678, 813, 15, 1522, 10),
    ("triste", 845, 980, 15, 1522, 10),
])
S("nix", "pro", "Nix/Nix/NixPro_SleepTrain.png", "light", [
    ("dormir", 232, 362, 12, 1524, 10),
    ("dormir", 395, 537, 12, 1524, 10),
    ("entrenar", 663, 800, 12, 1524, 12),
    ("entrenar", 835, 975, 12, 1524, 12),
])
S("nix", "pro", "Nix/Nix/NixPro_Walktrhough.png", "light", [
    ("caminar_derecha", 180, 328, 208, 1520, 6),
    ("caminar_izquierda", 365, 517, 208, 1520, 6),
    ("caminar_atras", 553, 730, 208, 1520, 6),
    ("caminar_frente", 767, 945, 208, 1520, 6),
])
S("nix", "prime", "Nix/Nix/NixPrime_HappySad.png", "light", [
    ("feliz", 272, 400, 15, 1522, 10),
    ("feliz", 428, 555, 15, 1522, 10),
    ("triste", 680, 802, 15, 1522, 10),
    ("triste", 832, 966, 15, 1522, 10),
])
S("nix", "prime", "Nix/Nix/NixPrime_SleepTrain.png", "light", [
    ("dormir", 260, 370, 15, 1522, 12),
    ("dormir", 398, 510, 15, 1522, 12),
    ("entrenar", 624, 737, 15, 1522, 8),
    ("entrenar", 758, 868, 15, 1522, 8),
    ("entrenar", 887, 987, 15, 1522, 10),
])
S("nix", "prime", "Nix/Nix/NixPrime_Walktrhough.png", "light", [
    ("caminar_derecha", 225, 370, 190, 1520, 8),
    ("caminar_izquierda", 405, 552, 190, 1520, 8),
    ("caminar_atras", 588, 750, 190, 1520, 8),
    ("caminar_frente", 785, 950, 190, 1520, 8),
])
S("nix", "upf", "Nix/Nix/NIX_UPF_ALL.png", "light", [
    ("caminar_derecha", 218, 300, 183, 1520, 8),
    ("caminar_izquierda", 320, 402, 183, 1520, 8),
    ("caminar_atras", 422, 518, 183, 1520, 8),
    ("caminar_frente", 535, 627, 183, 1520, 8),
    ("dormir", 648, 712, 183, 1520, 8, {"dark_t": 45, "pocket_t": 34}),  # fondo índigo oscuro
    ("entrenar", 728, 808, 194, 1520, 8),
    ("feliz", 823, 905, 194, 1520, 8),
    ("triste", 922, 997, 194, 1520, 8),
])

# ============================ BROOT ========================================
S("broot", "huevo", "Broot/Broot/Egg_All.png", "alpha", [
    ("idle", 30, 250, 180, 1400, 4),
    ("idle", 275, 495, 180, 1400, 4),
    ("eclosion", 515, 725, 180, 1400, 4),
    ("eclosion", 745, 985, 180, 1400, 4),
])
S("broot", "jr", "Broot/Broot/Broot_JrStates.png", "light", [
    ("dormir", 190, 268, 216, 1520, 9),
    ("dormir", 285, 362, 216, 1520, 9),
    ("entrenar", 395, 478, 216, 1520, 13),
    ("entrenar", 500, 580, 216, 1520, 13),
    ("feliz", 612, 690, 216, 1520, 10),
    ("feliz", 705, 783, 216, 1520, 10),
    ("triste", 812, 893, 216, 1520, 10),
    ("triste", 909, 990, 216, 1520, 10),
])
S("broot", "jr", "Broot/Broot/Broot_JrWalk.png", "light", light={"pocket_neutral": True}, rows=[
    ("caminar_derecha", 190, 345, 225, 1520, 8),
    ("caminar_izquierda", 392, 550, 225, 1520, 8),
    ("caminar_frente", 598, 752, 225, 1520, 8),
    ("caminar_atras", 800, 960, 225, 1520, 8),
])
S("broot", "pro", "Broot/Broot/Broot_ProStates.png", "alpha+light", [
    ("dormir", 175, 262, 176, 1520, 10),
    ("dormir", 285, 368, 176, 1520, 10),
    ("entrenar", 400, 485, 176, 1520, 12),
    ("entrenar", 510, 596, 176, 1520, 12),
    ("feliz", 625, 712, 176, 1520, 10),
    ("feliz", 735, 822, 176, 1520, 10),
    ("triste", 850, 918, 176, 1520, 10),
    ("triste", 935, 997, 176, 1520, 10),
])
S("broot", "pro", "Broot/Broot/Broot_ProWalk.png", "alpha", [
    ("caminar_derecha", 185, 322, 192, 1525, 8),
    ("caminar_izquierda", 390, 530, 192, 1525, 8),
    ("caminar_frente", 585, 752, 192, 1525, 8),
    ("caminar_atras", 800, 970, 192, 1525, 8),
])
S("broot", "prime", "Broot/Broot/Broot_PrimeStates.png", "light", light={"pocket_neutral": True}, rows=[
    ("dormir", 160, 240, 168, 1525, 9),
    ("dormir", 262, 342, 168, 1525, 9),
    ("entrenar", 375, 470, 168, 1525, 13),
    ("entrenar", 495, 585, 168, 1525, 12),
    ("feliz", 615, 710, 168, 1525, 10),
    ("feliz", 735, 825, 168, 1525, 10),
    ("triste", 850, 920, 168, 1525, 10),
    ("triste", 935, 1003, 168, 1525, 10),
])
S("broot", "prime", "Broot/Broot/Broot_PrimeWalk.png", "light", light={"pocket_neutral": True}, rows=[
    ("caminar_derecha", 140, 295, 152, 1530, 8),
    ("caminar_izquierda", 345, 505, 152, 1530, 8),
    ("caminar_frente", 548, 730, 152, 1530, 8),
    ("caminar_atras", 772, 962, 152, 1530, 8),
])
S("broot", "upf", "Broot/Broot/BRoot_UPFStates.png", "light", light={"pocket_neutral": True}, rows=[
    ("dormir", 105, 208, 165, 1530, 10),
    ("dormir", 225, 322, 165, 1530, 10),
    ("entrenar", 350, 455, 165, 1530, 12),
    ("entrenar", 470, 574, 165, 1530, 12),
    ("feliz", 595, 695, 165, 1530, 10),
    ("feliz", 712, 812, 165, 1530, 10),
    ("triste", 840, 912, 165, 1530, 10),
    ("triste", 928, 1003, 165, 1530, 10),
])
S("broot", "upf", "Broot/Broot/Broot_UPFWalk.png", "light", light={"pocket_neutral": True}, rows=[
    ("caminar_derecha", 115, 292, 150, 1530, 8),
    ("caminar_izquierda", 335, 505, 150, 1530, 8),
    ("caminar_frente", 540, 730, 150, 1530, 8),
    ("caminar_atras", 765, 968, 150, 1530, 8),
])


# ---------------------------------------------------------------------------
# Matting
# ---------------------------------------------------------------------------
def luma(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def border_connected(mask):
    """Componentes de `mask` que tocan el borde del recorte."""
    lab, n = ndi.label(mask)
    if n == 0:
        return np.zeros_like(mask)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    edge = edge[edge > 0]
    return np.isin(lab, edge)


def normconv(rgb, w, sigma):
    """Estimación suave del fondo: media ponderada gaussiana de los píxeles w."""
    wf = w.astype(np.float32)
    den = ndi.gaussian_filter(wf, sigma) + 1e-6
    out = np.empty_like(rgb)
    for c in range(3):
        out[..., c] = ndi.gaussian_filter(rgb[..., c] * wf, sigma) / den
    return out, den


def matte_light(rgb, dark_t=95, dist_t=42, sigma=10, strong_t=70, min_area=25, shadow_sat=0.32, pocket_t=0, pocket_neutral=False):
    L = luma(rgb)
    dark = L < dark_t
    barrier = ndi.binary_dilation(dark, iterations=1)
    bg0 = border_connected(~barrier)
    field, den = normconv(rgb, bg0, sigma)
    # donde no hay fondo cerca (interior de personajes) la estimación no vale;
    # usamos la global para no inventar
    dist = np.sqrt(((rgb - field) ** 2).sum(-1))
    passable = ~barrier & (dist < dist_t)
    bg1 = border_connected(passable)
    fg = ~bg1
    # anillo de la dilatación de la barrera: si es claro y parecido al fondo, fuera
    ring = fg & ~dark & ndi.binary_dilation(bg1, iterations=2) & (dist < dist_t)
    fg &= ~ring
    if pocket_t:
        # bolsas de fondo encerradas (p.ej. dentro de remolinos de agua) sobre
        # fondos oscuros de color muy característico: fuera por color global
        bgc = np.median(rgb[bg1], axis=0)
        pocket = np.sqrt(((rgb - bgc) ** 2).sum(-1)) < pocket_t
        fg &= ~ndi.binary_opening(pocket, iterations=1)
    if pocket_neutral:
        # fondo de cuadros de ajedrez pintado: gris/blanco neutro encerrado
        # entre patas u hojas. El personaje nunca es gris claro puro.
        mxc, mnc = rgb.max(-1), rgb.min(-1)
        neut = ((mxc - mnc) < 14) & (L > 185)
        fg &= ~ndi.binary_opening(neut, iterations=1)
    # limpiar componentes pequeños o débiles (bordes de celda, sombras tenues)
    lab, n = ndi.label(fg)
    if n:
        idx = np.arange(1, n + 1)
        area = ndi.sum(np.ones_like(L), lab, idx)
        mx = ndi.maximum(dist, lab, idx)
        hasdark = ndi.maximum(dark.astype(np.float32), lab, idx)
        keep = (area >= min_area) & ((mx >= strong_t) | (hasdark > 0))
        # sombras proyectadas: manchas planas, poco saturadas y sin contorno
        mxc, mnc = rgb.max(-1), rgb.min(-1)
        sat = (mxc - mnc) / np.maximum(mxc, 1)
        msat = ndi.mean(sat, lab, idx)
        sl = ndi.find_objects(lab)
        for j, ob in enumerate(sl):
            if keep[j] and hasdark[j] == 0 and ob is not None:
                hh = ob[0].stop - ob[0].start
                ww = ob[1].stop - ob[1].start
                if msat[j] < shadow_sat and hh < 0.45 * ww:
                    keep[j] = False
        fg = np.isin(lab, idx[keep])
    return fg, dist


def matte_alpha(rgba, t=128):
    return rgba[..., 3] >= t


# ---------------------------------------------------------------------------
# Segmentación de una banda en n frames
# ---------------------------------------------------------------------------
def find_cuts(fg, n):
    h, w = fg.shape
    prof = fg.sum(0).astype(np.float32)
    prof = ndi.uniform_filter1d(prof, 3)
    cw = w / n
    cuts = [0]
    for k in range(1, n):
        e = int(round(k * cw))
        lo = max(cuts[-1] + int(cw * 0.4), int(e - cw * 0.35))
        hi = min(w - 1, int(e + cw * 0.35))
        seg = prof[lo:hi]
        m = seg.min()
        cand = np.where(seg <= m + 0.5)[0] + lo
        # entre los mínimos, el más cercano al centro del hueco de mínimos
        # (si hay una zona vacía ancha, cortamos en su mitad)
        runs = np.split(cand, np.where(np.diff(cand) > 1)[0] + 1)
        best = min(runs, key=lambda r: abs((r[0] + r[-1]) / 2 - e) - 0.3 * len(r))
        cuts.append(int((best[0] + best[-1]) // 2))
    cuts.append(w)
    return cuts


# ---------------------------------------------------------------------------
def drop_edge_slivers(fg, max_h=12, max_area=900):
    """Quita restos de números/insignias de la fila vecina: componentes pequeños
    y planos que tocan el borde superior o inferior de la banda."""
    lab, n = ndi.label(fg)
    for j, ob in enumerate(ndi.find_objects(lab)):
        if ob is None:
            continue
        touches = ob[0].start == 0 or ob[0].stop == fg.shape[0]
        h = ob[0].stop - ob[0].start
        if touches and h <= max_h and (lab[ob] == j + 1).sum() <= max_area:
            fg[lab == j + 1] = False
    return fg


def assign_components(fg, cuts):
    """Reparte los componentes del primer plano entre los n frames.

    Los cortes por columna dan la partición inicial. Luego:
    - componentes grandes (cuerpos) -> frame que contiene la mayoría de sus píxeles
    - componentes pequeños (destellos, gotas, zzz) -> frame cuyo cuerpo principal
      está más cerca en horizontal (un destello pegado al borde de la celda no
      debe acabar en el frame vecino).
    """
    n = len(cuts) - 1
    lab, nc = ndi.label(fg)
    if nc == 0:
        return [np.zeros_like(fg) for _ in range(n)]
    idx = np.arange(1, nc + 1)
    area = ndi.sum(np.ones(fg.shape), lab, idx)
    objs = ndi.find_objects(lab)
    colframe = np.zeros(fg.shape[1], int)
    for i in range(n):
        colframe[cuts[i]:cuts[i + 1]] = i
    owner = np.zeros(nc + 1, int)
    # cuerpo: el componente mayor de cada frame (por píxeles dentro del frame)
    body_box = []
    for i in range(n):
        sub = lab[:, cuts[i]:cuts[i + 1]]
        cnt = np.bincount(sub.ravel(), minlength=nc + 1)
        cnt[0] = 0
        b = int(cnt.argmax())
        if cnt[b] == 0:
            body_box.append((cuts[i], cuts[i + 1]))
        else:
            ob = objs[b - 1]
            body_box.append((ob[1].start, ob[1].stop))
    big = np.median([body_box[i][1] - body_box[i][0] for i in range(n)])
    big_area = np.median(np.sort(area)[-n:]) if nc >= n else area.max()
    for j in range(nc):
        ob = objs[j]
        cols = np.nonzero((lab[ob] == j + 1).any(0))[0] + ob[1].start
        if cols[-1] - cols[0] > 1.35 * (fg.shape[1] / n):
            owner[j + 1] = -1  # personajes que se tocan: se reparten por columnas
        elif area[j] >= 0.15 * big_area:
            owner[j + 1] = np.bincount(colframe[cols], minlength=n).argmax()
        else:
            a0, a1 = cols[0], cols[-1] + 1
            d = [max(0, b0 - a1, a0 - b1) for (b0, b1) in body_box]
            owner[j + 1] = int(np.argmin(d))
    own = owner[lab]
    split = own == -1
    own[split] = np.broadcast_to(colframe, fg.shape)[split]
    return [(own == i) & fg for i in range(n)]


def load_sheet(path):
    im = Image.open(path)
    arr = np.asarray(im.convert("RGBA")).astype(np.float32)
    return arr, im.mode


def extract_sheet(sheet, src, debug=None):
    """Devuelve dict anim -> lista de frames RGBA (float, recortados al contenido)."""
    arr, _ = load_sheet(os.path.join(src, sheet["file"]))
    anims = {}
    dbg_rows = []
    for r in sheet["rows"]:
        aid, y0, y1, x0, x1, n = r[:6]
        ropt = dict(sheet.get("light", {}), **(r[6] if len(r) > 6 else {}))
        band = arr[y0:y1, x0:x1]
        rgb = band[..., :3]
        if sheet["method"] == "light":
            fg, _ = matte_light(rgb, **ropt)
        elif sheet["method"] == "alpha":
            fg = matte_alpha(band, sheet.get("alpha_t", 128))
            fg = ndi.binary_opening(fg, iterations=1)
        elif sheet["method"] == "alpha+light":
            a = band[..., 3] >= sheet.get("alpha_t", 200)
            fl, _ = matte_light(rgb, **ropt)
            fg = a & fl
        else:
            raise ValueError(sheet["method"])
        fg = drop_edge_slivers(fg)
        cuts = find_cuts(fg, n)
        masks = assign_components(fg, cuts)
        row = []
        for i in range(n):
            m = masks[i]
            if not m.any():
                print(f"  ! {sheet['file']} {aid} frame vacío", file=sys.stderr)
                continue
            cols = np.nonzero(m.any(0))[0]
            c0, c1 = cols[0], cols[-1] + 1
            rgba = band[:, c0:c1].copy()
            rgba[..., 3] = m[:, c0:c1] * 255.0
            row.append(rgba)
        # línea de suelo de la fila = mediana de la base del cuerpo principal
        base = float(np.median([frame_metrics(f)["bottom"] for f in row]))
        anims.setdefault(aid, []).extend((f, base) for f in row)
        dbg_rows.append((y0, y1, x0, x1, cuts, fg))
    if debug:
        save_debug_overlay(arr, dbg_rows, os.path.join(debug, "ov_" + os.path.basename(sheet["file"])))
    return anims


def save_debug_overlay(arr, rows, path):
    img = arr[..., :3].copy() * 0.35 + 0.65 * 255
    for (y0, y1, x0, x1, cuts, fg) in rows:
        sub = img[y0:y1, x0:x1]
        src = arr[y0:y1, x0:x1, :3]
        sub[fg] = src[fg]
        sub[~fg] = sub[~fg] * 0.5 + np.array([255, 0, 255]) * 0.5 * 0.4 + 60
        img[y0, x0:x1] = [255, 0, 0]
        img[y1 - 1, x0:x1] = [255, 0, 0]
        for c in cuts:
            img[y0:y1, min(x0 + c, arr.shape[1] - 1)] = [0, 160, 0]
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(path)


# ---------------------------------------------------------------------------
# Normalización y empaquetado
# ---------------------------------------------------------------------------
def main_component(alpha):
    lab, n = ndi.label(alpha > 0)
    if n == 0:
        return alpha > 0
    sizes = ndi.sum(np.ones_like(alpha), lab, np.arange(1, n + 1))
    return lab == (np.argmax(sizes) + 1)


def frame_metrics(rgba):
    body = main_component(rgba[..., 3])
    ys, xs = np.nonzero(body)
    return dict(size=float(np.sqrt(body.sum())), cx=float(xs.mean()), bottom=float(ys.max() + 1))


PCT = 98  # los efectos más lejanos (raros) pueden tocar el borde; el cuerpo nunca


def normalize_stage(groups):
    """groups: lista de (sheet_id, {anim: [(frame, base_y)]}).

    Devuelve {anim: [128x128 RGBA uint8]} con escala y suelo comunes a toda la etapa.
    - Escala por hoja: iguala la mediana del tamaño del cuerpo (sqrt del área del
      componente principal) entre hojas de la misma etapa.
    - Ancla vertical: la línea de suelo de la FILA (mediana de las bases del
      cuerpo en esa fila), así los saltos conservan su movimiento vertical.
    - Ancla horizontal: centroide del cuerpo principal de cada frame.
    """
    sizes = {}
    for gid, anims in groups:
        s = [frame_metrics(f)["size"] for fr in anims.values() for f, _b in fr]
        sizes[gid] = float(np.median(s))
    ref = max(sizes.values())
    rel = {g: ref / s for g, s in sizes.items()}
    E, EB = [], []
    items = []
    for gid, anims in groups:
        k = rel[gid]
        for aid, frames in anims.items():
            for f, base in frames:
                m = frame_metrics(f)
                ys, xs = np.nonzero(f[..., 3] > 0)
                E.append(((m["cx"] - xs.min()) * k, (xs.max() + 1 - m["cx"]) * k,
                          (base - ys.min()) * k, max(0.0, ys.max() + 1 - base) * k))
                body = main_component(f[..., 3])
                by, bx = np.nonzero(body)
                EB.append(((m["cx"] - bx.min()) * k, (bx.max() + 1 - m["cx"]) * k,
                           (base - by.min()) * k, max(0.0, by.max() + 1 - base) * k))
                items.append((gid, aid, f, m, base, k))
    # efectos (salpicaduras, zzz) por percentil 98; el cuerpo por percentil 99
    # (solo 1-2 poses extremas, p.ej. un remolino de agua pegado al cuerpo, pueden tocar el borde)
    L, R, U, D = np.maximum(np.percentile(np.array(E), PCT, axis=0), np.percentile(np.array(EB), 99, axis=0))
    half = max(L, R)
    avail = CELL - 2 * MARGIN
    scale = min(avail / (2 * half), avail / (U + D))
    base_y = CELL - MARGIN - D * scale
    out = {}
    for gid, aid, f, m, base, k in items:
        s = scale * k
        h, w = f.shape[:2]
        nw, nh = max(1, int(round(w * s))), max(1, int(round(h * s)))
        # reescalado premultiplicado (por canal, en float) para no crear halos
        pm = f.copy()
        pm[..., :3] *= pm[..., 3:4] / 255.0
        chans = [Image.fromarray(np.ascontiguousarray(pm[..., c]), "F").resize((nw, nh), Image.LANCZOS)
                 for c in range(4)]
        sm = np.clip(np.stack([np.asarray(c) for c in chans], -1), 0, 255)
        canvas = np.zeros((CELL, CELL, 4), np.float32)
        ox = int(round(CELL / 2 - m["cx"] * s))
        oy = int(round(base_y - base * s))
        x0, y0 = max(0, ox), max(0, oy)
        x1, y1 = min(CELL, ox + nw), min(CELL, oy + nh)
        if x1 > x0 and y1 > y0:
            canvas[y0:y1, x0:x1] = sm[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        a = canvas[..., 3]
        rgb = np.where(a[..., None] > 0, canvas[..., :3] * 255.0 / np.maximum(a[..., None], 1e-3), 0)
        a = np.where(a < 10, 0, a)
        o = np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)
        out.setdefault(aid, []).append(o)
    return out, scale


FPS = {
    "idle": 6, "eclosion": 8, "feliz": 8, "alegria": 10, "celebracion": 10,
    "triste": 6, "llorar": 8, "cansado": 6, "dormir": 5, "entrenar": 10,
    "caminar_derecha": 10, "caminar_izquierda": 10, "caminar_frente": 10, "caminar_atras": 10,
}
ONE_SHOT = {"eclosion", "celebracion"}
PORTRAIT_PREF = ["feliz", "idle", "caminar_frente"]
STAGES = ["huevo", "jr", "pro", "prime", "upf"]
NAMES = {"broot": "Broot", "nix": "Nix"}


def write_strip(frames, path):
    strip = np.concatenate(frames, axis=1)
    im = Image.fromarray(strip, "RGBA")
    im.save(path, "WEBP", quality=WEBP_QUALITY, method=6, exact=False)
    return os.path.getsize(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "..", "public", "mascotas"))
    ap.add_argument("--debug")
    ap.add_argument("--only", help="pet o pet/stage")
    ap.add_argument("--no-write", action="store_true")
    args = ap.parse_args()
    if args.debug:
        os.makedirs(args.debug, exist_ok=True)

    manifest_path = os.path.join(args.out, "manifest.json")
    manifest = {"cell": CELL, "pets": {}, "notes": NOTES}
    if os.path.exists(manifest_path):
        try:
            old = json.load(open(manifest_path))
            manifest["pets"] = old.get("pets", {})
        except Exception:
            pass

    stages = {}
    for sh in SHEETS:
        key = (sh["pet"], sh["stage"])
        if args.only and not (f"{sh['pet']}/{sh['stage']}".startswith(args.only)):
            continue
        stages.setdefault(key, []).append(sh)

    for (pet, stage), sheets in stages.items():
        print(f"== {pet}/{stage}")
        groups = []
        srcmap = {}
        for i, sh in enumerate(sheets):
            anims = extract_sheet(sh, args.src, args.debug)
            for a, fr in anims.items():
                print(f"   {os.path.basename(sh['file'])}: {a} {len(fr)}")
                srcmap[a] = os.path.basename(sh["file"])
            groups.append((i, anims))
        norm, scale = normalize_stage(groups)
        odir = os.path.join(args.out, pet, stage)
        os.makedirs(odir, exist_ok=True)
        st = {"anims": {}}
        order = [a for sh in sheets for (a, *_r) in sh["rows"]]
        order = list(dict.fromkeys(order))
        for a in order:
            frames = norm[a]
            rel = f"{pet}/{stage}/{a}.webp"
            if not args.no_write:
                write_strip(frames, os.path.join(args.out, rel))
            st["anims"][a] = {"src": rel, "frames": len(frames), "fps": FPS.get(a, 8),
                              "loop": a not in ONE_SHOT, "sourceSheet": srcmap[a]}
        pa = next(a for a in PORTRAIT_PREF + order if a in norm)
        prel = f"{pet}/{stage}/retrato.webp"
        if not args.no_write:
            Image.fromarray(norm[pa][0], "RGBA").save(os.path.join(args.out, prel), "WEBP",
                                                      quality=WEBP_QUALITY, method=6)
        st["portrait"] = prel
        st = {"portrait": st["portrait"], "anims": st["anims"]}
        manifest["pets"].setdefault(pet, {"name": NAMES[pet], "stages": {}})
        manifest["pets"][pet]["stages"][stage] = st
        if args.debug:
            for a in order:
                np.save(os.path.join(args.debug, f"{pet}_{stage}_{a}.npy"), np.stack(norm[a]))

    # ordenar etapas
    for pet in manifest["pets"].values():
        pet["stages"] = {s: pet["stages"][s] for s in STAGES if s in pet["stages"]}
    manifest["pets"] = {p: manifest["pets"][p] for p in ["broot", "nix"] if p in manifest["pets"]}
    if not args.no_write:
        with open(manifest_path, "w") as fh:
            json.dump(manifest, fh, indent=2, ensure_ascii=False)


NOTES = [
    "Las hojas dicen 'INFO SPRITE 64x64 transparente': es falso, son imágenes aplanadas de 1536x1024; se recortó y quitó el fondo por software (scripts/sprites/slice.py).",
    "El número de frames real no siempre coincide con el rótulo de la hoja; se usa lo que hay dibujado, en orden de izquierda a derecha y de arriba abajo (los numeritos impresos están repetidos/mal en varias hojas y se ignoran).",
    "broot/jr: dormir tiene 18 frames (rótulo 20) y entrenar 26 (rótulo 24).",
    "broot/prime: dormir tiene 18 frames (rótulo 20) y entrenar 25 (rótulo 24).",
    "nix/prime: entrenar tiene 26 frames (8+8+10; rótulo 24).",
    "nix/huevo: solo hay animación idle (8 frames); no existe hoja de eclosión para Nix.",
    "nix/jr: los paseos (caminar_*) salen de NixEgg_NixJr.png y tienen 6 frames; nix/pro también 6; prime y upf 8.",
    "nix/jr tiene además alegria, celebracion, llorar y cansado; el resto de etapas solo feliz/triste/dormir/entrenar + caminar_*.",
    "broot no tiene celebracion/llorar/cansado en ninguna etapa; broot/huevo tiene idle (filas 1-2 de Egg_All) y eclosion (filas 3-4, one-shot).",
    "Etapa upf = forma final ('Ultra Prime Final' en Nix, 'UPF' en Broot). Nix UPF solo tiene 8 frames por animación.",
    "Escala: cada etapa comparte lienzo/escala/suelo; entre etapas NO se conserva la escala relativa (cada etapa llena su lienzo de 128).",
    "El suelo se ancla por fila (mediana), así los saltos conservan su movimiento vertical. El centro horizontal es el centroide del cuerpo en cada frame.",
    "Algunos efectos muy grandes (remolinos de agua de nix/prime entrenar) pueden tocar el borde del lienzo en 1-2 frames.",
]

if __name__ == "__main__":
    main()
