# LOVET | Web de arena perlada para gatos

Página informativa de LOVET Super Premium, arena perlada aglomerante con aroma a aloe vera.

## Cómo verla

La web carga el mapa y las fuentes desde internet, así que conviene abrirla con un servidor local
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
- `assets/`: bolsa final de 10 kg, texturas de la arena LOVET (`arena-lovet-bolsa.jpg` dentro de la bolsa;
  `arena-lovet.jpg` en "Toca la arena" y en el arenero de "El cambio"), foto del arenero con arena común
  (`arenero.webp`, recortada con su sombra) y la máscara de su zona de arena (`arenero-arena.png`), fotos de las secciones, logos de LOVET y de los distribuidores de ejemplo.

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

## Pendiente antes de publicar

- Reemplazar las tiendas del mapa (son datos de ejemplo) por los distribuidores reales, en `STORES` dentro de `main.js`.
- El formulario de contacto no tiene servidor: al enviarlo abre el correo del visitante con el mensaje
  listo para marketingpets@solvet.com.pe. Si se quiere envío directo, conectarlo a un servicio (Formspree, CRM...).
- Si hay archivos de la bolsa en mayor resolución que el PDF de presentaciones, reemplazar `assets/bolsa-10kg.png`.
