/**
 * NutriTrack – Main Application
 */

// ── State ─────────────────────────────────────────────
let currentDate = toDateString(new Date());
let editingEntryId = null;
let editingWeightId = null;
let pendingFoodForServing = null;   // food item waiting for serving confirm
let pendingFoodForApproval = null;  // AI result waiting for approval
let editingLibraryId = null;
let weightChartRange = 30;
let scanStream = null;

// ── Navigation ────────────────────────────────────────
let currentPage = 'dashboard';

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('[data-page]').forEach(a => a.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  document.querySelectorAll(`[data-page="${page}"]`).forEach(a => a.classList.add('active'));
  currentPage = page;
  refreshPage(page);
}

document.querySelectorAll('[data-page]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(a.dataset.page);
  });
});

// ── Date Navigation ───────────────────────────────────
function changeDate(delta) {
  const d = fromDateString(currentDate);
  d.setDate(d.getDate() + delta);
  // Don't allow future dates (compare date strings to avoid time-of-day issues)
  if (toDateString(d) > toDateString(new Date())) return;
  currentDate = toDateString(d);
  updateDateLabels();
  refreshPage(currentPage);
}

function updateDateLabels() {
  const label = formatDisplayDate(currentDate);
  const full = formatFullDate(currentDate);
  const dateLabel = document.getElementById('current-date-label');
  if (dateLabel) dateLabel.textContent = label;

  const dashDate = document.getElementById('dash-date-display');
  if (dashDate) dashDate.textContent = full;

  const logDate = document.getElementById('log-date-display');
  if (logDate) logDate.textContent = full;
}

['prev-day', 'dash-prev-day', 'log-prev-day'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', () => changeDate(-1));
});

['next-day', 'dash-next-day', 'log-next-day'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', () => changeDate(1));
});

// ── Page Refresh Router ───────────────────────────────
function refreshPage(page) {
  switch (page) {
    case 'dashboard': refreshDashboard(); break;
    case 'log':       refreshLogPage(); break;
    case 'weight':    refreshWeightPage(); break;
    case 'foods':     refreshFoodLibrary(); break;
    case 'targets':   refreshTargets(); break;
  }
}

// ─────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────
function refreshDashboard() {
  const totals  = Store.getDayTotals(currentDate);
  const targets = Store.getTargets();
  const entries = Store.getLog(currentDate);
  const weights = Store.getWeightEntries();

  // Ring
  updateCalorieRing(totals.cal, targets.cal || 0);

  // Macro bars
  updateMacroBar('protein', totals.protein, targets.protein, targets.proteinDir || 'min');
  updateMacroBar('carbs',   totals.carbs,   targets.carbs,   targets.carbsDir   || 'max');
  updateMacroBar('fat',     totals.fat,     targets.fat,     targets.fatDir     || 'max');

  // Food preview
  renderFoodPreviewRows(entries, document.getElementById('dash-food-list'));

  // Mini chart
  renderMiniWeightChart(weights);
}

// ─────────────────────────────────────────────────────
// LOG PAGE
// ─────────────────────────────────────────────────────
function refreshLogPage() {
  const entries = Store.getLog(currentDate);
  const totals  = Store.getDayTotals(currentDate);
  const container = document.getElementById('log-food-list');

  renderFoodRows(entries, container, true);

  // Click to edit
  container.querySelectorAll('.food-entry-card[data-editable]').forEach(card => {
    card.addEventListener('click', () => openEditEntry(card.dataset.id));
  });

  // Totals bar
  document.getElementById('total-cal').textContent  = `${round0(totals.cal)} kcal`;
  document.getElementById('total-prot').textContent = `P: ${round1(totals.protein)}g`;
  document.getElementById('total-carb').textContent = `C: ${round1(totals.carbs)}g`;
  document.getElementById('total-fat').textContent  = `F: ${round1(totals.fat)}g`;
}

// Base macros per serving for the entry being edited (used to recalculate on amount change)
let editingEntryBase = null;

