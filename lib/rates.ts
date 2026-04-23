// lib/rates.ts
export const MOCK_RATES: Record<string, number> = {
  "BTC": 65000,
  "ETH": 3500,
  "BNB": 580,
  "USDT": 1,
  "USDC": 1,
};

export async function getCryptoRates(symbols: string[]): Promise<Record<string, number>> {
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) {
    console.warn("COINMARKETCAP_API_KEY not set. Falling back to mock rates.");
    return MOCK_RATES;
  }

  const symbolString = symbols.map(s => s.toUpperCase()).join(",");
  
  try {
    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=${symbolString}`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": apiKey,
          "Accept": "application/json",
        },
        next: {
          revalidate: 120, // Cache for 120 seconds
        },
      }
    );

    if (!response.ok) {
      console.error(`CoinMarketCap API Error: ${response.status} ${response.statusText}`);
      return MOCK_RATES;
    }

    const data = await response.json();
    const rates: Record<string, number> = {};

    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      const coinData = data.data[upperSymbol];
      
      // CMC v2 returns an array for the symbol. We take the first one (highest market cap).
      if (coinData && coinData.length > 0 && coinData[0].quote && coinData[0].quote.USD) {
        rates[upperSymbol] = coinData[0].quote.USD.price;
      } else {
        rates[upperSymbol] = MOCK_RATES[upperSymbol] || 0; // Fallback for specific coin
      }
    }

    return rates;
  } catch (error) {
    console.error("Error fetching rates from CoinMarketCap:", error);
    return MOCK_RATES;
  }
}
