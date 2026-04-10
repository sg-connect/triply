let allTrips = [];
let currentFilter = 'all';
let currentView = 'dashboard';

// ── Init ─────────────────────────────────────────────────
async function init() {
    await seedIfEmpty();
    await loadOllamaStatus();
    await loadDashboard();
    setGreeting();
}

async function seedIfEmpty() {
    try {
        await fetch('/api/seed', { method: 'POST' });
    } catch {}
}

// ── Views ─────────────────────────────────────────────────
function showView(view) {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.style.display = 'none');
    document.getElementById(`view-${view}`).style.display = '';
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const idx = view === 'dashboard' ? 0 : 1;
    document.querySelectorAll('.nav-link')[idx]?.classList.add('active');
    currentView = view;

    if (view === 'trips') loadAllTrips();
}

// ── Greeting ──────────────────────────────────────────────
function setGreeting() {
    const hour = new Date().getHours();
    const msg = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const el = document.getElementById('dashGreeting');
    if (el) el.textContent = `${msg} — here's your travel overview`;
}

// ── Ollama ────────────────────────────────────────────────
async function loadOllamaStatus() {
    try {
        const data = await fetch('/api/ollama/status').then(r => r.json());
        const dot = document.getElementById('ollamaDot');
        const label = document.getElementById('ollamaLabel');
        if (data.available) {
            dot.className = 'ollama-dot online';
            label.textContent = `AI — ${data.travelModels[0] || data.models[0] || 'ready'}`;
        } else {
            dot.className = 'ollama-dot offline';
            label.textContent = 'AI offline';
        }
    } catch {}
}

// ── Dashboard ─────────────────────────────────────────────
async function loadDashboard() {
    try {
        const [stats, trips] = await Promise.all([
            fetch('/api/stats').then(r => r.json()),
            fetch('/api/trips').then(r => r.json()),
        ]);
        allTrips = trips;
        renderStats(stats);
        renderUpcomingBanner(stats.upcomingTrip);
        renderTripCards(trips.slice(0, 6), 'recentTrips');
    } catch (err) {
        console.error(err);
        toast('Failed to load dashboard', 'error');
    }
}

function renderStats(stats) {
    document.getElementById('statTotal').textContent = stats.totalTrips;
    document.getElementById('statTotalSub').textContent =
        stats.topDestinations.length ? `Top: ${stats.topDestinations.join(', ')}` : 'No trips yet';
    document.getElementById('statPlanned').textContent = stats.plannedTrips;
    document.getElementById('statSpent').textContent = `€${formatMoney(stats.totalSpent)}`;
    document.getElementById('statBudgetSub').textContent =
        stats.totalBudget > 0 ? `of €${formatMoney(stats.totalBudget)} budget` : 'no budget set';
    document.getElementById('statCompleted').textContent = stats.completedTrips;
}

function renderUpcomingBanner(trip) {
    const el = document.getElementById('upcomingBanner');
    if (!trip) { el.innerHTML = ''; return; }

    const days = Math.ceil((new Date(trip.startDate) - new Date()) / 86400000);
    const dateStr = formatDateRange(trip.startDate, trip.endDate);

    el.innerHTML = `
        <div class="upcoming-banner" onclick="openTripDetail('${trip._id}')">
            <div class="upcoming-emoji">${trip.coverEmoji}</div>
            <div class="upcoming-info">
                <div class="upcoming-label">Next adventure</div>
                <div class="upcoming-title">${trip.name}</div>
                <div class="upcoming-meta">${trip.destination}, ${trip.country} · ${dateStr}</div>
            </div>
            <div>
                <div class="upcoming-days">${days > 0 ? days : 'Today!'}</div>
                <div class="upcoming-days-label">${days > 1 ? 'days to go' : days === 1 ? 'day to go' : ''}</div>
            </div>
        </div>`;
}

// ── All Trips ─────────────────────────────────────────────
async function loadAllTrips() {
    try {
        allTrips = await fetch('/api/trips').then(r => r.json());
        applyFilter();
    } catch {
        toast('Failed to load trips', 'error');
    }
}

function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(el => el.classList.remove('active'));
    event.target.classList.add('active');
    applyFilter();
}

function applyFilter() {
    const filtered = currentFilter === 'all'
        ? allTrips
        : allTrips.filter(t => t.status === currentFilter);
    renderTripCards(filtered, 'allTrips');
}

