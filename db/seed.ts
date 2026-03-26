import { db } from "./index";
import { cryptoAssets } from "./schema";

async function main() {
  console.log("Using DATABASE_URL:", process.env.DATABASE_URL);
  console.log("Seeding crypto assets...");

  try {
    const assets = [
      {
        symbol: "USDT",
        name: "Tether",
        iconUrl: "https://cryptologos.cc/logos/tether-usdt-logo.png",
        networks: [
          { name: "TRC20", addressRegex: "^T[1-9A-HJ-NP-Za-km-z]{33}$" },
          { name: "ERC20", addressRegex: "^0x[a-fA-F0-9]{40}$" },
        ],
      },
      {
        symbol: "BTC",
        name: "Bitcoin",
        iconUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
        networks: [{ name: "BTC", addressRegex: "^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$" }],
      },
      {
        symbol: "ETH",
        name: "Ethereum",
        iconUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
        networks: [{ name: "ERC20", addressRegex: "^0x[a-fA-F0-9]{40}$" }],
      },
    ];

    for (const asset of assets) {
      await db
        .insert(cryptoAssets)
        .values(asset)
        .onConflictDoUpdate({
          target: cryptoAssets.symbol,
          set: { iconUrl: asset.iconUrl, networks: asset.networks },
        });
    }

    console.log("Seeding complete! Krypton is ready.");
  } catch (err) {
    console.error("Seed failed in main block:", err);
    throw err;
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
