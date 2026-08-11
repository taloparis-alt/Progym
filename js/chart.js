function drawLineChart(container, points, opts = {}) {
  const width = opts.width || 600;
  const height = opts.height || 220;
  const pad = { top: 20, right: 20, bottom: 34, left: 44 };

  if (!points.length) {
    container.innerHTML = `<p class="chart-empty">Todavía no hay registros para graficar.</p>`;
    return;
  }

  const values = points.map((p) => p.y);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xy = points.map((p, i) => {
    const x = pad.left + (points.length > 1 ? i * xStep : innerW / 2);
    const y = pad.top + innerH - ((p.y - min) / range) * innerH;
    return { x, y, label: p.x, value: p.y };
  });

  const pathD = xy.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");

  const gridLines = [0, 0.5, 1]
    .map((t) => {
      const y = pad.top + innerH * t;
      const val = (max - t * range).toFixed(1);
      return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" class="chart-grid" />
              <text x="${pad.left - 8}" y="${y + 4}" class="chart-axis-y" text-anchor="end">${val}</text>`;
    })
    .join("");

  const showEvery = Math.ceil(xy.length / 6) || 1;
  const xLabels = xy
    .map((pt, i) => {
      if (i % showEvery !== 0 && i !== xy.length - 1) return "";
      const short = pt.label.slice(5);
      return `<text x="${pt.x}" y="${height - pad.bottom + 18}" class="chart-axis-x" text-anchor="middle">${short}</text>`;
    })
    .join("");

  const dots = xy
    .map(
      (pt) =>
        `<circle cx="${pt.x}" cy="${pt.y}" r="4" class="chart-dot"><title>${pt.label}: ${pt.value}</title></circle>`
    )
    .join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
      ${gridLines}
      <path d="${pathD}" class="chart-line" fill="none" />
      ${dots}
      ${xLabels}
    </svg>
  `;
}
