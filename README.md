# LOVET | Web de arena perlada para gatos

Página informativa de LOVET Super Premium, arena perlada aglomerante con aroma a aloe vera.

## Cómo verla

La web carga las fuentes y el mapa base (openfreemap.org) desde internet, así que conviene abrirla con un servidor local
(no con doble clic). Por ejemplo, desde esta carpeta:

```bash
npx serve .
```

Luego abre la dirección que muestra la terminal. `LOVET.html` e `index.html` son la misma página;
`index.html` es el nombre que usan los hostings.

## Archivos

- `index.html` / `LOVET.html`: estructura de las 6 secciones.
- `styles.css`: colores y tipografía de la marca, diseño de cada sección.
- `main.js`: navegación por secciones, vistazo dentro de la bolsa, arena interactiva con la pala,
  pasos del cambio de arena, mapa y formulario.
- `assets/vendor/maplibre/`: la librería del mapa (MapLibre GL 4.7.1, licencia BSD) incluida en el proyecto, sin depender de unpkg.
- `assets/`: bolsa final de 10 kg, texturas de la arena LOVET (`arena-lovet-bolsa.jpg` dentro de la bolsa;
  `arena-lovet.jpg` en "Toca la arena" y en el arenero de "El cambio"), foto del arenero con arena común
  (`arenero.webp`, recortada con su sombra) y la máscara de su zona de arena (`arenero-arena.png`), fotos de las secciones, logos de LOVET y de las tiendas del mapa (`assets/logos/`, cuadrados de 200 px en WebP).

## WordPress

La página se instala en WordPress como un tema, y queda igual que la versión HTML.

1. Arma el tema (desde esta carpeta):

   ```bash
   python3 wordpress/construir-tema.py
   ```

   Crea `wordpress/dist/lovet.zip` a partir de `index.html`, `styles.css`, `main.js` y `assets/`.
2. En WordPress: **Apariencia > Temas > Añadir nuevo tema > Subir tema**, elige `lovet.zip`, **Instalar ahora** y **Activar**.
3. Listo: la portada del sitio es la página de LOVET. Las demás páginas de WordPress (por ejemplo, la política de
   privacidad) usan la barra y el pie de LOVET.

Cada vez que cambie la página, se vuelve a correr el script y se sube el zip nuevo (WordPress ofrece reemplazar
el tema instalado). Para que el navegador no guarde la versión anterior, sube el número en `LOVET_VERSION`
de `wordpress/tema/functions.php`.

- Si el hosting rechaza el zip por tamaño (algunos limitan las subidas a 2 MB), súbelo descomprimido por FTP o
  el administrador de archivos del hosting a `wp-content/themes/lovet/` y actívalo en **Apariencia > Temas**.
- En `wordpress/tema/` está solo lo propio de WordPress: `functions.php` (carga estilos, script e imágenes desde el
  tema), `index.php` (páginas que no son la portada), `interior.css` y la miniatura del tema.

## Demo en WordPress Playground (gratis, para compartir)

Este enlace abre un WordPress completo en el navegador, con el tema de LOVET ya instalado y activado. No necesita
hosting, cuenta ni pago, y se puede enviar a cualquier persona:

https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/UnreCord/LOVET/main/wordpress/playground/blueprint.json

- La primera carga tarda unos segundos: arma el WordPress dentro del navegador.
- Cada persona recibe su propia copia; lo que cambie en el panel no se guarda ni le afecta a nadie más.
- Para ver el panel de administración, agrega `/wp-admin/` a la dirección (la sesión ya entra como administrador).
- El enlace instala `wordpress/playground/lovet.zip` de la rama `main`. Después de cambiar la página, corre
  `python3 wordpress/construir-tema.py` (actualiza esa copia), haz commit y fusiona en `main`: el enlace no cambia.

## Pendiente antes de publicar

- Veterinaria San Felipe en Los Olivos ("Asentamiento San Martín") no tiene número de puerta: sale en la lista con
  "Cómo llegar", sin pin. T&M Pet Style tiene 2 locales más sin dirección en la lista de distribución.
- Logo de Peluvet (misma razón social que Veterinaria San Felipe, otro nombre comercial): por ahora sale con su
  inicial. Guardarlo como `assets/logos/peluvet.webp` y poner `'peluvet'` en su fila de `STORES` (`main.js`).

## Tiendas del mapa

Los puntos de venta están en `STORES` dentro de `main.js`, uno por local: nombre comercial, logo, distrito, dirección,
latitud, longitud y si también vende online. Una fila sin dirección es una tienda solo online (sale en la lista, sin
pin); una con dirección pero sin coordenadas sale en la lista con "Cómo llegar", sin pin. Las coordenadas se ubicaron por número de puerta con OpenStreetMap; "Cómo llegar" abre Google Maps con el
nombre y la dirección, así que lleva a la tienda aunque el pin quede a unas casas.
- El formulario de contacto no tiene servidor: al enviarlo abre el correo del visitante con el mensaje
  listo para marketingpets@solvet.com.pe. Si se quiere envío directo, conectarlo a un servicio (Formspree, CRM...).
