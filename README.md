# 🎰 La Despedida — ¿Quién ha pagado?

Web estática que muestra el progreso de las cuotas del fondo de la despedida de soltero,
con datos en vivo desde una planilla de Google Sheets administrada por la organización.

## Cómo funciona

- `index.html` + `styles.css` + `app.js` — sitio vanilla, sin build ni dependencias.
- Al cargar, la página hace `fetch` del Sheet vía el endpoint CSV público (`gviz/tq?tqx=out:csv`).
  **Cada cambio en el Sheet se refleja al recargar la web**, sin tocar el repo.
- El Sheet tiene una fila por participante y una columna por mes (`TRUE`/`FALSE`).
  Si se agregan o quitan columnas de meses, la web se adapta sola.
- La cuota mensual ($30.000) y los datos bancarios están definidos en `app.js` / `index.html`.

## Deploy

GitHub Actions (`.github/workflows/deploy.yml`) despliega la raíz del repo a GitHub Pages
en cada push a `main`. Requiere que Pages esté configurado en modo **GitHub Actions**
(Settings → Pages → Source).

## Desarrollo local

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```
