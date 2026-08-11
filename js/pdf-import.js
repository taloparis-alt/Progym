const PDFJS_VERSION = "3.11.174";
let pdfJsLoadPromise = null;

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  if (pdfJsLoadPromise) return pdfJsLoadPromise;
  pdfJsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
      resolve();
    };
    script.onerror = () => reject(new Error("No se pudo cargar la librería de lectura de PDF (revisá tu conexión a internet)."));
    document.head.appendChild(script);
  });
  return pdfJsLoadPromise;
}

const HEADER_PATTERNS = [
  { re: /^MOVILIDAD$/i, kind: "movilidad" },
  { re: /^ZONAMEDIA$/i, kind: "zonaMedia" },
  { re: /^BLOQUE(\d+)$/i, kind: "bloque" },
  { re: /^TRABAJOPRINCIPAL$/i, kind: "skip" },
];

function collapseLetterSpacing(str) {
  return str.replace(/(?:\S\s){2,}\S/g, (m) => m.replace(/\s+/g, ""));
}

function classifyLine(rawText) {
  const collapsed = collapseLetterSpacing(rawText).trim();
  for (const { re, kind } of HEADER_PATTERNS) {
    const match = collapsed.match(re);
    if (match) return { type: "header", kind, num: match[1] ? Number(match[1]) : null };
  }
  const seriesMatch = collapsed.match(/^\((\d+)SERIES?\)$/i);
  if (seriesMatch) return { type: "series", count: Number(seriesMatch[1]) };
  if (/^\(.+\)$/.test(collapsed)) {
    const nota = collapsed
      .slice(1, -1)
      .replace(/([a-zA-Z])(\d)/g, "$1 $2")
      .replace(/(\d)([a-zA-Z])/g, "$1 $2");
    return { type: "nota", text: nota };
  }
  return { type: "item" };
}

const COLUMN_GAP_THRESHOLD = 35;

function groupItemsIntoLines(items) {
  const byY = new Map();
  items.forEach((it) => {
    if (!it.str || !it.str.trim()) return;
    const key = Math.round(it.y);
    if (!byY.has(key)) byY.set(key, []);
    byY.get(key).push(it);
  });
  const lines = [];
  byY.forEach((lineItems, y) => {
    lineItems.sort((a, b) => a.x - b.x);
    let run = [lineItems[0]];
    const flush = () => {
      const text = run.map((it) => it.str).join("").replace(/\s+/g, " ").trim();
      const minX = Math.min(...run.map((it) => it.x));
      if (text) lines.push({ y, minX, text });
    };
    for (let i = 1; i < lineItems.length; i++) {
      const prevItem = run[run.length - 1];
      const gap = lineItems[i].x - (prevItem.x + (prevItem.w || 0));
      if (gap > COLUMN_GAP_THRESHOLD) {
        flush();
        run = [lineItems[i]];
      } else {
        run.push(lineItems[i]);
      }
    }
    flush();
  });
  lines.sort((a, b) => b.y - a.y);
  return lines;
}

function looksLikeBareValue(text) {
  return /^[\d/"'x×.,\s+-]+(min|seg)?$/i.test(text.trim());
}

function shouldMergeContinuation(prevText, lineText) {
  if (!prevText.includes("⇨")) return lineText.includes("⇨");
  return looksLikeBareValue(lineText);
}

function mergeWrappedLines(lines) {
  const merged = [];
  for (const line of lines) {
    if (classifyLine(line.text).type === "item") {
      let target = null;
      for (let i = merged.length - 1; i >= 0 && line.y <= merged[i].y - 0 + 25; i--) {
        if (Math.abs(merged[i].minX - line.minX) <= 6) {
          if (classifyLine(merged[i].text).type === "item" && shouldMergeContinuation(merged[i].text, line.text)) {
            target = merged[i];
          }
          break;
        }
      }
      if (target) {
        target.text = `${target.text} ${line.text}`.trim();
        target.y = line.y;
        continue;
      }
    }
    merged.push({ ...line });
  }
  return merged;
}

function splitNameTarget(text) {
  const idx = text.indexOf("⇨");
  if (idx === -1) return { nombre: text.trim(), target: "" };
  return { nombre: text.slice(0, idx).trim(), target: text.slice(idx + 1).trim() };
}

function parsePageIntoDia(lines, diaIndex) {
  const headers = [];
  const others = [];
  lines.forEach((line) => {
    const info = classifyLine(line.text);
    if (info.type === "header" && info.kind !== "skip") {
      headers.push({ ...line, ...info });
    } else if (info.type !== "header") {
      others.push({ ...line, ...info });
    }
  });

  const groups = headers.map((h) => ({ header: h, series: null, nota: "", items: [] }));

  others.forEach((line) => {
    let best = null;
    let bestDist = Infinity;
    groups.forEach((g) => {
      if (g.header.y <= line.y) return;
      const dist = Math.abs(g.header.minX - line.minX) + (g.header.y - line.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = g;
      }
    });
    if (!best) return;
    if (line.type === "series") best.series = line.count;
    else if (line.type === "nota") best.nota = line.text;
    else best.items.push(line.text);
  });

  const dia = createEmptyDia(`Día ${diaIndex + 1}`);
  const bloques = [];

  groups.forEach((g) => {
    const ejercicios = g.items.map((text) => {
      const { nombre, target } = splitNameTarget(text);
      return { id: uid("ej"), nombre, target };
    });
    if (g.header.kind === "movilidad") {
      dia.movilidad = { series: g.series || 1, ejercicios };
    } else if (g.header.kind === "zonaMedia") {
      dia.zonaMedia = { series: g.series || 1, ejercicios };
    } else if (g.header.kind === "bloque") {
      const notaSeriesMatch = g.nota.match(/x\s*(\d+)\s*$/i);
      bloques.push({
        num: g.header.num || bloques.length + 1,
        bloque: {
          id: uid("bloque"),
          nombre: `Bloque ${g.header.num || bloques.length + 1}`,
          series: g.series || (notaSeriesMatch ? Number(notaSeriesMatch[1]) : 3),
          nota: g.nota,
          ejercicios,
        },
      });
    }
  });

  bloques.sort((a, b) => a.num - b.num);
  dia.bloques = bloques.map((b) => b.bloque);
  return dia;
}

async function extractRoutineFromPdf(file) {
  await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;

  const dias = [];
  let profesor = "";
  let telefono = "";

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width,
    }));

    if (p === 1) {
      const profesorItem = items.find((it) => /PROFESOR/i.test(collapseLetterSpacing(it.str)));
      if (profesorItem) {
        const collapsed = collapseLetterSpacing(profesorItem.str);
        const match = collapsed.match(/PROFESOR(.+?)-([\d\s]+)$/i);
        if (match) {
          profesor = match[1].trim();
          telefono = match[2].trim();
        }
      }
    }

    const lines = groupItemsIntoLines(items);
    const merged = mergeWrappedLines(lines);
    dias.push(parsePageIntoDia(merged, p - 1));
  }

  const nombre = file.name.replace(/\.pdf$/i, "").trim() || "Rutina importada";
  return {
    id: uid("rutina"),
    nombre,
    profesor,
    telefono,
    creadaEn: todayISO(),
    dias,
  };
}
