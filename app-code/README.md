# App Dojo OS · alumnos y responsables

PWA en React 18 + Vite + Tailwind 4. Se sirve en `/app/` (nginx toma `app-code/dist`) y habla con la API en `/api`.
Se "instala" desde el navegador del celular: menú ⋮ → *Agregar a pantalla de inicio* (Android) o Compartir → *Agregar a inicio* (iPhone).

## Quién entra y cómo

- El acceso lo da **recepción** en la ficha del alumno → tarjeta *App Dojo OS* → *Dar acceso*. Sale un código de 6 dígitos (vence en 72 h) y el botón *Enviar por WhatsApp*.
- **Alumno**: usuario = su matrícula (`CENT-26-0001`). Si no tiene teléfono, el WhatsApp se manda al de su responsable.
- **Responsable de pago**: usuario = su teléfono de 10 dígitos. Ve a todos los alumnos por los que paga.
- En la app: *Activar mi cuenta* → usuario + código + contraseña nueva. Si olvidó la contraseña, recepción genera otro código.

## Pantallas

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/app/a/:id` | alumno (o su responsable) | Saludo con avatar, **Mostrar mi QR** (el mismo de la credencial impresa), aviso de pago, rumbo a la siguiente cinta, semana y racha, clases de hoy |
| `/app/a/:id/camino` | | Todas las cintas como sendero: pasadas, "Estás aquí", siguiente con fecha de examen |
| `/app/a/:id/avatar` | | Accesorios por tipo (los bloqueados dicen en qué grado se ganan) e insignias |
| `/app/a/:id/examen` | | Fechas, requisitos (meses, asistencia, plazo), solicitar y estado de la solicitud |
| `/app/familia` | responsable | Cuánto debe, si está vencido, saldo a favor y sus alumnos |
| `/app/pagos` | responsable | Pendientes por alumno, historial y recibo |

## Avatar

- `src/avatar/esqueleto.js`: proporciones por edad (niño, joven, adulto), poses y movimientos de cada disciplina. Una pose son ángulos de tronco, brazos y piernas; un movimiento es una lista de poses con su duración. Para agregar uno se define ahí y aparece como botón en Mi avatar.
- `src/Avatar.jsx`: dibuja las piezas sobre el esqueleto (cabeza, cabello, vello, uniforme según la disciplina, cinta del grado, accesorios). Cada accesorio de la tabla `accesorios` (columna `imagen`) es una clave que se dibuja ahí (`banda-roja`, `dobok-negro`…).
- `src/avatar/fondos.jsx`: los fondos.
- Lo bloqueado se puede **probar**: el avatar se ve con esa pieza y un aviso de en qué grado se gana, pero no se guarda (la API lo rechaza).

## Desarrollo

```bash
cd app-code
npm install          # la primera vez
npm run dev          # http://localhost:5174/app/  (las llamadas a /api van a http://localhost:8080)
npm run celular      # igual pero con https, para abrirla desde el celular en la misma red
npm run build        # genera dist/ (se sube al repo: git add -A -f app-code/dist)
```

Para probar desde el celular sigue los mismos pasos de `web-code/panel/README.md` (portproxy de Windows) cambiando el puerto 5173 por **5174**.
