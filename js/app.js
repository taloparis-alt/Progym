const state = {
  view: "rutina",
  diaId: null,
  fecha: todayISO(),
  progressRoutineId: null,
  progressExerciseId: null,
  progressTab: "ejercicio",
  configScreen: "list",
  configRoutineId: null,
};

let lastKnownFechaAuto = state.fecha;

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const today = todayISO();
  if (state.fecha === lastKnownFechaAuto && lastKnownFechaAuto !== today) {
    state.fecha = today;
    lastKnownFechaAuto = today;
    if (state.view === "rutina") renderRutina();
  } else {
    lastKnownFechaAuto = today;
  }
});

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function armConfirm(btn, action) {
  if (btn.dataset.confirming === "1") {
    clearTimeout(Number(btn.dataset.confirmTimer));
    action();
    return;
  }
  btn.dataset.confirming = "1";
  if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
  btn.textContent = "¿Seguro? Tocá de nuevo";
  btn.classList.add("confirm-armed");
  const timer = setTimeout(() => {
    btn.dataset.confirming = "0";
    btn.textContent = btn.dataset.originalText;
    btn.classList.remove("confirm-armed");
  }, 3500);
  btn.dataset.confirmTimer = String(timer);
}

function showInlineError(container, message) {
  let el = container.querySelector(".inline-error");
  if (!el) {
    el = document.createElement("p");
    el.className = "inline-error";
    container.appendChild(el);
  }
  el.textContent = message;
  clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(setTimeout(() => el.remove(), 5000));
}

/* ================= Onboarding ================= */

function renderOnboarding() {
  $("#app-header").classList.add("hidden");
  $("#main-nav").classList.add("hidden");
  $("#view-rutina").classList.add("hidden");
  $("#view-progreso").classList.add("hidden");
  $("#view-config").classList.add("hidden");
  $("#view-onboarding").classList.remove("hidden");
  $("#view-onboarding").innerHTML = `
    <div class="onboarding">
      <h1>PROGYM</h1>
      <p class="subtitle">Seguimiento de tu progreso en el gimnasio</p>
      <div class="onboarding-card">
        <label>¿Cómo te llamás?
          <input type="text" id="onboarding-name" placeholder="Tu nombre" autofocus>
        </label>
        <button id="onboarding-start">Comenzar</button>
      </div>
    </div>
  `;

  const start = () => {
    const input = $("#onboarding-name");
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    saveUser({ nombre: name, creadoEn: todayISO() });
    if (!getRoutines().length) {
      const routine = buildDefaultRoutineTemplate();
      upsertRoutine(routine);
      setActiveRoutineId(routine.id);
    }
    bootApp();
  };

  $("#onboarding-start").addEventListener("click", start);
  $("#onboarding-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") start();
  });
}

/* ================= Rutina (vista de registro) ================= */

function exerciseRowHtml(routineId, exercise) {
  const entry = getEntry(routineId, state.fecha, exercise.id);
  const last = getLastKnownForExercise(routineId, exercise.id, state.fecha);
  const prevCompact = last ? `${last.peso} - ${last.hecho || "-"}` : "—";
  return `
    <div class="set-labels">
      <span>Kg</span>
      <span>Reps</span>
      <span>Anterior</span>
      <span></span>
    </div>
    <div class="set-row" data-exercise="${exercise.id}">
      <input type="number" inputmode="decimal" step="0.5" class="input-peso" placeholder="kg" value="${escAttr(entry.peso)}">
      <input type="text" class="input-hecho" placeholder="${escAttr(exercise.target)}" value="${escAttr(entry.hecho)}">
      <span class="prev-compact">${prevCompact}</span>
      <button type="button" class="btn-save-row" data-exercise="${exercise.id}">Guardar</button>
    </div>
  `;
}

function exerciseCardHtml(routineId, exercise) {
  return `
    <div class="exercise">
      <div class="exercise-head">
        <span class="ex-name">${exercise.nombre}</span>
        <div class="ex-head-right">
          <span class="ex-target">${exercise.target}</span>
          <button class="btn-chart" data-goto="${exercise.id}" data-goto-routine="${routineId}" title="Ver progreso">📈</button>
        </div>
      </div>
      ${exerciseRowHtml(routineId, exercise)}
    </div>
  `;
}