function openEditEntry(id) {
  const entries = Store.getLog(currentDate);
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  editingEntryId = id;

  // Store per-serving base macros so we can scale when amount changes.
  // The entry stores already-scaled values (amount * per-serving).
  // Recover the per-serving base by dividing by the stored amount.
  const storedAmt = entry.amount || 1;
  editingEntryBase = {
    cal:     (parseFloat(entry.cal)     || 0) / storedAmt,
    protein: (parseFloat(entry.protein) || 0) / storedAmt,
    carbs:   (parseFloat(entry.carbs)   || 0) / storedAmt,
    fat:     (parseFloat(entry.fat)     || 0) / storedAmt,
    servingSize: entry.servingSize || 1,
    servingUnit: entry.servingUnit || '',
  };

  document.getElementById('edit-entry-name').value   = entry.name || '';
  document.getElementById('edit-entry-amount').value = storedAmt;
  document.getElementById('edit-entry-unit').value   = entry.servingUnit || '';
  document.getElementById('edit-entry-cal').value    = round1(entry.cal || 0);
  document.getElementById('edit-entry-prot').value   = round1(entry.protein || 0);
  document.getElementById('edit-entry-carb').value   = round1(entry.carbs || 0);
  document.getElementById('edit-entry-fat').value    = round1(entry.fat || 0);
  openModal('modal-edit-entry');
}

// Recalculate macro fields when amount is changed in the edit modal
document.getElementById('edit-entry-amount').addEventListener('input', e => {
  if (!editingEntryBase) return;
  const amt = parseFloat(e.target.value) || 0;
  document.getElementById('edit-entry-cal').value  = round1(editingEntryBase.cal     * amt);
  document.getElementById('edit-entry-prot').value = round1(editingEntryBase.protein * amt);
  document.getElementById('edit-entry-carb').value = round1(editingEntryBase.carbs   * amt);
  document.getElementById('edit-entry-fat').value  = round1(editingEntryBase.fat     * amt);
});

document.getElementById('edit-entry-form').addEventListener('submit', e => {
  e.preventDefault();
  const updates = {
    name:    document.getElementById('edit-entry-name').value,
    amount:  parseFloat(document.getElementById('edit-entry-amount').value) || 1,
    servingUnit: document.getElementById('edit-entry-unit').value,
    cal:     parseFloat(document.getElementById('edit-entry-cal').value) || 0,
    protein: parseFloat(document.getElementById('edit-entry-prot').value) || 0,
    carbs:   parseFloat(document.getElementById('edit-entry-carb').value) || 0,
    fat:     parseFloat(document.getElementById('edit-entry-fat').value) || 0,
  };
  Store.updateLogEntry(currentDate, editingEntryId, updates);
  closeModal('modal-edit-entry');
  refreshPage(currentPage);
  showToast('Entry updated', 'success');
});

document.getElementById('delete-entry-btn').addEventListener('click', () => {
  Store.deleteLogEntry(currentDate, editingEntryId);
  closeModal('modal-edit-entry');
  refreshPage(currentPage);
  showToast('Entry deleted');
});

// ─────────────────────────────────────────────────────
// ADD FOOD MODAL
// ─────────────────────────────────────────────────────
function openAddFoodModal() {
  // Reset tabs
  document.querySelectorAll('#modal-add-food .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#modal-add-food .tab-content').forEach(t => {
    t.classList.remove('active');
    t.classList.add('hidden');
  });
  document.querySelector('[data-tab="recent"]').classList.add('active');
  document.getElementById('tab-recent').classList.add('active');
  document.getElementById('tab-recent').classList.remove('hidden');

  // Populate recent
  populateRecentList();

  openModal('modal-add-food');
}

['quick-add-btn', 'log-add-food-btn'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', openAddFoodModal);
});

// Recent + Library lists
function populateRecentList(filter = '') {
  const items = Store.getRecentFoods(40);
  const filtered = filter
    ? items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()))
    : items;
  renderSelectableList('recent-food-list', filtered, openServingModal);
}

