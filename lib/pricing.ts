import { db } from "@/db";

/**
 * Mock USD prices per asset symbol.
 * Replace with a live price feed (e.g. CoinGecko) when ready.
 */
export const USD_RATES: Record<string, number> = {
  BTC: 65000,
  ETH: 3500,
  BNB: 580,
  USDT: 1,
  USDC: 1,
  SOL: 150,
  XRP: 0.55,
  DOGE: 0.12,
  TRX: 0.12,
};

/** Default NGN per 1 USD fallback if not set in admin settings. */
const DEFAULT_NGN_RATE = 1650;

/**
 * Read the NGN/USD exchange rate from global_settings.
 * Admins can update it via PATCH /api/admin/settings with key "ngn_usd_rate".
 */
export async function getNgnRate(): Promise<number> {
  try {
    const setting = await db.query.globalSettings.findFirst({
      where: (s, { eq }) => eq(s.key, "ngn_usd_rate"),
    });
    if (setting) {
      const rate = parseFloat(setting.value);
      if (!isNaN(rate) && rate > 0) return rate;
    }
  } catch {
    // Silently fall through to default
  }
  return DEFAULT_NGN_RATE;
}

/**
 * Get USD price for a given asset symbol.
 * Returns 0 if the symbol is not in the rate table.
 */
export function getUsdPrice(symbol: string): number {
  return USD_RATES[symbol.toUpperCase()] ?? 0;
}

export interface WalletValuation {
  symbol: string;
  balance: number;
  usdValue: number;
  ngnValue: number;
}

/**
 * Given an array of wallets (with symbol + balance), compute per-wallet
 * USD/NGN values and the overall portfolio totals.
 */
export function computePortfolioValue(
  wallets: { symbol: string; balance: string | number | null }[],
  ngnRate: number
): {
  perWallet: WalletValuation[];
  totalBalanceUsd: number;
  totalBalanceNgn: number;
} {
  let totalBalanceUsd = 0;

  const perWallet: WalletValuation[] = wallets.map((w) => {
    const balance = parseFloat((w.balance ?? "0").toString());
    const usdPrice = getUsdPrice(w.symbol);
    const usdValue = balance * usdPrice;
    const ngnValue = usdValue * ngnRate;
    totalBalanceUsd += usdValue;
    return { symbol: w.symbol, balance, usdValue, ngnValue };
  });

  return {
    perWallet,
    totalBalanceUsd,
    totalBalanceNgn: totalBalanceUsd * ngnRate,
  };
}