function sectionCardHtml(routineId, title, seriesLabel, ejercicios, extraClass = "") {
  if (!ejercicios.length) {
    return `
      <section class="pill-card ${extraClass}">
        <h3>${title}</h3>
        <p class="series-label">${seriesLabel}</p>
        <p class="empty-note">Sin ejercicios cargados. Sumalos desde "Mis rutinas".</p>
      </section>
    `;
  }
  return `
    <section class="pill-card ${extraClass}">
      <h3>${title}</h3>
      <p class="series-label">${seriesLabel}</p>
      ${ejercicios.map((e) => exerciseCardHtml(routineId, e)).join("")}
    </section>
  `;
}

function renderRutina() {
  const root = $("#view-rutina");
  const routine = getActiveRoutine();

  if (!routine || !routine.dias.length) {
    root.innerHTML = `
      <div class="empty-state">
        <p>${routine ? "Esta rutina todavía no tiene días cargados." : "Todavía no tenés una rutina activa."}</p>
        <button id="go-config">Ir a Mis rutinas</button>
      </div>
    `;
    $("#go-config").addEventListener("click", () => {
      state.view = "config";
      state.configScreen = routine ? "editor" : "list";
      state.configRoutineId = routine ? routine.id : null;
      renderAll();
    });
    return;
  }

  if (!state.diaId || !routine.dias.find((d) => d.id === state.diaId)) {
    state.diaId = routine.dias[0].id;
  }
  const dia = routine.dias.find((d) => d.id === state.diaId);
  const bwToday = getBodyweightForDate(state.fecha);

  root.innerHTML = `
    <p class="active-routine-label">${routine.nombre}</p>
    <div class="day-tabs">
      ${routine.dias
        .map((d) => `<button class="day-tab ${d.id === state.diaId ? "active" : ""}" data-dia="${d.id}">${d.nombre}</button>`)
        .join("")}
    </div>

    <div class="date-bar">
      <label>Fecha
        <input type="date" id="fecha-input" value="${state.fecha}">
      </label>
      <label>Peso corporal (kg)
        <input type="number" step="0.1" id="bw-input" placeholder="ej: 78.5" value="${escAttr(bwToday)}">
      </label>
    </div>

    <div class="two-col">
      ${sectionCardHtml(routine.id, "Movilidad", `(${dia.movilidad.series} serie${dia.movilidad.series > 1 ? "s" : ""})`, dia.movilidad.ejercicios, "card-movilidad")}
      ${sectionCardHtml(routine.id, "Zona media", `(${dia.zonaMedia.series} series)`, dia.zonaMedia.ejercicios, "card-zonamedia")}
    </div>

    ${
      dia.bloques.length
        ? `<h2 class="section-title">Trabajo principal</h2>
           <div class="bloques-grid">
             ${dia.bloques
               .map((b) =>
                 sectionCardHtml(routine.id, b.nombre, b.nota ? `(${b.nota})` : `(${b.series} series)`, b.ejercicios, "card-bloque")
               )
               .join("")}
           </div>`
        : ""
    }

    <button type="button" id="btn-save-session" class="btn-save-session">Guardar sesión completa</button>
  `;

  $$(".day-tab", root).forEach((btn) =>
    btn.addEventListener("click", () => {
      state.diaId = btn.dataset.dia;
      renderRutina();
    })
  );

  const currentFecha = () => $("#fecha-input", root).value || state.fecha || todayISO();

  $("#fecha-input", root).addEventListener("change", (e) => {
    state.fecha = e.target.value || todayISO();
    renderRutina();
  });
  $("#fecha-input", root).addEventListener("input", (e) => {
    state.fecha = e.target.value || todayISO();
  });

  $("#bw-input", root).addEventListener("change", (e) => {
    setBodyweightEntry(currentFecha(), e.target.value === "" ? "" : Number(e.target.value));
  });

  $$(".input-peso, .input-hecho", root).forEach((input) => {
    input.addEventListener("change", (e) => {
      const row = e.target.closest(".set-row");
      const field = e.target.classList.contains("input-peso") ? "peso" : "hecho";
      const value = field === "peso" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value;
      setEntry(routine.id, currentFecha(), row.dataset.exercise, field, value);
      flashSaved(row);
    });
  });

  $$(".btn-save-row", root).forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest(".set-row");
      const pesoInput = row.querySelector(".input-peso");
      const hechoInput = row.querySelector(".input-hecho");
      const filled = fillDefaults(pesoInput.value, hechoInput.value, hechoInput.placeholder);
      const original = btn.textContent;
      if (!filled) {
        btn.textContent = "Nada para guardar";
        btn.classList.add("empty-flash");
        clearTimeout(Number(btn.dataset.savedTimer));
        btn.dataset.savedTimer = String(
          setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove("empty-flash");
          }, 1500)
        );
        return;
      }
      pesoInput.value = filled.peso;
      hechoInput.value = filled.hecho;
      setEntry(routine.id, currentFecha(), row.dataset.exercise, "peso", filled.peso);
      setEntry(routine.id, currentFecha(), row.dataset.exercise, "hecho", filled.hecho);
      flashSaved(row);
      btn.textContent = "✓ Guardado";
      btn.classList.add("saved-flash");
      clearTimeout(Number(btn.dataset.savedTimer));
      btn.dataset.savedTimer = String(
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove("saved-flash");
        }, 1500)
      );
    });
  });

  $$(".btn-chart", root).forEach((btn) =>
    btn.addEventListener("click", () => {
      state.view = "progreso";
      state.progressTab = "ejercicio";
      state.progressRoutineId = btn.dataset.gotoRoutine;
      state.progressExerciseId = btn.dataset.goto;
      renderAll();
    })
  );

  $("#btn-save-session", root).addEventListener("click", () => {
    let count = 0;
    const fecha = currentFecha();
    $$(".set-row", root).forEach((row) => {
      const pesoInput = row.querySelector(".input-peso");
      const hechoInput = row.querySelector(".input-hecho");
      const peso = pesoInput.value === "" ? 0 : Number(pesoInput.value);
      const hecho = hechoInput.value === "" ? hechoInput.placeholder : hechoInput.value;
      pesoInput.value = peso;
      hechoInput.value = hecho;
      setEntry(routine.id, fecha, row.dataset.exercise, "peso", peso);
      setEntry(routine.id, fecha, row.dataset.exercise, "hecho", hecho);
      flashSaved(row);
      count++;
    });
    const btn = $("#btn-save-session", root);
    const original = btn.textContent;
    btn.textContent = `✓ Sesión guardada (${count} ejercicio${count === 1 ? "" : "s"})`;
    btn.classList.add("saved-flash");
    clearTimeout(Number(btn.dataset.savedTimer));
    btn.dataset.savedTimer = String(
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("saved-flash", "empty-flash");
      }, 2200)
    );
  });
}

