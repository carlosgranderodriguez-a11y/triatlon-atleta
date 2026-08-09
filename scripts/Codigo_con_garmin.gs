// ══════════════════════════════════════════════════════════════
//  TRIATLÓN — APPS SCRIPT (RECONSTRUIDO 20 jul 2026 + Garmin 9 ago 2026)
//  Reemplaza el Código.gs que se pegó por error (el de GymCoach Pro).
//  Apunta al mismo Sheet de siempre: no se toca ningún dato existente,
//  solo se reescribe el código que lee/escribe en él.
//
//  Sheet: 1UafOLH3X4akOkEhkfbubK9buiAbVcKkHAjPZ5e_5qTA
// ══════════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1UafOLH3X4akOkEhkfbubK9buiAbVcKkHAjPZ5e_5qTA';
const SHEET_NAMES = {
  wellness:   'Wellness',
  sessions:   'Sesiones',
  calendar:   'Calendario',
  tests:      'Tests',
  athletes:   'Atletas',
  workouts:   'Workouts',
  comments:   'Comentarios',
  auth:       'Auth',
  biblioteca: 'Biblioteca',
  garmin:     'Garmin',
};

// ══════════════════════════════════════════════════════════════
//  ENDPOINTS HTTP
// ══════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'login')       return jsonResp(doLogin(e.parameter.email, e.parameter.password));
    if (action === 'register')    return jsonResp(doRegister(e.parameter.email, e.parameter.password, e.parameter.athleteId));
    if (action === 'setPassword') return jsonResp(setAthletePassword(e.parameter.athleteId, e.parameter.password));

    const athlete = e.parameter.athlete || 'atletaDemo';
    const type    = e.parameter.type    || 'all';

    const data = {};
    if (type === 'all' || type === 'wellness')  data.wellness  = getWellness(athlete);
    if (type === 'all' || type === 'sessions')  data.sessions  = getSessions(athlete);
    if (type === 'all' || type === 'calendar')  data.calEvents = getCalendar(athlete);
    if (type === 'all' || type === 'tests')     data.tests     = getTests(athlete);
    if (type === 'all' || type === 'workouts')  data.workouts  = getWorkouts(athlete);
    if (type === 'all' || type === 'athletes')  data.athletes  = getAthletes();
    if (type === 'all' || type === 'comments')  data.comments  = getComments(athlete);
    if (type === 'all' || type === 'garmin')    data.garmin    = getGarmin(athlete);
    if (type === 'biblioteca')                  data.biblioteca = getBiblioteca();
    if (type === 'profile')                     data.athlete   = getAthleteById(athlete);

    return jsonResp({ ok: true, athlete, data });
  } catch (err) {
    return jsonResp({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { type, athlete, data } = payload;
    let result = null;
    switch (type) {
      case 'wellness':         result = saveWellness(athlete, data);        break;
      case 'session':          result = saveSession(athlete, data);         break;
      case 'cal':               result = saveCalEvent(athlete, data);       break;
      case 'comp':              result = saveCalEvent(athlete, data);       break;
      case 'test':              result = saveTest(athlete, data);           break;
      case 'workout':           result = saveWorkout(athlete, data);        break;
      case 'deleteWorkout':     result = deleteWorkout(athlete, data.id);   break;
      case 'biblioteca':        result = saveBiblioteca(data);              break;
      case 'deleteBiblioteca':  result = deleteBiblioteca(data.id);         break;
      case 'athlete':           result = saveAthlete(data);                 break;
      case 'comment':           result = saveComment(athlete, data);        break;
      case 'garmin':            result = saveGarmin(athlete, data);         break;
      case 'login':             result = doLogin(data.email, data.password); break;
      case 'register':          result = doRegister(data.email, data.password, data.athleteId); break;
      default: throw new Error('Tipo desconocido: ' + type);
    }
    return jsonResp({ ok: true, result });
  } catch (err) {
    return jsonResp({ ok: false, error: err.message });
  }
}

function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════
//  HELPERS GENÉRICOS DE HOJA
//  (leen/escriben según las cabeceras que YA existan en la hoja,
//   no asumen posiciones fijas de columna → no corrompen datos)
// ══════════════════════════════════════════════════════════════
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// Devuelve la hoja si existe; si no, la crea con las cabeceras indicadas.
// Si ya existe, NUNCA toca sus cabeceras actuales (evita corromper datos reales).
function getOrCreateSheet(name, headersIfNew) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headersIfNew);
  }
  return sheet;
}

function getHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
}

// Convierte todas las filas de una hoja en objetos {cabecera: valor},
// usando las cabeceras reales de la fila 1 (sea cual sea su orden).
function sheetToObjects(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const headers = getHeaders(sheet);
  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const out = [];
  rows.forEach(row => {
    const obj = {};
    let hasId = false;
    headers.forEach((h, i) => {
      if (!h) return;
      obj[h] = row[i];
      if (h === 'id' || h === 'workout_id') hasId = hasId || (row[i] !== '' && row[i] != null);
    });
    if (hasId || Object.values(obj).some(v => v !== '' && v != null)) out.push(obj);
  });
  return out;
}

function sameAthlete(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function toISODate(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'Europe/Madrid', 'yyyy-MM-dd');
  }
  return String(v).slice(0, 10);
}

// ══════════════════════════════════════════════════════════════
//  WORKOUTS — upsert por athlete+id, fecha SIEMPRE como texto
//  (evita el bug de desfase de zona horaria de Google Sheets)
// ══════════════════════════════════════════════════════════════
const WORKOUT_HEADERS = [
  'timestamp','athlete','workout_id','fecha','name','disc',
  'plan_dur','plan_dist','plan_pace','plan_tss','plan_if','plan_rpe',
  'comp_dur','comp_dist','comp_pace','comp_tss','comp_if','comp_rpe',
  'comp_fc_avg','comp_pw_avg','comp_rpe_mental',
  'intervals_json','desc','notes_priv','comm_pre','comm_post','full_json'
];
const WORKOUT_TEXT_COLS = ['fecha','plan_dur','plan_pace','comp_dur','comp_pace'];

function saveWorkout(athlete, data) {
  const sheet = getOrCreateSheet(SHEET_NAMES.workouts, WORKOUT_HEADERS);
  const headers = getHeaders(sheet);
  const idCol    = headers.indexOf('workout_id');
  const athCol   = headers.indexOf('athlete');
  const fechaStr = String(data.fecha || '').slice(0, 10);

  const all = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < all.length; i++) {
    if (idCol >= 0 && athCol >= 0 &&
        String(all[i][idCol]) === String(data.id) &&
        sameAthlete(all[i][athCol], athlete)) {
      targetRow = i + 1;
      break;
    }
  }

  const p = data.plan || {};
  const c = data.comp || {};
  const vals = {
    timestamp: new Date().toISOString(),
    athlete: athlete,
    workout_id: data.id,
    fecha: fechaStr,
    name: data.name || '',
    disc: data.disc || '',
    plan_dur: p.dur || '', plan_dist: p.dist || '', plan_pace: p.pace || '',
    plan_tss: p.tss || '', plan_if: p.if || '', plan_rpe: p.rpe || '',
    comp_dur: c.dur || '', comp_dist: c.dist || '', comp_pace: c.pace || '',
    comp_tss: c.tss || '', comp_if: c.if || '', comp_rpe: c.rpe || '',
    comp_fc_avg: c.fc_avg || '', comp_pw_avg: c.pw_avg || '', comp_rpe_mental: c.rpe_mental || '',
    intervals_json: JSON.stringify(data.intervals || []),
    desc: data.desc || '',
    notes_priv: data.notes_priv || '',
    comm_pre: data.comm_pre || '',
    comm_post: data.comm_post || '',
    full_json: JSON.stringify(data),
  };

  const row = headers.map(h => (vals[h] !== undefined ? vals[h] : ''));
  const target = targetRow > 0 ? targetRow : sheet.getLastRow() + 1;
  sheet.getRange(target, 1, 1, row.length).setValues([row]);

  // Fijar formato texto en columnas sensibles a fecha/duración (evita que
  // Sheets las reinterprete como Date/hora y las desfase).
  WORKOUT_TEXT_COLS.forEach(name => {
    const col = headers.indexOf(name) + 1;
    if (col > 0 && vals[name] !== '') {
      sheet.getRange(target, col).setNumberFormat('@').setValue(String(vals[name]));
    }
  });

  return { saved: true, updated: targetRow > 0, fecha: fechaStr };
}

