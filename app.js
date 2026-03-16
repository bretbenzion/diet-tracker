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

  // Ring
  updateCalorieRing(totals.cal, targets.cal || 0);

  // Macro bars
  updateMacroBar('protein', totals.protein, targets.protein, targets.proteinDir || 'min');
  updateMacroBar('carbs',   totals.carbs,   targets.carbs,   targets.carbsDir   || 'max');
  updateMacroBar('fat',     totals.fat,     targets.fat,     targets.fatDir     || 'max');
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

function updateEditEntryCalField() {
  const protein = parseFloat(document.getElementById('edit-entry-prot').value) || 0;
  const carbs   = parseFloat(document.getElementById('edit-entry-carb').value) || 0;
  const fat     = parseFloat(document.getElementById('edit-entry-fat').value) || 0;
  document.getElementById('edit-entry-cal').value = round1(protein * 4 + carbs * 4 + fat * 9);
}
['edit-entry-prot', 'edit-entry-carb', 'edit-entry-fat'].forEach(id => {
  ['input', 'change', 'keyup'].forEach(ev =>
    document.getElementById(id).addEventListener(ev, updateEditEntryCalField)
  );
});

// Base macros per serving for the entry being edited
let editingEntryBase = null;

function openEditEntry(id) {
  const entries = Store.getLog(currentDate);
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  editingEntryId = id;
  const storedAmt = entry.amount || 1;

  // Per-serving base macros (divide stored scaled values by amount)
  editingEntryBase = {
    protein: (parseFloat(entry.protein) || 0) / storedAmt,
    carbs:   (parseFloat(entry.carbs)   || 0) / storedAmt,
    fat:     (parseFloat(entry.fat)     || 0) / storedAmt,
  };
  editingEntryBase.cal = Math.round(
    editingEntryBase.protein * 4 + editingEntryBase.carbs * 4 + editingEntryBase.fat * 9
  );

  document.getElementById('edit-entry-name').value   = entry.name || '';
  document.getElementById('edit-entry-amount').value = storedAmt;
  document.getElementById('edit-entry-unit').value   = entry.servingUnit || '';
  document.getElementById('edit-entry-prot').value   = round1(entry.protein || 0);
  document.getElementById('edit-entry-carb').value   = round1(entry.carbs || 0);
  document.getElementById('edit-entry-fat').value    = round1(entry.fat || 0);
  updateEditEntryCalField();
  openModal('modal-edit-entry');
}

// Recalculate macro fields when amount is changed in the edit modal
document.getElementById('edit-entry-amount').addEventListener('input', e => {
  if (!editingEntryBase) return;
  const amt = parseFloat(e.target.value) || 0;
  const protein = round1(editingEntryBase.protein * amt);
  const carbs   = round1(editingEntryBase.carbs   * amt);
  const fat     = round1(editingEntryBase.fat     * amt);
  document.getElementById('edit-entry-prot').value = protein;
  document.getElementById('edit-entry-carb').value = carbs;
  document.getElementById('edit-entry-fat').value  = fat;
  document.getElementById('edit-entry-cal').value  = round1(protein * 4 + carbs * 4 + fat * 9);
});

document.getElementById('edit-entry-form').addEventListener('submit', e => {
  e.preventDefault();
  const protein = parseFloat(document.getElementById('edit-entry-prot').value) || 0;
  const carbs   = parseFloat(document.getElementById('edit-entry-carb').value) || 0;
  const fat     = parseFloat(document.getElementById('edit-entry-fat').value) || 0;
  const updates = {
    name:        document.getElementById('edit-entry-name').value,
    amount:      parseFloat(document.getElementById('edit-entry-amount').value) || 1,
    servingUnit: document.getElementById('edit-entry-unit').value,
    protein,
    carbs,
    fat,
    cal: Math.round(protein * 4 + carbs * 4 + fat * 9),
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
  document.querySelectorAll('#modal-add-food .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#modal-add-food .tab-content').forEach(t => {
    t.classList.remove('active');
    t.classList.add('hidden');
  });
  document.querySelector('[data-tab="library"]').classList.add('active');
  document.getElementById('tab-library').classList.add('active');
  document.getElementById('tab-library').classList.remove('hidden');
  document.getElementById('library-search-modal').value = '';
  populateLibraryListModal();
  openModal('modal-add-food');
}

['log-add-food-btn'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', openAddFoodModal);
});

function populateLibraryListModal(filter = '') {
  const items = Store.getLibrary();
  const filtered = filter
    ? items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()))
    : items;
  renderSelectableList('library-food-list-modal', filtered, openServingModal);
}