function fillDefaults(pesoValue, hechoValue, target) {
  if (pesoValue === "" && hechoValue === "") return null;
  return {
    peso: pesoValue === "" ? 0 : Number(pesoValue),
    hecho: hechoValue === "" ? target : hechoValue,
  };
}

function flashSaved(row) {
  row.classList.add("saved");
  setTimeout(() => row.classList.remove("saved"), 600);
}

/* ================= Progreso ================= */

function exercisesOfRoutine(routine) {
  const list = [];
  routine.dias.forEach((dia) => {
    dia.movilidad.ejercicios.forEach((e) => list.push({ ...e, diaNombre: dia.nombre, seccion: "Movilidad" }));
    dia.zonaMedia.ejercicios.forEach((e) => list.push({ ...e, diaNombre: dia.nombre, seccion: "Zona media" }));
    dia.bloques.forEach((b) => {
      b.ejercicios.forEach((e) => list.push({ ...e, diaNombre: dia.nombre, seccion: b.nombre }));
    });
  });
  return list;
}

function renderProgreso() {
  const root = $("#view-progreso");
  const routines = getRoutines();

  if (!routines.length) {
    root.innerHTML = `<div class="empty-state"><p>Todavía no creaste ninguna rutina.</p></div>`;
    return;
  }

  if (!state.progressRoutineId || !getRoutine(state.progressRoutineId)) {
    state.progressRoutineId = getActiveRoutineId() || routines[0].id;
  }
  const routine = getRoutine(state.progressRoutineId);
  const exercises = exercisesOfRoutine(routine);
  if (!exercises.find((e) => e.id === state.progressExerciseId)) {
    state.progressExerciseId = exercises.length ? exercises[0].id : null;
  }

  const routineOptionsHtml = routines
    .map((r) => `<option value="${r.id}" ${r.id === routine.id ? "selected" : ""}>${r.nombre}</option>`)
    .join("");

  const byDia = {};
  exercises.forEach((e) => {
    if (!byDia[e.diaNombre]) byDia[e.diaNombre] = [];
    byDia[e.diaNombre].push(e);
  });

  const exerciseOptionsHtml = Object.entries(byDia)
    .map(
      ([diaNombre, list]) => `
      <optgroup label="${diaNombre}">
        ${list
          .map(
            (e) =>
              `<option value="${e.id}" ${e.id === state.progressExerciseId ? "selected" : ""}>${e.seccion} · ${e.nombre}</option>`
          )
          .join("")}
      </optgroup>`
    )
    .join("");

  root.innerHTML = `
    <div class="progress-tabs">
      <button class="progress-tab ${state.progressTab === "ejercicio" ? "active" : ""}" data-tab="ejercicio">Por ejercicio</button>
      <button class="progress-tab ${state.progressTab === "peso" ? "active" : ""}" data-tab="peso">Peso corporal</button>
    </div>

    <div id="progress-ejercicio" class="${state.progressTab === "ejercicio" ? "" : "hidden"}">
      <label class="ex-select-label">Rutina
        <select id="progress-routine-select">${routineOptionsHtml}</select>
      </label>
      ${
        exercises.length
          ? `<label class="ex-select-label">Ejercicio
              <select id="progress-select">${exerciseOptionsHtml}</select>
            </label>
            <div class="pill-card chart-card">
              <div id="progress-chart"></div>
            </div>
            <div id="progress-table"></div>`
          : `<p class="empty-note">Esta rutina no tiene ejercicios cargados todavía.</p>`
      }
    </div>

    <div id="progress-peso" class="${state.progressTab === "peso" ? "" : "hidden"}">
      <div class="pill-card chart-card">
        <div id="bw-chart"></div>
      </div>
      <div id="bw-table"></div>
    </div>
  `;

  $$(".progress-tab", root).forEach((btn) =>
    btn.addEventListener("click", () => {
      state.progressTab = btn.dataset.tab;
      renderProgreso();
    })
  );

  const routineSelect = $("#progress-routine-select", root);
  if (routineSelect) {
    routineSelect.addEventListener("change", (e) => {
      state.progressRoutineId = e.target.value;
      state.progressExerciseId = null;
      renderProgreso();
    });
  }

  const exerciseSelect = $("#progress-select", root);
  if (exerciseSelect) {
    exerciseSelect.addEventListener("change", (e) => {
      state.progressExerciseId = e.target.value;
      renderProgreso();
    });
  }

  if (state.progressTab === "ejercicio" && exercises.length) {
    renderExerciseProgress(routine.id, exercises);
  } else if (state.progressTab === "peso") {
    renderBodyweightProgress();
  }
}

