let days = 7, travelStyle = '', budget = 20000;
let settings = {}, suggestions = [], selectedDest = null, detailPlan = null, currentStep = 1;

async function init() {
    settings = await fetch('/api/settings').then(r => r.json()).catch(() => ({}));
    const left = (settings.vacationDaysTotal || 25) - (settings.vacationDaysUsed || 0);
    days = Math.min(left || 7, 21);
    budget = (settings.budgetRange && settings.budgetRange.max) || 20000;
    updateDaysDisplay();
    updateBudget();
    loadHolidays();
    loadAiStatus();
    document.getElementById('budgetSlider').value = budget;
}

async function loadAiStatus() {
    try {
        const d = await fetch('/api/ollama/status').then(r => r.json());
        const dot = document.getElementById('aiDot');
        const lbl = document.getElementById('aiLabel');
        if (d.available) {
            dot.className = 'ai-dot on';
            lbl.textContent = 'AI: ' + (d.travelModels[0] || d.models[0] || 'ready').split(':')[0];
        } else {
            dot.className = 'ai-dot off';
            lbl.textContent = 'AI offline';
        }
    } catch {
        document.getElementById('aiDot').className = 'ai-dot off';
        document.getElementById('aiLabel').textContent = 'AI offline';
    }
}

function loadHolidays() {
    const today = new Date().toISOString().split('T')[0];
    const upcoming = (settings.publicHolidays || []).filter(h => h.date >= today);
    const info = document.getElementById('vacDaysInfo');
    const left = (settings.vacationDaysTotal || 25) - (settings.vacationDaysUsed || 0);
    if (info) info.textContent = left + ' vacation days remaining';

    const combos = buildCombos(upcoming.slice(0, 12));
    const list = document.getElementById('holidayList');
    if (!list) return;
    if (!combos.length) {
        list.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">No upcoming holidays. Add them in <a href="/settings.html" style="color:var(--green)">Settings</a>.</div>';
        return;
    }
    list.innerHTML = combos.map((c, i) =>
        `<div class="holiday-item" id="hc${i}" onclick="selectCombo(${i})">
            <div>
                <div class="holiday-name">${c.name}</div>
                <div class="holiday-bonus">${c.bonus}</div>
            </div>
            <span class="holiday-date-tag">${c.dateLabel}</span>
            <span class="holiday-days-tag">${c.totalDays} days</span>
        </div>`
    ).join('');
}

function buildCombos(holidays) {
    return holidays.map(h => {
        const d = new Date(h.date);
        const dow = d.getDay();
        let extra = 2, bonus = 'Extended weekend!';
        if (dow === 1) { extra = 3; bonus = 'Take Fri off \u2014 4-day weekend!'; }
        else if (dow === 5) { extra = 3; bonus = 'Take Mon off \u2014 4-day weekend!'; }
        else if (dow === 2) { extra = 4; bonus = 'Take Mon+Fri off \u2014 5-day trip!'; }
        else if (dow === 4) { extra = 4; bonus = 'Take Thu+Fri off \u2014 5-day trip!'; }
        else if (dow === 3) { extra = 2; bonus = 'Bridge the week \u2014 3-day trip!'; }
        return {
            name: h.name,
            date: h.date,
            dateLabel: new Date(h.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            totalDays: extra + 1,
            bonus,
        };
    }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
}

function selectCombo(i) {
    const today = new Date().toISOString().split('T')[0];
    const upcoming = (settings.publicHolidays || []).filter(h => h.date >= today);
    const combos = buildCombos(upcoming.slice(0, 12));
    if (!combos[i]) return;
    days = combos[i].totalDays;
    document.getElementById('startDate').value = combos[i].date;
    updateDaysDisplay();
    document.querySelectorAll('.holiday-item').forEach((el, idx) => el.classList.toggle('selected', idx === i));
}

function adjustDays(d) {
    days = Math.max(2, Math.min(30, days + d));
    updateDaysDisplay();
}

function updateDaysDisplay() {
    const el = document.getElementById('daysDisplay');
    if (el) el.textContent = days;
}

function selectStyle(el) {
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    travelStyle = el.dataset.style;
}

function updateBudget() {
    const v = parseInt(document.getElementById('budgetSlider').value);
    budget = v;
    const curr = settings.currency === 'USD' ? 'USD' : 'kr';
    const display = curr === 'USD' ? '$' + v.toLocaleString() : v.toLocaleString('sv-SE') + ' kr';
    document.getElementById('budgetDisplay').textContent = display;
}

function setBudgetPreset(v) {
    document.getElementById('budgetSlider').value = v;
    updateBudget();
}

function goStep(n) {
    if (n === 2 && !days) { toast('Please set number of days', 'err'); return; }
    if (n === 3 && !travelStyle) { toast('Please pick a travel style', 'err'); return; }
    if (n === 6) renderConfirm();
    currentStep = n;
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('step' + n);
    if (panel) panel.classList.add('active');
    for (let i = 1; i <= 6; i++) {
        const dot = document.getElementById('dot' + i);
        if (!dot) continue;
        dot.classList.remove('active', 'done');
        if (i < n) dot.classList.add('done');
        else if (i === n) dot.classList.add('active');
    }
}

async function getSuggestions() {
    if (!travelStyle) { toast('Please pick a travel style first', 'err'); goStep(2); return; }
    goStep(4);
    selectedDest = null;
    document.getElementById('detailBtn').style.display = 'none';
    const curr = settings.currency === 'USD' ? 'USD' : 'SEK';
    document.getElementById('s4summary').textContent = `${days} days \u2022 ${travelStyle} \u2022 ${budget.toLocaleString()} ${curr}`;
    document.getElementById('destGrid').innerHTML = '<div class="loading" style="grid-column:1/-1"><div class="spinner"></div>AI is finding the best destinations for you\u2026</div>';
    const startDate = document.getElementById('startDate').value;
    const month = startDate ? new Date(startDate).getMonth() + 1 : new Date().getMonth() + 1;
    try {
        const data = await fetch('/api/plan/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                availableDays: days,
                startDate,
                travelStyle,
                budgetMin: Math.round(budget * 0.6),
                budgetMax: budget,
                currency: curr,
                preferredTransport: settings.preferredTransport || ['flight'],
                month,
            }),
        }).then(r => r.json());
        suggestions = Array.isArray(data) ? data : [];
        if (!suggestions.length) throw new Error('No suggestions');
        renderSuggestions();
    } catch {
        document.getElementById('destGrid').innerHTML = '<div style="color:var(--danger);padding:20px;text-align:center;grid-column:1/-1">AI could not get suggestions.<br><small>Make sure Ollama is running with a model.</small><br><br><button class="btn btn-secondary" onclick="getSuggestions()">Try again</button></div>';
    }
}

