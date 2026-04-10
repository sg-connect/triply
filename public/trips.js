let allTrips = [], settings = {}, activeFilter = 'all';

async function init() {
    [allTrips, settings] = await Promise.all([
        fetch('/api/trips').then(r => r.json()).catch(() => []),
        fetch('/api/settings').then(r => r.json()).catch(() => ({})),
    ]);
    updateCount();
    render();
    const id = new URLSearchParams(location.search).get('id');
    if (id) { const t = allTrips.find(t => t._id === id); if (t) openModal(t); }
}

function updateCount() {
    const visible = filterList(activeFilter);
    document.getElementById('tripCount').textContent = `${visible.length} trip${visible.length !== 1 ? 's' : ''}`;
}

function filterList(filter) {
    if (filter === 'all') return allTrips;
    return allTrips.filter(t => t.status === filter);
}

function filterTrips(filter, btn) {
    activeFilter = filter;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateCount();
    render();
}

function render() {
    const trips = filterList(activeFilter);
    const el = document.getElementById('tripsGrid');
    if (!trips.length) {
        el.innerHTML = `<div class="empty">
            <div class="empty-icon">🗺️</div>
            <h3>No ${activeFilter === 'all' ? '' : activeFilter + ' '}trips yet</h3>
            <p>Start planning your next adventure</p>
            <a class="btn btn-primary" href="/plan.html" style="margin-top:16px">Plan a trip</a>
        </div>`;
        return;
    }
    el.innerHTML = trips.map(t => tripCard(t)).join('');
}