function renderExerciseProgress(routineId) {
  const exercise = getRoutine(routineId) && exercisesOfRoutine(getRoutine(routineId)).find((e) => e.id === state.progressExerciseId);
  if (!exercise) return;
  const history = getHistoryForExercise(routineId, state.progressExerciseId);

  const points = history
    .map((h) => ({ x: h.date, y: Number(h.peso) }))
    .filter((p) => !isNaN(p.y) && p.y > 0);

  drawLineChart($("#progress-chart"), points);

  const table = $("#progress-table");
  if (!history.length) {
    table.innerHTML = `<p class="chart-empty">Registrá pesos en "${exercise.nombre}" para ver el historial acá.</p>`;
    return;
  }

  table.innerHTML = `
    <table class="history-table">
      <thead><tr><th>Fecha</th><th>Peso</th><th>Realizado</th></tr></thead>
      <tbody>
        ${history
          .slice()
          .reverse()
          .map(
            (h) => `
            <tr>
              <td>${h.date}</td>
              <td>${h.peso || "-"}kg</td>
              <td>${h.hecho || "-"}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderBodyweightProgress() {
  const log = getBodyweightLog();
  const points = log.map((e) => ({ x: e.date, y: Number(e.kg) }));
  drawLineChart($("#bw-chart"), points);

  const table = $("#bw-table");
  if (!log.length) {
    table.innerHTML = `<p class="chart-empty">Cargá tu peso corporal desde la pestaña Rutina para ver el progreso acá.</p>`;
    return;
  }
  table.innerHTML = `
    <table class="history-table">
      <thead><tr><th>Fecha</th><th>Peso (kg)</th></tr></thead>
      <tbody>
        ${log
          .slice()
          .reverse()
          .map((e) => `<tr><td>${e.date}</td><td>${e.kg}</td></tr>`)
          .join("")}
      </tbody>
    </table>
  `;
}

/* ================= Mis rutinas (config) ================= */

function renderConfig() {
  const root = $("#view-config");
  if (state.configScreen === "editor" && state.configRoutineId && getRoutine(state.configRoutineId)) {
    root.innerHTML = configEditorHtml(getRoutine(state.configRoutineId));
    wireConfigEditor();
  } else {
    state.configScreen = "list";
    root.innerHTML = configListHtml();
    wireConfigList();
  }
}

function configListHtml() {
  const routines = getRoutines();
  const activeId = getActiveRoutineId();

  return `
    <div class="routine-list">
      ${
        routines.length
          ? routines
              .map(
                (r) => `
            <div class="routine-card ${r.id === activeId ? "active" : ""}">
              <div class="routine-card-head">
                <span class="routine-name">${r.nombre}</span>
                ${r.id === activeId ? '<span class="badge-active">Activa</span>' : ""}
              </div>
              <p class="routine-meta">${r.dias.length} día${r.dias.length === 1 ? "" : "s"}</p>
              <div class="routine-actions">
                ${r.id === activeId ? "" : `<button data-action="activar" data-id="${r.id}">Usar</button>`}
                <button data-action="editar" data-id="${r.id}">Editar</button>
                <button data-action="duplicar" data-id="${r.id}">Duplicar</button>
                <button data-action="eliminar" data-id="${r.id}" class="danger">Eliminar</button>
              </div>
            </div>`
              )
              .join("")
          : `<p class="empty-note">Todavía no tenés ninguna rutina creada.</p>`
      }
    </div>

    <div class="pill-card new-routine-card">
      <h3>Nueva rutina</h3>
      <label class="ex-select-label">Nombre
        <input type="text" id="new-routine-name" placeholder="Ej: Plan Agosto - Septiembre">
      </label>
      <div class="new-routine-actions">
        <button id="btn-new-blank">Crear en blanco</button>
        <label class="btn-import">Cargar desde PDF<input type="file" id="file-import-pdf" accept="application/pdf" hidden></label>
        <label class="btn-import">Importar rutina (.json)<input type="file" id="file-import-routine" accept="application/json" hidden></label>
      </div>
      <p class="hint-text">"Cargar desde PDF" lee el archivo del plan y arma los días, bloques y ejercicios automáticamente. Después revisás todo en el editor por si algo quedó mal leído.</p>
      <p id="pdf-loading-note" class="hint-text hidden">Leyendo el PDF...</p>
    </div>

    <div class="pill-card backup-card">
      <h3>Respaldo de datos</h3>
      <p class="hint-text">Incluye tus rutinas, registros de progreso y peso corporal.</p>
      <div class="new-routine-actions">
        <button id="btn-export">Exportar todo</button>
        <label class="btn-import">Importar todo (.json)<input type="file" id="file-import-backup" accept="application/json" hidden></label>
      </div>
    </div>
  `;
}

function wireConfigList() {
  const root = $("#view-config");

  $$("[data-action]", root).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === "activar") {
        setActiveRoutineId(id);
        state.diaId = null;
        renderAll();
      } else if (action === "editar") {
        state.configScreen = "editor";
        state.configRoutineId = id;
        renderConfig();
      } else if (action === "duplicar") {
        const original = getRoutine(id);
        duplicateRoutine(id, `${original.nombre} (copia)`);
        renderConfig();
      } else if (action === "eliminar") {
        armConfirm(btn, () => {
          deleteRoutine(id);
          renderConfig();
        });
      }
    });
  });

  $("#btn-new-blank", root).addEventListener("click", () => {
    const nameInput = $("#new-routine-name", root);
    const nombre = nameInput.value.trim() || "Nueva rutina";
    const routine = createEmptyRoutine(nombre);
    upsertRoutine(routine);
    state.configScreen = "editor";
    state.configRoutineId = routine.id;
    renderConfig();
  });

  $("#file-import-pdf", root).addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const loadingNote = $("#pdf-loading-note", root);
    loadingNote.classList.remove("hidden");
    try {
      const routine = await extractRoutineFromPdf(file);
      upsertRoutine(routine);
      state.configScreen = "editor";
      state.configRoutineId = routine.id;
      renderConfig();
    } catch (err) {
      loadingNote.classList.add("hidden");
      showInlineError($(".new-routine-card", root), "No se pudo leer el PDF: " + err.message);
    }
  });

  $("#file-import-routine", root).addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        const routine = normalizeImportedRoutine(raw, file.name.replace(/\.json$/i, ""));
        upsertRoutine(routine);
        state.configScreen = "editor";
        state.configRoutineId = routine.id;
        renderConfig();
      } catch (err) {
        showInlineError($(".new-routine-card", root), "No se pudo importar la rutina: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  $("#btn-export", root).addEventListener("click", () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `progym-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $("#file-import-backup", root).addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(reader.result);
        renderAll();
      } catch (err) {
        showInlineError($(".backup-card", root), "No se pudo importar el archivo: " + err.message);
      }
    };
    reader.readAsText(file);
  });
}

