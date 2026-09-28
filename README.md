# Fitness

Tracker personal de entrenos, comidas, peso y hábitos. Web estática (GitHub Pages) instalable como app.

- **Sin datos en este repositorio.** Todo se guarda en el navegador de cada dispositivo y se sincroniza con un archivo en el Dropbox del usuario (OAuth PKCE, sin servidor).
- Funciona offline (service worker).
- Imágenes de ejercicios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense / dominio público).

## Estructura
- `index.html` — interfaz y estilos
- `js/foods.js` — alimentos (macros por 100 g)
- `js/meals.js` — opciones del plan de comidas y semana tipo
- `js/exercises.js` — biblioteca de ejercicios (técnica, errores, músculos)
- `js/routines.js` — rutinas A/B (gym y casa) y baremo de peso
- `js/anim.js` — animaciones propias de los ejercicios
- `js/muscles.js` — mapa muscular
- `js/store.js` — datos locales + sincronización con Dropbox
- `js/app.js` — vistas y lógica (progresión, diagnóstico)

Al cambiar archivos, sube el `?v=` de los `<script>` en `index.html` y `VERSION` en `sw.js` para forzar la actualización en los dispositivos.
