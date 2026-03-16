/**
 * NutriTrack – Charts (Chart.js)
 */

let _weightChart = null;
let _miniWeightChart = null;

const CHART_DEFAULTS = {
  font: { family: "'DM Sans', system-ui, sans-serif" },
  color: '#6b6b67',
};

Chart.defaults.font.family = CHART_DEFAULTS.font.family;
Chart.defaults.color = CHART_DEFAULTS.color;

// ── Trendline calculation (linear regression) ─────────
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return points.map(p => ({ x: p.x, y: p.y }));
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  return [
    { x: minX, y: slope * minX + intercept },
    { x: maxX, y: slope * maxX + intercept },
  ];
}

// ── Date to numeric index ─────────────────────────────
function dateToNum(dateStr) {
  return new Date(dateStr + 'T00:00:00').getTime();
}

// ── Main Weight Chart ─────────────────────────────────
function renderWeightChart(entries, rangeDays = 30) {
  const canvas = document.getElementById('weight-chart');
  if (!canvas) return;

  // Filter by range
  let filtered = [...entries];
  if (rangeDays > 0) {
    const cutoff = Date.now() - rangeDays * 86400000;
    filtered = entries.filter(e => dateToNum(e.date) >= cutoff);
  }

  if (_weightChart) {
    _weightChart.destroy();
    _weightChart = null;
  }

  if (filtered.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const labels = filtered.map(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const values = filtered.map(e => e.value);

  // Trendline — only calculate if we have at least 2 points
  const pts = filtered.map((e, i) => ({ x: i, y: e.value }));
  const trend = linearRegression(pts);
  const trendData = trend.length < 2
    ? filtered.map(e => e.value)  // flat line at actual value for single point
    : filtered.map((_, i) => {
        const t0 = trend[0], t1 = trend[1];
        const slope = t1.x !== t0.x ? (t1.y - t0.y) / (t1.x - t0.x) : 0;
        return t0.y + slope * (i - t0.x);
      });

  _weightChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Weight',
          data: values,
          borderColor: '#1a1a18',
          backgroundColor: 'rgba(26,26,24,0.07)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#1a1a18',
          pointHoverRadius: 6,
          fill: true,
          tension: 0.3,
          order: 1,
        },
        {
          label: 'Trend',
          data: trendData,
          borderColor: '#e85d3a',
          borderWidth: 2,
          borderDash: [6, 3],
          pointRadius: 0,
          fill: false,
          tension: 0,
          order: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a18',
          titleFont: { size: 13, weight: '600' },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label(ctx) {
              const unit = Store.getTargets().weightUnit || 'lbs';
              if (ctx.datasetIndex === 0) return ` ${ctx.parsed.y} ${unit}`;
              if (ctx.datasetIndex === 1) return ` Trend: ${round1(ctx.parsed.y)} ${unit}`;
              return '';
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#e8e6e0' },
          ticks: { maxRotation: 0, font: { size: 11 } },
        },
        y: {
          grid: { color: '#e8e6e0' },
          ticks: { font: { size: 11 } },
        },
      },
    },
  });
}

// ── Mini Weight Chart (Dashboard) ─────────────────────
function renderMiniWeightChart(entries) {
  const canvas = document.getElementById('mini-weight-chart');
  if (!canvas) return;

  if (_miniWeightChart) {
    _miniWeightChart.destroy();
    _miniWeightChart = null;
  }

  const last30 = [...entries].slice(-30);
  if (last30.length === 0) {
    canvas.style.display = 'none';
    return;
  }
  canvas.style.display = '';

  const labels = last30.map(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const values = last30.map(e => e.value);

  const pts = last30.map((e, i) => ({ x: i, y: e.value }));
  const trend = linearRegression(pts);
  const trendData = last30.map((_, i) => {
    const t0 = trend[0], t1 = trend[1];
    const slope = t1.x !== t0.x ? (t1.y - t0.y) / (t1.x - t0.x) : 0;
    return t0.y + slope * (i - t0.x);
  });

  _miniWeightChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: '#1a1a18',
          backgroundColor: 'rgba(26,26,24,0.06)',
          borderWidth: 1.5,
          pointRadius: 2,
          fill: true,
          tension: 0.3,
        },
        {
          data: trendData,
          borderColor: '#e85d3a',
          borderWidth: 1.5,
          borderDash: [4, 2],
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: {
          grid: { color: '#f0eee9' },
          ticks: { font: { size: 10 }, maxTicksLimit: 4 },
        },
      },
    },
  });
}