function normalizeImportedRoutine(raw, fallbackName) {
  const dias = Array.isArray(raw.dias) ? raw.dias : [];
  const normEj = (e) => ({ id: uid("ej"), nombre: e.nombre || "", target: e.target || "" });
  return {
    id: uid("rutina"),
    nombre: raw.nombre || fallbackName || "Rutina importada",
    profesor: raw.profesor || "",
    telefono: raw.telefono || "",
    creadaEn: todayISO(),
    dias: dias.map((dia, i) => ({
      id: uid("dia"),
      nombre: dia.nombre || `Día ${i + 1}`,
      movilidad: {
        series: Number(dia.movilidad?.series) || 1,
        ejercicios: (dia.movilidad?.ejercicios || []).map(normEj),
      },
      zonaMedia: {
        series: Number(dia.zonaMedia?.series) || 1,
        ejercicios: (dia.zonaMedia?.ejercicios || []).map(normEj),
      },
      bloques: (dia.bloques || []).map((b, bi) => ({
        id: uid("bloque"),
        nombre: b.nombre || `Bloque ${bi + 1}`,
        series: Number(b.series) || 3,
        nota: b.nota || "",
        ejercicios: (b.ejercicios || []).map(normEj),
      })),
    })),
  };
}

function ejerciciosArrayOf(dia, seccionKey) {
  if (seccionKey === "movilidad") return dia.movilidad.ejercicios;
  if (seccionKey === "zonaMedia") return dia.zonaMedia.ejercicios;
  return dia.bloques.find((b) => b.id === seccionKey).ejercicios;
}

