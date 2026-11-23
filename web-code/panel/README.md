# Panel web · Dojo OS

React 18 + Vite + Tailwind 4. Habla con la API en `/api`.

## Trabajar en desarrollo (con recarga automática)

```bash
cd web-code/panel
npm install          # la primera vez
npm run dev          # http://localhost:5173  (las llamadas a /api van a http://localhost:8080)
```

La API tiene que estar arriba: `docker compose up -d` en la raíz del repo.

## Publicar en Nginx (http://localhost:8080)

```bash
cd web-code/panel
npm run build        # genera dist/, que Nginx sirve en /
```

`dist/` y `node_modules/` no se suben a GitHub.

## Estructura

```
src/
├── api.js            único lugar que llama a la API (token, errores, formatos)
├── auth/Sesion.jsx   sesión, rol activo y permisos: tiene('pagos.cobrar')
├── layout/           menú lateral (menu.js) y barra superior (Panel.jsx)
├── ui/               componentes: Boton, Campo, Tarjeta, Modal, Tabla, Chip, avisos, confirmaciones…
└── paginas/          una pantalla por archivo (S-01 Login, S-03 Inscripción, S-05 Ficha, S-06 Horarios…)
```

## Reglas

- Colores y tipografía salen de las variables de `src/index.css` (tokens de `docs/DESIGN_DojoOS.md`); no se escriben colores sueltos.
- Modo oscuro por defecto; el botón de sol/luna cambia a claro y se recuerda en el navegador.
- Un botón o menú se muestra solo si el rol tiene el permiso, pero **la API vuelve a validar**: ocultar no es seguridad.
- Para una pantalla nueva: archivo en `paginas/`, ruta en `App.jsx` y opción en `layout/menu.js` con sus permisos.
