import { MongoClient, Db, ObjectId } from 'mongodb';
import { Trip, TripStats } from '../models';

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

export async function getTrips(): Promise<Trip[]> {
    return getDb().collection<Trip>('trips').find().sort({ startDate: -1 }).toArray() as any;
}

export async function getTripById(id: string): Promise<Trip | null> {
    return getDb().collection<Trip>('trips').findOne({ _id: new ObjectId(id) as any }) as any;
}

export async function createTrip(trip: Omit<Trip, '_id'>): Promise<Trip> {
    const result = await getDb().collection<Trip>('trips').insertOne(trip as any);
    return { ...trip, _id: result.insertedId.toString() };
}

export async function updateTrip(id: string, updates: Partial<Trip>): Promise<boolean> {
    const result = await getDb().collection('trips').updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
}

export async function deleteTrip(id: string): Promise<boolean> {
    const result = await getDb().collection('trips').deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
}

export async function getTripStats(): Promise<TripStats> {
    const trips = await getTrips();
    const now = new Date().toISOString().split('T')[0];

    const completed = trips.filter(t => t.status === 'completed');
    const planned = trips.filter(t => t.status === 'planned');
    const ongoing = trips.filter(t => t.status === 'ongoing');

    const totalSpent = trips.reduce((sum, t) => {
        const spent = t.budget.expenses.filter(e => e.paid).reduce((s, e) => s + e.amount, 0);
        return sum + spent;
    }, 0);

    const totalBudget = trips.reduce((sum, t) => sum + t.budget.totalBudget, 0);

    const destinationCounts: Record<string, number> = {};
    for (const t of trips) {
        destinationCounts[t.destination] = (destinationCounts[t.destination] || 0) + 1;
    }
    const topDestinations = Object.entries(destinationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([d]) => d);

    const upcomingTrip = planned
        .filter(t => t.startDate >= now)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

    return {
        totalTrips: trips.length,
        completedTrips: completed.length,
        plannedTrips: planned.length,
        ongoingTrips: ongoing.length,
        totalSpent,
        totalBudget,
        topDestinations,
        upcomingTrip,
    };
}