document.getElementById('library-search-modal').addEventListener('input', e => {
  populateLibraryListModal(e.target.value);
});

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
    el.addEventListener('click', e => {
      e.stopPropagation();
      onSelect(items[i]);
    });
  });
}

// ─────────────────────────────────────────────────────
// SERVING MODAL
// ─────────────────────────────────────────────────────
// mode: 'unit' = user enters raw amount in food's unit (e.g. grams)
//       'servings' = user enters number of servings
let servingMode = 'unit';

function openServingModal(food) {
  pendingFoodForServing = food;
  const baseSize = food.servingSize || 1;
  const baseUnit = food.servingUnit || '';

  document.getElementById('serving-food-name').textContent = food.name;
  document.getElementById('serving-base-info').textContent =
    `1 serving = ${baseSize}${baseUnit ? ' ' + baseUnit : ''} · ${food.cal} kcal`;

  // Default to unit mode if food has a unit, otherwise servings
  servingMode = baseUnit ? 'unit' : 'servings';
  setServingMode(servingMode, food);

  // Default input to 1 serving worth of the unit
  document.getElementById('serving-amount').value = baseUnit ? baseSize : 1;
  updateServingPreview();
  openModal('modal-serving');
}

function setServingMode(mode, food) {
  food = food || pendingFoodForServing;
  if (!food) return;
  servingMode = mode;
  const baseSize = food.servingSize || 1;
  const baseUnit = food.servingUnit || '';
  const unitBtn     = document.getElementById('mode-unit-btn');
  const servingsBtn = document.getElementById('mode-servings-btn');

  if (mode === 'unit') {
    unitBtn.className     = 'btn-primary';
    servingsBtn.className = 'btn-secondary';
    unitBtn.textContent     = baseUnit || 'Amount';
    document.getElementById('serving-amount-label').textContent =
      `Amount (${baseUnit || 'units'})`;
  } else {
    unitBtn.className     = 'btn-secondary';
    servingsBtn.className = 'btn-primary';
    unitBtn.textContent   = baseUnit || 'Amount';
    document.getElementById('serving-amount-label').textContent =
      `Servings (1 = ${baseSize}${baseUnit ? ' ' + baseUnit : ''})`;
  }
}

function updateServingPreview() {
  if (!pendingFoodForServing) return;
  const food = pendingFoodForServing;
  const raw = parseFloat(document.getElementById('serving-amount').value) || 0;
  const baseSize = food.servingSize || 1;
  // Convert raw input to a serving multiplier
  const ratio = servingMode === 'unit' ? raw / baseSize : raw;
  const scaled = scaleMacros(food, ratio);
  renderMacrosPreview('serving-macros-preview', scaled.cal, scaled.protein, scaled.carbs, scaled.fat);
}

document.getElementById('mode-unit-btn').addEventListener('click', e => {
  e.stopPropagation();
  if (!pendingFoodForServing) return;
  const food = pendingFoodForServing;
  const currentVal = parseFloat(document.getElementById('serving-amount').value) || 1;
  setServingMode('unit', food);
  // Convert current servings value to unit amount
  if (servingMode === 'unit') {
    document.getElementById('serving-amount').value = round1(currentVal * (food.servingSize || 1));
  }
  updateServingPreview();
});

document.getElementById('mode-servings-btn').addEventListener('click', e => {
  e.stopPropagation();
  if (!pendingFoodForServing) return;
  const food = pendingFoodForServing;
  const currentVal = parseFloat(document.getElementById('serving-amount').value) || 1;
  const wasUnit = servingMode === 'unit';
  setServingMode('servings', food);
  // Convert current unit amount to servings
  if (wasUnit) {
    document.getElementById('serving-amount').value = round1(currentVal / (food.servingSize || 1));
  }
  updateServingPreview();
});

document.getElementById('serving-amount').addEventListener('input', () => {
  updateServingPreview();
});

