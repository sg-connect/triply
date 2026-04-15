/**
 * REST Countries API — free, no key needed.
 * https://restcountries.com/
 *
 * We cache the full list in memory on first fetch.
 */

export interface CountryInfo {
    name: string;
    code: string;        // ISO 3166-1 alpha-2 (e.g. "SE")
    flag: string;        // emoji flag
    capital: string;
    region: string;
    subregion: string;
    population: number;
    currencies: string[];    // e.g. ["SEK"]
    languages: string[];     // e.g. ["Swedish"]
    latlng: [number, number];
}

export interface CityEntry {
    name: string;
    country: string;
    countryCode: string;
    flag: string;
}

let countryCache: CountryInfo[] | null = null;

export async function getAllCountries(): Promise<CountryInfo[]> {
    if (countryCache) return countryCache;
    const res = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,flag,capital,region,subregion,population,currencies,languages,latlng');
    if (!res.ok) throw new Error(`REST Countries error: ${res.status}`);
    const raw: any[] = await res.json() as any[];
    countryCache = raw
        .map(c => ({
            name: c.name?.common || '',
            code: c.cca2 || '',
            flag: c.flag || '',
            capital: Array.isArray(c.capital) ? c.capital[0] || '' : '',
            region: c.region || '',
            subregion: c.subregion || '',
            population: c.population || 0,
            currencies: c.currencies ? Object.keys(c.currencies) : [],
            languages: c.languages ? Object.values(c.languages) as string[] : [],
            latlng: c.latlng || [0, 0],
        }))
        .filter(c => c.name && c.code)
        .sort((a, b) => a.name.localeCompare(b.name));
    return countryCache;
}

export async function getCountryByCode(code: string): Promise<CountryInfo | null> {
    const all = await getAllCountries();
    return all.find(c => c.code === code) || null;
}

/**
 * Popular cities by country — a curated list for the dropdown.
 * We keep this as a static map for speed; can be expanded over time.
 */
