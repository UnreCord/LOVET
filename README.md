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
- `assets/`: bolsa final de 10 kg, foto real de la arena (`arena-lovet.jpg`, se usa como textura en la bolsa,
  en "Toca la arena" y en el arenero de "El cambio"), foto del arenero con arena común
  (`arenero.webp`, recortada con su sombra) y la máscara de su zona de arena (`arenero-arena.png`), fotos de las secciones, logos de LOVET y de los distribuidores de ejemplo.

## Pendiente antes de publicar

- Reemplazar las tiendas del mapa (son datos de ejemplo) por los distribuidores reales, en `STORES` dentro de `main.js`.
- El formulario de contacto no tiene servidor: al enviarlo abre el correo del visitante con el mensaje
  listo para marketingpets@solvet.com.pe. Si se quiere envío directo, conectarlo a un servicio (Formspree, CRM...).
- Si hay archivos de la bolsa en mayor resolución que el PDF de presentaciones, reemplazar `assets/bolsa-10kg.png`.
