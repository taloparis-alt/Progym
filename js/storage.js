const USER_KEY = "progym_user_v1";
const ROUTINES_KEY = "progym_routines_v1";
const ACTIVE_ROUTINE_KEY = "progym_active_routine_v1";
const LOGS_KEY = "progym_logs_v3";
const BODYWEIGHT_KEY = "progym_bodyweight_v1";

function uid(prefix = "id") {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- Usuario ---------- */

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (e) {
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/* ---------- Rutinas ---------- */

function getRoutines() {
  try {
    return JSON.parse(localStorage.getItem(ROUTINES_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveRoutines(routines) {
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
}

function getRoutine(routineId) {
  return getRoutines().find((r) => r.id === routineId) || null;
}

function upsertRoutine(routine) {
  const routines = getRoutines();
  const idx = routines.findIndex((r) => r.id === routine.id);
  if (idx === -1) routines.push(routine);
  else routines[idx] = routine;
  saveRoutines(routines);
}

function deleteRoutine(routineId) {
  saveRoutines(getRoutines().filter((r) => r.id !== routineId));
  if (getActiveRoutineId() === routineId) {
    const remaining = getRoutines();
    setActiveRoutineId(remaining.length ? remaining[0].id : null);
  }
}

function duplicateRoutine(routineId, newName) {
  const original = getRoutine(routineId);
  if (!original) return null;
  const copy = deepCloneWithNewIds(original);
  copy.nombre = newName;
  upsertRoutine(copy);
  return copy;
}

function deepCloneWithNewIds(routine) {
  return {
    ...routine,
    id: uid("rutina"),
    dias: routine.dias.map((dia) => ({
      ...dia,
      id: uid("dia"),
      movilidad: {
        ...dia.movilidad,
        ejercicios: dia.movilidad.ejercicios.map((e) => ({ ...e, id: uid("ej") })),
      },
      zonaMedia: {
        ...dia.zonaMedia,
        ejercicios: dia.zonaMedia.ejercicios.map((e) => ({ ...e, id: uid("ej") })),
      },
      bloques: dia.bloques.map((b) => ({
        ...b,
        id: uid("bloque"),
        ejercicios: b.ejercicios.map((e) => ({ ...e, id: uid("ej") })),
      })),
    })),
  };
}

function getActiveRoutineId() {
  return localStorage.getItem(ACTIVE_ROUTINE_KEY) || null;
}

function setActiveRoutineId(routineId) {
  if (routineId) localStorage.setItem(ACTIVE_ROUTINE_KEY, routineId);
  else localStorage.removeItem(ACTIVE_ROUTINE_KEY);
}

function getActiveRoutine() {
  const id = getActiveRoutineId();
  return id ? getRoutine(id) : null;
}

function createEmptyRoutine(nombre) {
  return {
    id: uid("rutina"),
    nombre,
    profesor: "",
    telefono: "",
    creadaEn: todayISO(),
    dias: [],
  };
}

function createEmptyDia(nombre) {
  return {
    id: uid("dia"),
    nombre,
    movilidad: { series: 1, ejercicios: [] },
    zonaMedia: { series: 2, ejercicios: [] },
    bloques: [],
  };
}

function createEmptyBloque(nombre) {
  return { id: uid("bloque"), nombre, series: 3, nota: "", ejercicios: [] };
}

function createEmptyEjercicio() {
  return { id: uid("ej"), nombre: "", target: "" };
}

/* ---------- Registros de progreso (por rutina) ---------- */

function getLogs() {
  try {
    return JSON.parse(localStorage.getItem(LOGS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveLogs(logs) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

function getEntry(routineId, date, exerciseId) {
  const logs = getLogs();
  return logs?.[routineId]?.[date]?.[exerciseId] || { peso: "", hecho: "", nota: "" };
}

function setEntry(routineId, date, exerciseId, field, value) {
  const logs = getLogs();
  if (!logs[routineId]) logs[routineId] = {};
  if (!logs[routineId][date]) logs[routineId][date] = {};
  if (!logs[routineId][date][exerciseId]) {
    logs[routineId][date][exerciseId] = { peso: "", hecho: "", nota: "" };
  }
  logs[routineId][date][exerciseId][field] = value;
  saveLogs(logs);
}

function getHistoryForExercise(routineId, exerciseId) {
  const logs = getLogs();
  const routineLogs = logs[routineId] || {};
  return Object.keys(routineLogs)
    .filter((date) => routineLogs[date][exerciseId])
    .sort()
    .map((date) => ({ date, ...routineLogs[date][exerciseId] }));
}

function getLastKnownForExercise(routineId, exerciseId, beforeDate) {
  const history = getHistoryForExercise(routineId, exerciseId).filter((h) => h.date < beforeDate);
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].peso) return history[i];
  }
  return null;
}

function diaEjercicioIds(dia) {
  return [
    ...dia.movilidad.ejercicios,
    ...dia.zonaMedia.ejercicios,
    ...dia.bloques.flatMap((b) => b.ejercicios),
  ].map((e) => e.id);
}

function getSessionDatesForDia(routineId, dia) {
  const exerciseIds = diaEjercicioIds(dia);
  const logs = getLogs();
  const routineLogs = logs[routineId] || {};
  return Object.keys(routineLogs)
    .filter((date) => exerciseIds.some((exId) => routineLogs[date][exId]))
    .sort()
    .reverse();
}

function getSessionForDiaDate(routineId, dia, date) {
  const logs = getLogs();
  const dayEntries = (logs[routineId] && logs[routineId][date]) || {};
  const buildSection = (title, ejercicios) => ({
    title,
    items: ejercicios.filter((e) => dayEntries[e.id]).map((e) => ({ nombre: e.nombre, ...dayEntries[e.id] })),
  });
  const sections = [
    buildSection("Movilidad", dia.movilidad.ejercicios),
    buildSection("Zona media", dia.zonaMedia.ejercicios),
    ...dia.bloques.map((b) => buildSection(b.nombre, b.ejercicios)),
  ];
  return sections.filter((s) => s.items.length);
}

/* ---------- Peso corporal (global, no depende de la rutina) ---------- */

function getBodyweightLog() {
  try {
    return JSON.parse(localStorage.getItem(BODYWEIGHT_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function setBodyweightEntry(date, kg) {
  const log = getBodyweightLog();
  const idx = log.findIndex((e) => e.date === date);
  if (kg === "" || kg === null) {
    if (idx !== -1) log.splice(idx, 1);
  } else if (idx !== -1) {
    log[idx].kg = kg;
  } else {
    log.push({ date, kg });
  }
  log.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(BODYWEIGHT_KEY, JSON.stringify(log));
}

function getBodyweightForDate(date) {
  const log = getBodyweightLog();
  const entry = log.find((e) => e.date === date);
  return entry ? entry.kg : "";
}

/* ---------- Backup ---------- */

function exportData() {
  return JSON.stringify(
    {
      user: getUser(),
      routines: getRoutines(),
      activeRoutineId: getActiveRoutineId(),
      logs: getLogs(),
      bodyweight: getBodyweightLog(),
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

function importData(jsonString) {
  const data = JSON.parse(jsonString);
  if (data.user) saveUser(data.user);
  if (data.routines) saveRoutines(data.routines);
  if (data.activeRoutineId) setActiveRoutineId(data.activeRoutineId);
  if (data.logs) saveLogs(data.logs);
  if (data.bodyweight) localStorage.setItem(BODYWEIGHT_KEY, JSON.stringify(data.bodyweight));
}
