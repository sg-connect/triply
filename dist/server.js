"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const db = __importStar(require("./services/db"));
const ollama = __importStar(require("./services/ollama"));
const mock_data_1 = require("./mock-data");
const app = (0, express_1.default)();
const PORT = 3400;
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
// ── Stats ────────────────────────────────────────────────
app.get('/api/stats', async (_req, res) => {
    try {
        const stats = await db.getTripStats();
        res.json(stats);
    }
    catch (err) {
        console.error('[stats]', err);
        res.status(500).json({ error: 'Failed to load stats' });
    }
});
// ── Trips ────────────────────────────────────────────────
app.get('/api/trips', async (_req, res) => {
    try {
        const trips = await db.getTrips();
        res.json(trips);
    }
    catch (err) {
        console.error('[trips]', err);
        res.status(500).json({ error: 'Failed to load trips' });
    }
});
app.get('/api/trips/:id', async (req, res) => {
    try {
        const trip = await db.getTripById(req.params.id);
        if (!trip)
            return res.status(404).json({ error: 'Trip not found' });
        res.json(trip);
    }
    catch (err) {
        console.error('[trip]', err);
        res.status(500).json({ error: 'Failed to load trip' });
    }
});
app.post('/api/trips', async (req, res) => {
    try {
        const body = req.body;
        if (!body.name || !body.destination) {
            return res.status(400).json({ error: 'name and destination are required' });
        }
        const trip = {
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
    }
    catch (err) {
        console.error('[create trip]', err);
        res.status(500).json({ error: 'Failed to create trip' });
    }
});
app.put('/api/trips/:id', async (req, res) => {
    try {
        const ok = await db.updateTrip(req.params.id, req.body);
        if (!ok)
            return res.status(404).json({ error: 'Trip not found' });
        res.json({ success: true });
    }
    catch (err) {
        console.error('[update trip]', err);
        res.status(500).json({ error: 'Failed to update trip' });
    }
});
app.delete('/api/trips/:id', async (req, res) => {
    try {
        const ok = await db.deleteTrip(req.params.id);
        if (!ok)
            return res.status(404).json({ error: 'Trip not found' });
        res.json({ success: true });
    }
    catch (err) {
        console.error('[delete trip]', err);
        res.status(500).json({ error: 'Failed to delete trip' });
    }
});
// ── AI Analysis ──────────────────────────────────────────
app.post('/api/trips/:id/analyze', async (req, res) => {
    try {
        const trip = await db.getTripById(req.params.id);
        if (!trip)
            return res.status(404).json({ error: 'Trip not found' });
        const insights = await ollama.analyzeTripWithAI(trip, req.body.model);
        await db.updateTrip(req.params.id, { aiInsights: insights });
        res.json(insights);
    }
    catch (err) {
        console.error('[analyze]', err);
        res.status(500).json({ error: err.message || 'AI analysis failed' });
    }
});
// ── Ollama status ────────────────────────────────────────
app.get('/api/ollama/status', async (_req, res) => {
    try {
        const config = await ollama.checkOllamaConfig();
        res.json(config);
    }
    catch {
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
        const mocks = (0, mock_data_1.getMockTrips)();
        for (const trip of mocks) {
            await db.createTrip(trip);
        }
        res.json({ message: 'Seeded', count: mocks.length });
    }
    catch (err) {
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
