# Panel web · Dojo OS

React 18 + Vite + Tailwind 4. Habla con la API en `/api`.

## Trabajar en desarrollo (con recarga automática)

```bash
cd web-code/panel
npm install          # la primera vez
npm run dev          # http://localhost:5173  (las llamadas a /api van a http://localhost:8080)
```

La API tiene que estar arriba: `docker compose up -d` en la raíz del repo.

## Usar el celular como tableta de asistencia

La cámara del navegador solo funciona en páginas **https**. `npm run celular` levanta el panel con un certificado de prueba.

1. En WSL (con Docker arriba):
   ```bash
   cd web-code/panel
   npm run celular      # https://localhost:5173
   hostname -I          # la primera IP es la de WSL, p. ej. 172.24.10.5
   ```
2. En Windows, PowerShell **como administrador** (una sola vez; repetir el primer comando si cambia la IP de WSL al reiniciar):
   ```powershell
   netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=172.24.10.5
   New-NetFirewallRule -DisplayName "Dojo panel 5173" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
   ipconfig             # "Dirección IPv4" del Wi-Fi, p. ej. 192.168.1.70
   ```
3. En el celular, conectado al **mismo Wi-Fi**: abrir `https://192.168.1.70:5173`, aceptar el aviso del certificado
   ("Avanzado → Continuar") y entrar con `tableta.centro@dojoos.mx`. Permitir la cámara.

La cuenta de la tableta entra directo a la pantalla de asistencia. También sirve un lector de códigos USB o Bluetooth:
escribe el código y un Enter, la pantalla lo toma sin tocar nada. Para quitar el puente:
`netsh interface portproxy delete v4tov4 listenport=5173 listenaddress=0.0.0.0`.

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
- Para una pantalla nueva: archivo en `paginas/`, ruta en `jsx` y opción en `layout/menu.js` con sus permisos.

## Marca blanca y traducción

- **Marca** (Configuración → Apariencia y marca): la guarda la API en la tabla `marca`. `src/marca/Marca.jsx` la aplica a todo el panel: colores (`src/marca/temas.js`), letra (`src/marca/fuentes.js`), nombre en la pestaña e ícono. Para agregar un tema listo, súmalo a `TEMAS` en `temas.js`, en la API (`MarcaControlador::TEMAS` y `Temas::FONDOS`) y en la app (`app-code/src/marca.jsx`).
- **Contraste**: el color del texto de los botones y de los enlaces se calcula solo para que se lean (WCAG AA). En Apariencia se ve la revisión.
- **Idiomas**: `src/i18n/es-MX.js` y `src/i18n/en-US.js`. En un componente: `const { t } = useTranslation();` y `t('menu.alumnos')`. Para un idioma nuevo, copia `en-US.js`, tradúcelo, regístralo en `src/i18n/index.js` y en la API (`MarcaControlador::IDIOMAS`). Las pantallas que todavía tienen el texto directo en el JSX se van pasando a claves poco a poco.
- **Preferencias del usuario** (Mi perfil): idioma, tema y tamaño de letra; se guardan en la API y viajan en `/auth/yo`.