const POPULAR_CITIES: Record<string, string[]> = {
    SE: ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Kiruna'],
    NO: ['Oslo', 'Bergen', 'Tromsø', 'Stavanger', 'Trondheim'],
    DK: ['Copenhagen', 'Aarhus', 'Odense'],
    FI: ['Helsinki', 'Tampere', 'Turku', 'Rovaniemi'],
    IS: ['Reykjavik', 'Akureyri', 'Vik'],
    GB: ['London', 'Edinburgh', 'Manchester', 'Liverpool', 'Bath', 'Oxford', 'Brighton'],
    IE: ['Dublin', 'Galway', 'Cork', 'Killarney'],
    FR: ['Paris', 'Nice', 'Lyon', 'Marseille', 'Bordeaux', 'Strasbourg'],
    ES: ['Barcelona', 'Madrid', 'Seville', 'Valencia', 'Malaga', 'Palma de Mallorca', 'Granada', 'Bilbao'],
    PT: ['Lisbon', 'Porto', 'Faro', 'Funchal'],
    IT: ['Rome', 'Florence', 'Venice', 'Milan', 'Naples', 'Amalfi', 'Cinque Terre', 'Bologna'],
    GR: ['Athens', 'Santorini', 'Mykonos', 'Crete', 'Rhodes', 'Thessaloniki'],
    HR: ['Dubrovnik', 'Split', 'Zagreb', 'Hvar'],
    ME: ['Kotor', 'Budva', 'Podgorica'],
    DE: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Dresden'],
    AT: ['Vienna', 'Salzburg', 'Innsbruck'],
    CH: ['Zurich', 'Geneva', 'Lucerne', 'Interlaken', 'Zermatt'],
    NL: ['Amsterdam', 'Rotterdam', 'Utrecht', 'The Hague'],
    BE: ['Brussels', 'Bruges', 'Ghent', 'Antwerp'],
    CZ: ['Prague', 'Brno', 'Český Krumlov'],
    PL: ['Warsaw', 'Krakow', 'Gdansk', 'Wroclaw'],
    HU: ['Budapest', 'Eger', 'Debrecen'],
    RO: ['Bucharest', 'Brasov', 'Cluj-Napoca', 'Sibiu'],
    BG: ['Sofia', 'Plovdiv', 'Varna'],
    TR: ['Istanbul', 'Antalya', 'Cappadocia', 'Bodrum', 'Izmir'],
    EG: ['Cairo', 'Luxor', 'Hurghada', 'Sharm El Sheikh'],
    MA: ['Marrakech', 'Fez', 'Casablanca', 'Chefchaouen'],
    ZA: ['Cape Town', 'Johannesburg', 'Durban', 'Kruger National Park'],
    KE: ['Nairobi', 'Mombasa', 'Maasai Mara'],
    TZ: ['Zanzibar', 'Dar es Salaam', 'Arusha', 'Serengeti'],
    US: ['New York', 'Los Angeles', 'Miami', 'San Francisco', 'Las Vegas', 'Chicago', 'Hawaii', 'Seattle', 'Boston', 'New Orleans'],
    CA: ['Toronto', 'Vancouver', 'Montreal', 'Banff', 'Quebec City'],
    MX: ['Mexico City', 'Cancún', 'Playa del Carmen', 'Oaxaca', 'Tulum'],
    CR: ['San José', 'Arenal', 'Manuel Antonio', 'Monteverde'],
    CO: ['Bogotá', 'Medellín', 'Cartagena'],
    PE: ['Lima', 'Cusco', 'Machu Picchu'],
    AR: ['Buenos Aires', 'Mendoza', 'Patagonia', 'Iguazu Falls'],
    BR: ['Rio de Janeiro', 'São Paulo', 'Salvador', 'Florianópolis'],
    CL: ['Santiago', 'Valparaíso', 'Atacama', 'Patagonia'],
    JP: ['Tokyo', 'Kyoto', 'Osaka', 'Hiroshima', 'Nara', 'Hakone'],
    KR: ['Seoul', 'Busan', 'Jeju Island'],
    CN: ['Beijing', 'Shanghai', 'Chengdu', 'Xi\'an', 'Guilin'],
    TH: ['Bangkok', 'Chiang Mai', 'Phuket', 'Koh Samui', 'Krabi'],
    VN: ['Hanoi', 'Ho Chi Minh City', 'Hoi An', 'Ha Long Bay', 'Da Nang'],
    ID: ['Bali', 'Jakarta', 'Yogyakarta', 'Lombok'],
    MY: ['Kuala Lumpur', 'Penang', 'Langkawi', 'Borneo'],
    SG: ['Singapore'],
    PH: ['Manila', 'Cebu', 'Palawan', 'Boracay', 'Siargao'],
    IN: ['Delhi', 'Mumbai', 'Jaipur', 'Goa', 'Kerala', 'Varanasi'],
    LK: ['Colombo', 'Kandy', 'Ella', 'Galle'],
    NP: ['Kathmandu', 'Pokhara', 'Everest Base Camp'],
    AE: ['Dubai', 'Abu Dhabi'],
    JO: ['Amman', 'Petra', 'Dead Sea', 'Wadi Rum'],
    IL: ['Tel Aviv', 'Jerusalem', 'Haifa'],
    AU: ['Sydney', 'Melbourne', 'Brisbane', 'Gold Coast', 'Perth', 'Cairns'],
    NZ: ['Auckland', 'Queenstown', 'Wellington', 'Rotorua'],
    FJ: ['Nadi', 'Suva'],
    MV: ['Malé', 'Maafushi'],
    CU: ['Havana', 'Trinidad', 'Viñales'],
};

export function getCitiesForCountry(countryCode: string): string[] {
    return POPULAR_CITIES[countryCode.toUpperCase()] || [];
}
