"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMockTrips = getMockTrips;
function getMockTrips() {
    const now = new Date();
    return [
        {
            name: 'Summer in Barcelona',
            destination: 'Barcelona',
            country: 'Spain',
            startDate: '2026-07-10',
            endDate: '2026-07-18',
            status: 'planned',
            coverEmoji: '🇪🇸',
            notes: 'Visit Sagrada Familia, eat tapas, beach days.',
            budget: {
                totalBudget: 2000,
                currency: 'EUR',
                expenses: [
                    { category: 'transport', description: 'Round-trip flight', amount: 420, date: '2026-07-10', paid: true },
                    { category: 'accommodation', description: 'Airbnb 8 nights', amount: 680, date: '2026-07-10', paid: true },
                    { category: 'food', description: 'Food budget estimate', amount: 300, date: '2026-07-10', paid: false },
                    { category: 'activities', description: 'Sagrada Familia + Park Güell', amount: 60, date: '2026-07-11', paid: false },
                ],
            },
            transports: [
                { type: 'flight', from: 'Stockholm', to: 'Barcelona', departureDate: '2026-07-10', departureTime: '07:30', arrivalTime: '10:45', provider: 'Vueling', reference: 'VY1234', price: 210, currency: 'EUR', status: 'confirmed' },
                { type: 'flight', from: 'Barcelona', to: 'Stockholm', departureDate: '2026-07-18', departureTime: '18:00', arrivalTime: '21:15', provider: 'Vueling', reference: 'VY1235', price: 210, currency: 'EUR', status: 'confirmed' },
            ],
            places: [
                { name: 'Sagrada Família', category: 'landmark', status: 'want' },
                { name: 'Park Güell', category: 'park', status: 'want' },
                { name: 'La Barceloneta Beach', category: 'beach', status: 'want' },
                { name: 'El Born', category: 'neighborhood', status: 'want' },
            ],
            createdAt: now,
            updatedAt: now,
        },
        {
            name: 'Weekend in Copenhagen',
            destination: 'Copenhagen',
            country: 'Denmark',
            startDate: '2026-05-22',
            endDate: '2026-05-25',
            status: 'planned',
            coverEmoji: '🇩🇰',
            notes: 'Short Scandinavian getaway. Noma area, canals, Tivoli.',
            budget: {
                totalBudget: 900,
                currency: 'EUR',
                expenses: [
                    { category: 'transport', description: 'Train Stockholm-Copenhagen', amount: 120, date: '2026-05-22', paid: true },
                    { category: 'accommodation', description: 'Hotel 3 nights', amount: 420, date: '2026-05-22', paid: false },
                    { category: 'food', description: 'Food & drinks', amount: 200, date: '2026-05-22', paid: false },
                ],
            },
            transports: [
                { type: 'train', from: 'Stockholm', to: 'Copenhagen', departureDate: '2026-05-22', departureTime: '09:00', arrivalTime: '13:30', provider: 'SJ', reference: 'SJ8821', price: 120, currency: 'EUR', status: 'confirmed' },
            ],
            places: [
                { name: 'Tivoli Gardens', category: 'park', status: 'want' },
                { name: 'Nyhavn', category: 'landmark', status: 'want' },
                { name: 'The Little Mermaid', category: 'landmark', status: 'want' },
            ],
            createdAt: now,
            updatedAt: now,
        },
        {
            name: 'Tokyo Winter Adventure',
            destination: 'Tokyo',
            country: 'Japan',
            startDate: '2025-12-01',
            endDate: '2025-12-14',
            status: 'completed',
            coverEmoji: '🇯🇵',
            notes: 'Amazing trip. Cherry blossom in December was unexpected, ramen every day.',
            budget: {
                totalBudget: 4500,
                currency: 'EUR',
                expenses: [
                    { category: 'transport', description: 'Flights', amount: 980, date: '2025-12-01', paid: true },
                    { category: 'accommodation', description: 'Hotel 13 nights', amount: 1300, date: '2025-12-01', paid: true },
                    { category: 'food', description: 'Food & drinks', amount: 850, date: '2025-12-01', paid: true },
                    { category: 'activities', description: 'Tokyo Pass + experiences', amount: 420, date: '2025-12-01', paid: true },
                    { category: 'shopping', description: 'Shopping & souvenirs', amount: 680, date: '2025-12-01', paid: true },
                ],
            },
            transports: [
                { type: 'flight', from: 'Stockholm', to: 'Tokyo', departureDate: '2025-12-01', departureTime: '11:00', arrivalTime: '06:30+1', provider: 'Finnair', reference: 'AY73', price: 490, currency: 'EUR', status: 'confirmed' },
                { type: 'flight', from: 'Tokyo', to: 'Stockholm', departureDate: '2025-12-14', departureTime: '10:00', arrivalTime: '15:30', provider: 'Finnair', reference: 'AY74', price: 490, currency: 'EUR', status: 'confirmed' },
            ],
            places: [
                { name: 'Shibuya Crossing', category: 'landmark', status: 'visited', rating: 5 },
                { name: 'Shinjuku Gyoen', category: 'park', status: 'visited', rating: 5 },
                { name: 'Senso-ji Temple', category: 'temple', status: 'visited', rating: 4 },
                { name: 'Tsukiji Market', category: 'market', status: 'visited', rating: 5 },
                { name: 'teamLab Borderless', category: 'museum', status: 'visited', rating: 5 },
            ],
            createdAt: now,
            updatedAt: now,
        },
    ];
}
