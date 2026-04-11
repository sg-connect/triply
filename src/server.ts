import express from 'express';
import path from 'path';
import * as db from './services/db';
import * as ollama from './services/ollama';
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
        const { destination, country, days, style, currency } = req.body;
        if (!destination || !days) return res.status(400).json({ error: 'destination and days required' });
        const plan = await ollama.generateTripPlan(destination, country || '', days, style || 'mixed', currency || 'SEK');
        res.json(plan);
    } catch (err) { console.error('[plan-detail]', err); res.status(500).json({ error: 'Failed to generate plan' }); }
});

app.post('/api/plan/from-prompt', async (req, res) => {
    try {
        const { prompt, currency } = req.body;
        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return res.status(400).json({ error: 'prompt is required' });
        }
        let webContext = '';
        try {
            const q = encodeURIComponent(`best travel destinations ${prompt.slice(0, 100)}`);
            const ddgRes = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_html=1&skip_disambig=1`, {
                headers: { 'User-Agent': 'Triply/1.0' },
                signal: AbortSignal.timeout(5000),
            });
            const ddgData = await ddgRes.json() as any;
            const parts: string[] = [];
            if (ddgData.AbstractText) parts.push(ddgData.AbstractText);
            if (Array.isArray(ddgData.RelatedTopics)) {
                for (const t of (ddgData.RelatedTopics as any[]).slice(0, 4)) {
                    if (t.Text) parts.push(t.Text);
                }
            }
            webContext = parts.join('\n');
        } catch {
            console.warn('[from-prompt] web search skipped');
        }
        const suggestions = await ollama.suggestFromFreePrompt(prompt.trim(), currency || 'SEK', webContext || undefined);
        res.json(suggestions);
    } catch (err) { console.error('[from-prompt]', err); res.status(500).json({ error: 'Failed to get suggestions from prompt' }); }
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