function getWorkouts(athlete) {
  const sheet = getOrCreateSheet(SHEET_NAMES.workouts, WORKOUT_HEADERS);
  const rows = sheetToObjects(sheet).filter(r => sameAthlete(r.athlete, athlete));
  return rows.map(r => {
    const obj = rescueFullJson(r);
    if (obj) return obj;
    const out = Object.assign({}, r);
    if (out.id == null && out.workout_id != null) out.id = out.workout_id;
    if (out.fecha) out.fecha = String(out.fecha).slice(0, 10);
    return out;
  });
}

// Rescata el full_json aunque haya quedado desplazado a otra columna
// por versiones antiguas del frontend (bug histórico ya conocido).
function rescueFullJson(r) {
  const candidatos = [r.full_json, r.comp_rpe_mental, r.comm_post, r.notes_priv];
  for (let i = 0; i < candidatos.length; i++) {
    const v = candidatos[i];
    if (!v || typeof v !== 'string') continue;
    const s = v.trim();
    if (s.charAt(0) !== '{') continue;
    try {
      const o = JSON.parse(s);
      if (o && o.id != null) {
        if (o.fecha) o.fecha = String(o.fecha).slice(0, 10);
        return o;
      }
    } catch (e) {}
  }
  return null;
}

function deleteWorkout(athlete, id) {
  const sheet = getOrCreateSheet(SHEET_NAMES.workouts, WORKOUT_HEADERS);
  const headers = getHeaders(sheet);
  const idCol  = headers.indexOf('workout_id');
  const athCol = headers.indexOf('athlete');
  const all = sheet.getDataRange().getValues();
  for (let i = all.length - 1; i >= 1; i--) {
    if (idCol >= 0 && athCol >= 0 &&
        String(all[i][idCol]) === String(id) &&
        sameAthlete(all[i][athCol], athlete)) {
      sheet.deleteRow(i + 1);
      return { deleted: true };
    }
  }
  return { deleted: false, error: 'No encontrado' };
}

// ══════════════════════════════════════════════════════════════
//  WELLNESS — un registro por atleta/día (upsert), fecha en texto
// ══════════════════════════════════════════════════════════════
const WELLNESS_HEADERS = [
  'id','athlete','fecha',
  'sueno','energia','fatiga','mental','dolor','animo',
  'fc_rep','hrv','notes','comentario','total','full_json'
];

function getWellness(athlete) {
  const sheet = getOrCreateSheet(SHEET_NAMES.wellness, WELLNESS_HEADERS);
  return sheetToObjects(sheet)
    .filter(r => sameAthlete(r.athlete, athlete))
    .map(r => {
      const out = Object.assign({}, r);
      out.fecha = toISODate(out.fecha);
      return out;
    });
}

