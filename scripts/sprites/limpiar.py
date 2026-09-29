"""Limpieza de artefactos del recorte: líneas finas y largas sueltas.

POR QUÉ (auditoría v6, 29/09/2026): al recortar las hojas, los bordes de las
celdas se colaban en algunos fotogramas como líneas verticales finas de hasta
83 px. Medido: 21 de 116 fotogramas de Broot Jr (los cuatro ciclos de caminar) y
1 de Broot UPF. Se ven a un lado de la mascota mientras pasea.

Qué hace: en cada fotograma busca componentes conexos de alfa > 40 que NO sean
el cuerpo principal, sean finos y largos (relación >= 8:1, >= 24 px) y estén
lejos del cuerpo (>= 3 px), y los borra junto con su halo (2 px). Los efectos
del propio dibujo (chispas, agua, hojas) son compactos o están pegados al
cuerpo, así que no se tocan. Idempotente: si no hay líneas, no reescribe nada.

Uso:  python3 scripts/sprites/limpiar.py [--raiz public/mascotas] [--solo-medir]
"""
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

CELDA = 128
MIN_LARGO = 24
# En los ciclos de CAMINAR (sin efectos sueltos en el dibujo) también sobran los
# restos más cortos: rayas de 1–2 px de ancho y >= 10 de alto (los bordes de
# celda que quedaban tras la 1.ª pasada, vistos junto a Broot Jr al pasear).
MIN_LARGO_CAMINAR, MAX_ANCHO_CAMINAR = 10, 2
MIN_RELACION = 8
DISTANCIA_MIN = 3
# Restos del fondo blanco de las hojas originales: píxeles casi blancos y sin color
# CONECTADOS AL EXTERIOR (rodeando a la mascota, como manchas y rayitas bajo los
# pies). Medido en Nix UPF: 5–8 % de los píxeles de cada fotograma; sobre el
# agua azul se veían como una mancha blanca opaca alrededor. Lo blanco ENCERRADO
# por el cuerpo (vientre, ojos) no está conectado al exterior y no se toca.
BLANCO_MIN, BLANCO_SAT_MAX, MIN_PX_BLANCO = 228, 26, 15
SATURACION_MAX = 45     # las líneas de basura son grises/blancas; los efectos del dibujo (lágrimas azules…) son de color
QUALITY, ALPHA_QUALITY = 84, 90      # algo por encima del de slice.py: es una 2.ª codificación

def _lineas_del_fotograma(trozo, caminar=False):
    """Devuelve la máscara (bool) de los píxeles a borrar en un fotograma RGBA."""
    alfa = trozo[:, :, 3]
    fuerte = alfa > 40
    lab, n = ndimage.label(fuerte)
    if n < 2:
        return None
    tam = ndimage.sum(fuerte, lab, range(1, n + 1))
    principal = 1 + int(np.argmax(tam))
    cuerpo = lab == principal
    # Distancia de cada píxel al cuerpo principal
    dist = ndimage.distance_transform_edt(~cuerpo)
    borrar = np.zeros_like(fuerte)
    for k in range(1, n + 1):
        if k == principal:
            continue
        comp = lab == k
        ys, xs = np.where(comp)
        h, w = int(np.ptp(ys)) + 1, int(np.ptp(xs)) + 1
        largo, ancho = max(h, w), max(1, min(h, w))
        rgb = trozo[:, :, :3][comp].astype(int)
        saturacion = float((rgb.max(axis=1) - rgb.min(axis=1)).mean())
        larga = largo >= MIN_LARGO and largo / ancho >= MIN_RELACION
        raya = caminar and largo >= MIN_LARGO_CAMINAR and ancho <= MAX_ANCHO_CAMINAR
        if (larga or raya) and dist[comp].min() >= DISTANCIA_MIN and saturacion <= SATURACION_MAX:
            borrar |= ndimage.binary_dilation(comp, iterations=2)
    borrar &= ~ndimage.binary_dilation(cuerpo, iterations=1)   # nunca tocar el cuerpo
    return borrar if borrar.any() else None

def _blanco_del_fotograma(trozo):
    """Máscara de blanco exterior a quitar y de su borde (a medio alfa)."""
    alfa = trozo[:, :, 3]
    rgb = trozo[:, :, :3].astype(int)
    # Candidatos: casi opacos. Exterior: casi transparente. Los píxeles de borde a
    # medio alfa que deja esta misma limpieza no son ni una cosa ni otra, así que
    # una 2.ª pasada NO sigue «pelando» capas: es idempotente.
    blanco = (alfa >= 200) & (rgb.min(axis=2) >= BLANCO_MIN) & ((rgb.max(axis=2) - rgb.min(axis=2)) <= BLANCO_SAT_MAX)
    exterior = alfa <= 8
    lab, _ = ndimage.label(blanco | exterior)
    ids = np.unique(lab[exterior]); ids = ids[ids > 0]
    fuera = np.isin(lab, ids) & blanco
    if fuera.sum() < MIN_PX_BLANCO:   # ruido de recompresión, no restos de fondo
        return None, None
    borde = ndimage.binary_dilation(fuera, iterations=1) & ~fuera & (rgb.min(axis=2) > 200)
    return fuera, borde

def limpiar_tira(ruta, solo_medir=False):
    """Limpia una tira; devuelve cuántos fotogramas tenían líneas."""
    caminar = Path(ruta).name.startswith("caminar_")
    im = Image.open(ruta).convert("RGBA")
    arr = np.array(im)
    tocados = 0
    for i in range(arr.shape[1] // CELDA):
        trozo = arr[:, i * CELDA:(i + 1) * CELDA]
        borrar = _lineas_del_fotograma(trozo, caminar)
        tocado = borrar is not None
        if tocado and not solo_medir:
            trozo[borrar] = 0
        fuera, borde = _blanco_del_fotograma(trozo)
        if fuera is not None:
            tocado = True
            if not solo_medir:
                trozo[fuera, 3] = 0
                trozo[borde, 3] = (trozo[borde, 3] * 0.5).astype(np.uint8)
        if tocado:
            tocados += 1
    if tocados and not solo_medir:
        Image.fromarray(arr, "RGBA").save(ruta, "WEBP", quality=QUALITY, alpha_quality=ALPHA_QUALITY, method=6)
    return tocados

def limpiar_todo(raiz, solo_medir=False):
    raiz = Path(raiz)
    m = json.loads((raiz / "manifest.json").read_text())
    total = archivos = 0
    for pet, pd in m["pets"].items():
        for st, sd in pd["stages"].items():
            rutas = [a["src"] for a in sd["anims"].values()] + [sd["portrait"]]
            for rel in rutas:
                n = limpiar_tira(raiz / rel, solo_medir)
                if n:
                    archivos += 1; total += n
                    print(f"  {rel}: {n} fotograma(s) con resto de fondo" + ("" if solo_medir else " → limpiados"))
    print(f"limpieza: {total} fotogramas en {archivos} archivos" + (" (solo medido)" if solo_medir else ""))
    return total

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--raiz", default=str(Path(__file__).resolve().parents[2] / "public" / "mascotas"))
    ap.add_argument("--solo-medir", action="store_true")
    a = ap.parse_args()
    limpiar_todo(a.raiz, a.solo_medir)
