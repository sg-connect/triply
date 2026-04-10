export type TripStatus = 'planned' | 'ongoing' | 'completed' | 'cancelled' | 'scheduled';
export type TransportType = 'flight' | 'bus' | 'train' | 'car' | 'ferry' | 'other';
export type PlaceStatus = 'want' | 'visited' | 'skipped';
export type BudgetCategory = 'transport' | 'accommodation' | 'food' | 'activities' | 'shopping' | 'other';
export type TravelStyle = 'adventure' | 'relax' | 'culture' | 'nature' | 'nightlife' | 'mixed';

export interface Trip {
    _id?: string;
    name: string;
    destination: string;
    country: string;
    countryCode: string;
    flag: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    status: TripStatus;
    travelStyle: TravelStyle;
    notes: string;
    budget: Budget;
    transports: Transport[];
    places: Place[];
    aiInsights?: AiInsights;
    aiPlan?: AiPlan;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Budget {
    totalBudget: number;
    predictedBudget: number;
    currency: 'SEK' | 'USD';
    expenses: Expense[];
}

export interface Expense {
    _id?: string;
    category: BudgetCategory;
    description: string;
    amount: number;
    predicted: boolean;
    date: string;
    paid: boolean;
}

export interface Transport {
    _id?: string;
    type: TransportType;
    from: string;
    to: string;
    departureTime: string;
    arrivalTime: string;
    price: number;
    currency: 'SEK' | 'USD';
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

export interface AiPlan {
    overview: string;
    dayByDay: string[];
    tips: string[];
    nearbyOptions: NearbyOption[];
    budgetBreakdown: BudgetBreakdown;
    generatedAt: string;
    model: string;
}

export interface NearbyOption {
    destination: string;
    country: string;
    flag: string;
    extraDays: number;
    reason: string;
}

export interface BudgetBreakdown {
    flight: number;
    accommodation: number;
    food: number;
    activities: number;
    other: number;
    total: number;
    currency: 'SEK' | 'USD';
}

export interface DestinationSuggestion {
    country: string;
    city: string;
    flag: string;
    tagline: string;
    travelStyle: string[];
    daysMin: number;
    daysMax: number;
    budgetMin: number;
    budgetMax: number;
    flightHours: number;
    directFlight: boolean;
    tips: string[];
    nearby: NearbyOption[];
    bestMonths: number[];
    why: string;
}

export interface PublicHoliday {
    date: string;
    name: string;
    country: string;
}

export interface Settings {
    _id?: string;
    vacationDaysTotal: number;
    vacationDaysUsed: number;
    homeCountry: string;
    homeCity: string;
    currency: 'SEK' | 'USD';
    preferredTransport: TransportType[];
    travelStyle: TravelStyle;
    publicHolidays: PublicHoliday[];
    budgetRange: { min: number; max: number };
    updatedAt?: Date;
}

export interface PlanRequest {
    availableDays: number;
    startDate?: string;
    travelStyle: TravelStyle;
    budgetMin: number;
    budgetMax: number;
    currency: 'SEK' | 'USD';
    preferredTransport: TransportType[];
    month?: number;
}

export interface TripStats {
    totalTrips: number;
    completedTrips: number;
    plannedTrips: number;
    scheduledTrips: number;
    ongoingTrips: number;
    totalSpent: number;
    totalBudget: number;
    vacationDaysLeft: number;
    topDestinations: string[];
    upcomingTrip?: Trip;
}