function tripCard(t) {
    const curr = (t.budget && t.budget.currency === 'USD') ? '$' : 'kr';
    const predicted = t.budget && t.budget.predictedBudget;
    const real = t.budget ? (t.budget.expenses || []).filter(e => !e.predicted).reduce((s, e) => s + e.amount, 0) : 0;
    const pct = predicted && real ? Math.min(120, Math.round((real / predicted) * 100)) : 0;
    const places = (t.places || []).slice(0, 3).map(p => p.name).join(', ');
    return `<div class="trip-card" onclick="openModal(${JSON.stringify(t).replace(/"/g, '&quot;')})">
        <div class="trip-card-top">
            <div class="trip-flag">${t.flag || '\u2708\uFE0F'}</div>
            <div style="flex:1">
                <div class="trip-name">${t.name}</div>
                <div class="trip-dest">${t.destination}${t.country ? ', ' + t.country : ''}</div>
                ${t.startDate ? `<div class="trip-dates">${fmt(t.startDate)}${t.endDate ? ' \u2013 ' + fmt(t.endDate) : ''}</div>` : ''}
            </div>
            <span class="badge badge-${t.status}">${t.status}</span>
        </div>
        ${predicted ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:4px">
            <span>Budget: ${predicted.toLocaleString()} ${curr}</span>
            ${real ? `<span style="color:${pct > 100 ? 'var(--danger)' : 'var(--green)'}">Spent: ${real.toLocaleString()} ${curr}</span>` : ''}
        </div>
        <div class="budget-track"><div class="budget-fill${pct > 100 ? ' over' : ''}" style="width:${pct}%"></div></div>` : ''}
        <div class="trip-meta">
            ${t.durationDays ? `<span><span class="material-symbols-rounded">schedule</span>${t.durationDays} days</span>` : ''}
            ${places ? `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${places}</span>` : ''}
        </div>
    </div>`;
}

function openModal(t) {
    if (typeof t === 'string') t = allTrips.find(x => x._id === t);
    if (!t) return;
    const curr = (t.budget && t.budget.currency === 'USD') ? 'USD' : 'kr';
    const expenses = (t.budget && t.budget.expenses) || [];
    const places = t.places || [];
    const ai = t.aiInsights;

    const modalEl = document.getElementById('tripModal');
    modalEl.style.display = 'flex';
    modalEl.className = 'modal-overlay';
    modalEl.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <div class="modal-flag">${t.flag || '\u2708\uFE0F'}</div>
                <div>
                    <div class="modal-title">${t.name}</div>
                    <div style="color:var(--text-secondary);font-size:13px">${t.destination}${t.country ? ', ' + t.country : ''}</div>
                    <span class="badge badge-${t.status}" style="margin-top:4px;display:inline-block">${t.status}</span>
                </div>
                <span class="modal-close material-symbols-rounded" onclick="closeModal()">close</span>
            </div>
            ${t.startDate ? `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">${fmt(t.startDate)}${t.endDate ? ' \u2013 ' + fmt(t.endDate) : ''}${t.durationDays ? ' \u2022 ' + t.durationDays + ' days' : ''}</div>` : ''}

            ${expenses.length ? `<div class="modal-section">
                <div class="modal-section-title">Budget</div>
                <div class="expense-list">
                    ${expenses.map(e => `<div class="expense-item">
                        <span class="e-cat">${e.category}</span>
                        <span class="e-desc">${e.description}</span>
                        ${e.predicted ? '<span class="e-predicted">predicted</span>' : ''}
                        <span class="e-amt">${e.amount.toLocaleString()} ${curr}</span>
                    </div>`).join('')}
                </div>
                ${t.budget.predictedBudget ? `<div style="text-align:right;margin-top:8px;font-size:13px;color:var(--text-secondary)">Total predicted: <strong style="color:var(--blue)">${t.budget.predictedBudget.toLocaleString()} ${curr}</strong></div>` : ''}
            </div>` : ''}

            ${places.length ? `<div class="modal-section">
                <div class="modal-section-title">Places</div>
                <div class="place-chips">
                    ${places.map(p => `<span class="place-chip ${p.status}">${p.name}</span>`).join('')}
                </div>
            </div>` : ''}

            ${ai ? `<div class="modal-section">
                <div class="modal-section-title">AI Insights</div>
                <div class="ai-insights-box">
                    <div class="insights-summary">${ai.summary}</div>
                    ${ai.highlights && ai.highlights.length ? `<div class="insights-highlights">${ai.highlights.map(h => `<div class="highlight-item">${h}</div>`).join('')}</div>` : ''}
                    ${ai.warnings && ai.warnings.length ? ai.warnings.map(w => `<div class="warning-item">${w}</div>`).join('') : ''}
                </div>
            </div>` : ''}

            ${t.notes ? `<div class="modal-section">
                <div class="modal-section-title">Notes</div>
                <div style="font-size:13px;color:var(--text-secondary)">${t.notes}</div>
            </div>` : ''}

            <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
                ${!ai ? `<button class="btn btn-secondary" onclick="analyzeTrip('${t._id}')"><span class="material-symbols-rounded">auto_awesome</span>AI Analyze</button>` : ''}
                <button class="btn btn-danger" onclick="deleteTrip('${t._id}')"><span class="material-symbols-rounded">delete</span>Delete</button>
            </div>
        </div>`;
}

function closeModal() {
    document.getElementById('tripModal').style.display = 'none';
    history.replaceState({}, '', '/trips.html');
}

async function analyzeTrip(id) {
    toast('Analyzing with AI...', '');
    try {
        const updated = await fetch(`/api/trips/${id}/analyze`, { method: 'POST' }).then(r => r.json());
        const i = allTrips.findIndex(t => t._id === id);
        if (i >= 0) allTrips[i] = updated;
        closeModal();
        openModal(updated);
        toast('AI analysis complete!', 'ok');
    } catch { toast('Analysis failed', 'err'); }
}

async function deleteTrip(id) {
    if (!confirm('Delete this trip?')) return;
    try {
        await fetch(`/api/trips/${id}`, { method: 'DELETE' });
        allTrips = allTrips.filter(t => t._id !== id);
        closeModal();
        render();
        toast('Trip deleted', 'ok');
    } catch { toast('Delete failed', 'err'); }
}

function fmt(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toast(msg, type) {
    const c = document.getElementById('toasts');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), type ? 3000 : 6000);
}

init();
