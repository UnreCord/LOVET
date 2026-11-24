# Mapa de puntos de venta Solpet

Mapa interactivo con todos los puntos de venta, pensado sobre todo para el celular (también funciona en laptop).
Usa el mismo diseño de la sección "Dónde comprar", con el logo de Solpet y el verde `#007A33`.
No menciona productos ni marcas: solo las tiendas, sus direcciones y "Cómo llegar".

## Las dos propuestas

| | Celular | Laptop |
|---|---|---|
| **Propuesta 1 · Mapa + lista** (`propuesta-1/`) | Mapa arriba; la lista sube como una hoja sobre el mapa, con el buscador fijo arriba. Al tocar una tienda vuelve al mapa y muestra su tarjeta. | Mapa a pantalla completa con la tarjeta de tiendas flotando a la izquierda (como el diseño original). |
| **Propuesta 2 · Mapa completo** (`propuesta-2/`) | El mapa ocupa toda la pantalla. Las tiendas se recorren deslizando tarjetas abajo: cada tarjeta enciende su pin. "Ver lista" abre la lista por distrito. | La misma idea, con flechas para pasar las tarjetas y la lista como panel a la izquierda. |

Las dos tienen buscador (distrito, tienda o calle), "Cerca de mí" (ordena por distancia y marca tu ubicación),
pines agrupados que se abren al tocarlos y "Cómo llegar" con Google Maps. `index.html` permite abrir cualquiera de las dos.

## Cómo verlo

Necesita internet (fuentes y mapa base de openfreemap.org) y abrirse desde un servidor, no con doble clic. Desde la raíz del repositorio:

```bash
npx serve .
```

y abrir `/mapa-solpet/`. Para publicarlo basta subir la carpeta `mapa-solpet/` completa a cualquier hosting estático
(GitHub Pages, Netlify, Vercel o el hosting de la web).

## Archivos

- `comun/tiendas.js`: **los puntos de venta**, tomados de la tabla `DIRECCIONES.xlsx` (nombre, logo, distrito,
  dirección, coordenadas y web si tiene tienda online). Una fila sin dirección es una tienda solo online; con dirección
  pero sin coordenadas sale en la lista sin pin. La tabla trae también los productos de cada punto, pero el mapa no los muestra.
- `comun/mapa.js`, `comun/base.css`: lo que comparten las dos propuestas (mapa, pines, lista, colores).
- `propuesta-1/`, `propuesta-2/`: página, estilos y comportamiento de cada propuesta.
- `assets/logos/`: logos de los clientes (cuadrados de 240 px en WebP). Para una tienda nueva, guardar su logo ahí y
  poner el nombre del archivo (sin `.webp`) en su fila de `tiendas.js`. Sin logo, sale con sus iniciales.
- `assets/`: logo de Solpet, la huella, los pines y los iconos. `assets/vendor/maplibre/`: librería del mapa (BSD).
- `qr/`: los QR (PNG para imprimir, SVG vectorial y una tarjeta lista para compartir).

## QR

Los QR de `qr/` apuntan a la dirección que tendría la carpeta en GitHub Pages de este repositorio
(`https://unrecord.github.io/LOVET/mapa-solpet/propuesta-1/` y `.../propuesta-2/`). **Cuando se defina dónde se
publica el mapa, hay que regenerarlo con la dirección final**:

```bash
pip install segno pillow
```

```bash
python3 mapa-solpet/herramientas/generar-qr.py https://la-direccion-final/ qr-mapa-solpet
```

Usa corrección de errores alta, así que se lee aunque la huella tape el centro. Conviene que la dirección final sea
corta y estable (por ejemplo `solpet.com.pe/mapa`): si luego cambia, los QR impresos dejan de funcionar.

## Pendiente

- **Sin pin** (salen en la lista con "Cómo llegar"):
  - Veterinaria San Felipe, Los Olivos ("Asentamiento San Martín"): no tiene número de puerta.
  - Veterinaria Mundo Animal, Chorrillos ("Av. Alameda Los Horizontes Mza. A1 Lote 15 Urb. L..."): en la tabla la
    urbanización está cortada y la avenida es larga; falta el nombre completo de la urbanización.
  - Peluditos Pet Shop, "Av. Central 993, Lima": OpenStreetMap no encuentra una Av. Central en el Cercado de Lima; falta confirmar el distrito.
- **Pin aproximado** (marcados `'calle'` en `tiendas.js`): OpenStreetMap no tiene esos números de puerta y el pin se
  calculó sobre el trazo de la calle (100 números ≈ una cuadra), así que puede quedar a una o dos cuadras: The Urban Pets,
  American Vet (San Borja), Lumpet, Peluditos (Pueblo Libre), Naricitas (×2), Pals & Tails, T&M (Magdalena y La Victoria)
  y Veterinaria Engreídos. Para corregir uno, copiar las coordenadas del local en Google Maps (clic derecho sobre el
  local) y pegarlas en su fila.
- **Logos que faltan** (salen con sus iniciales): The Urban Pets, American Vet, Lumpet, Peluditos, Naricitas,
  Pals & Tails, Peluvet Spa, Veterinaria Mundo Animal y Veterinaria Engreídos.
