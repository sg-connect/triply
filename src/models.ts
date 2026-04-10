// ============================
// Triply Data Models
// ============================

export type TripStatus = 'planned' | 'ongoing' | 'completed' | 'cancelled';
export type TransportType = 'flight' | 'bus' | 'train' | 'car' | 'ferry' | 'other';
export type PlaceStatus = 'want' | 'visited' | 'skipped';
export type BudgetCategory = 'transport' | 'accommodation' | 'food' | 'activities' | 'shopping' | 'other';

export interface Trip {
    _id?: string;
    name: string;
    destination: string;
    country: string;
    startDate: string;
    endDate: string;
    status: TripStatus;
    coverEmoji: string;
    notes: string;
    budget: Budget;
    transports: Transport[];
    places: Place[];
    aiInsights?: AiInsights;
    createdAt: Date;
    updatedAt: Date;
}

export interface Budget {
    totalBudget: number;
    currency: string;
    expenses: Expense[];
}

export interface Expense {
    _id?: string;
    category: BudgetCategory;
    description: string;
    amount: number;
    date: string;
    paid: boolean;
}

export interface Transport {
    _id?: string;
    type: TransportType;
    from: string;
    to: string;
    departureDate: string;
    departureTime: string;
    arrivalTime?: string;
    provider: string;
    reference?: string;
    price: number;
    currency: string;
    status: 'confirmed' | 'pending' | 'cancelled';
    notes?: string;
}

export interface Place {
    _id?: string;
    name: string;
    category: string;
    status: PlaceStatus;
    rating?: number;
    notes?: string;
    address?: string;
}

export interface AiInsights {
    summary: string;
    budgetAdvice: string;
    highlights: string[];
    warnings: string[];
    generatedAt: string;
    model: string;
}

export interface TripStats {
    totalTrips: number;
    completedTrips: number;
    plannedTrips: number;
    ongoingTrips: number;
    totalSpent: number;
    totalBudget: number;
    topDestinations: string[];
    upcomingTrip?: Trip;
}
