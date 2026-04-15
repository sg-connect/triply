import express from 'express';
import path from 'path';
import * as db from './services/db';
import * as ollama from './services/ollama';
import * as countries from './services/countries';
import * as weather from './services/weather';
import * as wiki from './services/wikipedia';
import * as currency from './services/currency';
import { Trip, PlanRequest } from './models';

const app = express();
const PORT = 3400;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/stats', async (_req, res) => {
    try { res.json(await db.getTripStats()); }
    catch (err) { console.error('[stats]', err); res.status(500).json({ error: 'Failed to load stats' }); }
});

app.get('/api/trips', async (_req, res) => {
    try { res.json(await db.getTrips()); }
    catch (err) { console.error('[trips]', err); res.status(500).json({ error: 'Failed to load trips' }); }
});

app.get('/api/trips/:id', async (req, res) => {
    try {
        const trip = await db.getTripById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });
        res.json(trip);
    } catch (err) { console.error('[trip]', err); res.status(500).json({ error: 'Failed to load trip' }); }
});

app.post('/api/trips', async (req, res) => {
    try {
        const body = req.body as Partial<Trip>;
        if (!body.name || !body.destination) return res.status(400).json({ error: 'name and destination required' });
        const settings = await db.getSettings();
        const trip: Omit<Trip, '_id'> = {
            name: body.name,
            destination: body.destination,
            country: body.country || '',
            countryCode: body.countryCode || '',
            flag: body.flag || '✈️',
            startDate: body.startDate || '',
            endDate: body.endDate || '',
            durationDays: body.durationDays || 0,
            status: body.status || 'planned',
            travelStyle: body.travelStyle || settings.travelStyle,
            notes: body.notes || '',
            budget: body.budget || { totalBudget: 0, predictedBudget: 0, currency: settings.currency, expenses: [] },
            transports: body.transports || [],
            places: body.places || [],
            aiPlan: body.aiPlan,
        };
        const created = await db.createTrip(trip);
        res.status(201).json(created);
    } catch (err) { console.error('[create-trip]', err); res.status(500).json({ error: 'Failed to create trip' }); }
});

app.put('/api/trips/:id', async (req, res) => {
    try {
        const trip = await db.updateTrip(req.params.id, req.body);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });
        res.json(trip);
    } catch (err) { console.error('[update-trip]', err); res.status(500).json({ error: 'Failed to update trip' }); }
});

app.delete('/api/trips/:id', async (req, res) => {
    try {
        const ok = await db.deleteTrip(req.params.id);
        if (!ok) return res.status(404).json({ error: 'Trip not found' });
        res.json({ ok: true });
    } catch (err) { console.error('[delete-trip]', err); res.status(500).json({ error: 'Failed to delete trip' }); }
});

app.post('/api/trips/:id/analyze', async (req, res) => {
    try {
        const trip = await db.getTripById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });
        const insights = await ollama.analyzeTripWithAI(trip);
        const updated = await db.updateTrip(req.params.id, { aiInsights: insights });
        res.json(updated);
    } catch (err) { console.error('[analyze]', err); res.status(500).json({ error: 'Failed to analyze trip' }); }
});

app.get('/api/settings', async (_req, res) => {
    try { res.json(await db.getSettings()); }
    catch (err) { console.error('[settings-get]', err); res.status(500).json({ error: 'Failed to load settings' }); }
});

app.put('/api/settings', async (req, res) => {
    try { res.json(await db.saveSettings(req.body)); }
    catch (err) { console.error('[settings-put]', err); res.status(500).json({ error: 'Failed to save settings' }); }
});

// --- Country & City data (REST Countries, no key) ---

app.get('/api/countries', async (_req, res) => {
    try {
        const all = await countries.getAllCountries();
        // Return a slim list for the dropdown (name, code, flag, capital, region)
        res.json(all.map(c => ({ name: c.name, code: c.code, flag: c.flag, capital: c.capital, region: c.region, subregion: c.subregion })));
    } catch (err) { console.error('[countries]', err); res.status(500).json({ error: 'Failed to load countries' }); }
});

app.get('/api/countries/:code', async (req, res) => {
    try {
        const info = await countries.getCountryByCode(req.params.code.toUpperCase());
        if (!info) return res.status(404).json({ error: 'Country not found' });
        res.json(info);
    } catch (err) { console.error('[country]', err); res.status(500).json({ error: 'Failed to load country' }); }
});

