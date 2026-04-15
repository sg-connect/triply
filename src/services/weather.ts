/**
 * Open-Meteo — free weather API, no key needed.
 * https://open-meteo.com/
 */

export interface CityWeather {
    city: string;
    latitude: number;
    longitude: number;
    daily: DayForecast[];
    summary: WeatherSummary;
}

export interface DayForecast {
    date: string;          // YYYY-MM-DD
    tempMin: number;       // °C
    tempMax: number;
    precipitation: number; // mm
    weatherCode: number;   // WMO code
    weatherLabel: string;
}

export interface WeatherSummary {
    avgTempMin: number;
    avgTempMax: number;
    totalRainMm: number;
    rainyDays: number;
    sunnyDays: number;
    overallLabel: string;  // e.g. "Warm and sunny" / "Cool with some rain"
}

const WMO_LABELS: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
    95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Thunderstorm + heavy hail',
};

function summarize(daily: DayForecast[]): WeatherSummary {
    if (!daily.length) return { avgTempMin: 0, avgTempMax: 0, totalRainMm: 0, rainyDays: 0, sunnyDays: 0, overallLabel: 'No data' };
    const avgMin = daily.reduce((s, d) => s + d.tempMin, 0) / daily.length;
    const avgMax = daily.reduce((s, d) => s + d.tempMax, 0) / daily.length;
    const totalRain = daily.reduce((s, d) => s + d.precipitation, 0);
    const rainyDays = daily.filter(d => d.precipitation > 1).length;
    const sunnyDays = daily.filter(d => d.weatherCode <= 1).length;

    let label: string;
    if (avgMax >= 25 && rainyDays <= 2) label = 'Hot and sunny';
    else if (avgMax >= 20 && rainyDays <= 3) label = 'Warm and mostly sunny';
    else if (avgMax >= 15) label = rainyDays > 4 ? 'Mild with frequent rain' : 'Pleasant and mild';
    else if (avgMax >= 5) label = rainyDays > 4 ? 'Cool and rainy' : 'Cool but dry';
    else label = 'Cold';

    return {
        avgTempMin: Math.round(avgMin * 10) / 10,
        avgTempMax: Math.round(avgMax * 10) / 10,
        totalRainMm: Math.round(totalRain),
        rainyDays,
        sunnyDays,
        overallLabel: label,
    };
}

/**
 * Geocode a city using Open-Meteo's geocoding API (free, no key).
 */
export async function geocodeCity(city: string, country?: string): Promise<{ lat: number; lon: number; name: string; country: string } | null> {
    const q = encodeURIComponent(country ? `${city}, ${country}` : city);
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=5&language=en`);
    if (!res.ok) return null;
    const data: any = await res.json();
    const results = data.results || [];
    // Prefer exact country match if given
    if (country && results.length > 1) {
        const match = results.find((r: any) => r.country?.toLowerCase() === country.toLowerCase());
        if (match) return { lat: match.latitude, lon: match.longitude, name: match.name, country: match.country };
    }
    if (results.length === 0) return null;
    return { lat: results[0].latitude, lon: results[0].longitude, name: results[0].name, country: results[0].country };
}

/**
 * Fetch weather for a location over a date range.
 * - For dates within 16 days: uses the real-time forecast API
 * - For dates further out: uses the historical API with LAST YEAR's same dates
 *   as a climate proxy (best approximation without a paid climate API)
 */
export async function getWeatherForecast(
    lat: number,
    lon: number,
    cityName: string,
    startDate: string,
    endDate: string,
): Promise<CityWeather> {
    const now = new Date();
    const start = new Date(startDate);
    const daysAhead = Math.ceil((start.getTime() - now.getTime()) / 86400000);

    let url: string;
    let isHistorical = false;

    if (daysAhead <= 14) {
        // Use live forecast
        url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
            + `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code`
            + `&start_date=${startDate}&end_date=${endDate}&timezone=auto`;
    } else {
        // Use last year's data as a climate proxy
        isHistorical = true;
        const histStart = new Date(startDate);
        const histEnd = new Date(endDate);
        histStart.setFullYear(histStart.getFullYear() - 1);
        histEnd.setFullYear(histEnd.getFullYear() - 1);
        const hs = histStart.toISOString().split('T')[0];
        const he = histEnd.toISOString().split('T')[0];
        url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}`
            + `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code`
            + `&start_date=${hs}&end_date=${he}&timezone=auto`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
    const data: any = await res.json();
    const d = data.daily || {};
    const dates: string[] = d.time || [];

    const daily: DayForecast[] = dates.map((date: string, i: number) => {
        // If historical, shift dates forward to the user's actual travel dates
        let displayDate = date;
        if (isHistorical) {
            const dt = new Date(date);
            dt.setFullYear(dt.getFullYear() + 1);
            displayDate = dt.toISOString().split('T')[0];
        }
        return {
            date: displayDate,
            tempMin: d.temperature_2m_min?.[i] ?? 0,
            tempMax: d.temperature_2m_max?.[i] ?? 0,
            precipitation: d.precipitation_sum?.[i] ?? 0,
            weatherCode: d.weather_code?.[i] ?? 0,
            weatherLabel: WMO_LABELS[d.weather_code?.[i]] || 'Unknown',
        };
    });

    return {
        city: cityName,
        latitude: lat,
        longitude: lon,
        daily,
        summary: summarize(daily),
    };
}

/**
 * High-level: geocode + fetch weather in one call.
 */
export async function getCityWeather(city: string, country: string, startDate: string, days: number): Promise<CityWeather | null> {
    const geo = await geocodeCity(city, country);
    if (!geo) return null;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days - 1);
    return getWeatherForecast(geo.lat, geo.lon, city, startDate, endDate.toISOString().split('T')[0]);
}
