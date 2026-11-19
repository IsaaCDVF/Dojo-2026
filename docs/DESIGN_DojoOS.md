# Dojo OS · Sistema de diseño (versión 0.5)
> "Dojo de medianoche": fondo azul marino profundo, una sola acción turquesa que brilla y el oro del cinturón para la marca y los logros.

Basado en la referencia de estilo que eligió el equipo (estilo Windsurf), adaptado a Dojo OS. Se conserva el logo y su oro; el turquesa es el único color de acción.

## Modos
- **Oscuro (predeterminado):** el que se usa en panel, tableta y portal.
- **Claro:** se elige en el perfil del usuario (útil en recepciones con mucha luz). Mismos componentes; el menú lateral sigue en azul medianoche.
- En el código: atributo `data-theme="dark" | "light"` en `<html>` y las variables de `dojo-tema.css`.

## Colores
| Rol | Oscuro | Claro | Uso |
|---|---|---|---|
| Fondo | `#011c42` | `#f4f6f9` | Lienzo de todas las pantallas |
| Tarjeta | `#0a2852` | `#ffffff` | Tarjetas y paneles |
| Interno | `#10335f` | `#eef1f5` | Campos, filas, tarjetas dentro de tarjetas |
| Menú lateral | `#00132e` | `#011c42` | Navegación |
| Texto | `#ffffff` | `#0b1b33` | Texto principal |
| Texto secundario | `#a9b3c9` | `#5b6478` | Descripciones, fechas |
| **Acción** | `#34e8bb` + texto `#003326` | igual | Botones principales, elemento activo del menú, enlaces |
| Enlace | `#34e8bb` | `#007a5c` | Enlaces en texto |
| Oro marca | `#f2a900` | igual | Logo, insignias, cintas, logros. Nunca en botones |
| Al corriente / Pendiente / Vencido | verde / ámbar / rojo | | Solo para estados (chips y avisos) |
| Aurora | `#006aff → #a95af8 → #fb9ce5` | — | Decoración del inicio de sesión. Nunca en botones o texto |

## Tipografía
- **Títulos de página:** Inter peso 300, 28–40 px, tracking −0.025 em. El tamaño da la jerarquía, no el grosor.
- **Texto, botones, tablas:** DM Sans 400–700, 14–16 px.
- **Etiquetas técnicas** (MATRÍCULA, FOLIO, TERMINAL, encabezados de tabla en mayúsculas): DM Mono 500, 12 px, +0.05 em.
- **Cifras grandes** (montos, KPI): DM Sans 700; no se usan en peso 300.
- El logotipo usa Manrope ExtraBold (ya convertido a trazos en los SVG).

## Forma
- Botones, chips y filtros: píldora (`9999px`).
- Tarjetas: 10 px. Campos: 6 px.
- Sombras casi nulas en oscuro: la profundidad la dan los tres niveles de fondo.

## Reglas
- Un solo botón turquesa relleno por bloque; los demás en contorno.
- Estados con color + texto ("Vencido", "Pendiente"), nunca solo color.
- Contraste mínimo AA: texto secundario `#a9b3c9` sobre `#0a2852` cumple 4.5:1.
- Íconos: Material Symbols Outlined, línea delgada.

## Archivos
- `dojo-tema.css`: variables y clases base para ambos modos.
- `tema-vista-previa.js`: aplica el tema a las pantallas HTML de Stitch para verlas en el navegador (botón para cambiar de modo). Solo para revisión; en el desarrollo se usan las variables de `dojo-tema.css`.