app.get('/api/countries/:code/cities', async (req, res) => {
    const cities = countries.getCitiesForCountry(req.params.code.toUpperCase());
    res.json(cities);
});

// --- City enrichment (Wikipedia + Wikivoyage + Weather + Currency, all free) ---

app.get('/api/city/enrich', async (req, res) => {
    try {
        const { city, country, countryCode, startDate, days, homeCurrency } = req.query;
        if (!city) return res.status(400).json({ error: 'city is required' });

        const cityStr = city as string;
        const countryStr = (country as string) || '';
        const start = (startDate as string) || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        const numDays = Number.parseInt((days as string) || '7', 10);

        // Fetch country info (for currency)
        let countryInfo = null;
        if (countryCode) {
            countryInfo = await countries.getCountryByCode((countryCode as string).toUpperCase());
        }

        // Run all data fetches in parallel
        const [summary, guide, weatherData, currencyRate] = await Promise.all([
            wiki.getCitySummary(cityStr, countryStr).catch(() => null),
            wiki.getWikivoyageGuide(cityStr).catch(() => null),
            weather.getCityWeather(cityStr, countryStr, start, numDays).catch(() => null),
            (homeCurrency && countryInfo?.currencies?.[0])
                ? currency.getRate(homeCurrency as string, countryInfo.currencies[0]).catch(() => null)
                : Promise.resolve(null),
        ]);

        res.json({
            city: cityStr,
            country: countryStr,
            summary,
            guide,
            weather: weatherData,
            currency: currencyRate,
            countryInfo,
        });
    } catch (err) { console.error('[city-enrich]', err); res.status(500).json({ error: 'City enrichment failed' }); }
});

// --- Weather (Open-Meteo, no key) ---

app.get('/api/weather', async (req, res) => {
    try {
        const { city, country, startDate, days } = req.query;
        if (!city || !startDate || !days) return res.status(400).json({ error: 'city, startDate, and days are required' });
        const result = await weather.getCityWeather(
            city as string,
            (country as string) || '',
            startDate as string,
            Number.parseInt(days as string, 10) || 7,
        );
        if (!result) return res.status(404).json({ error: 'Could not find weather for this city' });
        res.json(result);
    } catch (err) { console.error('[weather]', err); res.status(500).json({ error: 'Weather fetch failed' }); }
});

// --- Plan with real data (country + cities + weather → AI) ---

app.post('/api/plan/suggest', async (req, res) => {
    try {
        const planReq = req.body as PlanRequest;
        if (!planReq.availableDays || !planReq.travelStyle) {
            return res.status(400).json({ error: 'availableDays and travelStyle are required' });
        }
        const suggestions = await ollama.suggestDestinations(planReq);
        res.json(suggestions);
    } catch (err) { console.error('[plan-suggest]', err); res.status(500).json({ error: 'AI suggestion failed' }); }
});

app.post('/api/plan/detail', async (req, res) => {
    try {
        const { destination, country: countryName, days, style, currency: planCurrency, weatherData, countryInfo, cityProfiles } = req.body;
        if (!destination || !days) return res.status(400).json({ error: 'destination and days required' });
        const plan = await ollama.generateTripPlan(
            destination, countryName || '', days, style || 'mixed', planCurrency || 'SEK',
            weatherData || null, countryInfo || null, cityProfiles || null,
        );
        res.json(plan);
    } catch (err) { console.error('[plan-detail]', err); res.status(500).json({ error: 'Failed to generate plan' }); }
});

app.post('/api/wipe', async (_req, res) => {
    try { await db.wipeAndReset(); res.json({ ok: true, message: 'All data wiped and settings reset' }); }
    catch (err) { console.error('[wipe]', err); res.status(500).json({ error: 'Wipe failed' }); }
});

app.get('/api/ollama/status', async (_req, res) => {
    try { res.json(await ollama.getOllamaStatus()); }
    catch { res.json({ available: false, models: [], travelModels: [] }); }
});

async function start() {
    await db.connectDb();
    await db.getSettings();
    app.listen(PORT, () => console.log(`Triply running on http://localhost:${PORT}`));
}

start().catch(console.error);