function saveWellness(athlete, data) {
  const sheet = getOrCreateSheet(SHEET_NAMES.wellness, WELLNESS_HEADERS);
  const headers = getHeaders(sheet);
  const athCol   = headers.indexOf('athlete');
  const fechaCol = headers.indexOf('fecha');
  const fechaStr = String(data.fecha || '').slice(0, 10);

  const total = Number(data.total) ||
    ((+data.sueno||0)+(+data.energia||0)+(+data.fatiga||0)+(+data.dolor||0)+(+data.animo||0));

  const vals = Object.assign({}, data, {
    athlete: athlete,
    fecha: fechaStr,
    total: total,
    full_json: JSON.stringify(data),
  });
  if (!vals.id) vals.id = 'well_' + athlete + '_' + fechaStr;

  const all = sheet.getDataRange().getValues();
  let targetRow = -1;
  if (athCol >= 0 && fechaCol >= 0) {
    for (let i = 1; i < all.length; i++) {
      const filaFecha = toISODate(all[i][fechaCol]);
      if (sameAthlete(all[i][athCol], athlete) && filaFecha === fechaStr) {
        targetRow = i + 1;
        break;
      }
    }
  }

  const row = headers.map(h => (vals[h] !== undefined ? vals[h] : ''));
  const target = targetRow > 0 ? targetRow : sheet.getLastRow() + 1;
  sheet.getRange(target, 1, 1, row.length).setValues([row]);

  const fechaColIdx = headers.indexOf('fecha') + 1;
  if (fechaColIdx > 0) sheet.getRange(target, fechaColIdx).setNumberFormat('@').setValue(fechaStr);

  return { saved: true, updated: targetRow > 0, fecha: fechaStr };
}

// ══════════════════════════════════════════════════════════════
//  SESIONES / CALENDARIO / TESTS — genéricos por athlete
// ══════════════════════════════════════════════════════════════
const SESSION_HEADERS  = ['id','athlete','fecha','disc','dist','time','pace','rpe','fc','notes','zona','cad','desnivel','series','vel','power','ua','full_json'];
const CAL_HEADERS      = ['id','athlete','fecha','fase','rpe','ua','nota','sessions','comp_name','comp_tipo','comp_lugar','full_json'];
const TEST_HEADERS     = ['id','athlete','fecha','tipo','resultado','unidad','vo2max','notas'];

function getSessions(athlete) {
  const sheet = getOrCreateSheet(SHEET_NAMES.sessions, SESSION_HEADERS);
  return sheetToObjects(sheet).filter(r => sameAthlete(r.athlete, athlete))
    .map(r => Object.assign({}, r, { fecha: toISODate(r.fecha) }));
}

function saveSession(athlete, data) {
  const sheet = getOrCreateSheet(SHEET_NAMES.sessions, SESSION_HEADERS);
  const headers = getHeaders(sheet);
  const vals = Object.assign({}, data, {
    athlete: athlete,
    fecha: String(data.fecha || '').slice(0, 10),
    id: data.id || ('ses_' + Date.now()),
    full_json: JSON.stringify(data),
  });
  const row = headers.map(h => (vals[h] !== undefined ? vals[h] : ''));
  sheet.appendRow(row);
  const fechaColIdx = headers.indexOf('fecha') + 1;
  if (fechaColIdx > 0) sheet.getRange(sheet.getLastRow(), fechaColIdx).setNumberFormat('@').setValue(vals.fecha);
  return { saved: true, id: vals.id };
}

function getCalendar(athlete) {
  const sheet = getOrCreateSheet(SHEET_NAMES.calendar, CAL_HEADERS);
  return sheetToObjects(sheet).filter(r => sameAthlete(r.athlete, athlete))
    .map(r => Object.assign({}, r, { fecha: toISODate(r.fecha) }));
}

function saveCalEvent(athlete, data) {
  const sheet = getOrCreateSheet(SHEET_NAMES.calendar, CAL_HEADERS);
  const headers = getHeaders(sheet);
  const athCol   = headers.indexOf('athlete');
  const idCol    = headers.indexOf('id');
  const fechaCol = headers.indexOf('fecha');
  const fechaStr = String(data.fecha || '').slice(0, 10);
  const vals = Object.assign({}, data, { athlete: athlete, fecha: fechaStr, full_json: JSON.stringify(data) });
  if (!vals.id) vals.id = 'cal_' + athlete + '_' + fechaStr;

  const all = sheet.getDataRange().getValues();
  let targetRow = -1;
  for (let i = 1; i < all.length; i++) {
    if (idCol >= 0 && String(all[i][idCol]) === String(vals.id)) { targetRow = i + 1; break; }
    if (targetRow < 0 && athCol >= 0 && fechaCol >= 0 &&
        sameAthlete(all[i][athCol], athlete) && toISODate(all[i][fechaCol]) === fechaStr) {
      targetRow = i + 1;
    }
  }
  const row = headers.map(h => (vals[h] !== undefined ? vals[h] : ''));
  const target = targetRow > 0 ? targetRow : sheet.getLastRow() + 1;
  sheet.getRange(target, 1, 1, row.length).setValues([row]);
  const fechaColIdx = headers.indexOf('fecha') + 1;
  if (fechaColIdx > 0) sheet.getRange(target, fechaColIdx).setNumberFormat('@').setValue(fechaStr);
  return { saved: true, id: vals.id };
}

