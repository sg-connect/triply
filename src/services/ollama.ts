import { PlanRequest, DestinationSuggestion, AiPlan, AiInsights, Trip } from '../models';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

async function getModel(): Promise<string | null> {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`);
        const data = await res.json() as any;
        const models: string[] = (data.models || []).map((m: any) => m.name);
        const travel = models.find(m => m.includes('triply') || m.includes('travel'));
        if (travel) return travel;
        const preferred = ['llama3.2', 'llama3.1', 'llama3', 'qwen2.5', 'gemma3', 'mistral'];
        for (const p of preferred) {
            const found = models.find(m => m.startsWith(p));
            if (found) return found;
        }
        return models[0] || null;
    } catch {
        return null;
    }
}

async function ask(prompt: string): Promise<string> {
    const model = await getModel();
    if (!model) throw new Error('No Ollama model available');
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.4 } }),
    });
    const data = await res.json() as any;
    return data.response || '';
}

function parseJson<T>(text: string, fallback: T): T {
    try {
        const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (match) return JSON.parse(match[1]);
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

export async function suggestDestinations(req: PlanRequest): Promise<DestinationSuggestion[]> {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = req.month ? monthNames[req.month - 1] : 'any month';
    const curr = req.currency === 'USD' ? 'USD' : 'SEK';
    const budget = `${req.budgetMin}–${req.budgetMax} ${curr}`;

    const prompt = `You are a travel planner. Suggest 4 great travel destinations for someone with these preferences:
- Available days: ${req.availableDays}
- Travel month: ${month}
- Travel style: ${req.travelStyle}
- Budget range: ${budget} (total per person including flights)
- Preferred transport: ${req.preferredTransport.join(', ')}

Return ONLY a JSON array with exactly 4 destinations in this format:
[
  {
    "country": "Greece",
    "city": "Athens",
    "flag": "🇬🇷",
    "tagline": "Ancient history meets vibrant nightlife",
    "travelStyle": ["culture", "nightlife"],
    "daysMin": 4,
    "daysMax": 7,
    "budgetMin": 12000,
    "budgetMax": 18000,
    "flightHours": 3.5,
    "directFlight": true,
    "tips": ["Visit Acropolis at sunrise", "Take the metro", "Try local tavernas"],
    "nearby": [{"destination": "Santorini", "country": "Greece", "flag": "🇬🇷", "extraDays": 3, "reason": "Easy island hop"}],
    "bestMonths": [4, 5, 9, 10],
    "why": "Perfect for ${req.availableDays} days in ${month} with your ${req.travelStyle} style"
  }
]

Budget amounts must be in ${curr}. Return only the JSON array, no other text.`;

    const raw = await ask(prompt);
    return parseJson<DestinationSuggestion[]>(raw, []);
}

export async function generateTripPlan(destination: string, country: string, days: number, style: string, currency: string): Promise<AiPlan> {
    const curr = currency === 'USD' ? 'USD' : 'SEK';
    const prompt = `Create a detailed ${days}-day ${style} travel plan for ${destination}, ${country}.

Return ONLY a JSON object:
{
  "overview": "Brief 2-sentence description of this trip",
  "dayByDay": [
    "Day 1: Arrive, check in, explore the old town and grab dinner",
    "Day 2: Morning museum visit, afternoon beach, evening bar crawl"
  ],
  "tips": [
    "Book accommodation early for peak season",
    "Use public transport — it's cheap and easy",
    "Try the local street food markets"
  ],
  "nearbyOptions": [
    {"destination": "City", "country": "Country", "flag": "🏳️", "extraDays": 2, "reason": "Easy day trip by train"}
  ],
  "budgetBreakdown": {
    "flight": 4500,
    "accommodation": 6000,
    "food": 3000,
    "activities": 2000,
    "other": 1000,
    "total": 16500,
    "currency": "${curr}"
  }
}

All budget numbers in ${curr}. Return only the JSON object.`;

    const model = await getModel();
    const raw = await ask(prompt);
    const plan = parseJson<AiPlan>(raw, {
        overview: `A ${days}-day ${style} trip to ${destination}, ${country}.`,
        dayByDay: [],
        tips: [],
        nearbyOptions: [],
        budgetBreakdown: { flight: 0, accommodation: 0, food: 0, activities: 0, other: 0, total: 0, currency: curr as any },
        generatedAt: new Date().toISOString(),
        model: model || 'unknown',
    });
    plan.generatedAt = new Date().toISOString();
    plan.model = model || 'unknown';
    return plan;
}

export async function analyzeTripWithAI(trip: Trip): Promise<AiInsights> {
    const spent = (trip.budget.expenses || []).filter(e => !e.predicted).reduce((s, e) => s + e.amount, 0);
    const curr = trip.budget.currency;
    const prompt = `Analyze this trip and give insights:
Trip: ${trip.name} to ${trip.destination}, ${trip.country}
Duration: ${trip.durationDays} days (${trip.startDate} to ${trip.endDate})
Style: ${trip.travelStyle}
Budget spent: ${spent} ${curr}
Predicted budget: ${trip.budget.predictedBudget || trip.budget.totalBudget} ${curr}
Places: ${(trip.places || []).map(p => p.name).join(', ') || 'none'}
Transports: ${(trip.transports || []).map(t => t.type + ' ' + t.from + '->' + t.to).join(', ') || 'none'}

Return ONLY a JSON object:
{
  "summary": "2-3 sentence trip summary",
  "budgetAdvice": "Specific budget recommendations",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "warnings": ["warning if any, else empty array"]
}`;

    const model = await getModel();
    const raw = await ask(prompt);
    const insights = parseJson<AiInsights>(raw, {
        summary: `${trip.durationDays}-day trip to ${trip.destination}.`,
        budgetAdvice: 'Track your expenses carefully.',
        highlights: [],
        warnings: [],
        generatedAt: new Date().toISOString(),
        model: model || 'unknown',
    });
    insights.generatedAt = new Date().toISOString();
    insights.model = model || 'unknown';
    return insights;
}

export async function getOllamaStatus(): Promise<{ available: boolean; models: string[]; travelModels: string[] }> {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`);
        const data = await res.json() as any;
        const models: string[] = (data.models || []).map((m: any) => m.name);
        const travelModels = models.filter(m => m.includes('triply') || m.includes('travel'));
        return { available: true, models, travelModels };
    } catch {
        return { available: false, models: [], travelModels: [] };
    }
}