function populateLibraryListModal(filter = '') {
  const items = Store.getLibrary();
  const filtered = filter
    ? items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()))
    : items;
  renderSelectableList('library-food-list-modal', filtered, openServingModal);
}

function renderSelectableList(containerId, items, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<p class="empty-state">No items found.</p>';
    return;
  }
  container.innerHTML = items.map((item, i) => `
    <div class="selectable-item" data-idx="${i}">
      <div>
        <div class="item-name">${escHtml(item.name)}</div>
        <div class="item-meta">${item.servingSize || ''}${item.servingUnit ? ' ' + item.servingUnit : ''} · ${round0(item.cal)} kcal</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        ${macroChips(item)}
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.selectable-item').forEach((el, i) => {
    el.addEventListener('click', () => onSelect(items[i]));
  });
}

document.getElementById('recent-search').addEventListener('input', e => {
  populateRecentList(e.target.value);
});

document.getElementById('library-search-modal').addEventListener('input', e => {
  populateLibraryListModal(e.target.value);
});

// When library tab activated
document.querySelector('[data-tab="library"]').addEventListener('click', () => {
  populateLibraryListModal();
});

// ─────────────────────────────────────────────────────
// SERVING MODAL
// ─────────────────────────────────────────────────────
function openServingModal(food) {
  pendingFoodForServing = food;
  document.getElementById('serving-food-name').textContent = food.name;
  const baseSize = food.servingSize || 1;
  const baseUnit = food.servingUnit || '';
  document.getElementById('serving-base-info').textContent =
    `Base serving: ${baseSize}${baseUnit ? ' ' + baseUnit : ''}`;
  document.getElementById('serving-amount').value = 1;
  document.getElementById('serving-unit').value = baseUnit;

  // Show macros for 1 serving
  updateServingPreview(1);
  openModal('modal-serving');
}

function updateServingPreview(amt) {
  if (!pendingFoodForServing) return;
  const food = pendingFoodForServing;
  const scaled = scaleMacros(food, amt);
  renderMacrosPreview('serving-macros-preview', scaled.cal, scaled.protein, scaled.carbs, scaled.fat);
}

document.getElementById('serving-amount').addEventListener('input', e => {
  updateServingPreview(parseFloat(e.target.value) || 0);
});

document.getElementById('confirm-serving-btn').addEventListener('click', () => {
  if (!pendingFoodForServing) return;
  const food = pendingFoodForServing;
  const amt = parseFloat(document.getElementById('serving-amount').value) || 1;
  const unit = document.getElementById('serving-unit').value || food.servingUnit;
  const scaled = scaleMacros(food, amt);

  Store.addLogEntry(currentDate, {
    name: food.name,
    amount: amt,
    servingSize: food.servingSize || 1,
    servingUnit: unit,
    ...scaled,
  });

  closeModal('modal-serving');
  closeModal('modal-add-food');
  refreshPage(currentPage);
  showToast(`${food.name} added!`, 'success');
  pendingFoodForServing = null;
});

// ─────────────────────────────────────────────────────
// MANUAL ENTRY FORM
// ─────────────────────────────────────────────────────
document.getElementById('manual-food-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('manual-name').value.trim();
  if (!name) return;

  const servingSize = parseFloat(document.getElementById('manual-serving-size').value) || 1;
  const servingUnit = document.getElementById('manual-serving-unit').value.trim();
  const cal = parseFloat(document.getElementById('manual-cal').value) || 0;
  const protein = parseFloat(document.getElementById('manual-prot').value) || 0;
  const carbs = parseFloat(document.getElementById('manual-carb').value) || 0;
  const fat = parseFloat(document.getElementById('manual-fat').value) || 0;

  const foodData = { name, servingSize, servingUnit, cal, protein, carbs, fat };

  // Add to today's log
  Store.addLogEntry(currentDate, { ...foodData, amount: 1 });

  // Auto-sync to library: update if name already exists, otherwise add new
  const library = Store.getLibrary();
  const existing = library.find(i => i.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    Store.updateLibraryItem(existing.id, foodData);
  } else {
    Store.addToLibrary(foodData);
  }

  closeModal('modal-add-food');
  refreshPage(currentPage);
  showToast(`${name} added!`, 'success');
  document.getElementById('manual-food-form').reset();
});

document.getElementById('save-to-library-btn').addEventListener('click', () => {
  const name = document.getElementById('manual-name').value.trim();
  if (!name) { showToast('Please enter a food name', 'error'); return; }
  Store.addToLibrary({
    name,
    servingSize: parseFloat(document.getElementById('manual-serving-size').value) || 1,
    servingUnit: document.getElementById('manual-serving-unit').value.trim(),
    cal:     parseFloat(document.getElementById('manual-cal').value) || 0,
    protein: parseFloat(document.getElementById('manual-prot').value) || 0,
    carbs:   parseFloat(document.getElementById('manual-carb').value) || 0,
    fat:     parseFloat(document.getElementById('manual-fat').value) || 0,
  });
  showToast(`${name} saved to library!`, 'success');
});

// ─────────────────────────────────────────────────────
// AI FOOD SEARCH (in modal)
// ─────────────────────────────────────────────────────
document.getElementById('ai-search-btn').addEventListener('click', doAiSearch);
document.getElementById('ai-food-query').addEventListener('keydown', e => {
  if (e.key === 'Enter') doAiSearch();
});

async function doAiSearch() {
  const query = document.getElementById('ai-food-query').value.trim();
  if (!query) return;

  const resultsEl = document.getElementById('ai-results');
  resultsEl.innerHTML = `<div class="ai-loading"><div class="spinner"></div>Searching nutrition data…</div>`;

  try {
    const results = await AI.searchFood(query);
    if (!results.length) {
      resultsEl.innerHTML = '<p class="empty-state">No results found.</p>';
      return;
    }

    resultsEl.innerHTML = results.map((r, i) => `
      <div class="ai-result-card" data-idx="${i}">
        <div class="ai-result-name">${escHtml(r.name)}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap;">
          <small style="color:var(--ink-muted)">${r.servingSize || 1}${r.servingUnit ? ' ' + r.servingUnit : ''}</small>
          <span style="font-weight:700">${round0(r.cal)} kcal</span>
          ${macroChips(r)}
        </div>
      </div>
    `).join('');

    resultsEl.querySelectorAll('.ai-result-card').forEach((card, i) => {
      card.addEventListener('click', () => openAiApprovalModal(results[i]));
    });

  } catch (err) {
    resultsEl.innerHTML = `<p class="empty-state" style="color:var(--accent)">${err.message}</p>`;
  }
}

// ─────────────────────────────────────────────────────
// AI APPROVAL MODAL
// ─────────────────────────────────────────────────────
function openAiApprovalModal(food) {
  pendingFoodForApproval = food;
  document.getElementById('ai-approve-name').value         = food.name || '';
  document.getElementById('ai-approve-serving-size').value = food.servingSize || 1;
  document.getElementById('ai-approve-serving-unit').value = food.servingUnit || '';
  document.getElementById('ai-approve-cal').value          = food.cal || 0;
  document.getElementById('ai-approve-prot').value         = food.protein || 0;
  document.getElementById('ai-approve-carb').value         = food.carbs || 0;
  document.getElementById('ai-approve-fat').value          = food.fat || 0;
  openModal('modal-ai-approve');
}

document.getElementById('ai-approve-form').addEventListener('submit', e => {
  e.preventDefault();
  const entry = readAiApproveForm();
  Store.addLogEntry(currentDate, { ...entry, amount: 1 });
  closeModal('modal-ai-approve');
  closeModal('modal-add-food');
  refreshPage(currentPage);
  showToast(`${entry.name} added!`, 'success');
});

document.getElementById('ai-approve-library-btn').addEventListener('click', () => {
  const entry = readAiApproveForm();
  Store.addToLibrary(entry);
  showToast(`${entry.name} saved to library!`, 'success');
  refreshFoodLibrary();
});

function readAiApproveForm() {
  return {
    name:        document.getElementById('ai-approve-name').value.trim(),
    servingSize: parseFloat(document.getElementById('ai-approve-serving-size').value) || 1,
    servingUnit: document.getElementById('ai-approve-serving-unit').value.trim(),
    cal:         parseFloat(document.getElementById('ai-approve-cal').value) || 0,
    protein:     parseFloat(document.getElementById('ai-approve-prot').value) || 0,
    carbs:       parseFloat(document.getElementById('ai-approve-carb').value) || 0,
    fat:         parseFloat(document.getElementById('ai-approve-fat').value) || 0,
  };
}

// ─────────────────────────────────────────────────────
// SCAN TAB (Camera / Image)
// ─────────────────────────────────────────────────────
document.getElementById('scan-camera-btn').addEventListener('click', async () => {
  try {
    if (scanStream) {
      scanStream.getTracks().forEach(t => t.stop());
      scanStream = null;
    }
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('scan-video');
    video.srcObject = scanStream;
    video.style.display = '';
    document.getElementById('scan-preview-img').style.display = 'none';
    document.getElementById('scan-capture-btn').classList.remove('hidden');
    document.getElementById('scan-analyze-btn').classList.add('hidden');
  } catch (err) {
    showToast('Camera access denied or unavailable', 'error');
  }
});

document.getElementById('scan-capture-btn').addEventListener('click', () => {
  const video = document.getElementById('scan-video');
  const canvas = document.getElementById('scan-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  // Stop camera
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  video.style.display = 'none';

  // Clear any previously uploaded file so camera capture is used for analysis
  document.getElementById('scan-analyze-btn')._file = null;

  // Show preview
  const img = document.getElementById('scan-preview-img');
  img.src = canvas.toDataURL('image/jpeg');
  img.style.display = '';

  document.getElementById('scan-capture-btn').classList.add('hidden');
  document.getElementById('scan-analyze-btn').classList.remove('hidden');
});

document.getElementById('scan-file-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = document.getElementById('scan-preview-img');
  img.src = url;
  img.style.display = '';
  document.getElementById('scan-video').style.display = 'none';
  document.getElementById('scan-capture-btn').classList.add('hidden');
  document.getElementById('scan-analyze-btn').classList.remove('hidden');
  // Store file for analysis
  document.getElementById('scan-analyze-btn')._file = file;
});

document.getElementById('scan-analyze-btn').addEventListener('click', async () => {
  const resultsEl = document.getElementById('scan-results');
  resultsEl.innerHTML = `<div class="ai-loading"><div class="spinner"></div>Analyzing label…</div>`;

  try {
    let base64, mimeType;
    const fileInput = document.getElementById('scan-file-input');
    const analyzeBtn = document.getElementById('scan-analyze-btn');

    if (analyzeBtn._file) {
      const conv = await fileToBase64(analyzeBtn._file);
      base64 = conv.base64;
      mimeType = conv.mimeType;
    } else {
      // From canvas capture
      const canvas = document.getElementById('scan-canvas');
      const conv = canvasToBase64(canvas);
      base64 = conv.base64;
      mimeType = conv.mimeType;
    }

    const food = await AI.scanLabel(base64, mimeType);
    resultsEl.innerHTML = '';
    openAiApprovalModal(food);
    closeModal('modal-add-food');

  } catch (err) {
    resultsEl.innerHTML = `<p class="empty-state" style="color:var(--accent)">${err.message}</p>`;
  }
});

// ─────────────────────────────────────────────────────
// WEIGHT PAGE
// ─────────────────────────────────────────────────────
function refreshWeightPage() {
  const entries = Store.getWeightEntries();
  const targets = Store.getTargets();
  const unit = targets.weightUnit || 'lbs';

  renderWeightChart(entries, weightChartRange);
  renderWeightStats(entries, unit);
  renderWeightLog(entries, unit);
}

function renderWeightStats(entries, unit) {
  if (!entries.length) {
    ['stat-current','stat-start','stat-change','stat-avg'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
    return;
  }
  const current = entries[entries.length - 1].value;
  const start = entries[0].value;
  const avg = entries.reduce((a, e) => a + e.value, 0) / entries.length;
  const change = current - start;

  document.getElementById('stat-current').textContent = `${current} ${unit}`;
  document.getElementById('stat-start').textContent   = `${start} ${unit}`;
  document.getElementById('stat-change').textContent  = `${change > 0 ? '+' : ''}${round1(change)} ${unit}`;
  document.getElementById('stat-avg').textContent     = `${round1(avg)} ${unit}`;

  document.getElementById('stat-change').style.color =
    change < 0 ? 'var(--green)' : change > 0 ? 'var(--accent)' : 'inherit';
}

function renderWeightLog(entries, unit) {
  const container = document.getElementById('weight-log-list');
  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">No weight entries yet.</p>';
    return;
  }

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  container.innerHTML = sorted.map((e, i) => {
    const prev = sorted[i + 1];
    let changeTxt = '';
    let changeClass = '';
    if (prev) {
      const delta = e.value - prev.value;
      changeTxt = `${delta > 0 ? '+' : ''}${round1(delta)} ${unit}`;
      changeClass = delta < 0 ? 'neg' : delta > 0 ? 'pos' : '';
    }
    return `
      <div class="weight-log-row" data-id="${e.id}">
        <span class="weight-log-date">${formatDisplayDate(e.date)}</span>
        <div style="display:flex;gap:14px;align-items:center;">
          ${changeTxt ? `<span class="weight-log-change ${changeClass}">${changeTxt}</span>` : ''}
          <span class="weight-log-val">${e.value} ${unit}</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.weight-log-row').forEach(row => {
    row.addEventListener('click', () => openEditWeight(row.dataset.id));
  });
}

