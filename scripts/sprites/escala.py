"""Escala de pantalla por etapa, a partir del tamaño REAL del cuerpo.

POR QUÉ (28/09/2026): cada etapa se recortó llenando su lienzo de 128 px
INCLUIDOS sus efectos (agua, hojas, brillos). Las formas evolucionadas traen
más efectos, así que su cuerpo quedaba MÁS PEQUEÑO que el de las anteriores:
medido, Nix UPF 54 px de alto frente a los 73 de Nix Jr. Evolucionar parecía
encoger.

Qué hace: mide el cuerpo (píxeles casi opacos, alfa > 200: los efectos
suelen ser semitransparentes) en el idle/feliz de cada etapa, lo resume como
sqrt(ancho × alto) — el alto solo engaña con las formas alargadas — y
calcula la escala para que el cuerpo crezca de etapa en etapa según OBJETIVO.
Escribe `escala` en cada etapa de manifest.json.

Uso:  python3 scripts/sprites/escala.py
"""
import json, math
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2] / "public" / "mascotas"
# Tamaño del cuerpo relativo a Jr. Crece siempre, y con un techo razonable
# para que la forma final quepa en el hábitat del móvil.
OBJETIVO = {"huevo": 0.9, "jr": 1.0, "pro": 1.15, "prime": 1.3, "upf": 1.45}

def cuerpo(anim):
    im = Image.open(RAIZ / anim["src"]).convert("RGBA")
    medidas = []
    for i in range(anim["frames"]):
        a = im.crop((i * 128, 0, (i + 1) * 128, 128)).getchannel("A").point(lambda v: 255 if v > 200 else 0)
        bb = a.getbbox()
        if bb:
            medidas.append(math.sqrt((bb[2] - bb[0]) * (bb[3] - bb[1])))
    return sum(medidas) / len(medidas)

m = json.loads((RAIZ / "manifest.json").read_text())
for pet, pd in m["pets"].items():
    tam = {}
    for st, sd in pd["stages"].items():
        an = sd["anims"].get("feliz") or sd["anims"].get("idle")
        tam[st] = cuerpo(an)
    for st, sd in pd["stages"].items():
        sd["escala"] = round(OBJETIVO[st] * tam["jr"] / tam[st], 3)
        print(f"{pet}/{st:6s} cuerpo {tam[st]:5.1f}px → escala {sd['escala']}  (se verá a {tam[st] * sd['escala']:.0f}px)")
(RAIZ / "manifest.json").write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n")
