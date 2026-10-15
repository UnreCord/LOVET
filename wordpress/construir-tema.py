"""Arma el tema de WordPress de LOVET a partir de la pagina.

    python3 wordpress/construir-tema.py

Crea wordpress/dist/lovet.zip, listo para subir en WordPress desde
Apariencia > Temas > Añadir nuevo tema > Subir tema.

La portada del tema es index.html convertida a plantilla (front-page.php), con
styles.css, main.js y la carpeta assets/ tal cual. Despues de cambiar la pagina
basta con volver a correr este script y subir el zip nuevo.
"""
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMA = ROOT / 'wordpress' / 'tema'
DIST = ROOT / 'wordpress' / 'dist'
VERSION = re.search(r"define\( 'LOVET_VERSION', '([^']+)' \)", (TEMA / 'functions.php').read_text()).group(1)

CABECERA = f"""/*
Theme Name: LOVET
Theme URI: https://lovet.pe
Author: LOVET
Description: Página de LOVET Super Premium, arena perlada aglomerante con aroma a aloe vera. La portada del sitio es la página completa de LOVET; las demás páginas usan la barra y el pie de la marca.
Version: {VERSION}
Requires at least: 6.3
Requires PHP: 7.4
License: Todos los derechos reservados
Text Domain: lovet
*/

"""


def reemplazar(texto, viejo, nuevo):
    if viejo not in texto:
        raise SystemExit(f'No encontré en index.html: {viejo[:70]!r}. ¿Cambió la página? Actualiza este script.')
    return texto.replace(viejo, nuevo)


def portada(html):
    """index.html -> front-page.php: los estilos y scripts los carga functions.php."""
    for etiqueta in [
        '  <link rel="icon" href="assets/logo-lovet.png">\n',
        '  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Instrument+Serif&display=swap" rel="stylesheet">\n',
        '  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">\n',
        '  <link rel="stylesheet" href="styles.css">\n',
        '  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js" defer></script>\n',
        '  <script src="main.js"></script>\n',
    ]:
        html = reemplazar(html, etiqueta, '')
    html = reemplazar(html, '<html lang="es">', '<html <?php language_attributes(); ?>>')
    html = reemplazar(html, '<meta charset="utf-8">', '<meta charset="<?php bloginfo( \'charset\' ); ?>">')
    html = reemplazar(html, '</head>', '  <?php wp_head(); ?>\n</head>')
    html = reemplazar(html, '<body data-tone="dark">', '<body <?php body_class(); ?> data-tone="dark">\n<?php wp_body_open(); ?>')
    html = reemplazar(html, '</body>', '<?php wp_footer(); ?>\n</body>')
    html = re.sub(r'"assets/([^"]+)"', lambda m: f'"<?php echo esc_url( get_theme_file_uri( \'assets/{m.group(1)}\' ) ); ?>"', html)
    if re.search(r'(src|href)="(?!https?:|#|mailto:|<\?php)', html):
        raise SystemExit('Quedó una ruta relativa sin convertir en front-page.php.')
    return "<?php if ( ! defined( 'ABSPATH' ) ) { exit; } ?>" + html


def main():
    DIST.mkdir(exist_ok=True)
    salida = DIST / 'lovet.zip'
    estilos = CABECERA + (ROOT / 'styles.css').read_text(encoding='utf-8') + '\n' + (TEMA / 'interior.css').read_text(encoding='utf-8')
    # en WordPress conviven otros scripts (plugins): el de LOVET va encerrado para no chocar con ellos
    script = '(function () {\n' + (ROOT / 'main.js').read_text(encoding='utf-8') + '\n})();\n'
    with zipfile.ZipFile(salida, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('lovet/style.css', estilos)
        z.writestr('lovet/front-page.php', portada((ROOT / 'index.html').read_text(encoding='utf-8')))
        z.writestr('lovet/main.js', script)
        for nombre in ['functions.php', 'index.php', 'screenshot.jpg']:
            z.write(TEMA / nombre, f'lovet/{nombre}')
        for archivo in sorted((ROOT / 'assets').rglob('*')):
            if archivo.is_file():
                z.write(archivo, f'lovet/{archivo.relative_to(ROOT).as_posix()}')
    print(f'{salida.relative_to(ROOT)} ({salida.stat().st_size / 1e6:.1f} MB), tema LOVET {VERSION}')


if __name__ == '__main__':
    main()