// ── Trip Cards ────────────────────────────────────────────
function renderTripCards(trips, containerId) {
    const el = document.getElementById(containerId);
    if (!trips.length) {
        el.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><span class="material-symbols-rounded" style="font-size:56px">luggage</span></div>
                <div class="empty-title">No trips yet</div>
                <div class="empty-sub">Start planning your next adventure</div>
                <button class="btn btn-primary" onclick="openNewTripModal()">
                    <span class="material-symbols-rounded">add</span> New Trip
                </button>
            </div>`;
        return;
    }
    el.innerHTML = trips.map(trip => tripCardHTML(trip)).join('');
}

function tripCardHTML(trip) {
    const spent = trip.budget.expenses.filter(e => e.paid).reduce((s, e) => s + e.amount, 0);
    const pct = trip.budget.totalBudget > 0 ? Math.min((spent / trip.budget.totalBudget) * 100, 100) : 0;
    const over = spent > trip.budget.totalBudget && trip.budget.totalBudget > 0;
    const dateStr = formatDateRange(trip.startDate, trip.endDate);
    const placesVisited = trip.places.filter(p => p.status === 'visited').length;
    const transportsCount = trip.transports.length;

    return `
        <div class="trip-card" onclick="openTripDetail('${trip._id}')">
            <div class="trip-card-header">
                <div class="trip-emoji">${trip.coverEmoji}</div>
                <div class="trip-info">
                    <div class="trip-name">${trip.name}</div>
                    <div class="trip-destination">${trip.destination}, ${trip.country}</div>
                    <span class="status-badge status-${trip.status}">${trip.status}</span>
                </div>
            </div>
            <div class="trip-card-body">
                <div class="trip-dates">
                    <span class="material-symbols-rounded">calendar_month</span>
                    ${dateStr}
                </div>
                ${trip.budget.totalBudget > 0 ? `
                <div class="budget-bar-wrap">
                    <div class="budget-bar-labels">
                        <span>${trip.budget.currency} ${formatMoney(spent)} spent</span>
                        <span>${trip.budget.currency} ${formatMoney(trip.budget.totalBudget)}</span>
                    </div>
                    <div class="budget-bar">
                        <div class="budget-bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div>
                    </div>
                </div>` : ''}
            </div>
            <div class="trip-footer">
                <div class="trip-footer-item">
                    <span class="material-symbols-rounded">flight</span> ${transportsCount} transport${transportsCount !== 1 ? 's' : ''}
                </div>
                <div class="trip-footer-item">
                    <span class="material-symbols-rounded">location_on</span> ${placesVisited}/${trip.places.length} places
                </div>
            </div>
        </div>`;
}

// ── Trip Detail (placeholder) ─────────────────────────────
function openTripDetail(id) {
    const trip = allTrips.find(t => t._id === id || String(t._id) === String(id));
    if (!trip) return;
    toast(`Opening "${trip.name}" — detail view coming soon!`);
}

// ── New Trip Modal ────────────────────────────────────────
function openNewTripModal() {
    document.getElementById('newTripModal').classList.add('open');
}

function closeNewTripModal() {
    document.getElementById('newTripModal').classList.remove('open');
    clearNewTripForm();
}

function clearNewTripForm() {
    ['tripName', 'tripDestination', 'tripCountry', 'tripStart', 'tripEnd', 'tripBudget', 'tripEmoji', 'tripNotes']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('tripCurrency').value = 'EUR';
}

async function createTrip() {
    const name = document.getElementById('tripName').value.trim();
    const destination = document.getElementById('tripDestination').value.trim();

    if (!name || !destination) {
        toast('Name and destination are required', 'error');
        return;
    }

    const body = {
        name,
        destination,
        country: document.getElementById('tripCountry').value.trim(),
        startDate: document.getElementById('tripStart').value,
        endDate: document.getElementById('tripEnd').value,
        coverEmoji: document.getElementById('tripEmoji').value.trim() || '✈️',
        notes: document.getElementById('tripNotes').value.trim(),
        status: 'planned',
        budget: {
            totalBudget: parseFloat(document.getElementById('tripBudget').value) || 0,
            currency: document.getElementById('tripCurrency').value,
            expenses: [],
        },
        transports: [],
        places: [],
    };

    try {
        const res = await fetch('/api/trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed');
        const created = await res.json();
        allTrips.unshift(created);
        closeNewTripModal();
        toast(`"${name}" created!`, 'success');
        if (currentView === 'dashboard') loadDashboard();
        else applyFilter();
    } catch {
        toast('Failed to create trip', 'error');
    }
}

// Close modal on overlay click
document.getElementById('newTripModal').addEventListener('click', function(e) {
    if (e.target === this) closeNewTripModal();
});

// ── Helpers ───────────────────────────────────────────────
function formatMoney(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toFixed(0);
}

function formatDateRange(start, end) {
    if (!start) return 'Dates TBD';
    const s = new Date(start);
    const e = end ? new Date(end) : null;
    const opts = { day: 'numeric', month: 'short' };
    if (!e) return s.toLocaleDateString('en-GB', opts);
    if (s.getFullYear() !== e.getFullYear()) {
        return `${s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
    }
    return `${s.toLocaleDateString('en-GB', opts)} – ${e.toLocaleDateString('en-GB', opts)}`;
}

function toast(msg, type = '') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ── Boot ──────────────────────────────────────────────────
init();