// Range buttons
document.querySelectorAll('.range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    weightChartRange = parseInt(btn.dataset.range);
    const entries = Store.getWeightEntries();
    renderWeightChart(entries, weightChartRange);
  });
});

// Log weight
function openLogWeightModal(dateStr) {
  const targets = Store.getTargets();
  const unit = targets.weightUnit || 'lbs';
  document.getElementById('weight-unit-label').textContent = unit;
  // Always fall back to today if no date provided
  const date = dateStr || toDateString(new Date());
  document.getElementById('weight-date-input').value = date;
  document.getElementById('weight-value-input').value = '';
  openModal('modal-log-weight');
}

['log-weight-btn', 'add-weight-entry-btn'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', () => openLogWeightModal(currentDate));
});

document.getElementById('confirm-weight-btn').addEventListener('click', () => {
  const date = document.getElementById('weight-date-input').value;
  const val = parseFloat(document.getElementById('weight-value-input').value);
  if (!date || isNaN(val) || val <= 0) { showToast('Please enter a valid weight', 'error'); return; }
  const targets = Store.getTargets();
  Store.addWeightEntry(date, val, targets.weightUnit || 'lbs');
  closeModal('modal-log-weight');
  refreshPage(currentPage);
  // Always sync the mini chart in case user is on dashboard
  renderMiniWeightChart(Store.getWeightEntries());
  showToast('Weight logged!', 'success');
});

