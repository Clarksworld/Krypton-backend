
import { db } from "../db";
import { cryptoAssets } from "../db/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding crypto assets...");

  const assets = [
    {
      symbol: "USDT",
      name: "Tether USD",
      isActive: true,
      networks: [
        {
          name: "BSC Testnet",
          rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
          tokenAddress: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
          standard: "BEP20",
        },
      ],
    },
    {
      symbol: "BNB",
      name: "Binance Coin",
      isActive: true,
      networks: [
        {
          name: "BSC Testnet",
          rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
          tokenAddress: null, // Native
          standard: "Native",
        },
      ],
    },
  ];

  for (const asset of assets) {
    const existing = await db.query.cryptoAssets.findFirst({
      where: eq(cryptoAssets.symbol, asset.symbol),
    });

    if (!existing) {
      console.log(`Inserting ${asset.symbol}...`);
      await db.insert(cryptoAssets).values(asset);
    } else {
      console.log(`${asset.symbol} already exists.`);
    }
  }

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Error seeding:", err);
  process.exit(1);
});