function getTests(athlete) {
  const sheet = getOrCreateSheet(SHEET_NAMES.tests, TEST_HEADERS);
  return sheetToObjects(sheet).filter(r => sameAthlete(r.athlete, athlete))
    .map(r => Object.assign({}, r, { fecha: toISODate(r.fecha) }));
}

function saveTest(athlete, data) {
  const sheet = getOrCreateSheet(SHEET_NAMES.tests, TEST_HEADERS);
  const headers = getHeaders(sheet);
  const vals = Object.assign({}, data, {
    athlete: athlete,
    fecha: String(data.fecha || '').slice(0, 10),
    id: data.id || ('test_' + Date.now()),
  });
  const row = headers.map(h => (vals[h] !== undefined ? vals[h] : ''));
  sheet.appendRow(row);
  return { saved: true, id: vals.id };
}

// ══════════════════════════════════════════════════════════════
//  ATLETAS
// ══════════════════════════════════════════════════════════════
const ATHLETE_HEADERS = ['id','nombre','club','cat','nivel','email','full_json'];

function getAthletes() {
  const sheet = getOrCreateSheet(SHEET_NAMES.athletes, ATHLETE_HEADERS);
  return sheetToObjects(sheet).map(r => {
    let out = Object.assign({}, r);
    if (out.full_json && typeof out.full_json === 'string' && out.full_json.trim().startsWith('{')) {
      try { out = Object.assign({}, JSON.parse(out.full_json), { id: out.id, nombre: out.nombre }); } catch(e) {}
    }
    return out;
  }).filter(a => a.id);
}

function getAthleteById(id) {
  const list = getAthletes();
  return list.find(a => sameAthlete(a.id, id)) || null;
}

function saveAthlete(data) {
  const sheet = getOrCreateSheet(SHEET_NAMES.athletes, ATHLETE_HEADERS);
  const headers = getHeaders(sheet);
  const idCol = headers.indexOf('id');
  if (!data.id) data.id = (data.nombre || 'atleta').toLowerCase().replace(/[^a-z0-9]+/g,'');

  const vals = Object.assign({}, data, { full_json: JSON.stringify(data) });
  const row = headers.map(h => (vals[h] !== undefined ? vals[h] : ''));

  const all = sheet.getDataRange().getValues();
  let targetRow = -1;
  if (idCol >= 0) {
    for (let i = 1; i < all.length; i++) {
      if (String(all[i][idCol]) === String(data.id)) { targetRow = i + 1; break; }
    }
  }
  const target = targetRow > 0 ? targetRow : sheet.getLastRow() + 1;
  sheet.getRange(target, 1, 1, row.length).setValues([row]);
  return { saved: true, id: data.id };
}

// ══════════════════════════════════════════════════════════════
//  COMENTARIOS (chat coach ↔ atleta por entreno)
// ══════════════════════════════════════════════════════════════
const COMMENT_HEADERS = ['id','athlete','workout_id','from','text','timestamp'];

function getComments(athlete) {
  const sheet = getOrCreateSheet(SHEET_NAMES.comments, COMMENT_HEADERS);
  return sheetToObjects(sheet).filter(r => sameAthlete(r.athlete, athlete));
}

function saveComment(athlete, data) {
  const sheet = getOrCreateSheet(SHEET_NAMES.comments, COMMENT_HEADERS);
  const headers = getHeaders(sheet);
  const vals = Object.assign({}, data, {
    athlete: athlete,
    id: data.id || ('com_' + Date.now()),
    timestamp: data.timestamp || new Date().toISOString(),
  });
  const row = headers.map(h => (vals[h] !== undefined ? vals[h] : ''));
  sheet.appendRow(row);
  return { saved: true, id: vals.id };
}

