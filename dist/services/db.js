"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDb = connectDb;
exports.getDb = getDb;
exports.getTrips = getTrips;
exports.getTripById = getTripById;
exports.createTrip = createTrip;
exports.updateTrip = updateTrip;
exports.deleteTrip = deleteTrip;
exports.getTripStats = getTripStats;
const mongodb_1 = require("mongodb");
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'triply';
let client;
let db;
async function connectDb() {
    if (db)
        return db;
    client = new mongodb_1.MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`  MongoDB connected: ${DB_NAME}`);
    return db;
}
function getDb() {
    if (!db)
        throw new Error('Database not connected. Call connectDb() first.');
    return db;
}
async function getTrips() {
    return getDb().collection('trips').find().sort({ startDate: -1 }).toArray();
}
async function getTripById(id) {
    return getDb().collection('trips').findOne({ _id: new mongodb_1.ObjectId(id) });
}
async function createTrip(trip) {
    const result = await getDb().collection('trips').insertOne(trip);
    return { ...trip, _id: result.insertedId.toString() };
}
async function updateTrip(id, updates) {
    const result = await getDb().collection('trips').updateOne({ _id: new mongodb_1.ObjectId(id) }, { $set: { ...updates, updatedAt: new Date() } });
    return result.modifiedCount > 0;
}
async function deleteTrip(id) {
    const result = await getDb().collection('trips').deleteOne({ _id: new mongodb_1.ObjectId(id) });
    return result.deletedCount > 0;
}
async function getTripStats() {
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
    const destinationCounts = {};
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
