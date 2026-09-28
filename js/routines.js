// Rutinas por defecto. reps: [mín, máx] · time: segundos · fail: al fallo
// rest: [mín, máx] segundos · ss: superserie con el siguiente ejercicio (sin descanso entre los dos)
window.ROUTINES = {
  'A-gym': {
    name: 'Día A · Pierna + empuje', place: 'gym',
    items: [
      { ex: 'goblet_squat', sets: 3, reps: [10, 12], rest: [90, 120] },
      { ex: 'bulgara', sets: 3, reps: [10, 12], rest: [90, 120] },
      { ex: 'press_inclinado', sets: 3, reps: [8, 10], rest: [90, 120] },
      { ex: 'press_militar', sets: 3, reps: [8, 10], rest: [90, 120] },
      { ex: 'curl_biceps', sets: 3, reps: [12, 15], rest: [60, 90], ss: true, note: '2-3 series' },
      { ex: 'ext_triceps', sets: 3, reps: [12, 15], rest: [60, 90], note: '2-3 series' },
      { ex: 'plancha', sets: 3, time: [20, 30], rest: [60, 90] },
    ],
  },
  'B-gym': {
    name: 'Día B · Pierna posterior + tirón + pecho', place: 'gym',
    items: [
      { ex: 'rdl', sets: 3, reps: [10, 12], rest: [90, 120] },
      { ex: 'zancada_caminando', sets: 3, reps: [12, 12], rest: [90, 120] },
      { ex: 'remo_polea', sets: 3, reps: [10, 12], rest: [60, 90] },
      { ex: 'press_pecho_maquina', sets: 3, reps: [10, 12], rest: [90, 120] },
      { ex: 'elev_laterales', sets: 3, reps: [12, 15], rest: [60, 90], ss: true, note: '2-3 series' },
      { ex: 'curl_martillo', sets: 3, reps: [12, 15], rest: [60, 90], note: '2-3 series' },
      { ex: 'gemelo', sets: 3, reps: [15, 20], rest: [60, 90] },
    ],
  },
  'A-casa': {
    name: 'Día A casa · Pierna + empuje', place: 'casa',
    items: [
      { ex: 'bulgara_kb', sets: 3, reps: [10, 12], rest: [90, 120] },
      { ex: 'sentadilla_pausa', sets: 3, reps: [15, 20], rest: [60, 90], note: 'Pausa 2-3 s abajo' },
      { ex: 'flexiones_banda', sets: 3, reps: [10, 15], fail: true, rest: [90, 120] },
      { ex: 'press_militar_banda', sets: 3, reps: [12, 15], rest: [60, 90] },
      { ex: 'curl_banda', sets: 3, reps: [12, 15], rest: [60, 90], ss: true, note: '2-3 series' },
      { ex: 'fondos_silla', sets: 3, reps: [12, 15], rest: [60, 90], note: '2-3 series' },
      { ex: 'plancha', sets: 3, time: [20, 30], rest: [60, 90] },
    ],
  },
  'B-casa': {
    name: 'Día B casa · Pierna posterior + tirón + pecho', place: 'casa',
    items: [
      { ex: 'rdl_una_pierna_kb', sets: 3, reps: [8, 10], rest: [90, 120] },
      { ex: 'puente_gluteo', sets: 3, reps: [15, 20], rest: [60, 90] },
      { ex: 'remo_banda', sets: 3, reps: [12, 15], rest: [60, 90] },
      { ex: 'flexiones_declinadas', sets: 3, reps: [8, 15], fail: true, rest: [90, 120] },
      { ex: 'laterales_banda', sets: 3, reps: [12, 15], rest: [60, 90], ss: true, note: '2-3 series' },
      { ex: 'curl_martillo_kb', sets: 3, reps: [12, 15], rest: [60, 90], note: '2-3 series' },
      { ex: 'gemelo_una_pierna', sets: 3, reps: [15, 20], rest: [60, 90] },
    ],
  },
};

// Baremo de peso (objetivos_peso.pdf), como subida sobre el peso inicial: semana -> [mín, máx] kg
window.WEIGHT_BAND = [[0, 0, 0], [2, 0.8, 1.5], [4, 1.2, 2.2], [6, 1.6, 2.9], [8, 2.0, 3.6], [10, 2.4, 4.5], [12, 3.0, 5.5]];
