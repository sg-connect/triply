import { Trip, AiInsights } from '../models';

const OLLAMA_HOST = 'http://localhost:11434';
const OLLAMA_MODEL = 'triply-ai';

const TRAVEL_MODELS = ['triply-ai', 'llama', 'qwen', 'mistral', 'phi', 'gemma'];

export interface OllamaConfig {
    available: boolean;
    host: string;
    model: string;
    models: string[];
    travelModels: string[];
}

export async function checkOllamaConfig(): Promise<OllamaConfig> {
    try {
        const res = await fetch(`${OLLAMA_HOST}/api/tags`);
        if (!res.ok) throw new Error('Ollama not reachable');
        const data = await res.json() as any;
        const models: string[] = (data.models || []).map((m: any) => m.name);
        const travelModels = models.filter(m => TRAVEL_MODELS.some(t => m.includes(t)));
        const available = models.length > 0;
        return { available, host: OLLAMA_HOST, model: OLLAMA_MODEL, models, travelModels };
    } catch {
        return { available: false, host: OLLAMA_HOST, model: OLLAMA_MODEL, models: [], travelModels: [] };
    }
}

function buildTripPrompt(trip: Trip): string {
    const totalBudget = trip.budget.totalBudget;
    const spent = trip.budget.expenses.filter(e => e.paid).reduce((s, e) => s + e.amount, 0);
    const remaining = totalBudget - spent;
    const budgetPct = totalBudget > 0 ? ((spent / totalBudget) * 100).toFixed(1) : '0';

    const expenseBreakdown = trip.budget.expenses
        .reduce((acc: Record<string, number>, e) => {
            acc[e.category] = (acc[e.category] || 0) + e.amount;
            return acc;
        }, {});

    const expenseLines = Object.entries(expenseBreakdown)
        .map(([cat, amt]) => `  - ${cat}: ${trip.budget.currency} ${amt.toFixed(2)}`)
        .join('\n');

    const places = trip.places.map(p => `- ${p.name} (${p.status})`).join('\n') || 'None listed';
    const transports = trip.transports.map(t => `- ${t.type}: ${t.from} → ${t.to} on ${t.departureDate}`).join('\n') || 'None listed';

    return `You are a travel assistant. Analyze this trip and provide helpful insights.

TRIP: ${trip.name}
Destination: ${trip.destination}, ${trip.country}
Dates: ${trip.startDate} to ${trip.endDate}
Status: ${trip.status}

BUDGET:
Total: ${trip.budget.currency} ${totalBudget}
Spent: ${trip.budget.currency} ${spent.toFixed(2)} (${budgetPct}%)
Remaining: ${trip.budget.currency} ${remaining.toFixed(2)}

EXPENSE BREAKDOWN:
${expenseLines || '  No expenses yet'}

TRANSPORT:
${transports}

PLACES:
${places}

NOTES: ${trip.notes || 'None'}

Provide a JSON response with this exact structure:
{
  "summary": "2-3 sentence overview of the trip and its status",
  "budgetAdvice": "1-2 sentences of budget advice",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "warnings": ["warning 1 if any"]
}

Respond only with valid JSON.`;
}

export async function analyzeTripWithAI(trip: Trip, modelName?: string): Promise<AiInsights> {
    const config = await checkOllamaConfig();

    const model = modelName
        || config.travelModels[0]
        || config.models.find(m => m.includes('llama') || m.includes('qwen') || m.includes('mistral'))
        || config.models[0];

    if (!model) {
        throw new Error('No Ollama model available');
    }

    const prompt = buildTripPrompt(trip);

    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

    const data = await res.json() as any;
    const raw = data.response?.trim() || '{}';

    let parsed: any = {};
    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
        parsed = { summary: raw, budgetAdvice: '', highlights: [], warnings: [] };
    }

    return {
        summary: parsed.summary || 'Analysis complete.',
        budgetAdvice: parsed.budgetAdvice || '',
        highlights: parsed.highlights || [],
        warnings: parsed.warnings || [],
        generatedAt: new Date().toISOString(),
        model,
    };
}
