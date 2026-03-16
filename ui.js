/**
 * NutriTrack – UI Utilities
 */

// ── Toast ─────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ` ${type}` : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = 'toast hidden'; }, 3000);
}

// ── Modal ─────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// Close modal on overlay click or close button
document.addEventListener('click', e => {
  // Overlay click — only fire if the click landed directly on the overlay,
  // not on a child element that bubbled up
  if (e.target.classList.contains('modal-overlay') && e.target === e.currentTarget || 
      e.target.classList.contains('modal-overlay')) {
    // Extra guard: don't close if another modal is already visible (just opened)
    const otherOpen = [...document.querySelectorAll('.modal-overlay:not(.hidden)')]
      .filter(m => m !== e.target).length > 0;
    if (!otherOpen) e.target.classList.add('hidden');
  }
  // Close button
  if (e.target.dataset.close) {
    closeModal(e.target.dataset.close);
  }
});

// ── Tabs ──────────────────────────────────────────────
function initTabs(containerSelector) {
  document.querySelectorAll(containerSelector + ' .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.modal') || document.body;
      parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      parent.querySelectorAll('.tab-content').forEach(t => {
        t.classList.remove('active');
        t.classList.add('hidden');
      });
      btn.classList.add('active');
      const target = parent.querySelector('#tab-' + btn.dataset.tab);
      if (target) {
        target.classList.add('active');
        target.classList.remove('hidden');
      }
    });
  });
}

// ── Date Helpers ──────────────────────────────────────
function toDateString(d) {
  // Returns YYYY-MM-DD in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDateString(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(dateStr) {
  const today = toDateString(new Date());
  const yesterday = toDateString(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = fromDateString(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr) {
  const d = fromDateString(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Number Helpers ────────────────────────────────────
function round1(n) { return Math.round((n || 0) * 10) / 10; }
function round0(n) { return Math.round(n || 0); }

// ── Macro chip HTML ───────────────────────────────────
function macroChips(entry) {
  return `
    <span class="macro-chip chip-p">${round1(entry.protein)}g P</span>
    <span class="macro-chip chip-c">${round1(entry.carbs)}g C</span>
    <span class="macro-chip chip-f">${round1(entry.fat)}g F</span>
  `;
}

// ── Serving label ─────────────────────────────────────
function servingLabel(entry) {
  if (!entry.amount && !entry.servingSize) return '';
  const amt = entry.amount || 1;
  const size = entry.servingSize || 1;
  const unit = entry.servingUnit || '';
  const displayAmt = round1(amt * size);
  return `${displayAmt}${unit ? ' ' + unit : ''}`;
}

// ── Scale macros by ratio ─────────────────────────────
function scaleMacros(base, ratio) {
  const protein = round1((parseFloat(base.protein) || 0) * ratio);
  const carbs   = round1((parseFloat(base.carbs)   || 0) * ratio);
  const fat     = round1((parseFloat(base.fat)     || 0) * ratio);
  return {
    protein,
    carbs,
    fat,
    cal: Math.round(protein * 4 + carbs * 4 + fat * 9),
  };
}

// ── Render food log rows (shared by dash + log page) ──
function renderFoodRows(entries, container, editable = false) {
  if (!entries || entries.length === 0) {
    container.innerHTML = '<p class="empty-state">No food logged yet.</p>';
    return;
  }
  container.innerHTML = entries.map(e => `
    <div class="food-entry-card" data-id="${e.id}" ${editable ? 'data-editable="true"' : ''}>
      <div class="food-entry-main">
        <div class="food-entry-name">${escHtml(e.name)}</div>
        <div class="food-entry-serving">${servingLabel(e) || '—'}</div>
      </div>
      <div class="food-entry-macros">
        ${macroChips(e)}
      </div>
      <div class="food-entry-cal">${round0(Math.round((parseFloat(e.protein)||0)*4+(parseFloat(e.carbs)||0)*4+(parseFloat(e.fat)||0)*9))} kcal</div>
    </div>
  `).join('');
}

// ── Render food preview rows (dashboard compact) ──────
function renderFoodPreviewRows(entries, container) {
  if (!entries || entries.length === 0) {
    container.innerHTML = '<p class="empty-state">No food logged yet. Start tracking!</p>';
    return;
  }
  container.innerHTML = entries.slice(0, 8).map(e => `
    <div class="food-row" data-id="${e.id}">
      <div>
        <div class="food-row-name">${escHtml(e.name)}</div>
        <div class="food-row-meta">${servingLabel(e) || ''}</div>
      </div>
      <div class="food-row-cal">${round0(e.cal)} kcal</div>
    </div>
  `).join('');
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Calorie ring animation ────────────────────────────
function updateCalorieRing(consumed, goal) {
  const ring = document.getElementById('calorie-ring');
  if (!ring) return;
  const circ = 2 * Math.PI * 68;
  ring.style.strokeDasharray = circ;
  const pct = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const offset = circ - pct * circ;
  ring.style.strokeDashoffset = offset;
  // color: green if under, amber if 90-100%, red if over
  if (pct < 0.9) ring.style.stroke = 'var(--cal-color)';
  else if (pct < 1) ring.style.stroke = 'var(--amber)';
  else ring.style.stroke = 'var(--accent)';

  document.getElementById('ring-consumed').textContent = round0(consumed);
  const rem = goal - consumed;
  document.getElementById('ring-remaining').textContent = rem > 0
    ? `${round0(rem)} remaining`
    : `${round0(-rem)} over`;
  document.getElementById('legend-consumed').textContent = `${round0(consumed)} consumed`;
  document.getElementById('legend-goal').textContent = `${round0(goal)} goal`;
}

// ── Macro bar animation ───────────────────────────────
function updateMacroBar(macro, value, target, dir) {
  const bar = document.getElementById(`bar-${macro}`);
  const valEl = document.getElementById(`val-${macro}`);
  const targetEl = document.getElementById(`target-${macro}`);
  if (!bar) return;

  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  bar.style.width = pct + '%';

  valEl.textContent = round1(value) + 'g';
  targetEl.textContent = target ? `/ ${round1(target)}g` : '';

  // Color based on direction
  const card = bar.closest('.macro-card');
  if (!card) return;
  const over = value > target && target > 0;

  // Always reset first, then apply override color if over-budget on a max target
  bar.style.background = '';
  if (over && dir === 'max') {
    bar.style.background = 'var(--accent)';
  }
}

// ── Macros preview panel ──────────────────────────────
function renderMacrosPreview(containerId, cal, protein, carbs, fat) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="macro-preview-item">
      <span class="macro-preview-val">${round0(cal)}</span>
      <span class="macro-preview-label">kcal</span>
    </div>
    <div class="macro-preview-item">
      <span class="macro-preview-val" style="color:var(--protein-color)">${round1(protein)}</span>
      <span class="macro-preview-label">Protein</span>
    </div>
    <div class="macro-preview-item">
      <span class="macro-preview-val" style="color:var(--carb-color)">${round1(carbs)}</span>
      <span class="macro-preview-label">Carbs</span>
    </div>
    <div class="macro-preview-item">
      <span class="macro-preview-val" style="color:var(--fat-color)">${round1(fat)}</span>
      <span class="macro-preview-label">Fat</span>
    </div>
  `;
}
