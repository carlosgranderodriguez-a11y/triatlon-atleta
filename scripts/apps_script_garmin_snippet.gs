// ════════════════════════════════════════════════════════════
//  GARMIN — datos diarios sincronizados automáticamente
//  (sueño, HRV, Body Battery, FC reposo, actividades)
// ════════════════════════════════════════════════════════════
const GARMIN_HEADERS = [
  'id','athlete','fecha',
  'sleep_score','sleep_total_min','hrv_last_night_avg','rhr',
  'body_battery_min','body_battery_max',
  'actividades_json','full_json'
];

function saveGarmin(athlete, data) {
  const sheet   = getOrCreateSheet(SHEET_NAMES.garmin, GARMIN_HEADERS);
  const headers = getHeaders(sheet);
  const fechaStr = String(data.fecha || '').slice(0, 10);

  const vals = Object.assign({}, data, {
    athlete: athlete,
    fecha: fechaStr,
    id: 'garmin_' + athlete + '_' + fechaStr,
    actividades_json: JSON.stringify(data.actividades || []),
    full_json: JSON.stringify(data),
  });

  const idCol = headers.indexOf('id');
  const all = sheet.getDataRange().getValues();
  let targetRow = -1;
  if (idCol >= 0) {
    for (let i = 1; i < all.length; i++) {
      if (String(all[i][idCol]) === String(vals.id)) { targetRow = i + 1; break; }
    }
  }

  const row = headers.map(h => (vals[h] !== undefined ? vals[h] : ''));
  const target = targetRow > 0 ? targetRow : sheet.getLastRow() + 1;
  sheet.getRange(target, 1, 1, row.length).setValues([row]);

  const fechaColIdx = headers.indexOf('fecha') + 1;
  if (fechaColIdx > 0) sheet.getRange(target, fechaColIdx).setNumberFormat('@').setValue(fechaStr);

  return { saved: true, id: vals.id, updated: targetRow > 0 };
}

function getGarmin(athlete) {
  const sheet = getOrCreateSheet(SHEET_NAMES.garmin, GARMIN_HEADERS);
  return sheetToObjects(sheet)
    .filter(r => sameAthlete(r.athlete, athlete))
    .map(r => Object.assign({}, r, { fecha: toISODate(r.fecha) }));
}
