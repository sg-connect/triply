/**
 * Frankfurter — free currency conversion API, no key needed.
 * https://www.frankfurter.app/
 */

export interface CurrencyRate {
    base: string;
    target: string;
    rate: number;
    date: string;
}

/**
 * Fetch exchange rate: 1 [base] = X [target]
 */
export async function getRate(base: string, target: string): Promise<CurrencyRate | null> {
    const baseUp = base.toUpperCase();
    const targetUp = target.toUpperCase();
    if (baseUp === targetUp) return { base: baseUp, target: targetUp, rate: 1, date: new Date().toISOString().split('T')[0] };
    try {
        const res = await fetch(`https://api.frankfurter.app/latest?from=${baseUp}&to=${targetUp}`);
        if (!res.ok) return null;
        const data: any = await res.json();
        const rate = data.rates?.[targetUp];
        if (!rate) return null;
        return { base: baseUp, target: targetUp, rate, date: data.date || '' };
    } catch {
        return null;
    }
}
