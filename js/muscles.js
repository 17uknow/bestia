// Mapa muscular propio: figura frontal y trasera. Resalta músculo principal y secundarios.
(function () {
  const pair = (id, cx, cy, rx, ry, mirror, rot) => {
    const r = rot || 0;
    const e = (x, rr) => `<ellipse data-m="${id}" cx="${x}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rr} ${x} ${cy})"/>`;
    return e(cx, r) + e(mirror - (cx - mirror), -r);
  };
  // Silueta base (brazos, piernas, tronco) — color neutro
  const silhouette = cx => `
    <circle cx="${cx}" cy="22" r="14" class="sil"/>
    <rect x="${cx - 6}" y="34" width="12" height="10" rx="4" class="sil"/>
    <path d="M${cx - 30} 50 Q${cx} 42 ${cx + 30} 50 L${cx + 26} 130 Q${cx} 138 ${cx - 26} 130 Z" class="sil"/>
    <rect x="${cx - 40}" y="52" width="13" height="90" rx="6.5" class="sil" transform="rotate(8 ${cx - 33} 52)"/>
    <rect x="${cx + 27}" y="52" width="13" height="90" rx="6.5" class="sil" transform="rotate(-8 ${cx + 33} 52)"/>
    <path d="M${cx - 26} 128 L${cx + 26} 128 L${cx + 22} 150 L${cx - 22} 150 Z" class="sil"/>
    <rect x="${cx - 23}" y="140" width="20" height="112" rx="9" class="sil"/>
    <rect x="${cx + 3}" y="140" width="20" height="112" rx="9" class="sil"/>`;

  const FRONT = 60, BACK = 180;
  const front = `
    ${silhouette(FRONT)}
    ${pair('deltoide_ant', 36, 60, 8, 11, FRONT, 10)}
    ${pair('deltoide_lat', 30, 64, 5, 10, FRONT, 12)}
    ${pair('pecho', 47, 70, 12.5, 9.5, FRONT, 8)}
    ${pair('biceps', 29, 92, 5.5, 13, FRONT, 8)}
    ${pair('antebrazo', 24, 124, 5, 14, FRONT, 8)}
    <rect data-m="abdomen" x="${FRONT - 10}" y="83" width="20" height="44" rx="7"/>
    ${pair('oblicuos', 43, 106, 4.5, 15, FRONT, -6)}
    ${pair('cuadriceps', 48, 172, 9, 28, FRONT, 3)}
    ${pair('aductores', 56.5, 162, 3.5, 16, FRONT, -6)}
    ${pair('gemelos', 48, 222, 5, 14, FRONT, 0)}
    <path data-m="trapecio" d="M${FRONT - 14} 46 Q${FRONT} 40 ${FRONT + 14} 46 L${FRONT + 8} 52 L${FRONT - 8} 52 Z"/>`;
  const back = `
    ${silhouette(BACK)}
    <path data-m="trapecio" d="M${BACK - 20} 50 Q${BACK} 38 ${BACK + 20} 50 L${BACK + 8} 70 L${BACK} 96 L${BACK - 8} 70 Z"/>
    ${pair('deltoide_post', 156, 61, 8, 10, BACK, 10)}
    ${pair('deltoide_lat', 150, 65, 5, 10, BACK, 12)}
    ${pair('triceps', 149, 92, 6, 14, BACK, 8)}
    ${pair('antebrazo', 144, 124, 5, 14, BACK, 8)}
    ${pair('espalda_media', 170, 74, 7, 10, BACK, -10)}
    ${pair('dorsal', 165, 98, 9, 20, BACK, 14)}
    <ellipse data-m="lumbar" cx="${BACK}" cy="118" rx="9" ry="11"/>
    ${pair('gluteo', 170, 142, 10.5, 11, BACK, 0)}
    ${pair('isquios', 169, 180, 8.5, 24, BACK, 2)}
    ${pair('gemelos', 168, 220, 7, 15, BACK, 0)}`;

  window.muscleMapSVG = function (primary, secondary) {
    const svg = `<svg viewBox="0 0 240 262" class="mmap" role="img" aria-label="Músculos trabajados">
      <g class="mm">${front}</g><g class="mm">${back}</g>
      <text x="${FRONT}" y="260" text-anchor="middle" class="mmt">Delante</text>
      <text x="${BACK}" y="260" text-anchor="middle" class="mmt">Detrás</text></svg>`;
    const wrap = document.createElement('div');
    wrap.innerHTML = svg;
    wrap.querySelectorAll('[data-m]').forEach(n => {
      const m = n.getAttribute('data-m');
      n.setAttribute('class', primary.includes(m) ? 'm-p' : secondary.includes(m) ? 'm-s' : 'm-o');
    });
    return wrap.innerHTML;
  };
})();
