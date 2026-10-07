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

- `index.html` / `LOVET.html`: estructura de las 7 secciones.
- `styles.css`: colores y tipografía de la marca, diseño de cada sección.
- `main.js`: navegación por secciones, vistazo dentro de la bolsa, arena interactiva con la pala,
  calculadora de presentaciones, caja de "Cámbiate", mapa y formulario.
- `assets/`: bolsas de 5, 10 y 20 kg, logos de LOVET y logos de los distribuidores de ejemplo.

## Pendiente antes de publicar

- Reemplazar las tiendas del mapa (son datos de ejemplo) por los distribuidores reales, en `STORES` dentro de `main.js`.
- Cambiar el número de WhatsApp de relleno `51900000000` (en `main.js` e `index.html`).
- Conectar el formulario de contacto a un servicio de envío (Formspree, backend propio, CRM).
- Validar con datos reales los supuestos de la calculadora (`FILL_KG`, `CHANGE_DAYS`, `CAT_KG_DAY` en `main.js`).
- Reemplazar las fotos de Unsplash y las bolsas de 5 y 20 kg (editadas a partir de la de 10 kg) por fotos propias.
