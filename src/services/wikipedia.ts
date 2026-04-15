/**
 * Wikipedia + Wikivoyage APIs — free, no key needed.
 * Fetches city summaries, images, and travel guide content.
 */

export interface WikiSummary {
    title: string;
    extract: string;         // 2-3 sentence summary
    description: string;     // short tagline e.g. "Capital city of Spain"
    thumbnail: string | null; // image URL
    coordinates: { lat: number; lon: number } | null;
    url: string;             // Wikipedia page link
}

export interface WikivoyageGuide {
    title: string;
    see: string[];           // attractions / sights
    doActivities: string[];  // things to do
    eat: string[];           // restaurants / food
    drink: string[];         // bars / nightlife
    sleep: string[];         // accommodation tips
    understand: string;      // city overview
    url: string;
}

/**
 * Fetch a city's Wikipedia summary + thumbnail image.
 */
export async function getCitySummary(city: string, country?: string): Promise<WikiSummary | null> {
    const query = country ? `${city}, ${country}` : city;
    try {
        // Step 1: Search for the best matching page
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json`;
        const searchRes = await fetch(searchUrl);
        const searchData: any = await searchRes.json();
        const titles: string[] = searchData[1] || [];
        if (!titles.length) return null;

        // Prefer a title that looks like a city (contains the city name)
        const bestTitle = titles.find(t => t.toLowerCase().includes(city.toLowerCase())) || titles[0];

        // Step 2: Get the summary via the REST API
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`;
        const summaryRes = await fetch(summaryUrl, {
            headers: { 'User-Agent': 'Triply/1.0 (travel planner app)' },
        });
        if (!summaryRes.ok) return null;
        const data: any = await summaryRes.json();

        return {
            title: data.title || bestTitle,
            extract: data.extract || '',
            description: data.description || '',
            thumbnail: data.thumbnail?.source || data.originalimage?.source || null,
            coordinates: data.coordinates ? { lat: data.coordinates.lat, lon: data.coordinates.lon } : null,
            url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(bestTitle)}`,
        };
    } catch {
        return null;
    }
}

/**
 * Fetch a city's Wikivoyage travel guide (See, Do, Eat, Drink, Sleep).
 */
export async function getWikivoyageGuide(city: string): Promise<WikivoyageGuide | null> {
    try {
        // Get Wikivoyage page sections
        const sectionsUrl = `https://en.wikivoyage.org/w/api.php?action=parse&page=${encodeURIComponent(city)}&prop=sections&format=json`;
        const sectionsRes = await fetch(sectionsUrl, {
            headers: { 'User-Agent': 'Triply/1.0' },
        });
        const sectionsData: any = await sectionsRes.json();
        if (sectionsData.error) return null;

        const sections: Array<{ index: string; line: string }> = sectionsData.parse?.sections || [];

        // Map section names to their indices
        const sectionMap: Record<string, string> = {};
        for (const s of sections) {
            const name = s.line.toLowerCase().trim();
            sectionMap[name] = s.index;
        }

        // Fetch the sections we care about
        const targets = ['see', 'do', 'eat', 'drink', 'sleep', 'understand'];
        const results: Record<string, string> = {};

        for (const target of targets) {
            const idx = sectionMap[target];
            if (!idx) continue;
            try {
                const url = `https://en.wikivoyage.org/w/api.php?action=parse&page=${encodeURIComponent(city)}&section=${idx}&prop=wikitext&format=json`;
                const res = await fetch(url, { headers: { 'User-Agent': 'Triply/1.0' } });
                const data: any = await res.json();
                results[target] = data.parse?.wikitext?.['*'] || '';
            } catch { /* skip */ }
        }

        return {
            title: city,
            see: parseWikiList(results.see || ''),
            doActivities: parseWikiList(results.do || ''),
            eat: parseWikiList(results.eat || ''),
            drink: parseWikiList(results.drink || ''),
            sleep: parseWikiList(results.sleep || ''),
            understand: cleanWikiText(results.understand || '').slice(0, 500),
            url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(city)}`,
        };
    } catch {
        return null;
    }
}

/**
 * Parse a Wikivoyage section's wikitext into a list of place names/descriptions.
 * Wikivoyage uses {{listing|name=...|alt=...|url=...|directions=...|content=...}}
 */
function parseWikiList(wikitext: string): string[] {
    const items: string[] = [];

    // Extract {{listing}} or {{see}} or {{do}} etc templates
    const listingRegex = /\{\{(?:listing|see|do|eat|drink|sleep|buy)[^}]*name\s*=\s*([^|}\n]+)/gi;
    let match;
    while ((match = listingRegex.exec(wikitext)) !== null) {
        const name = match[1].trim();
        // Try to get the content/description too
        const fullMatch = wikitext.slice(match.index, wikitext.indexOf('}}', match.index) + 2);
        const contentMatch = fullMatch.match(/content\s*=\s*([^|}]+)/);
        const desc = contentMatch ? contentMatch[1].trim() : '';
        const entry = desc ? `${name} — ${cleanWikiText(desc).slice(0, 120)}` : name;
        if (entry && !items.includes(entry)) items.push(entry);
    }

    // Fallback: extract bullet points (* Item — description)
    if (items.length === 0) {
        const lines = wikitext.split('\n');
        for (const line of lines) {
            if (line.startsWith('*')) {
                const cleaned = cleanWikiText(line.replace(/^\*+\s*/, '')).trim();
                if (cleaned.length > 3 && cleaned.length < 200 && !items.includes(cleaned)) {
                    items.push(cleaned);
                }
            }
        }
    }

    return items.slice(0, 10);
}

/**
 * Clean wikitext markup to plain text.
 */
function cleanWikiText(text: string): string {
    return text
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')  // [[link|text]] → text
        .replace(/\{\{[^}]*\}\}/g, '')                       // remove templates
        .replace(/'{2,}/g, '')                                // bold/italic markers
        .replace(/<[^>]+>/g, '')                              // HTML tags
        .replace(/\n{2,}/g, '\n')
        .trim();
}