function renderSuggestions() {
    const curr = settings.currency === 'USD' ? 'USD' : 'kr';
    document.getElementById('destGrid').innerHTML = suggestions.map((s, i) =>
        `<div class="dest-card" id="dest${i}" onclick="pickDest(${i})">
            <div class="dest-flag">${s.flag || '🌍'}</div>
            <div class="dest-city">${s.city}</div>
            <div class="dest-country">${s.country}</div>
            <div class="dest-tagline">${s.tagline || ''}</div>
            <div class="dest-tags">
                ${s.directFlight ? '<span class="dest-tag direct">\u2708\uFE0F Direct</span>' : ''}
                ${s.flightHours ? `<span class="dest-tag">\u23F1 ${s.flightHours}h</span>` : ''}
                ${(s.travelStyle || []).slice(0,2).map(st => `<span class="dest-tag">${st}</span>`).join('')}
            </div>
            <div class="dest-row">
                <div class="dest-budget">${s.budgetMin ? s.budgetMin.toLocaleString() : '?'}\u2013${s.budgetMax ? s.budgetMax.toLocaleString() : '?'} ${curr}</div>
                <div class="dest-days">${s.daysMin || '?'}\u2013${s.daysMax || '?'} days</div>
            </div>
            <div class="dest-why">${s.why || ''}</div>
        </div>`
    ).join('');
}

function pickDest(i) {
    document.querySelectorAll('.dest-card').forEach((c, idx) => c.classList.toggle('selected', idx === i));
    selectedDest = suggestions[i];
    document.getElementById('detailBtn').style.display = 'inline-flex';
}

async function getDetail() {
    if (!selectedDest) return;
    goStep(5);
    document.getElementById('detailTitle').textContent = (selectedDest.flag || '') + ' ' + selectedDest.city + ', ' + selectedDest.country;
    document.getElementById('detailSub').textContent = days + '-day ' + travelStyle + ' trip \u2014 full AI plan';
    document.getElementById('planDetail').innerHTML = '<div class="loading"><div class="spinner"></div>Building your day-by-day plan\u2026</div>';
    try {
        detailPlan = await fetch('/api/plan/detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination: selectedDest.city,
                country: selectedDest.country,
                days,
                style: travelStyle,
                currency: settings.currency || 'SEK',
            }),
        }).then(r => r.json());
        renderDetail();
    } catch {
        document.getElementById('planDetail').innerHTML = '<div style="color:var(--danger);padding:20px">Failed to generate plan. Check Ollama is running.</div>';
    }
}

