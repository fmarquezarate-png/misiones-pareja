"""Posproceso del manifest de mascotas: escala, caja del cuerpo y hash.

Se ejecuta SOLO al final de slice.py (o a mano). Antes slice.py reconstruía cada
etapa sin `escala` ni `cuerpo`, y regenerar los sprites los perdía en silencio.

1) ESCALA por etapa (auditoría 28/09): cada etapa se recortó llenando su lienzo de
   128 px INCLUIDOS sus efectos (agua, hojas, brillos); las formas evolucionadas
   traen más efectos, así que su cuerpo salía MÁS PEQUEÑO (Nix UPF 54 px de alto
   frente a 73 de Jr). Se mide el cuerpo (píxeles casi opacos, alfa > 200: los
   efectos suelen ser semitransparentes) como sqrt(ancho × alto) y se calcula la
   escala para que crezca de etapa en etapa según OBJETIVO.
2) CAJA DEL CUERPO por etapa (`cuerpo`): mediana de los bordes en los sprites de
   caminar. Ajusta la línea de flotación de Nix a CADA etapa.
3) HASH de contenido por archivo (`v`, y `portraitV` para el retrato): el service
   worker sirve los sprites con CacheFirst; sin versión en la URL, un sprite
   regenerado no llegaba jamás a una PWA ya instalada.

Uso:  python3 scripts/sprites/escala.py [--raiz public/mascotas]
"""
import argparse, hashlib, json, math
from pathlib import Path
from PIL import Image

RAIZ_DEFECTO = Path(__file__).resolve().parents[2] / "public" / "mascotas"
# Tamaño del cuerpo relativo a Jr. Crece siempre, con un techo razonable para que
# la forma final quepa en el hábitat del móvil.
OBJETIVO = {"huevo": 0.9, "jr": 1.0, "pro": 1.15, "prime": 1.3, "upf": 1.45}
CELDA = 128

def _cajas(raiz, anim):
    im = Image.open(raiz / anim["src"]).convert("RGBA")
    for i in range(anim["frames"]):
        a = im.crop((i * CELDA, 0, (i + 1) * CELDA, CELDA)).getchannel("A").point(lambda v: 255 if v > 200 else 0)
        bb = a.getbbox()
        if bb:
            yield bb

def cuerpo_px(raiz, anim):
    medidas = [math.sqrt((bb[2] - bb[0]) * (bb[3] - bb[1])) for bb in _cajas(raiz, anim)]
    return sum(medidas) / len(medidas)

def caja_cuerpo(raiz, anims):
    ids = [a for a in ("caminar_derecha", "caminar_izquierda") if a in anims] or [a for a in ("feliz", "idle") if a in anims]
    bordes = [bb for aid in ids for bb in _cajas(raiz, anims[aid])]
    med = lambda k: sorted(b[k] for b in bordes)[len(bordes) // 2] / CELDA
    return {"x0": round(med(0), 3), "y0": round(med(1), 3), "x1": round(med(2), 3), "y1": round(med(3), 3)}

def hash_archivo(ruta):
    return hashlib.md5(Path(ruta).read_bytes()).hexdigest()[:8]

def postprocesar(raiz=RAIZ_DEFECTO, verbose=True):
    raiz = Path(raiz)
    m = json.loads((raiz / "manifest.json").read_text())
    for pet, pd in m["pets"].items():
        tam = {}
        for st, sd in pd["stages"].items():
            an = sd["anims"].get("feliz") or sd["anims"].get("idle")
            tam[st] = cuerpo_px(raiz, an)
        for st, sd in pd["stages"].items():
            sd["cuerpoPx"] = round(tam[st], 1)      # cuerpo medido en el lienzo de 128 px
            sd["escala"] = round(OBJETIVO[st] * tam["jr"] / tam[st], 3)
            sd["cuerpo"] = caja_cuerpo(raiz, sd["anims"])
            for a in sd["anims"].values():
                a["v"] = hash_archivo(raiz / a["src"])
            sd["portraitV"] = hash_archivo(raiz / sd["portrait"])
            if verbose:
                c = sd["cuerpo"]
                print(f"{pet}/{st:6s} cuerpo {tam[st]:5.1f}px → escala {sd['escala']}  · caja x {c['x0']}–{c['x1']} y {c['y0']}–{c['y1']}")
    (raiz / "manifest.json").write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n")
    return m

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--raiz", default=str(RAIZ_DEFECTO))
    postprocesar(ap.parse_args().raiz)
