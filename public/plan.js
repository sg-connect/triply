let days = 7, travelStyle = '', budget = 20000;
let settings = {};
let allCountries = [], selectedCountry = null, selectedCountryInfo = null;
let selectedCities = [], weatherResults = [], detailPlan = null;
let currentStep = 1;

// ============================
// Init
// ============================

async function init() {
    settings = await fetch('/api/settings').then(r => r.json()).catch(() => ({}));
    const left = (settings.vacationDaysTotal || 25) - (settings.vacationDaysUsed || 0);
    days = Math.min(left || 7, 21);
    budget = (settings.budgetRange && settings.budgetRange.max) || 20000;
    updateDaysDisplay();
    updateBudget();
    document.getElementById('budgetSlider').value = budget;
    const info = document.getElementById('vacDaysInfo');
    if (info) info.textContent = left + ' vacation days remaining';
    loadHolidays();
    loadAiStatus();
    loadCountries();
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

// ============================
// Step 1: Country Selection
// ============================

async function loadCountries() {
    try {
        allCountries = await fetch('/api/countries').then(r => r.json());
        renderCountries(allCountries);
    } catch {
        document.getElementById('countryGrid').innerHTML = '<div style="color:var(--danger);padding:12px">Failed to load countries. Check your internet connection.</div>';
    }
}

function filterCountries() {
    const q = (document.getElementById('countrySearch').value || '').toLowerCase().trim();
    if (!q) { renderCountries(allCountries); return; }
    const filtered = allCountries.filter(c =>
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || (c.capital || '').toLowerCase().includes(q)
    );
    renderCountries(filtered);
}

function renderCountries(list) {
    const grid = document.getElementById('countryGrid');
    if (!list.length) { grid.innerHTML = '<div style="color:var(--text-secondary);padding:12px">No countries match your search</div>'; return; }
    // Show popular regions first, then alphabetical
    const popular = ['ES', 'IT', 'GR', 'FR', 'PT', 'HR', 'TH', 'JP', 'TR', 'GB', 'US', 'MX', 'ID', 'MA', 'NO', 'AT'];
    const sorted = [...list].sort((a, b) => {
        const aP = popular.indexOf(a.code);
        const bP = popular.indexOf(b.code);
        if (aP >= 0 && bP >= 0) return aP - bP;
        if (aP >= 0) return -1;
        if (bP >= 0) return 1;
        return a.name.localeCompare(b.name);
    });
    grid.innerHTML = sorted.slice(0, 60).map(c =>
        `<div class="country-card${selectedCountry?.code === c.code ? ' selected' : ''}" onclick="pickCountry('${c.code}')">
            <span class="country-flag">${c.flag}</span>
            <span class="country-name">${c.name}</span>
        </div>`
    ).join('');
}

async function pickCountry(code) {
    selectedCountry = allCountries.find(c => c.code === code);
    selectedCities = [];
    document.querySelectorAll('.country-card').forEach(el => el.classList.remove('selected'));
    const clicked = document.querySelector(`.country-card[onclick="pickCountry('${code}')"]`);
    if (clicked) clicked.classList.add('selected');
    document.getElementById('step1Next').disabled = false;

    // Pre-fetch full country info
    try {
        selectedCountryInfo = await fetch('/api/countries/' + code).then(r => r.json());
    } catch { selectedCountryInfo = selectedCountry; }
}

// ============================
// Step 2: City Selection
// ============================

async function loadCities() {
    if (!selectedCountry) return;
    document.getElementById('selectedCountryFlag').textContent = selectedCountry.flag;
    document.getElementById('selectedCountryName').textContent = selectedCountry.name;

    // Show country info bar
    if (selectedCountryInfo) {
        const ci = selectedCountryInfo;
        document.getElementById('countryInfoBar').style.display = 'flex';
        document.getElementById('ciCapital').textContent = ci.capital || '—';
        document.getElementById('ciCurrency').textContent = (ci.currencies || []).join(', ') || '—';
        document.getElementById('ciLanguage').textContent = (ci.languages || []).slice(0, 2).join(', ') || '—';
        document.getElementById('ciRegion').textContent = [ci.region, ci.subregion].filter(Boolean).join(' / ') || '—';
    }

    const grid = document.getElementById('cityGrid');
    grid.innerHTML = '<div class="loading"><div class="spinner"></div>Loading cities...</div>';
    try {
        const cities = await fetch('/api/countries/' + selectedCountry.code + '/cities').then(r => r.json());
        if (!cities.length) {
            grid.innerHTML = '<div style="color:var(--text-secondary);padding:12px">No popular cities listed for this country yet. You can type a custom city below.</div>'
                + '<input type="text" id="customCity" class="country-search" placeholder="Type a city name..." style="margin-top:8px">'
                + '<button class="btn btn-secondary" style="margin-top:8px" onclick="addCustomCity()">Add City</button>';
            return;
        }
        grid.innerHTML = cities.map(city =>
            `<div class="city-card" onclick="toggleCity(this, '${city.replaceAll("'", "&#39;")}')" data-city="${city}">
                <span class="city-name">${city}</span>
                <span class="city-check material-symbols-rounded">check_circle</span>
            </div>`
        ).join('')
        + '<div style="margin-top:12px;display:flex;gap:8px;align-items:center">'
        + '<input type="text" id="customCity" class="country-search" placeholder="Or add a different city..." style="flex:1;margin:0">'
        + '<button class="btn btn-secondary" onclick="addCustomCity()" style="white-space:nowrap">+ Add</button>'
        + '</div>';

        // Restore selections
        selectedCities.forEach(city => {
            const card = grid.querySelector(`[data-city="${city}"]`);
            if (card) card.classList.add('selected');
        });
    } catch {
        grid.innerHTML = '<div style="color:var(--danger);padding:12px">Failed to load cities</div>';
    }
}

function toggleCity(el, city) {
    if (selectedCities.includes(city)) {
        selectedCities = selectedCities.filter(c => c !== city);
        el.classList.remove('selected');
    } else {
        selectedCities.push(city);
        el.classList.add('selected');
    }
    document.getElementById('step2Next').disabled = selectedCities.length === 0;
}

function addCustomCity() {
    const input = document.getElementById('customCity');
    const city = (input.value || '').trim();
    if (!city) return;
    if (selectedCities.includes(city)) { input.value = ''; return; }
    selectedCities.push(city);
    input.value = '';
    // Add a visual card
    const grid = document.getElementById('cityGrid');
    const div = document.createElement('div');
    div.className = 'city-card selected';
    div.dataset.city = city;
    div.onclick = function() { toggleCity(div, city); };
    div.innerHTML = `<span class="city-name">${city}</span><span class="city-check material-symbols-rounded">check_circle</span>`;
    grid.insertBefore(div, grid.querySelector('div[style]'));
    document.getElementById('step2Next').disabled = false;
}

// ============================
// Step 3: Details (days, style, budget, holidays)
// ============================

function adjustDays(d) {
    days = Math.max(1, Math.min(30, days + d));
    updateDaysDisplay();
}

function updateDaysDisplay() {
    const el = document.getElementById('daysDisplay');
    if (el) el.textContent = days;
}

function selectStyle(el) {
    document.querySelectorAll('.style-mini').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    travelStyle = el.dataset.style;
}

function updateBudget() {
    const v = Number.parseInt(document.getElementById('budgetSlider').value, 10);
    budget = v;
    const curr = settings.currency === 'USD' ? 'USD' : 'kr';
    const display = curr === 'USD' ? '$' + v.toLocaleString() : v.toLocaleString('sv-SE') + ' kr';
    document.getElementById('budgetDisplay').textContent = display;
}

function onDateChange() {
    // Refresh holiday combos if date changes
}

// Holiday combos (same logic as before)
function loadHolidays() {
    const today = new Date().toISOString().split('T')[0];
    const upcoming = (settings.publicHolidays || []).filter(h => h.date >= today);
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
            <span class="holiday-days-tag">${c.totalDays} days${c.vacDays > 0 ? ' (' + c.vacDays + ' vacation)' : ' (free!)'}</span>
        </div>`
    ).join('');
}

function countVacationDays(startDate, endDate, holidayDates) {
    let count = 0;
    const d = new Date(startDate);
    const last = endDate.getTime();
    while (d.getTime() <= last) {
        const dow = d.getDay();
        const iso = d.toISOString().split('T')[0];
        if (dow !== 0 && dow !== 6 && !holidayDates.has(iso)) count++;
        d.setDate(d.getDate() + 1);
    }
    return count;
}

const COMBO_RULES = {
    1: { startOff: -3, endOff: 0, bonus: 'Take Fri off \u2014 4-day weekend!' },
    2: { startOff: -1, endOff: 5, bonus: 'Take Mon off \u2014 5-day trip!' },
    3: { startOff:  0, endOff: 0, bonus: 'Midweek break \u2014 enjoy the day off!' },
    4: { startOff:  0, endOff: 3, bonus: 'Take Fri off \u2014 4-day trip!' },
    5: { startOff:  0, endOff: 3, bonus: 'Take Mon off \u2014 4-day weekend!' },
};

function comboWindow(holidayDate) {
    const d = new Date(holidayDate);
    const dow = d.getDay();
    const rule = COMBO_RULES[dow];
    if (!rule) return { start: d, end: d, bonus: 'Weekend holiday!' };
    const start = new Date(d); start.setDate(start.getDate() + rule.startOff);
    const end = new Date(d); end.setDate(end.getDate() + rule.endOff);
    return { start, end, bonus: rule.bonus };
}

function buildCombos(holidays) {
    const holidayDates = new Set(holidays.map(h => h.date));
    return holidays.map(h => {
        const { start, end, bonus } = comboWindow(h.date);
        const totalDays = Math.round((end - start) / 86400000) + 1;
        const vacDays = countVacationDays(start, end, holidayDates);
        return { name: h.name, date: h.date, dateLabel: new Date(h.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), totalDays, vacDays, bonus };
    }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
}

function selectCombo(i) {
    const today = new Date().toISOString().split('T')[0];
    const upcoming = (settings.publicHolidays || []).filter(h => h.date >= today);
    const combos = buildCombos(upcoming.slice(0, 12));
    if (!combos[i]) return;
    days = combos[i].vacDays || 1;
    document.getElementById('startDate').value = combos[i].date;
    updateDaysDisplay();
    document.querySelectorAll('.holiday-item').forEach((el, idx) => el.classList.toggle('selected', idx === i));
}

// ============================
// Step 4: Fetch Weather + AI Plan
// ============================

let cityProfiles = [];

async function fetchWeatherAndPlan() {
    if (!travelStyle) { toast('Please pick a travel style', 'err'); return; }
    if (!selectedCities.length) { toast('No cities selected', 'err'); return; }

    goStep(4);
    const startDate = document.getElementById('startDate').value || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const curr = settings.currency || 'SEK';
    const citiesLabel = selectedCities.join(', ');
    document.getElementById('planTitle').textContent = (selectedCountry?.flag || '') + ' ' + citiesLabel + ', ' + (selectedCountry?.name || '');
    document.getElementById('planSub').textContent = days + '-day ' + travelStyle + ' trip';
    document.getElementById('planDetail').innerHTML = '<div class="loading"><div class="spinner"></div>Fetching city info from Wikipedia, weather from Open-Meteo, and live currency rates...</div>';
    document.getElementById('weatherSection').style.display = 'none';
    document.getElementById('citiesSection').style.display = 'none';

    // 1. Fetch full city enrichment for all selected cities in parallel
    cityProfiles = [];
    weatherResults = [];
    try {
        const enrichPromises = selectedCities.map(city =>
            fetch(`/api/city/enrich?city=${encodeURIComponent(city)}&country=${encodeURIComponent(selectedCountry?.name || '')}&countryCode=${encodeURIComponent(selectedCountry?.code || '')}&startDate=${startDate}&days=${days}&homeCurrency=${curr}`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
        );
        cityProfiles = (await Promise.all(enrichPromises)).filter(Boolean);
        weatherResults = cityProfiles.map(p => p.weather).filter(Boolean);

        if (cityProfiles.length) {
            document.getElementById('citiesSection').style.display = 'block';
            renderCityProfiles(cityProfiles);
        }
        if (weatherResults.length) {
            document.getElementById('weatherSection').style.display = 'block';
            renderWeatherCards(weatherResults);
        }
    } catch { /* enrichment is optional */ }

    // 2. Send everything to AI for planning
    document.getElementById('planDetail').innerHTML = '<div class="loading"><div class="spinner"></div>AI is planning your trip using real city data, weather, and currency rates...</div>';

    try {
        const destination = selectedCities.length === 1 ? selectedCities[0] : selectedCities.join(' + ');
        detailPlan = await fetch('/api/plan/detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination,
                country: selectedCountry?.name || '',
                days,
                style: travelStyle,
                currency: curr,
                weatherData: weatherResults.length ? weatherResults[0] : null,
                countryInfo: selectedCountryInfo || null,
                cityProfiles,
            }),
        }).then(r => r.json());

        renderDetail();
    } catch {
        document.getElementById('planDetail').innerHTML = '<div style="color:var(--danger);padding:20px">Failed to generate plan. Make sure Ollama is running.</div>';
    }
}

function renderCityProfiles(profiles) {
    const container = document.getElementById('cityProfiles');
    container.innerHTML = profiles.map(p => {
        const s = p.summary || {};
        const g = p.guide || {};
        const c = p.currency;
        const seeList = (g.see || []).slice(0, 6);
        const doList = (g.doActivities || []).slice(0, 5);
        const eatList = (g.eat || []).slice(0, 4);
        const drinkList = (g.drink || []).slice(0, 3);

        return `<div class="city-profile">
            ${s.thumbnail ? `<div class="cp-image" style="background-image:url('${s.thumbnail}')"></div>` : ''}
            <div class="cp-content">
                <div class="cp-header">
                    <div class="cp-title">${p.city}${s.description ? ` <span class="cp-desc">· ${s.description}</span>` : ''}</div>
                    ${s.url ? `<a href="${s.url}" target="_blank" class="cp-link" rel="noopener">Wikipedia &#8599;</a>` : ''}
                </div>
                ${s.extract ? `<p class="cp-extract">${s.extract}</p>` : ''}

                ${c?.rate ? `<div class="cp-currency">💱 1 ${c.base} = ${c.rate.toFixed(4)} ${c.target}</div>` : ''}

                ${seeList.length || doList.length || eatList.length ? '<div class="cp-sections">' : ''}
                ${seeList.length ? `<div class="cp-section">
                    <div class="cp-section-title">🏛️ See</div>
                    <ul class="cp-list">${seeList.map(i => `<li>${i}</li>`).join('')}</ul>
                </div>` : ''}
                ${doList.length ? `<div class="cp-section">
                    <div class="cp-section-title">🎯 Do</div>
                    <ul class="cp-list">${doList.map(i => `<li>${i}</li>`).join('')}</ul>
                </div>` : ''}
                ${eatList.length ? `<div class="cp-section">
                    <div class="cp-section-title">🍽️ Eat</div>
                    <ul class="cp-list">${eatList.map(i => `<li>${i}</li>`).join('')}</ul>
                </div>` : ''}
                ${drinkList.length ? `<div class="cp-section">
                    <div class="cp-section-title">🍸 Drink</div>
                    <ul class="cp-list">${drinkList.map(i => `<li>${i}</li>`).join('')}</ul>
                </div>` : ''}
                ${seeList.length || doList.length || eatList.length ? '</div>' : ''}

                ${g.url ? `<a href="${g.url}" target="_blank" class="cp-wikivoyage" rel="noopener">Full Wikivoyage guide &#8599;</a>` : ''}
            </div>
        </div>`;
    }).join('');
}

const WEATHER_ICONS = {
    0: '☀️',    // Clear sky
    1: '🌤️',   // Mainly clear
    2: '⛅',    // Partly cloudy
    3: '☁️',    // Overcast
    45: '🌫️',  // Foggy
    48: '🌫️',  // Rime fog
    51: '🌦️',  // Light drizzle
    53: '🌧️',  // Moderate drizzle
    55: '🌧️',  // Dense drizzle
    61: '🌦️',  // Slight rain
    63: '🌧️',  // Moderate rain
    65: '🌧️',  // Heavy rain
    71: '🌨️',  // Slight snow
    73: '❄️',   // Moderate snow
    75: '❄️',   // Heavy snow
    80: '🌦️',  // Slight showers
    81: '🌧️',  // Moderate showers
    82: '⛈️',   // Violent showers
    95: '⛈️',   // Thunderstorm
    96: '⛈️',   // Thunderstorm + hail
    99: '⛈️',   // Thunderstorm + heavy hail
};

function weatherIcon(code) {
    return WEATHER_ICONS[code] || '🌡️';
}

function summaryIcon(label) {
    if (!label) return '🌡️';
    const l = label.toLowerCase();
    if (l.includes('hot') || l.includes('sunny')) return '☀️';
    if (l.includes('warm') && l.includes('sunny')) return '🌤️';
    if (l.includes('warm')) return '⛅';
    if (l.includes('pleasant') || l.includes('mild') && !l.includes('rain')) return '🌤️';
    if (l.includes('rain')) return '🌧️';
    if (l.includes('cool') && l.includes('dry')) return '🌥️';
    if (l.includes('cool')) return '🌥️';
    if (l.includes('cold')) return '❄️';
    return '🌡️';
}

function renderWeatherCards(results) {
    const cards = document.getElementById('weatherCards');
    cards.innerHTML = results.map(w => {
        const s = w.summary || {};
        const dailyHtml = (w.daily || []).slice(0, 7).map(d =>
            `<div class="wd-day">
                <div class="wd-icon">${weatherIcon(d.weatherCode)}</div>
                <div class="wd-date">${new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</div>
                <div class="wd-temp">${Math.round(d.tempMax)}°<span class="wd-temp-low">${Math.round(d.tempMin)}°</span></div>
                <div class="wd-label">${d.weatherLabel}</div>
                ${d.precipitation > 0 ? `<div class="wd-rain">💧 ${d.precipitation.toFixed(1)}mm</div>` : ''}
            </div>`
        ).join('');
        return `<div class="weather-card">
            <div class="wc-header">
                <div class="wc-city">${summaryIcon(s.overallLabel)} ${w.city}</div>
                <div class="wc-summary">${s.overallLabel || ''}</div>
            </div>
            <div class="wc-stats">
                <span>🌡️ ${s.avgTempMin}° – ${s.avgTempMax}°C</span>
                <span>🌧️ ${s.rainyDays} rainy day${s.rainyDays === 1 ? '' : 's'}</span>
                <span>☀️ ${s.sunnyDays} sunny day${s.sunnyDays === 1 ? '' : 's'}</span>
            </div>
            <div class="wc-daily">${dailyHtml}</div>
        </div>`;
    }).join('');
}

// ============================
// Render Plan Detail (same as before)
// ============================

function renderDetail() {
    const curr = settings.currency === 'USD' ? 'USD' : 'kr';
    const bp = detailPlan.budgetBreakdown || {};
    const nearby = (detailPlan.nearbyOptions || []).slice(0, 3);
    let html = '';
    if (detailPlan.overview) {
        html += `<div class="plan-section"><div class="plan-section-title">Overview</div><div class="plan-overview">${detailPlan.overview}</div></div>`;
    }
    if (detailPlan.dayByDay && detailPlan.dayByDay.length) {
        html += '<div class="plan-section"><div class="plan-section-title">Day by Day</div>';
        html += detailPlan.dayByDay.map(d => {
            const colon = d.indexOf(':');
            const label = colon > 0 ? d.slice(0, colon) : '';
            const text = colon > 0 ? d.slice(colon + 1).trim() : d;
            return `<div class="day-item">${label ? `<span class="day-num">${label}:</span> ` : ''}${text}</div>`;
        }).join('');
        html += '</div>';
    }
    if (detailPlan.tips && detailPlan.tips.length) {
        html += '<div class="plan-section"><div class="plan-section-title">Tips & Tricks</div>';
        html += detailPlan.tips.map(t => `<div class="tip-item">${t}</div>`).join('');
        html += '</div>';
    }
    if (bp.total) {
        html += '<div class="plan-section"><div class="plan-section-title">Predicted Budget</div><div class="budget-breakdown">';
        ['flight', 'accommodation', 'food', 'activities', 'other'].filter(k => bp[k]).forEach(k => {
            html += `<div class="bb-row"><span class="bb-label">${k.charAt(0).toUpperCase() + k.slice(1)}</span><span class="bb-val">${bp[k].toLocaleString()} ${curr}</span></div>`;
        });
        html += `<div class="bb-row total"><span class="bb-label" style="font-weight:700">Total</span><span class="bb-val">${bp.total.toLocaleString()} ${curr}</span></div>`;
        html += '</div></div>';
    }
    if (nearby.length) {
        html += '<div class="plan-section"><div class="plan-section-title">Nearby Options</div>';
        html += nearby.map(n => `<div class="nearby-item">
            <div class="nearby-flag">${n.flag || '\ud83c\udff3\ufe0f'}</div>
            <div class="nearby-info"><div class="nearby-name">${n.destination}, ${n.country}</div><div class="nearby-reason">${n.reason}</div></div>
            <span class="nearby-extra">+${n.extraDays} days</span>
        </div>`).join('');
        html += '</div>';
    }
    document.getElementById('planDetail').innerHTML = html || '<p style="color:var(--text-secondary)">No plan data returned.</p>';
}

// ============================
// Step 5: Confirm & Save
// ============================

function renderConfirm() {
    const curr = settings.currency === 'USD' ? 'USD' : 'kr';
    const bp = detailPlan && detailPlan.budgetBreakdown;
    const citiesLabel = selectedCities.join(', ');
    document.getElementById('confirmFlag').textContent = selectedCountry?.flag || '✈️';
    document.getElementById('confirmTitle').textContent = citiesLabel;
    document.getElementById('confirmDest').textContent = (selectedCountry?.name || '') + ' \u2014 ' + travelStyle + ' trip';
    document.getElementById('confirmDays').textContent = days + ' days';
    document.getElementById('confirmBudget').textContent = bp ? (bp.total.toLocaleString() + ' ' + curr) : '\u2014';
    document.getElementById('confirmStyle').textContent = travelStyle.charAt(0).toUpperCase() + travelStyle.slice(1);
}

async function scheduleTrip() { await saveTrip('scheduled'); }
async function startTrip() { await saveTrip('planned'); }

async function saveTrip(status) {
    if (!selectedCities.length) { toast('No cities selected', 'err'); return; }
    const curr = settings.currency || 'SEK';
    const bp = detailPlan && detailPlan.budgetBreakdown;
    const startDate = document.getElementById('startDate').value || '';
    let endDate = '';
    if (startDate) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + days - 1);
        endDate = d.toISOString().split('T')[0];
    }
    const citiesLabel = selectedCities.join(', ');
    const trip = {
        name: `${days}-Day ${citiesLabel} ${travelStyle.charAt(0).toUpperCase() + travelStyle.slice(1)}`,
        destination: citiesLabel,
        country: selectedCountry?.name || '',
        countryCode: selectedCountry?.code || '',
        flag: selectedCountry?.flag || '✈️',
        startDate,
        endDate,
        durationDays: days,
        status,
        travelStyle,
        notes: '',
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
        places: (detailPlan?.tips || []).slice(0, 5).map(tip => ({ name: tip, category: 'attraction', status: 'want' })),
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
        setTimeout(() => { location.href = '/trips.html'; }, 1500);
    } catch { toast('Failed to save trip', 'err'); }
}

// ============================
// Navigation
// ============================

function goStep(n) {
    if (n === 2 && !selectedCountry) { toast('Please pick a country', 'err'); return; }
    if (n === 2) loadCities();
    if (n === 3 && !selectedCities.length) { toast('Please pick at least one city', 'err'); return; }
    if (n === 5) renderConfirm();
    currentStep = n;
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('step' + n);
    if (panel) panel.classList.add('active');
    // Update stepper dots
    for (let i = 1; i <= 5; i++) {
        const dot = document.getElementById('dot' + i);
        if (!dot) continue;
        dot.classList.remove('active', 'done');
        if (i < n) dot.classList.add('done');
        else if (i === n) dot.classList.add('active');
    }
    // Update stepper lines
    for (let i = 1; i <= 4; i++) {
        const line = document.getElementById('line' + i);
        if (!line) continue;
        line.classList.toggle('done', i < n);
    }
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