function editorEjercicioRowHtml(diaId, seccionKey, ejercicio) {
  return `
    <div class="editor-ej-row">
      <input type="text" placeholder="Nombre del ejercicio" data-dia="${diaId}" data-seccion="${seccionKey}" data-ej="${ejercicio.id}" data-field="nombre" value="${escAttr(ejercicio.nombre)}">
      <input type="text" placeholder="Target (ej: 8/8)" class="target-input" data-dia="${diaId}" data-seccion="${seccionKey}" data-ej="${ejercicio.id}" data-field="target" value="${escAttr(ejercicio.target)}">
      <button class="btn-remove-small" data-remove-ej="${ejercicio.id}" data-dia="${diaId}" data-seccion="${seccionKey}" title="Eliminar ejercicio">✕</button>
    </div>
  `;
}

function editorSeccionHtml(dia, seccionKey, seccionObj, label) {
  return `
    <div class="editor-seccion">
      <div class="editor-seccion-head">
        <span>${label}</span>
        <label class="series-input-label">Series
          <input type="number" min="1" class="series-input" data-dia="${dia.id}" data-seccion="${seccionKey}" data-field="series" value="${seccionObj.series}">
        </label>
      </div>
      ${seccionObj.ejercicios.map((e) => editorEjercicioRowHtml(dia.id, seccionKey, e)).join("")}
      <button class="btn-add-small" data-add-ej="${dia.id}" data-seccion="${seccionKey}">+ Agregar ejercicio</button>
    </div>
  `;
}

