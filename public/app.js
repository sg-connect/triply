let settings = {};

async function init() {
    loadAiStatus();
    const [stats, trips] = await Promise.all([
        fetch('/api/stats').then(r => r.json()).catch(() => ({})),
        fetch('/api/trips').then(r => r.json()).catch(() => []),
    ]);
    settings = await fetch('/api/settings').then(r => r.json()).catch(() => ({}));
    renderStats(stats);
    renderUpcoming(stats.upcomingTrip);
    renderTrips(trips.slice(0, 6));
    document.getElementById('greeting').textContent = greeting();
}

function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning ✈️';
    if (h < 17) return 'Good afternoon ✈️';
    return 'Good evening ✈️';
}

async function loadAiStatus() {
    try {
        const d = await fetch('/api/ollama/status').then(r => r.json());
        const dot = document.getElementById('aiDot');
        const label = document.getElementById('aiLabel');
        if (d.available) {
            dot.className = 'ai-dot on';
            const model = (d.travelModels[0] || d.models[0] || '').split(':')[0];
            label.textContent = 'AI: ' + (model || 'ready');
        } else {
            dot.className = 'ai-dot off';
            label.textContent = 'AI offline';
        }
    } catch {
        document.getElementById('aiDot').className = 'ai-dot off';
        document.getElementById('aiLabel').textContent = 'AI offline';
    }
}

function renderStats(s) {
    const curr = settings.currency === 'USD' ? '$' : 'kr';
    document.getElementById('statVac').textContent = s.vacationDaysLeft ?? '—';
    document.getElementById('statVacSub').textContent = `of ${settings.vacationDaysTotal || 25} total`;
    document.getElementById('statUpcoming').textContent = (s.plannedTrips || 0) + (s.scheduledTrips || 0);
    document.getElementById('statSpent').textContent = s.totalSpent ? fmtMoney(s.totalSpent, curr) : '0';
    document.getElementById('statSpentSub').textContent = s.topDestinations && s.topDestinations.length ? 'top: ' + s.topDestinations[0] : 'across all trips';
    document.getElementById('statDone').textContent = s.completedTrips ?? '—';
}

function renderUpcoming(trip) {
    const el = document.getElementById('upcomingBanner');
    if (!trip) { el.innerHTML = ''; return; }
    const days = trip.startDate ? Math.max(0, Math.ceil((new Date(trip.startDate) - new Date()) / 86400000)) : null;
    el.innerHTML = `
        <div class="upcoming-banner">
            <div class="upcoming-flag">${trip.flag || '✈️'}</div>
            <div class="upcoming-info">
                <div class="upcoming-label">Next trip</div>
                <div class="upcoming-name">${trip.name}</div>
                <div class="upcoming-dates">${trip.destination}${trip.startDate ? ' • ' + fmt(trip.startDate) : ''}</div>
            </div>
            ${days !== null ? `<div style="text-align:right"><div class="upcoming-countdown">${days}</div><div class="upcoming-cdays">days to go</div></div>` : ''}
        </div>`;
}

function renderTrips(trips) {
    const el = document.getElementById('recentTrips');
    if (!trips.length) {
        el.innerHTML = `<div class="empty">
            <div class="empty-icon">🗺️</div>
            <h3>No trips yet</h3>
            <p>Start planning your first adventure</p>
            <a class="btn btn-primary" href="/plan.html" style="margin-top:16px">Plan a trip</a>
        </div>`;
        return;
    }
    el.innerHTML = trips.map(t => tripCard(t)).join('');
}

function tripCard(t) {
    const curr = (t.budget && t.budget.currency === 'USD') ? '$' : 'kr';
    const predicted = t.budget && t.budget.predictedBudget;
    const real = t.budget && (t.budget.expenses || []).filter(e => !e.predicted).reduce((s, e) => s + e.amount, 0);
    const pct = predicted && real ? Math.min(120, Math.round((real / predicted) * 100)) : 0;
    const places = (t.places || []).slice(0, 3).map(p => p.name).join(', ');
    const transport = (t.transports || []).map(tr => tr.type).filter((v, i, a) => a.indexOf(v) === i).join(', ');
    return `<div class="trip-card" onclick="location.href='/trips.html?id=${t._id}'">
        <div class="trip-card-top">
            <div class="trip-flag">${t.flag || '✈️'}</div>
            <div style="flex:1">
                <div class="trip-name">${t.name}</div>
                <div class="trip-dest">${t.destination}${t.country ? ', ' + t.country : ''}</div>
                ${t.startDate ? `<div class="trip-dates">${fmt(t.startDate)}${t.endDate ? ' – ' + fmt(t.endDate) : ''}</div>` : ''}
            </div>
            <span class="badge badge-${t.status}">${t.status}</span>
        </div>
        ${predicted ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:4px">
            <span>Budget: ${fmtMoney(predicted, curr)}</span>
            ${real ? `<span style="color:${pct > 100 ? 'var(--danger)' : 'var(--green)'}">Spent: ${fmtMoney(real, curr)}</span>` : ''}
        </div>
        <div class="budget-track"><div class="budget-fill${pct > 100 ? ' over' : ''}" style="width:${pct}%"></div></div>` : ''}
        <div class="trip-meta">
            ${t.durationDays ? `<span><span class="material-symbols-rounded">schedule</span>${t.durationDays}d</span>` : ''}
            ${transport ? `<span><span class="material-symbols-rounded">flight</span>${transport}</span>` : ''}
            ${places ? `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${places}</span>` : ''}
        </div>
    </div>`;
}

function fmtMoney(n, curr) {
    if (curr === '$') return '$' + n.toLocaleString();
    return n.toLocaleString('sv-SE') + ' kr';
}

function fmt(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

init();
