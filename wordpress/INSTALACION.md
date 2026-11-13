# Instalar la web de LOVET en WordPress

Esta guía explica cómo instalar la página de LOVET en una web de WordPress y qué se puede y qué no se puede editar
después desde el panel.

## Cómo funciona

La web de LOVET se instala como un **tema de WordPress** (`lovet.zip`). Al activarlo:

- **La portada** del sitio pasa a ser la página completa de LOVET: Inicio, Por qué LOVET, Pruébala, El cambio,
  Dónde comprar y Contacto. Es la misma página que la versión HTML.
- **Las demás páginas** de WordPress (política de privacidad, términos, blog) se muestran con la barra y el pie de LOVET,
  y se editan normalmente desde el panel.

## Antes de empezar

| Requisito | Detalle |
| --- | --- |
| WordPress | 6.3 o superior |
| PHP | 7.4 o superior |
| Usuario | Con rol **Administrador** (para instalar temas) |
| Hosting | Que permita subir temas propios. En **WordPress.com** solo se puede en los planes que admiten temas y plugins propios (los planes gratuitos y básicos no lo permiten). En hostings con WordPress instalado (cPanel, Hostinger, SiteGround, etc.) sí se puede. |
| Archivo | `lovet.zip`: el último entregado, o `wordpress/playground/lovet.zip` de la rama `main` en GitHub |

> Si la web ya tiene contenido, haz una **copia de seguridad** antes de cambiar de tema (con el panel del hosting o con
> un plugin como UpdraftPlus).

## Pasos de instalación

### 1. Subir el tema

1. Entra al panel de WordPress (`tusitio.com/wp-admin`).
2. Ve a **Apariencia > Temas > Añadir nuevo tema > Subir tema**.
3. Elige `lovet.zip` y pulsa **Instalar ahora**.
4. Pulsa **Activar**.

**Si el hosting rechaza el archivo por tamaño:** el zip pesa unos 2,6 MB y algunos hostings limitan las subidas a 2 MB.
En ese caso:

1. Descomprime `lovet.zip` en tu computadora. Queda una carpeta `lovet`.
2. Súbela por FTP o por el administrador de archivos del hosting a `wp-content/themes/`, de modo que quede
   `wp-content/themes/lovet/`.
3. Vuelve a **Apariencia > Temas** y activa **LOVET**.

### 2. Revisar la portada

No hace falta configurar nada en **Ajustes > Lectura**: el tema usa la página de LOVET como portada, tanto si la
portada muestra "Tus últimas entradas" como si muestra una página estática.

Abre la dirección del sitio y comprueba:

- [ ] La portada se mueve por secciones con la rueda del mouse o deslizando.
- [ ] En **Pruébala**, al hacer clic en la arena se forma un grumo y aparece la pala.
- [ ] En **El cambio**, los 3 pasos mezclan la arena en el arenero.
- [ ] En **Dónde comprar** se ve el mapa con los pines; al tocar una tienda se abre su ficha, y "Cómo llegar" abre Google Maps.
- [ ] En **Contacto**, al enviar el formulario se abre el correo con el mensaje listo.
- [ ] Todo lo anterior también en el celular.

### 3. Ajustes opcionales

- **Ícono de la pestaña:** **Apariencia > Personalizar > Identidad del sitio > Icono del sitio**. Si no se elige uno,
  se usa el logo de LOVET.
- **Plugins de caché u optimización** (WP Rocket, LiteSpeed Cache, Autoptimize, etc.): después de instalar o actualizar
  el tema, **vacía la caché**. Si alguna animación o el mapa dejan de funcionar, excluye de la minificación o combinación
  de JavaScript los archivos `main.js` y `maplibre-gl.js` del tema `lovet`.
- **La barra de administración** de WordPress no aparece en la portada (taparía la página). En las demás páginas sí.

## Actualizar a una versión nueva

Cada cambio en la página se entrega como un `lovet.zip` nuevo:

1. **Apariencia > Temas > Añadir nuevo tema > Subir tema** y elige el zip nuevo.
2. WordPress avisa que el tema ya existe: pulsa **Reemplazar el actual con el subido**.
3. Vacía la caché si hay plugin de caché.

Cada versión del tema lleva un número nuevo (por ejemplo, 1.3.1), así que los navegadores de los visitantes descargan
los archivos nuevos y no se quedan con los anteriores.