function openEditWeight(id) {
  const entries = Store.getWeightEntries();
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  editingWeightId = id;
  const targets = Store.getTargets();
  document.getElementById('edit-weight-unit-label').textContent = targets.weightUnit || 'lbs';
  document.getElementById('edit-weight-date').value = entry.date;
  document.getElementById('edit-weight-value').value = entry.value;
  openModal('modal-edit-weight');
}

document.getElementById('save-weight-edit-btn').addEventListener('click', () => {
  const date = document.getElementById('edit-weight-date').value;
  const val = parseFloat(document.getElementById('edit-weight-value').value);
  if (!date || isNaN(val)) { showToast('Invalid input', 'error'); return; }
  Store.updateWeightEntry(editingWeightId, { date, value: val });
  closeModal('modal-edit-weight');
  refreshWeightPage();
  showToast('Updated!', 'success');
});

document.getElementById('delete-weight-btn').addEventListener('click', () => {
  Store.deleteWeightEntry(editingWeightId);
  closeModal('modal-edit-weight');
  refreshWeightPage();
  showToast('Entry deleted');
});

// ─────────────────────────────────────────────────────
// FOOD LIBRARY PAGE
// ─────────────────────────────────────────────────────
function refreshFoodLibrary(filter = '') {
  const items = Store.getLibrary();
  const filtered = filter
    ? items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()))
    : items;
  const container = document.getElementById('food-library-list');

  if (!filtered.length) {
    container.innerHTML = `<p class="empty-state" style="grid-column:1/-1">
      ${filter ? 'No matching foods.' : 'Your library is empty. Add foods manually or via AI search!'}
    </p>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="library-food-card" data-id="${item.id}">
      <div class="library-food-actions">
        <button class="icon-btn edit-lib-btn" title="Edit">✎</button>
        <button class="icon-btn danger delete-lib-btn" title="Delete">✕</button>
      </div>
      <div class="library-food-name">${escHtml(item.name)}</div>
      <div class="library-food-serving">${item.servingSize || 1}${item.servingUnit ? ' ' + item.servingUnit : ''}</div>
      <div class="library-macro-row">
        <span style="font-weight:700;font-size:13px">${round0(item.cal)} kcal</span>
        ${macroChips(item)}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.library-food-card').forEach(card => {
    const id = card.dataset.id;
    card.querySelector('.edit-lib-btn').addEventListener('click', e => {
      e.stopPropagation();
      openEditLibraryItem(id);
    });
    card.querySelector('.delete-lib-btn').addEventListener('click', e => {
      e.stopPropagation();
      Store.deleteLibraryItem(id);
      refreshFoodLibrary(document.getElementById('food-library-search').value);
      showToast('Removed from library');
    });
    // Click card to add to today
    card.addEventListener('click', () => {
      const item = Store.getLibrary().find(i => i.id === id);
      if (item) openServingModal(item);
    });
  });
}

document.getElementById('food-library-search').addEventListener('input', e => {
  refreshFoodLibrary(e.target.value);
});

// Manual add to library (from library page)
document.getElementById('manual-add-food-btn').addEventListener('click', () => {
  editingLibraryId = null;
  document.getElementById('manual-lib-title').textContent = 'Add to Library';
  document.getElementById('manual-library-form').reset();
  openModal('modal-manual-library');
});

// AI search from library page
document.getElementById('ai-search-food-btn').addEventListener('click', () => {
  openAddFoodModal();
});

function openEditLibraryItem(id) {
  const item = Store.getLibrary().find(i => i.id === id);
  if (!item) return;
  editingLibraryId = id;
  document.getElementById('manual-lib-title').textContent = 'Edit Food';
  document.getElementById('lib-name').value         = item.name || '';
  document.getElementById('lib-serving-size').value = item.servingSize || 1;
  document.getElementById('lib-serving-unit').value = item.servingUnit || '';
  document.getElementById('lib-cal').value          = item.cal || 0;
  document.getElementById('lib-prot').value         = item.protein || 0;
  document.getElementById('lib-carb').value         = item.carbs || 0;
  document.getElementById('lib-fat').value          = item.fat || 0;
  openModal('modal-manual-library');
}

document.getElementById('manual-library-form').addEventListener('submit', e => {
  e.preventDefault();
  const data = {
    name:        document.getElementById('lib-name').value.trim(),
    servingSize: parseFloat(document.getElementById('lib-serving-size').value) || 1,
    servingUnit: document.getElementById('lib-serving-unit').value.trim(),
    cal:         parseFloat(document.getElementById('lib-cal').value) || 0,
    protein:     parseFloat(document.getElementById('lib-prot').value) || 0,
    carbs:       parseFloat(document.getElementById('lib-carb').value) || 0,
    fat:         parseFloat(document.getElementById('lib-fat').value) || 0,
  };
  if (editingLibraryId) {
    Store.updateLibraryItem(editingLibraryId, data);
    showToast('Food updated!', 'success');
  } else {
    Store.addToLibrary(data);
    showToast('Food added to library!', 'success');
  }
  closeModal('modal-manual-library');
  refreshFoodLibrary();
  editingLibraryId = null;
});

// ─────────────────────────────────────────────────────
// TARGETS PAGE
// ─────────────────────────────────────────────────────
function refreshTargets() {
  const t = Store.getTargets();
  document.getElementById('target-cal-input').value  = t.cal || '';
  document.getElementById('target-prot-input').value = t.protein || '';
  document.getElementById('target-prot-dir').value   = t.proteinDir || 'min';
  document.getElementById('target-carb-input').value = t.carbs || '';
  document.getElementById('target-carb-dir').value   = t.carbsDir || 'max';
  document.getElementById('target-fat-input').value  = t.fat || '';
  document.getElementById('target-fat-dir').value    = t.fatDir || 'max';
  document.getElementById('target-weight-input').value = t.weight || '';
  document.getElementById('weight-unit-select').value = t.weightUnit || 'lbs';
  document.getElementById('api-key-input').value = Store.getApiKey() ? '••••••••••••' : '';
}

document.getElementById('save-targets-btn').addEventListener('click', () => {
  Store.setTargets({
    cal:        parseFloat(document.getElementById('target-cal-input').value) || 0,
    protein:    parseFloat(document.getElementById('target-prot-input').value) || 0,
    proteinDir: document.getElementById('target-prot-dir').value,
    carbs:      parseFloat(document.getElementById('target-carb-input').value) || 0,
    carbsDir:   document.getElementById('target-carb-dir').value,
    fat:        parseFloat(document.getElementById('target-fat-input').value) || 0,
    fatDir:     document.getElementById('target-fat-dir').value,
    weight:     parseFloat(document.getElementById('target-weight-input').value) || null,
    weightUnit: document.getElementById('weight-unit-select').value,
  });
  showToast('Targets saved!', 'success');
  refreshDashboard();
});

document.getElementById('api-key-input').addEventListener('focus', e => {
  if (e.target.value === '••••••••••••') e.target.value = Store.getApiKey();
});

document.getElementById('save-api-key-btn').addEventListener('click', () => {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) { showToast('Enter an API key', 'error'); return; }
  if (!key.startsWith('sk-ant-')) {
    showToast('API key should start with sk-ant-', 'error'); return;
  }
  Store.setApiKey(key);
  document.getElementById('api-key-input').value = '••••••••••••';
  showToast('API key saved!', 'success');
});

// ─────────────────────────────────────────────────────
// DATA PAGE
// ─────────────────────────────────────────────────────
document.getElementById('export-btn').addEventListener('click', () => {
  const data = Store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nutritrack-export-${toDateString(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported!', 'success');
});

document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-file-input').click();
});

document.getElementById('import-file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      Store.importAll(data);
      showToast('Data imported!', 'success');
      refreshPage(currentPage);
    } catch (err) {
      showToast('Import failed: invalid file', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('clear-data-btn').addEventListener('click', () => {
  if (!confirm('Are you sure? This will permanently delete all your data.')) return;
  Store.clearAll();
  showToast('All data cleared');
  refreshPage(currentPage);
});

// ─────────────────────────────────────────────────────
// DASHBOARD quick actions
// ─────────────────────────────────────────────────────
document.getElementById('dash-food-list').addEventListener('click', e => {
  const row = e.target.closest('[data-id]');
  if (row) {
    // Navigate to log page
    navigateTo('log');
  }
});

// ─────────────────────────────────────────────────────
// SERVICE WORKER (PWA)
// ─────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/diet-tracker/sw.js', { scope: '/diet-tracker/' }).catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

// ─────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────
(function init() {
  initTabs('#modal-add-food');
  updateDateLabels();
  refreshDashboard();
  refreshFoodLibrary();
})();
