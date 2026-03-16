/**
 * NutriTrack – Charts (Chart.js)
 */

let _weightChart = null;

Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
Chart.defaults.color = '#6b6b67';

function dateToNum(dateStr) {
  return new Date(dateStr + 'T00:00:00').getTime();
}

function renderWeightChart(entries, rangeDays = 30) {
  const canvas = document.getElementById('weight-chart');
  if (!canvas) return;

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
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Set explicit pixel height so Chart.js fills it correctly

  const labels = filtered.map(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const values = filtered.map(e => e.value);

  // Scale point size — fewer entries = slightly larger dots, many entries = no dots
  const pointRadius = filtered.length > 30 ? 0 : filtered.length > 14 ? 1.5 : 3;

  _weightChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Weight',
        data: values,
        borderColor: '#1a1a18',
        backgroundColor: 'rgba(26,26,24,0.07)',
        borderWidth: 2,
        pointRadius,
        pointHoverRadius: pointRadius > 0 ? pointRadius + 2 : 3,
        pointBackgroundColor: '#1a1a18',
        fill: true,
        tension: 0.3,
      }],
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
              return ' ' + ctx.parsed.y + ' ' + unit;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#e8e6e0' },
          ticks: { maxRotation: 0, font: { size: 11 }, maxTicksLimit: 8 },
        },
        y: {
          grid: { color: '#e8e6e0' },
          ticks: { font: { size: 11 } },
        },
      },
    },
  });
}

// No-op stub — mini chart canvas removed from dashboard
function renderMiniWeightChart() {}
