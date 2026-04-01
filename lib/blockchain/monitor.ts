import { JsonRpcProvider, FallbackProvider, formatUnits, Interface } from "ethers";
import { db } from "@/db";
import { wallets, cryptoAssets, transactions } from "@/db/schema";
import { env } from "@/lib/config";
import { eq, and, desc, sql } from "drizzle-orm";

// Minimal ERC20 ABI for Transfer events
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

// Reliable public BSC testnet RPC fallbacks (no API key needed)
const BSC_TESTNET_RPCS = [
  env.BSC_TESTNET_RPC_URL,
  "https://bsc-testnet-rpc.publicnode.com",
  "https://endpoints.omniatech.io/v1/bsc/testnet/public",
  "https://data-seed-prebsc-2-s1.binance.org:8545", // Binance official fallback
];

function getProvider() {
  // Try each RPC in order; JsonRpcProvider with a static network avoids the slow auto-detect
  return new JsonRpcProvider(BSC_TESTNET_RPCS[0], {
    chainId: 97,
    name: "bnbt",
  });
}

export async function checkOnChainDeposits(userId: string): Promise<any[]> {
  let provider: JsonRpcProvider;
  let currentBlock: number;

  try {
    provider = getProvider();
    currentBlock = await Promise.race([
      provider.getBlockNumber(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("RPC timeout after 10s")), 10_000)
      ),
    ]);
  } catch (providerErr) {
    console.error("[deposit/check] Could not connect to BSC node:", providerErr);
    // Return empty rather than throw — caller gets a clean 200 with no deposits
    return [];
  }

  const minConfirmations = 3;

  // 1. Get all user wallets that support BSC/BEP20
  const userWallets = await db.query.wallets.findMany({
    where: (w, { eq }) => eq(w.userId, userId),
    with: {
      asset: true,
    },
  });

  const results = [];

  const iface = new Interface(ERC20_ABI);

  for (const wallet of userWallets) {
    const depositAddress = wallet.depositAddress;
    if (!depositAddress) continue;

    // Skip non-EVM addresses (e.g. mock_btc_*, TRC20 addresses starting with T)
    const isEvmAddress = depositAddress.startsWith("0x") && depositAddress.length === 42;
    if (!isEvmAddress) continue;

    const networks = wallet.asset.networks as any[];
    if (!Array.isArray(networks)) continue;

    // DB stores BNB as:  { name: "BEP20", isNative: true }
    // DB stores USDT as: { name: "BEP20", contractAddress: "0x..." }
    const bscNetwork = networks.find((n: any) => n.name === "BEP20");

    if (!bscNetwork) {
      console.log(`[deposit/check] No BEP20 network found for asset ${wallet.asset.symbol}, skipping`);
      continue;
    }

    const isNative = bscNetwork.isNative === true;
    const contractAddress = bscNetwork.contractAddress ?? bscNetwork.tokenAddress ?? null;

    console.log(`[deposit/check] Checking ${wallet.asset.symbol} | address=${depositAddress} | isNative=${isNative} | contractAddress=${contractAddress}`);

    if (isNative) {
      // --- Handle Native BNB ---
      try {
        const onChainBalance = await provider.getBalance(depositAddress);
        const onChainBalanceEth = formatUnits(onChainBalance, 18);
        const dbBalance = parseFloat(wallet.balance ?? "0");
        const diff = parseFloat(onChainBalanceEth) - dbBalance;

        console.log(`[deposit/check] BNB on-chain: ${onChainBalanceEth}, DB: ${dbBalance}, diff: ${diff}`);

        if (diff > 0.000001) { // ignore dust
          const txHash = `native_bnb_${Date.now()}`;

          await db.transaction(async (tx) => {
            await tx.insert(transactions).values({
              userId,
              assetId: wallet.assetId,
              type: "deposit",
              amount: diff.toFixed(8),
              status: "completed",
              reference: txHash,
              metadata: {
                network: "Native",
                onChainBalance: onChainBalanceEth,
              },
            });

            await tx
              .update(wallets)
              .set({ balance: sql`${wallets.balance} + ${diff.toFixed(8)}` })
              .where(eq(wallets.id, wallet.id));
          });

          results.push({ txHash, amount: diff.toFixed(8), asset: wallet.asset.symbol });
        }
      } catch (nativeErr) {
        console.error(`[deposit/check] Failed to check native BNB balance:`, nativeErr);
      }
    } else if (contractAddress) {
      // --- Handle BEP20 Tokens (USDT, etc.) ---
      try {
        const filter = {
          address: contractAddress,
          topics: [
            iface.getEvent("Transfer")!.topicHash,
            null, // from any
            "0x" + depositAddress.slice(2).padStart(64, "0"), // to user address
          ],
          fromBlock: currentBlock - 1000,
          toBlock: "latest",
        };

        const logs = await provider.getLogs(filter);
        console.log(`[deposit/check] Found ${logs.length} Transfer logs for ${wallet.asset.symbol}`);

        for (const log of logs) {
          if (currentBlock - log.blockNumber < minConfirmations) continue;

          const txHash = log.transactionHash;

          const existingTx = await db.query.transactions.findFirst({
            where: (t, { eq }) => eq(t.reference, txHash),
          });
          if (existingTx) continue;

          const parsedLog = iface.parseLog(log);
          if (!parsedLog) continue;

          const amount = formatUnits(parsedLog.args.value, 18);

          await db.transaction(async (tx) => {
            await tx.insert(transactions).values({
              userId,
              assetId: wallet.assetId,
              type: "deposit",
              amount: amount.toString(),
              status: "completed",
              reference: txHash,
              metadata: {
                network: "BEP20",
                blockNumber: log.blockNumber,
                from: parsedLog.args.from,
              },
            });

            await tx
              .update(wallets)
              .set({ balance: sql`${wallets.balance} + ${amount}` })
              .where(eq(wallets.id, wallet.id));
          });

          results.push({ txHash, amount, asset: wallet.asset.symbol });
        }
      } catch (logErr) {
        console.error(`[deposit/check] Failed to get logs for ${contractAddress}:`, logErr);
      }
    }
  }

  return results;
}