function editorBloqueHtml(dia, bloque) {
  return `
    <div class="editor-bloque">
      <div class="editor-bloque-head">
        <input type="text" class="bloque-name-input" placeholder="Nombre del bloque" data-dia="${dia.id}" data-bloque="${bloque.id}" data-field="nombre" value="${escAttr(bloque.nombre)}">
        <label class="series-input-label">Series
          <input type="number" min="1" class="series-input" data-dia="${dia.id}" data-bloque="${bloque.id}" data-field="series" value="${bloque.series}">
        </label>
        <button class="btn-remove-small" data-remove-bloque="${bloque.id}" data-dia="${dia.id}" title="Eliminar bloque">✕</button>
      </div>
      <input type="text" class="nota-input" placeholder="Nota opcional (ej: HIIT 15&quot;x15&quot;x4)" data-dia="${dia.id}" data-bloque="${bloque.id}" data-field="nota" value="${escAttr(bloque.nota)}">
      ${bloque.ejercicios.map((e) => editorEjercicioRowHtml(dia.id, bloque.id, e)).join("")}
      <button class="btn-add-small" data-add-ej="${dia.id}" data-seccion="${bloque.id}">+ Agregar ejercicio</button>
    </div>
  `;
}

function editorDiaHtml(dia) {
  return `
    <div class="pill-card editor-dia-card">
      <div class="editor-dia-head">
        <input type="text" class="dia-name-input" placeholder="Nombre del día" data-dia="${dia.id}" data-field="nombre" value="${escAttr(dia.nombre)}">
        <button class="btn-remove-small" data-remove-dia="${dia.id}" title="Eliminar día">✕ Eliminar día</button>
      </div>
      ${editorSeccionHtml(dia, "movilidad", dia.movilidad, "Movilidad")}
      ${editorSeccionHtml(dia, "zonaMedia", dia.zonaMedia, "Zona media")}
      <div class="editor-bloques-wrap">
        <p class="editor-bloques-label">Trabajo principal</p>
        ${dia.bloques.map((b) => editorBloqueHtml(dia, b)).join("")}
        <button class="btn-add-small" data-add-bloque="${dia.id}">+ Agregar bloque</button>
      </div>
    </div>
  `;
}

function configEditorHtml(routine) {
  const activeId = getActiveRoutineId();
  return `
    <button class="link-btn" id="btn-back-list">&larr; Volver a Mis rutinas</button>

    <div class="pill-card routine-meta-card">
      <label class="ex-select-label">Nombre de la rutina
        <input type="text" id="routine-nombre" data-routine-field="nombre" value="${escAttr(routine.nombre)}">
      </label>
      <div class="two-col-inputs">
        <label class="ex-select-label">Profesor (opcional)
          <input type="text" id="routine-profesor" data-routine-field="profesor" value="${escAttr(routine.profesor)}">
        </label>
        <label class="ex-select-label">Teléfono (opcional)
          <input type="text" id="routine-telefono" data-routine-field="telefono" value="${escAttr(routine.telefono)}">
        </label>
      </div>
      ${
        routine.id === activeId
          ? `<span class="badge-active">Rutina activa</span>`
          : `<button id="btn-activar-editor">Usar esta rutina</button>`
      }
    </div>

    ${routine.dias.map(editorDiaHtml).join("")}

    <button id="btn-add-dia" class="btn-add-day">+ Agregar día</button>
  `;
}

function wireConfigEditor() {
  const root = $("#view-config");

  $("#btn-back-list", root).addEventListener("click", () => {
    state.configScreen = "list";
    renderConfig();
  });

  const activarBtn = $("#btn-activar-editor", root);
  if (activarBtn) {
    activarBtn.addEventListener("click", () => {
      setActiveRoutineId(state.configRoutineId);
      state.diaId = null;
      renderConfig();
    });
  }

  $$("input[data-field], input[data-routine-field]", root).forEach((input) => {
    input.addEventListener("change", (e) => handleEditorFieldChange(e.target));
  });

  $("#btn-add-dia", root).addEventListener("click", () => {
    const routine = getRoutine(state.configRoutineId);
    routine.dias.push(createEmptyDia(`Día ${routine.dias.length + 1}`));
    upsertRoutine(routine);
    renderConfig();
  });

  $$("[data-remove-dia]", root).forEach((btn) =>
    btn.addEventListener("click", () => {
      armConfirm(btn, () => {
        const routine = getRoutine(state.configRoutineId);
        routine.dias = routine.dias.filter((d) => d.id !== btn.dataset.removeDia);
        upsertRoutine(routine);
        renderConfig();
      });
    })
  );

  $$("[data-add-bloque]", root).forEach((btn) =>
    btn.addEventListener("click", () => {
      const routine = getRoutine(state.configRoutineId);
      const dia = routine.dias.find((d) => d.id === btn.dataset.addBloque);
      dia.bloques.push(createEmptyBloque(`Bloque ${dia.bloques.length + 1}`));
      upsertRoutine(routine);
      renderConfig();
    })
  );

  $$("[data-remove-bloque]", root).forEach((btn) =>
    btn.addEventListener("click", () => {
      armConfirm(btn, () => {
        const routine = getRoutine(state.configRoutineId);
        const dia = routine.dias.find((d) => d.id === btn.dataset.dia);
        dia.bloques = dia.bloques.filter((b) => b.id !== btn.dataset.removeBloque);
        upsertRoutine(routine);
        renderConfig();
      });
    })
  );

  $$("[data-add-ej]", root).forEach((btn) =>
    btn.addEventListener("click", () => {
      const routine = getRoutine(state.configRoutineId);
      const dia = routine.dias.find((d) => d.id === btn.dataset.addEj);
      ejerciciosArrayOf(dia, btn.dataset.seccion).push(createEmptyEjercicio());
      upsertRoutine(routine);
      renderConfig();
    })
  );

  $$("[data-remove-ej]", root).forEach((btn) =>
    btn.addEventListener("click", () => {
      const routine = getRoutine(state.configRoutineId);
      const dia = routine.dias.find((d) => d.id === btn.dataset.dia);
      const arr = ejerciciosArrayOf(dia, btn.dataset.seccion);
      const idx = arr.findIndex((e) => e.id === btn.dataset.removeEj);
      if (idx !== -1) arr.splice(idx, 1);
      upsertRoutine(routine);
      renderConfig();
    })
  );
}