// ══════════════════════════════════════════════════════════════
//  BIBLIOTECA DE PLANTILLAS
// ══════════════════════════════════════════════════════════════
const BIBLIOTECA_HEADERS = ['id','nombre','periodo','tipo','zona','full_json'];

function getBiblioteca() {
  const sheet = getOrCreateSheet(SHEET_NAMES.biblioteca, BIBLIOTECA_HEADERS);
  return sheetToObjects(sheet).map(r => {
    if (r.full_json && typeof r.full_json === 'string' && r.full_json.trim().startsWith('{')) {
      try { return Object.assign({}, JSON.parse(r.full_json), { id: r.id }); } catch(e) {}
    }
    return r;
  });
}

function saveBiblioteca(data) {
  const sheet = getOrCreateSheet(SHEET_NAMES.biblioteca, BIBLIOTECA_HEADERS);
  const headers = getHeaders(sheet);
  if (!data.id) data.id = 'tpl_' + Date.now();
  const vals = Object.assign({}, data, { full_json: JSON.stringify(data) });
  const row = headers.map(h => (vals[h] !== undefined ? vals[h] : ''));

  const all = sheet.getDataRange().getValues();
  const idCol = headers.indexOf('id');
  let targetRow = -1;
  if (idCol >= 0) {
    for (let i = 1; i < all.length; i++) {
      if (String(all[i][idCol]) === String(data.id)) { targetRow = i + 1; break; }
    }
  }
  const target = targetRow > 0 ? targetRow : sheet.getLastRow() + 1;
  sheet.getRange(target, 1, 1, row.length).setValues([row]);
  return { saved: true, id: data.id };
}