document.getElementById('confirm-serving-btn').addEventListener('click', e => {
  e.stopPropagation();
  if (!pendingFoodForServing) return;
  const food = pendingFoodForServing;
  const raw = parseFloat(document.getElementById('serving-amount').value) || 1;
  const baseSize = food.servingSize || 1;
  const ratio = servingMode === 'unit' ? raw / baseSize : raw;
  const scaled = scaleMacros(food, ratio);

  Store.addLogEntry(currentDate, {
    name: food.name,
    amount: round1(ratio),
    servingSize: baseSize,
    servingUnit: food.servingUnit || '',
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

// Auto-calculate calories as user types macros
function updateManualCalField() {
  const protein = parseFloat(document.getElementById('manual-prot').value) || 0;
  const carbs   = parseFloat(document.getElementById('manual-carb').value) || 0;
  const fat     = parseFloat(document.getElementById('manual-fat').value) || 0;
  document.getElementById('manual-cal').value = Math.round(protein * 4 + carbs * 4 + fat * 9);
}
['manual-prot', 'manual-carb', 'manual-fat'].forEach(id => {
  ['input', 'change', 'keyup'].forEach(ev =>
    document.getElementById(id).addEventListener(ev, updateManualCalField)
  );
});

document.getElementById('manual-food-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('manual-name').value.trim();
  if (!name) return;

  const protein = parseFloat(document.getElementById('manual-prot').value) || 0;
  const carbs   = parseFloat(document.getElementById('manual-carb').value) || 0;
  const fat     = parseFloat(document.getElementById('manual-fat').value) || 0;

  const foodData = {
    name,
    servingSize: parseFloat(document.getElementById('manual-serving-size').value) || 1,
    servingUnit: document.getElementById('manual-serving-unit').value.trim(),
    protein,
    carbs,
    fat,
    cal: Math.round(protein * 4 + carbs * 4 + fat * 9),
  };

  // Save to library (update if exists, add if new)
  const library = Store.getLibrary();
  const existing = library.find(i => i.name.toLowerCase() === name.toLowerCase());
  let libraryItem;
  if (existing) {
    Store.updateLibraryItem(existing.id, foodData);
    libraryItem = { ...existing, ...foodData };
  } else {
    libraryItem = Store.addToLibrary(foodData);
  }

  refreshFoodLibrary();
  document.getElementById('manual-food-form').reset();

  // Open serving modal using the clean library item so multipliers are always correct
  closeModal('modal-add-food');
  openServingModal(libraryItem);
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
function updateAiApproveCalField() {
  const protein = parseFloat(document.getElementById('ai-approve-prot').value) || 0;
  const carbs   = parseFloat(document.getElementById('ai-approve-carb').value) || 0;
  const fat     = parseFloat(document.getElementById('ai-approve-fat').value) || 0;
  document.getElementById('ai-approve-cal').value = Math.round(protein * 4 + carbs * 4 + fat * 9);
}
['ai-approve-prot', 'ai-approve-carb', 'ai-approve-fat'].forEach(id => {
  ['input', 'change', 'keyup'].forEach(ev =>
    document.getElementById(id).addEventListener(ev, updateAiApproveCalField)
  );
});

function openAiApprovalModal(food) {
  pendingFoodForApproval = food;
  document.getElementById('ai-approve-name').value         = food.name || '';
  document.getElementById('ai-approve-serving-size').value = food.servingSize || 1;
  document.getElementById('ai-approve-serving-unit').value = food.servingUnit || '';
  document.getElementById('ai-approve-prot').value         = food.protein || 0;
  document.getElementById('ai-approve-carb').value         = food.carbs || 0;
  document.getElementById('ai-approve-fat').value          = food.fat || 0;
  updateAiApproveCalField();
  openModal('modal-ai-approve');
}

document.getElementById('ai-approve-form').addEventListener('submit', e => {
  e.preventDefault();
  const entry = readAiApproveForm();

  // Save to library first (update if name exists, add if new)
  const library = Store.getLibrary();
  const existing = library.find(i => i.name.toLowerCase() === entry.name.toLowerCase());
  let libraryItem;
  if (existing) {
    Store.updateLibraryItem(existing.id, entry);
    libraryItem = { ...existing, ...entry };
  } else {
    libraryItem = Store.addToLibrary(entry);
  }
  refreshFoodLibrary();

  // Close approval modal and open serving modal from clean library item
  closeModal('modal-ai-approve');
  closeModal('modal-add-food');
  openServingModal(libraryItem);
});

document.getElementById('ai-approve-library-btn').addEventListener('click', () => {
  const entry = readAiApproveForm();
  const library = Store.getLibrary();
  const existing = library.find(i => i.name.toLowerCase() === entry.name.toLowerCase());
  if (existing) {
    Store.updateLibraryItem(existing.id, entry);
  } else {
    Store.addToLibrary(entry);
  }
  showToast(`${entry.name} saved to library!`, 'success');
  refreshFoodLibrary();
});

function readAiApproveForm() {
  const protein = parseFloat(document.getElementById('ai-approve-prot').value) || 0;
  const carbs   = parseFloat(document.getElementById('ai-approve-carb').value) || 0;
  const fat     = parseFloat(document.getElementById('ai-approve-fat').value) || 0;
  return {
    name:        document.getElementById('ai-approve-name').value.trim(),
    servingSize: parseFloat(document.getElementById('ai-approve-serving-size').value) || 1,
    servingUnit: document.getElementById('ai-approve-serving-unit').value.trim(),
    protein,
    carbs,
    fat,
    cal: Math.round(protein * 4 + carbs * 4 + fat * 9),
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
// ─────────────────────────────────────────────────────
// WEIGHT PAGE
// ─────────────────────────────────────────────────────
function refreshWeightPage() {
  const targets = Store.getTargets();
  const unit    = targets.weightUnit || 'lbs';
  const entries = Store.getWeightEntries();

  // Keep the unit label in sync with targets
  document.getElementById('weight-unit-label').textContent = unit;

  // Default date input to today
  if (!document.getElementById('weight-date-input').value) {
    document.getElementById('weight-date-input').value = toDateString(new Date());
  }

  renderWeightChart(entries, weightChartRange);
  renderWeightStats(entries, unit);
  renderWeightLog(entries, unit);
}

function renderWeightStats(entries, unit) {
  const ids = ['stat-current', 'stat-start', 'stat-change', 'stat-avg'];
  if (!entries.length) {
    ids.forEach(id => { document.getElementById(id).textContent = '—'; });
    return;
  }
  const targets     = Store.getTargets();
  const current     = entries[entries.length - 1].value;
  const startWeight = targets.startWeight || entries[0].value;
  const avg         = entries.reduce((a, e) => a + e.value, 0) / entries.length;
  const change      = current - startWeight;

  document.getElementById('stat-current').textContent = `${current} ${unit}`;
  document.getElementById('stat-start').textContent   = `${startWeight} ${unit}`;
  document.getElementById('stat-change').textContent  = `${change > 0 ? '+' : ''}${round1(change)} ${unit}`;
  document.getElementById('stat-avg').textContent     = `${round1(avg)} ${unit}`;
  document.getElementById('stat-change').style.color  =
    change < 0 ? 'var(--green)' : change > 0 ? 'var(--accent)' : 'inherit';
}

function renderWeightLog(entries, unit) {
  const container = document.getElementById('weight-log-list');
  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">No entries yet.</p>';
    return;
  }
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  container.innerHTML = sorted.map((e, i) => {
    const prev  = sorted[i + 1];
    const delta = prev ? e.value - prev.value : null;
    const deltaTxt = delta !== null
      ? `<span class="weight-log-change ${delta < 0 ? 'neg' : delta > 0 ? 'pos' : ''}">${delta > 0 ? '+' : ''}${round1(delta)} ${unit}</span>`
      : '';
    return `
      <div class="weight-log-row" data-id="${e.id}">
        <span class="weight-log-date">${formatDisplayDate(e.date)}</span>
        <div style="display:flex;gap:14px;align-items:center;">
          ${deltaTxt}
          <span class="weight-log-val">${e.value} ${unit}</span>
          <button class="btn-danger" style="padding:4px 10px;font-size:12px;" data-delete-id="${e.id}">✕</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      Store.deleteWeightEntry(btn.dataset.deleteId);
      refreshWeightPage();
      showToast('Entry deleted');
    });
  });
}

// Range buttons
document.querySelectorAll('.range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    weightChartRange = parseInt(btn.dataset.range);
    renderWeightChart(Store.getWeightEntries(), weightChartRange);
  });
});

// Inline log form — always visible on the weight page, no modal
document.getElementById('log-weight-form').addEventListener('submit', e => {
  e.preventDefault();
  const date = document.getElementById('weight-date-input').value;
  const val  = parseFloat(document.getElementById('weight-value-input').value);

  if (!date) { showToast('Please select a date', 'error'); return; }
  if (isNaN(val) || val <= 0) { showToast('Please enter a valid weight', 'error'); return; }

  const unit = Store.getTargets().weightUnit || 'lbs';
  Store.addWeightEntry(date, val, unit);
  document.getElementById('weight-value-input').value = '';
  refreshWeightPage();
  showToast('Weight logged!', 'success');
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
  document.getElementById('lib-prot').value         = item.protein || 0;
  document.getElementById('lib-carb').value         = item.carbs || 0;
  document.getElementById('lib-fat').value          = item.fat || 0;
  // Always show recalculated calories, not stale stored value
  updateLibCalField();
  openModal('modal-manual-library');
}

// Auto-calculate calories in the library modal as user types macros
function updateLibCalField() {
  const protein = parseFloat(document.getElementById('lib-prot').value) || 0;
  const carbs   = parseFloat(document.getElementById('lib-carb').value) || 0;
  const fat     = parseFloat(document.getElementById('lib-fat').value) || 0;
  document.getElementById('lib-cal').value = Math.round(protein * 4 + carbs * 4 + fat * 9);
}
['lib-prot', 'lib-carb', 'lib-fat'].forEach(id => {
  ['input', 'change', 'keyup'].forEach(ev =>
    document.getElementById(id).addEventListener(ev, updateLibCalField)
  );
});

document.getElementById('manual-library-form').addEventListener('submit', e => {
  e.preventDefault();
  const protein = parseFloat(document.getElementById('lib-prot').value) || 0;
  const carbs   = parseFloat(document.getElementById('lib-carb').value) || 0;
  const fat     = parseFloat(document.getElementById('lib-fat').value) || 0;
  const data = {
    name:        document.getElementById('lib-name').value.trim(),
    servingSize: parseFloat(document.getElementById('lib-serving-size').value) || 1,
    servingUnit: document.getElementById('lib-serving-unit').value.trim(),
    protein,
    carbs,
    fat,
    cal: Math.round(protein * 4 + carbs * 4 + fat * 9),
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
  document.getElementById('target-cal-input').value    = t.cal || '';
  document.getElementById('target-prot-input').value   = t.protein || '';
  document.getElementById('target-prot-dir').value     = t.proteinDir || 'min';
  document.getElementById('target-carb-input').value   = t.carbs || '';
  document.getElementById('target-carb-dir').value     = t.carbsDir || 'max';
  document.getElementById('target-fat-input').value    = t.fat || '';
  document.getElementById('target-fat-dir').value      = t.fatDir || 'max';
  document.getElementById('target-weight-input').value = t.weight || '';
  document.getElementById('weight-unit-select').value  = t.weightUnit || 'lbs';
  document.getElementById('target-start-weight').value = t.startWeight || '';
  document.getElementById('target-start-date').value   = t.startDate || '';
  document.getElementById('api-key-input').value       = Store.getApiKey() ? '••••••••••••' : '';
}

document.getElementById('save-targets-btn').addEventListener('click', () => {
  Store.setTargets({
    cal:         parseFloat(document.getElementById('target-cal-input').value) || 0,
    protein:     parseFloat(document.getElementById('target-prot-input').value) || 0,
    proteinDir:  document.getElementById('target-prot-dir').value,
    carbs:       parseFloat(document.getElementById('target-carb-input').value) || 0,
    carbsDir:    document.getElementById('target-carb-dir').value,
    fat:         parseFloat(document.getElementById('target-fat-input').value) || 0,
    fatDir:      document.getElementById('target-fat-dir').value,
    weight:      parseFloat(document.getElementById('target-weight-input').value) || null,
    weightUnit:  document.getElementById('weight-unit-select').value,
    startWeight: parseFloat(document.getElementById('target-start-weight').value) || null,
    startDate:   document.getElementById('target-start-date').value || null,
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
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      if (!data || typeof data !== 'object') throw new Error('Not a valid NutriTrack export');
      Store.importAll(data);
      showToast('Data imported!', 'success');
      // Refresh every page so all views reflect the imported data
      updateDateLabels();
      refreshDashboard();
      refreshLogPage();
      refreshWeightPage();
      refreshFoodLibrary();
      refreshTargets();
      // Navigate to dashboard so user sees something immediately
      navigateTo('dashboard');
    } catch (err) {
      showToast('Import failed: ' + (err.message || 'invalid file'), 'error');
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
// SERVICE WORKER (PWA)
// ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────
// SERVICE WORKER
// ─────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/diet-tracker/sw.js', { scope: '/diet-tracker/' })
    .catch(err => console.warn('SW registration failed:', err));
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
