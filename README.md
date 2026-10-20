# Opella. Winter Evolution - revista digital

Proyecto estático listo para GitHub Pages.

## Estructura

- `index.html` - portada y lector.
- `css/styles.css` - diseño responsive y animación 3D de cambio de página.
- `js/reader.js` - navegación, zoom, fullscreen, miniaturas y gestos móviles.
- `assets/` - logos y mockup de Opella.
- `pages/` - 9 páginas optimizadas en WebP para lectura.
- `thumbs/` - miniaturas del índice.
- `revista/revista-opella-winter-evolution.pdf` - PDF descargable.

## Publicar en GitHub Pages

1. Crea un repositorio nuevo.
2. Sube **el contenido de esta carpeta** a la raíz del repositorio.
3. En GitHub abre `Settings` > `Pages`.
4. En `Build and deployment`, selecciona `Deploy from a branch`.
5. Selecciona `main` y `/ (root)`.
6. Guarda y espera a que GitHub publique la URL.

## Controles

- Flechas izquierda/derecha: cambiar página.
- Botones `− 100% +`: zoom en computadora.
- `+`, `-`, `0`: zoom por teclado.
- Arrastre con mouse cuando hay zoom.
- Swipe horizontal en móvil.
- Pellizco y doble toque en móvil para zoom.
- Pantalla completa con fallback de modo lectura.

El PDF original se conserva únicamente para el botón de descarga; el lector utiliza imágenes WebP optimizadas.