function deleteBiblioteca(id) {
  const sheet = getOrCreateSheet(SHEET_NAMES.biblioteca, BIBLIOTECA_HEADERS);
  const headers = getHeaders(sheet);
  const idCol = headers.indexOf('id');
  const all = sheet.getDataRange().getValues();
  for (let i = all.length - 1; i >= 1; i--) {
    if (idCol >= 0 && String(all[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { deleted: true };
    }
  }
  return { deleted: false };
}

// ══════════════════════════════════════════════════════════════
//  AUTENTICACIÓN (usada por index.html — la PWA del atleta)
// ══════════════════════════════════════════════════════════════
const AUTH_HEADERS = ['email','password','athleteId','created'];

function doLogin(email, password) {
  if (!email || !password) return { ok: false, error: 'Email y contraseña requeridos' };
  const sheet = getOrCreateSheet(SHEET_NAMES.auth, AUTH_HEADERS);
  const rows = sheetToObjects(sheet);
  const emailNorm = String(email).trim().toLowerCase();
  const match = rows.find(r => String(r.email||'').trim().toLowerCase() === emailNorm && String(r.password) === String(password));
  if (!match) return { ok: false, error: 'Email o contraseña incorrectos' };
  const profile = getAthleteById(match.athleteId);
  return { ok: true, athleteId: match.athleteId, profile: profile };
}

function doRegister(email, password, athleteId) {
  if (!email || !password || !athleteId) return { ok: false, error: 'Faltan datos' };
  const profile = getAthleteById(athleteId);
  if (!profile) return { ok: false, error: 'Tu coach aún no ha creado tu perfil de atleta (ID: ' + athleteId + ')' };

  const sheet = getOrCreateSheet(SHEET_NAMES.auth, AUTH_HEADERS);
  const rows = sheetToObjects(sheet);
  const emailNorm = String(email).trim().toLowerCase();
  if (rows.some(r => String(r.email||'').trim().toLowerCase() === emailNorm)) {
    return { ok: false, error: 'Ya existe una cuenta con ese email' };
  }
  sheet.appendRow([email, password, athleteId, new Date().toISOString()]);
  return { ok: true, athleteId: athleteId, profile: profile };
}

function setAthletePassword(athleteId, password) {
  const sheet = getOrCreateSheet(SHEET_NAMES.auth, AUTH_HEADERS);
  const headers = getHeaders(sheet);
  const idCol = headers.indexOf('athleteId');
  const pwCol = headers.indexOf('password');
  const all = sheet.getDataRange().getValues();
  for (let i = 1; i < all.length; i++) {
    if (idCol >= 0 && String(all[i][idCol]) === String(athleteId)) {
      sheet.getRange(i + 1, pwCol + 1).setValue(password);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Atleta no encontrado en Auth' };
}

// ══════════════════════════════════════════════════════════════
//  GARMIN — datos diarios sincronizados automáticamente
//  (sueño, HRV, Body Battery, FC reposo, actividades)
// ══════════════════════════════════════════════════════════════
const GARMIN_HEADERS = [
  'id','athlete','fecha',
  'sleep_score','sleep_total_min','sleep_deep_min','sleep_light_min','sleep_rem_min','sleep_awake_min',
  'sleep_start','sleep_end',
  'hrv_last_night_avg','rhr',
  'body_battery_min','body_battery_max',
  'actividades_json','full_json'
];

function saveGarmin(athlete, data) {
  const sheet   = getOrCreateSheet(SHEET_NAMES.garmin, GARMIN_HEADERS);
  const headers = getHeaders(sheet);
  const fechaStr = String(data.fecha || '').slice(0, 10);
  const id = 'garmin_' + athlete + '_' + fechaStr;

  // Buscamos si ya hay fila para ese día, y recogemos lo que ya tenía
  // guardado (para no perder sueño/HRV si ahora solo llegan actividades, o
  // viceversa).
  const idCol = headers.indexOf('id');
  const all = sheet.getDataRange().getValues();
  let targetRow = -1;
  let existingObj = {};
  if (idCol >= 0) {
    for (let i = 1; i < all.length; i++) {
      if (String(all[i][idCol]) === String(id)) {
        targetRow = i + 1;
        headers.forEach((h, idx) => { if (h) existingObj[h] = all[i][idx]; });
        break;
      }
    }
  }

  // Actividades: combinamos las nuevas con las que ya hubiera, sin duplicar.
  let mergedActs = [];
  try { mergedActs = JSON.parse(existingObj.actividades_json || '[]'); } catch(e) {}
  if (data.actividades) {
    const seen = new Set(mergedActs.map(a => JSON.stringify(a)));
    data.actividades.forEach(a => {
      const key = JSON.stringify(a);
      if (!seen.has(key)) { mergedActs.push(a); seen.add(key); }
    });
  }

  const vals = Object.assign({}, existingObj, data, {
    athlete: athlete,
    fecha: fechaStr,
    id: id,
    actividades_json: JSON.stringify(mergedActs),
    full_json: JSON.stringify(Object.assign({}, existingObj, data, { actividades: mergedActs })),
  });

  const row = headers.map(h => (vals[h] !== undefined ? vals[h] : ''));
  const target = targetRow > 0 ? targetRow : sheet.getLastRow() + 1;
  sheet.getRange(target, 1, 1, row.length).setValues([row]);

  // Fijar como texto la fecha y las horas de sueño (evita que Sheets las
  // reinterprete como Date y las desfase, el mismo bug de antes).
  ['fecha', 'sleep_start', 'sleep_end'].forEach(name => {
    const col = headers.indexOf(name) + 1;
    if (col > 0 && vals[name] !== '' && vals[name] != null) {
      sheet.getRange(target, col).setNumberFormat('@').setValue(String(vals[name]));
    }
  });

  return { saved: true, id: id, updated: targetRow > 0 };
}

function getGarmin(athlete) {
  const sheet = getOrCreateSheet(SHEET_NAMES.garmin, GARMIN_HEADERS);
  return sheetToObjects(sheet)
    .filter(r => sameAthlete(r.athlete, athlete))
    .map(r => Object.assign({}, r, { fecha: toISODate(r.fecha) }));
}