function handleEditorFieldChange(input) {
  const routine = getRoutine(state.configRoutineId);
  const field = input.dataset.field;
  const value = input.type === "number" ? Number(input.value) : input.value;

  if (input.dataset.routineField) {
    routine[input.dataset.routineField] = input.value;
  } else if (input.dataset.ej) {
    const dia = routine.dias.find((d) => d.id === input.dataset.dia);
    const arr = ejerciciosArrayOf(dia, input.dataset.seccion);
    const ejercicio = arr.find((e) => e.id === input.dataset.ej);
    ejercicio[field] = value;
  } else if (input.dataset.bloque) {
    const dia = routine.dias.find((d) => d.id === input.dataset.dia);
    const bloque = dia.bloques.find((b) => b.id === input.dataset.bloque);
    bloque[field] = value;
  } else if (input.dataset.seccion) {
    const dia = routine.dias.find((d) => d.id === input.dataset.dia);
    dia[input.dataset.seccion][field] = value;
  } else if (input.dataset.dia) {
    const dia = routine.dias.find((d) => d.id === input.dataset.dia);
    dia[field] = value;
  }
  upsertRoutine(routine);
}

/* ================= Navegación / arranque ================= */

function renderNav() {
  $$(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === state.view);
  });
  $("#view-rutina").classList.toggle("hidden", state.view !== "rutina");
  $("#view-progreso").classList.toggle("hidden", state.view !== "progreso");
  $("#view-config").classList.toggle("hidden", state.view !== "config");
}

function renderAll() {
  renderNav();
  if (state.view === "rutina") renderRutina();
  else if (state.view === "progreso") renderProgreso();
  else renderConfig();
}

function renderUserGreeting() {
  const user = getUser();
  const wrap = $("#user-greeting-wrap");
  wrap.innerHTML = `
    <p class="user-greeting">Hola, ${user.nombre}</p>
    <button id="btn-rename-user" class="link-btn light">Cambiar nombre</button>
  `;
  $("#btn-rename-user", wrap).addEventListener("click", () => {
    wrap.innerHTML = `
      <div class="rename-form">
        <input type="text" id="rename-input" value="${escAttr(user.nombre)}">
        <button id="rename-save">Guardar</button>
      </div>
    `;
    const input = $("#rename-input", wrap);
    input.focus();
    const save = () => {
      const val = input.value.trim();
      if (val) saveUser({ ...user, nombre: val });
      renderUserGreeting();
    };
    $("#rename-save", wrap).addEventListener("click", save);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
    });
  });
}

function bootApp() {
  const user = getUser();
  if (!user) {
    renderOnboarding();
    return;
  }
  $("#view-onboarding").classList.add("hidden");
  $("#app-header").classList.remove("hidden");
  $("#main-nav").classList.remove("hidden");
  renderUserGreeting();
  renderAll();
}

document.addEventListener("DOMContentLoaded", () => {
  $$(".nav-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.view = btn.dataset.view;
      renderAll();
    })
  );
  bootApp();
});
