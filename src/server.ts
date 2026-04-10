import express from 'express';
import path from 'path';
import * as db from './services/db';
import * as ollama from './services/ollama';
import { getMockTrips } from './mock-data';
import { Trip } from './models';

const app = express();
const PORT = 3400;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Stats ────────────────────────────────────────────────
app.get('/api/stats', async (_req, res) => {
    try {
        const stats = await db.getTripStats();
        res.json(stats);
    } catch (err) {
        console.error('[stats]', err);
        res.status(500).json({ error: 'Failed to load stats' });
    }
});

// ── Trips ────────────────────────────────────────────────
app.get('/api/trips', async (_req, res) => {
    try {
        const trips = await db.getTrips();
        res.json(trips);
    } catch (err) {
        console.error('[trips]', err);
        res.status(500).json({ error: 'Failed to load trips' });
    }
});

app.get('/api/trips/:id', async (req, res) => {
    try {
        const trip = await db.getTripById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });
        res.json(trip);
    } catch (err) {
        console.error('[trip]', err);
        res.status(500).json({ error: 'Failed to load trip' });
    }
});

app.post('/api/trips', async (req, res) => {
    try {
        const body = req.body as Partial<Trip>;
        if (!body.name || !body.destination) {
            return res.status(400).json({ error: 'name and destination are required' });
        }
        const trip: Omit<Trip, '_id'> = {
            name: body.name,
            destination: body.destination,
            country: body.country || '',
            startDate: body.startDate || '',
            endDate: body.endDate || '',
            status: body.status || 'planned',
            coverEmoji: body.coverEmoji || '✈️',
            notes: body.notes || '',
            budget: body.budget || { totalBudget: 0, currency: 'EUR', expenses: [] },
            transports: body.transports || [],
            places: body.places || [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const created = await db.createTrip(trip);
        res.status(201).json(created);
    } catch (err) {
        console.error('[create trip]', err);
        res.status(500).json({ error: 'Failed to create trip' });
    }
});

app.put('/api/trips/:id', async (req, res) => {
    try {
        const ok = await db.updateTrip(req.params.id, req.body);
        if (!ok) return res.status(404).json({ error: 'Trip not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('[update trip]', err);
        res.status(500).json({ error: 'Failed to update trip' });
    }
});

app.delete('/api/trips/:id', async (req, res) => {
    try {
        const ok = await db.deleteTrip(req.params.id);
        if (!ok) return res.status(404).json({ error: 'Trip not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('[delete trip]', err);
        res.status(500).json({ error: 'Failed to delete trip' });
    }
});

// ── AI Analysis ──────────────────────────────────────────
app.post('/api/trips/:id/analyze', async (req, res) => {
    try {
        const trip = await db.getTripById(req.params.id);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        const insights = await ollama.analyzeTripWithAI(trip, req.body.model);
        await db.updateTrip(req.params.id, { aiInsights: insights });
        res.json(insights);
    } catch (err: any) {
        console.error('[analyze]', err);
        res.status(500).json({ error: err.message || 'AI analysis failed' });
    }
});

// ── Ollama status ────────────────────────────────────────
app.get('/api/ollama/status', async (_req, res) => {
    try {
        const config = await ollama.checkOllamaConfig();
        res.json(config);
    } catch {
        res.json({ available: false });
    }
});

// ── Seed mock data ───────────────────────────────────────
app.post('/api/seed', async (_req, res) => {
    try {
        const existing = await db.getTrips();
        if (existing.length > 0) {
            return res.json({ message: 'Already has data', count: existing.length });
        }
        const mocks = getMockTrips();
        for (const trip of mocks) {
            await db.createTrip(trip);
        }
        res.json({ message: 'Seeded', count: mocks.length });
    } catch (err) {
        console.error('[seed]', err);
        res.status(500).json({ error: 'Seed failed' });
    }
});

// ── Boot ─────────────────────────────────────────────────
async function start() {
    await db.connectDb();
    app.listen(PORT, () => {
        console.log(`\n  Triply running at http://localhost:${PORT}\n`);
    });
}

start().catch(console.error);