function renderDetail() {
    const curr = settings.currency === 'USD' ? 'USD' : 'kr';
    const bp = detailPlan.budgetBreakdown || {};
    const nearby = (detailPlan.nearbyOptions || []).slice(0, 3);
    let html = '';
    if (detailPlan.overview) {
        html += `<div class="plan-section"><div class="plan-section-title">Overview</div><div class="plan-overview">${detailPlan.overview}</div></div>`;
    }
    if (detailPlan.dayByDay && detailPlan.dayByDay.length) {
        html += `<div class="plan-section"><div class="plan-section-title">Day by Day</div>`;
        html += detailPlan.dayByDay.map(d => {
            const colon = d.indexOf(':');
            const label = colon > 0 ? d.slice(0, colon) : '';
            const text = colon > 0 ? d.slice(colon + 1).trim() : d;
            return `<div class="day-item">${label ? `<span class="day-num">${label}:</span> ` : ''}${text}</div>`;
        }).join('');
        html += '</div>';
    }
    if (detailPlan.tips && detailPlan.tips.length) {
        html += `<div class="plan-section"><div class="plan-section-title">Tips &amp; Tricks</div>`;
        html += detailPlan.tips.map(t => `<div class="tip-item">${t}</div>`).join('');
        html += '</div>';
    }
    if (bp.total) {
        html += `<div class="plan-section"><div class="plan-section-title">Predicted Budget</div><div class="budget-breakdown">`;
        ['flight','accommodation','food','activities','other'].filter(k => bp[k]).forEach(k => {
            html += `<div class="bb-row"><span class="bb-label">${k.charAt(0).toUpperCase()+k.slice(1)}</span><span class="bb-val">${bp[k].toLocaleString()} ${curr}</span></div>`;
        });
        html += `<div class="bb-row total"><span class="bb-label" style="font-weight:700">Total</span><span class="bb-val">${bp.total.toLocaleString()} ${curr}</span></div>`;
        html += '</div></div>';
    }
    if (nearby.length) {
        html += `<div class="plan-section"><div class="plan-section-title">Nearby Options</div>`;
        html += nearby.map(n => `<div class="nearby-item">
            <div class="nearby-flag">${n.flag || '🏳️'}</div>
            <div class="nearby-info"><div class="nearby-name">${n.destination}, ${n.country}</div><div class="nearby-reason">${n.reason}</div></div>
            <span class="nearby-extra">+${n.extraDays} days</span>
        </div>`).join('');
        html += '</div>';
    }
    document.getElementById('planDetail').innerHTML = html || '<p style="color:var(--text-secondary)">No plan data returned.</p>';
}

function renderConfirm() {
    if (!selectedDest) return;
    const curr = settings.currency === 'USD' ? 'USD' : 'kr';
    const bp = detailPlan && detailPlan.budgetBreakdown;
    document.getElementById('confirmFlag').textContent = selectedDest.flag || '✈️';
    document.getElementById('confirmTitle').textContent = selectedDest.city;
    document.getElementById('confirmDest').textContent = selectedDest.country + ' \u2014 ' + travelStyle + ' trip';
    document.getElementById('confirmDays').textContent = days + ' days';
    document.getElementById('confirmBudget').textContent = bp ? (bp.total.toLocaleString() + ' ' + curr) : '\u2014';
    document.getElementById('confirmStyle').textContent = travelStyle.charAt(0).toUpperCase() + travelStyle.slice(1);
}

async function scheduleTrip() { await saveTrip('scheduled'); }
async function startTrip() { await saveTrip('planned'); }

async function saveTrip(status) {
    if (!selectedDest) { toast('No destination selected', 'err'); return; }
    const curr = settings.currency || 'SEK';
    const bp = detailPlan && detailPlan.budgetBreakdown;
    const startDate = document.getElementById('startDate').value || '';
    let endDate = '';
    if (startDate) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + days - 1);
        endDate = d.toISOString().split('T')[0];
    }
    const trip = {
        name: `${days}-Day ${selectedDest.city} ${travelStyle.charAt(0).toUpperCase() + travelStyle.slice(1)}`,
        destination: selectedDest.city,
        country: selectedDest.country,
        countryCode: '',
        flag: selectedDest.flag || '✈️',
        startDate,
        endDate,
        durationDays: days,
        status,
        travelStyle,
        notes: selectedDest.tagline || '',
        budget: {
            totalBudget: 0,
            predictedBudget: bp ? bp.total : budget,
            currency: curr,
            expenses: bp ? [
                { category: 'transport', description: 'Flights (predicted)', amount: bp.flight || 0, predicted: true, date: startDate, paid: false },
                { category: 'accommodation', description: 'Accommodation (predicted)', amount: bp.accommodation || 0, predicted: true, date: startDate, paid: false },
                { category: 'food', description: 'Food & drinks (predicted)', amount: bp.food || 0, predicted: true, date: startDate, paid: false },
                { category: 'activities', description: 'Activities (predicted)', amount: bp.activities || 0, predicted: true, date: startDate, paid: false },
            ].filter(e => e.amount > 0) : [],
        },
        transports: [],
        places: (selectedDest.tips || []).slice(0, 5).map(tip => ({ name: tip, category: 'attraction', status: 'want' })),
        aiPlan: detailPlan,
    };
    try {
        const res = await fetch('/api/trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trip),
        });
        if (!res.ok) throw new Error('Failed');
        toast('Trip saved! Redirecting...', 'ok');
        setTimeout(() => location.href = '/trips.html', 1500);
    } catch { toast('Failed to save trip', 'err'); }
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
