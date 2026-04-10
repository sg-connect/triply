let settings = {};
let vacTotal = 25, vacUsed = 0, currency = 'SEK', budgetMin = 5000, budgetMax = 25000;
let travelStyle = 'mixed', transport = ['flight'], holidays = [];

async function init() {
    settings = await fetch('/api/settings').then(r => r.json()).catch(() => ({}));
    vacTotal = settings.vacationDaysTotal || 25;
    vacUsed = settings.vacationDaysUsed || 0;
    currency = settings.currency || 'SEK';
    travelStyle = settings.travelStyle || 'mixed';
    transport = settings.preferredTransport || ['flight'];
    budgetMin = (settings.budgetRange && settings.budgetRange.min) || 5000;
    budgetMax = (settings.budgetRange && settings.budgetRange.max) || 25000;
    holidays = (settings.publicHolidays || []).slice().sort((a, b) => a.date.localeCompare(b.date));

    document.getElementById('vacTotal').textContent = vacTotal;
    document.getElementById('vacUsed').textContent = vacUsed;
    updateVacLeft();

    selectCurrency(currency, true);
    document.querySelectorAll('[data-style]').forEach(el => el.classList.toggle('selected', el.dataset.style === travelStyle));
    document.querySelectorAll('[data-transport]').forEach(el => el.classList.toggle('selected', transport.includes(el.dataset.transport)));

    updateBudgetDisplay();
    renderHolidays();
}

function adjustNum(id, delta) {
    if (id === 'vacTotal') { vacTotal = Math.max(0, vacTotal + delta); document.getElementById('vacTotal').textContent = vacTotal; }
    if (id === 'vacUsed') { vacUsed = Math.max(0, Math.min(vacTotal, vacUsed + delta)); document.getElementById('vacUsed').textContent = vacUsed; }
    updateVacLeft();
}

function updateVacLeft() {
    const left = document.getElementById('vacLeft');
    if (left) left.textContent = Math.max(0, vacTotal - vacUsed);
}

function selectCurrency(curr, silent) {
    currency = curr;
    document.getElementById('curr-SEK').classList.toggle('selected', curr === 'SEK');
    document.getElementById('curr-USD').classList.toggle('selected', curr === 'USD');
    if (!silent) updateBudgetDisplay();
}

function toggleTransport(el) {
    const t = el.dataset.transport;
    if (transport.includes(t)) {
        if (transport.length === 1) return;
        transport = transport.filter(x => x !== t);
        el.classList.remove('selected');
    } else {
        transport.push(t);
        el.classList.add('selected');
    }
}

function selectStyle(el) {
    document.querySelectorAll('[data-style]').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    travelStyle = el.dataset.style;
}

function adjustBudget(key, delta) {
    if (key === 'min') { budgetMin = Math.max(1000, budgetMin + delta); }
    if (key === 'max') { budgetMax = Math.max(budgetMin + 1000, budgetMax + delta); }
    updateBudgetDisplay();
}

function updateBudgetDisplay() {
    document.getElementById('budgetMin').textContent = budgetMin.toLocaleString('sv-SE');
    document.getElementById('budgetMax').textContent = budgetMax.toLocaleString('sv-SE');
}

function renderHolidays() {
    const list = document.getElementById('holidayList');
    if (!holidays.length) {
        list.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">No holidays added.</div>';
        return;
    }
    list.innerHTML = holidays.map((h, i) =>
        `<div class="holiday-settings-item">
            <span class="h-date">${h.date}</span>
            <span class="h-name">${h.name}</span>
            <span class="h-del material-symbols-rounded" onclick="removeHoliday(${i})">close</span>
        </div>`
    ).join('');
}

function addHoliday() {
    const date = document.getElementById('newHolidayDate').value;
    const name = document.getElementById('newHolidayName').value.trim();
    if (!date || !name) { toast('Please enter a date and name', 'err'); return; }
    if (holidays.some(h => h.date === date && h.name === name)) { toast('Holiday already exists', 'err'); return; }
    holidays.push({ date, name, country: 'SE' });
    holidays.sort((a, b) => a.date.localeCompare(b.date));
    document.getElementById('newHolidayDate').value = '';
    document.getElementById('newHolidayName').value = '';
    renderHolidays();
}

function removeHoliday(i) {
    holidays.splice(i, 1);
    renderHolidays();
}

async function saveSettings() {
    const payload = {
        vacationDaysTotal: vacTotal,
        vacationDaysUsed: vacUsed,
        currency,
        preferredTransport: transport,
        travelStyle,
        budgetRange: { min: budgetMin, max: budgetMax },
        publicHolidays: holidays,
    };
    try {
        await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        toast('Settings saved!', 'ok');
    } catch { toast('Failed to save settings', 'err'); }
}

async function wipeData() {
    if (!confirm('This will delete ALL trips and reset settings to defaults. Are you sure?')) return;
    try {
        await fetch('/api/wipe', { method: 'POST' });
        toast('All data wiped. Reloading...', 'ok');
        setTimeout(() => location.href = '/', 1500);
    } catch { toast('Wipe failed', 'err'); }
}

function toast(msg, type) {
    const c = document.getElementById('toasts');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

init();
