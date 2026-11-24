"""Genera el QR del mapa Solpet con la huella al centro.

Uso (desde la carpeta del repositorio):
    pip install segno pillow
    python3 mapa-solpet/herramientas/generar-qr.py <URL> [nombre]

Crea en mapa-solpet/qr/:
    <nombre>.png          QR solo (1600 px, para imprimir o insertar en piezas)
    <nombre>.svg          QR vectorial (la huella va incrustada como imagen)
    <nombre>-tarjeta.png  QR con el logo de Solpet y una línea de texto, listo para compartir
Se usa corrección de errores alta (H): el QR se lee aunque la huella tape el centro.
"""
import base64
import io
import sys
from pathlib import Path

import segno
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
ASSETS = RAIZ / 'assets'
SALIDA = RAIZ / 'qr'
VERDE = (0, 122, 51)
BLANCO = (255, 255, 255)
HUELLA = 0.24      # ancho de la huella respecto al QR (sin el margen)


def matriz(url):
    qr = segno.make(url, error='h', boost_error=False)
    return [list(row) for row in qr.matrix], qr


def png(url, lado=1600, borde=4):
    m, _ = matriz(url)
    n = len(m)
    mod = lado // (n + borde * 2)
    tam = mod * (n + borde * 2)
    im = Image.new('RGB', (tam, tam), BLANCO)
    d = ImageDraw.Draw(im)
    for y, fila in enumerate(m):
        for x, v in enumerate(fila):
            if v:
                x0, y0 = (x + borde) * mod, (y + borde) * mod
                d.rectangle([x0, y0, x0 + mod - 1, y0 + mod - 1], fill=VERDE)
    # huella al centro sobre un círculo blanco
    h = round(n * mod * HUELLA)
    c = tam // 2
    aire = round(mod * 1.2)
    d.ellipse([c - h // 2 - aire, c - h // 2 - aire, c + h // 2 + aire, c + h // 2 + aire], fill=BLANCO)
    huella = Image.open(ASSETS / 'huella-solpet.png').convert('RGBA').resize((h, h), Image.LANCZOS)
    im.paste(huella, (c - h // 2, c - h // 2), huella)
    return im


def svg(url, borde=4):
    m, _ = matriz(url)
    n = len(m)
    tam = n + borde * 2
    rects = ''.join(
        f'M{x + borde} {y + borde}h1v1h-1z' for y, fila in enumerate(m) for x, v in enumerate(fila) if v
    )
    h = n * HUELLA
    c = tam / 2
    buf = io.BytesIO()
    Image.open(ASSETS / 'huella-solpet.png').resize((256, 256), Image.LANCZOS).save(buf, 'PNG', optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {tam} {tam}" shape-rendering="crispEdges">'
        f'<rect width="{tam}" height="{tam}" fill="#fff"/>'
        f'<path fill="#007A33" d="{rects}"/>'
        f'<circle cx="{c}" cy="{c}" r="{h / 2 + 1.2}" fill="#fff"/>'
        f'<image href="data:image/png;base64,{b64}" x="{c - h / 2}" y="{c - h / 2}" width="{h}" height="{h}"/>'
        '</svg>'
    )


def fuente(tam, negrita=False):
    for f in (['DejaVuSans-Bold.ttf', 'Arial Bold.ttf', 'arialbd.ttf'] if negrita else ['DejaVuSans.ttf', 'Arial.ttf', 'arial.ttf']):
        for base in ('/usr/share/fonts/truetype/dejavu/', '/Library/Fonts/', 'C:/Windows/Fonts/', ''):
            try:
                return ImageFont.truetype(base + f, tam)
            except OSError:
                pass
    return ImageFont.load_default()


def tarjeta(qr_img):
    W, H = 1200, 1480
    im = Image.new('RGB', (W, H), BLANCO)
    d = ImageDraw.Draw(im)
    d.rectangle([0, H - 150, W, H], fill=VERDE)
    logo = Image.open(ASSETS / 'solpet-logo.png').convert('RGBA')
    lw = 560
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    im.paste(logo, ((W - lw) // 2, 80), logo)
    q = qr_img.resize((960, 960), Image.LANCZOS)
    im.paste(q, ((W - 960) // 2, 290))
    t = 'Escanea y encuentra tu punto de venta'
    f = fuente(46, True)
    tw = d.textlength(t, font=f)
    d.text(((W - tw) / 2, H - 150 + 48), t, font=f, fill=BLANCO)
    return im


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    url = sys.argv[1]
    nombre = sys.argv[2] if len(sys.argv) > 2 else 'qr-mapa-solpet'
    SALIDA.mkdir(exist_ok=True)
    im = png(url)
    im.save(SALIDA / f'{nombre}.png', optimize=True)
    (SALIDA / f'{nombre}.svg').write_text(svg(url), encoding='utf-8')
    tarjeta(im).save(SALIDA / f'{nombre}-tarjeta.png', optimize=True)
    print(f'QR para {url} -> {SALIDA / nombre}.png / .svg / -tarjeta.png')


if __name__ == '__main__':
    main()
