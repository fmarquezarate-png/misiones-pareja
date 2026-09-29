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
MIN_RELACION = 8
DISTANCIA_MIN = 3
SATURACION_MAX = 45     # las líneas de basura son grises/blancas; los efectos del dibujo (lágrimas azules…) son de color
QUALITY, ALPHA_QUALITY = 84, 90      # algo por encima del de slice.py: es una 2.ª codificación

def _lineas_del_fotograma(trozo):
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
        if largo >= MIN_LARGO and largo / ancho >= MIN_RELACION and dist[comp].min() >= DISTANCIA_MIN and saturacion <= SATURACION_MAX:
            borrar |= ndimage.binary_dilation(comp, iterations=2)
    borrar &= ~ndimage.binary_dilation(cuerpo, iterations=1)   # nunca tocar el cuerpo
    return borrar if borrar.any() else None

def limpiar_tira(ruta, solo_medir=False):
    """Limpia una tira; devuelve cuántos fotogramas tenían líneas."""
    im = Image.open(ruta).convert("RGBA")
    arr = np.array(im)
    tocados = 0
    for i in range(arr.shape[1] // CELDA):
        trozo = arr[:, i * CELDA:(i + 1) * CELDA]
        borrar = _lineas_del_fotograma(trozo)
        if borrar is not None:
            tocados += 1
            if not solo_medir:
                trozo[borrar] = 0
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
                    print(f"  {rel}: {n} fotograma(s) con línea suelta" + ("" if solo_medir else " → limpiados"))
    print(f"limpieza: {total} fotogramas en {archivos} archivos" + (" (solo medido)" if solo_medir else ""))
    return total

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--raiz", default=str(Path(__file__).resolve().parents[2] / "public" / "mascotas"))
    ap.add_argument("--solo-medir", action="store_true")
    a = ap.parse_args()
    limpiar_todo(a.raiz, a.solo_medir)
