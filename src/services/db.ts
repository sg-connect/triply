import { MongoClient, Db, ObjectId } from 'mongodb';
import { Trip, TripStats, Settings, PublicHoliday } from '../models';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'triply';

let client: MongoClient;
let db: Db;

export async function connectDb(): Promise<Db> {
    if (db) return db;
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`  MongoDB connected: ${DB_NAME}`);
    return db;
}

export function getDb(): Db {
    if (!db) throw new Error('Database not connected. Call connectDb() first.');
    return db;
}

const SWEDISH_HOLIDAYS_2026: PublicHoliday[] = [
    { date: '2026-01-01', name: 'Nyårsdagen', country: 'SE' },
    { date: '2026-01-06', name: 'Trettondag jul', country: 'SE' },
    { date: '2026-04-03', name: 'Långfredag', country: 'SE' },
    { date: '2026-04-05', name: 'Påskdagen', country: 'SE' },
    { date: '2026-04-06', name: 'Annandag påsk', country: 'SE' },
    { date: '2026-05-01', name: 'Första maj', country: 'SE' },
    { date: '2026-05-14', name: 'Kristi himmelsfärdsdag', country: 'SE' },
    { date: '2026-05-25', name: 'Pingstdagen', country: 'SE' },
    { date: '2026-06-06', name: 'Sveriges nationaldag', country: 'SE' },
    { date: '2026-06-19', name: 'Midsommarafton', country: 'SE' },
    { date: '2026-06-20', name: 'Midsommardagen', country: 'SE' },
    { date: '2026-10-31', name: 'Alla helgons dag', country: 'SE' },
    { date: '2026-12-24', name: 'Julafton', country: 'SE' },
    { date: '2026-12-25', name: 'Juldagen', country: 'SE' },
    { date: '2026-12-26', name: 'Annandag jul', country: 'SE' },
    { date: '2026-12-31', name: 'Nyårsafton', country: 'SE' },
];

const DEFAULT_SETTINGS: Omit<Settings, '_id'> = {
    vacationDaysTotal: 25,
    vacationDaysUsed: 0,
    homeCountry: 'Sweden',
    homeCity: 'Stockholm',
    currency: 'SEK',
    preferredTransport: ['flight', 'train'],
    travelStyle: 'mixed',
    publicHolidays: SWEDISH_HOLIDAYS_2026,
    budgetRange: { min: 5000, max: 25000 },
    updatedAt: new Date(),
};

export async function getSettings(): Promise<Settings> {
    const doc = await getDb().collection<Settings>('settings').findOne({});
    if (!doc) {
        const result = await getDb().collection<Settings>('settings').insertOne(DEFAULT_SETTINGS as any);
        return { ...DEFAULT_SETTINGS, _id: result.insertedId.toString() };
    }
    return { ...doc, _id: doc._id?.toString() };
}

export async function saveSettings(updates: Partial<Settings>): Promise<Settings> {
    const existing = await getDb().collection('settings').findOne({});
    if (!existing) {
        const merged = { ...DEFAULT_SETTINGS, ...updates, updatedAt: new Date() };
        await getDb().collection('settings').insertOne(merged as any);
        return merged as Settings;
    }
    const merged = { ...existing, ...updates, updatedAt: new Date() };
    await getDb().collection('settings').updateOne({ _id: existing._id }, { $set: merged });
    return { ...merged, _id: existing._id.toString() } as unknown as Settings;
}

export async function getTrips(): Promise<Trip[]> {
    return getDb().collection<Trip>('trips').find().sort({ startDate: -1 }).toArray() as any;
}

export async function getTripById(id: string): Promise<Trip | null> {
    return getDb().collection<Trip>('trips').findOne({ _id: new ObjectId(id) as any }) as any;
}

export async function createTrip(trip: Omit<Trip, '_id'>): Promise<Trip> {
    const result = await getDb().collection<Trip>('trips').insertOne({
        ...trip,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as any);
    return { ...trip, _id: result.insertedId.toString() };
}

export async function updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | null> {
    await getDb().collection<Trip>('trips').updateOne(
        { _id: new ObjectId(id) as any },
        { $set: { ...updates, updatedAt: new Date() } }
    );
    return getTripById(id);
}

export async function deleteTrip(id: string): Promise<boolean> {
    const result = await getDb().collection<Trip>('trips').deleteOne({ _id: new ObjectId(id) as any });
    return result.deletedCount === 1;
}

export async function wipeAndReset(): Promise<void> {
    await getDb().collection('trips').deleteMany({});
    await getDb().collection('settings').deleteMany({});
    await getDb().collection<Settings>('settings').insertOne(DEFAULT_SETTINGS as any);
}

export async function getTripStats(): Promise<TripStats> {
    const [trips, settings] = await Promise.all([getTrips(), getSettings()]);
    const now = new Date().toISOString().split('T')[0];
    const completed = trips.filter(t => t.status === 'completed');
    const planned = trips.filter(t => t.status === 'planned');
    const scheduled = trips.filter(t => t.status === 'scheduled');
    const ongoing = trips.filter(t => t.status === 'ongoing');
    const totalSpent = completed.reduce((s, t) => s + (t.budget.expenses || []).filter(e => !e.predicted).reduce((a, e) => a + e.amount, 0), 0);
    const totalBudget = trips.reduce((s, t) => s + (t.budget.predictedBudget || t.budget.totalBudget || 0), 0);
    const destinationCounts: Record<string, number> = {};
    for (const t of trips) {
        destinationCounts[t.destination] = (destinationCounts[t.destination] || 0) + 1;
    }
    const topDestinations = Object.entries(destinationCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d);
    const upcomingTrip = [...planned, ...scheduled].filter(t => t.startDate >= now).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    const vacationDaysLeft = settings.vacationDaysTotal - settings.vacationDaysUsed;
    return {
        totalTrips: trips.length,
        completedTrips: completed.length,
        plannedTrips: planned.length,
        scheduledTrips: scheduled.length,
        ongoingTrips: ongoing.length,
        totalSpent,
        totalBudget,
        vacationDaysLeft,
        topDestinations,
        upcomingTrip,
    };
}