## Limitaciones de edición

La portada está construida como **una página a medida dentro del tema**, no con bloques ni con un constructor visual.
Así se conservan las animaciones, el mapa interactivo y el diseño exacto, pero cambia lo que se puede editar desde el
panel:

### Lo que no se edita desde el panel de WordPress

| Qué | Por qué | Cómo se cambia |
| --- | --- | --- |
| Textos, títulos y botones de la portada | Están escritos en el archivo de la portada del tema | Se cambian en el código y se sube un zip nuevo |
| Fotos e imágenes de la portada (bolsa, arena, gatos, arenero) | Son archivos del tema, no de la Biblioteca de medios | Se reemplaza el archivo en el código y se sube un zip nuevo |
| Tiendas del mapa (nombres, logos, direcciones) | Están en el script del tema (`main.js`), con coordenadas ubicadas a mano por número de puerta | Se actualiza la lista en el código y se sube un zip nuevo |
| Orden y cantidad de secciones | Son parte del diseño y de la navegación por secciones | Desarrollo |
| Título de la pestaña y descripción para Google de la portada | Están fijos en la portada ("LOVET \| Arena perlada para gatos") | Se cambian en el código y se sube un zip nuevo |
| Correo de destino del formulario | Está fijo en la portada (marketingpets@solvet.com.pe) | Se cambia en el código y se sube un zip nuevo |

### Lo que no tiene efecto en la portada

- **Editor de bloques (Gutenberg), Elementor, Divi u otros constructores:** no pueden abrir ni modificar la portada.
- **Apariencia > Menús, Widgets y la mayoría de opciones de Personalizar:** el tema no usa menús ni widgets de WordPress.
  La navegación de la portada es propia.
- **Ajustes > Generales (Título del sitio, Descripción corta):** no cambian lo que se ve en la portada.
- **Plugins de SEO (Yoast, Rank Math):** pueden agregar sus etiquetas, pero el título y la descripción de la portada
  siguen siendo los del tema, así que pueden quedar repetidos. Conviene revisarlo si se instala uno.
- **Plugins de formularios (Contact Form 7, WPForms):** el formulario de Contacto no se conecta a ellos.

### Otras limitaciones

- **El formulario de contacto no envía correos por sí mismo:** abre el programa de correo del visitante con el mensaje
  listo. Si el visitante no tiene un correo configurado en su dispositivo, no se envía nada. Para recibir los mensajes
  directamente (o guardarlos en WordPress) hay que conectarlo a un servicio o plugin; eso requiere desarrollo.
- **Editar los archivos desde Apariencia > Editor de archivos de temas no es recomendable:** el archivo de la portada se
  genera automáticamente y cualquier cambio hecho ahí se pierde con la siguiente actualización del zip.
- **Servicios externos:** las fuentes se cargan de Google Fonts y el mapa base de OpenFreeMap. Si alguno no responde, la
  página sigue funcionando: se usa una fuente de respaldo, o el fondo del mapa puede quedar en blanco, pero la lista de
  tiendas y "Cómo llegar" siguen disponibles.
- **Solo en español:** no hay versión en otros idiomas ni integración con plugins de traducción.
- **El enlace de WordPress Playground es solo una demo:** cada persona recibe una copia temporal y los cambios que haga
  en ese panel no se guardan.

### Lo que sí se edita normalmente

- **Las demás páginas y entradas** (política de privacidad, términos, blog): se crean y editan con el editor de
  WordPress y se muestran con la barra y el pie de LOVET.
- **El ícono de la pestaña** (Identidad del sitio).
- **Usuarios, plugins, copias de seguridad, dominio y certificado SSL:** como en cualquier WordPress.

## Si se necesita editar la portada desde el panel

Si el equipo de marketing va a cambiar textos, imágenes o tiendas con frecuencia, se puede adaptar el tema para que esas
partes se editen desde WordPress sin tocar código. Requiere desarrollo adicional. Por ejemplo:

- Campos en **Apariencia > Personalizar**, o con el plugin **ACF**, para los textos, botones y fotos principales.
- Una sección **"Tiendas"** en el panel para agregar, editar o quitar puntos de venta. La ubicación en el mapa se puede
  calcular a partir de la dirección o marcarse a mano.
- Conexión del formulario de Contacto con un plugin de formularios para recibir los mensajes por correo y guardarlos.
