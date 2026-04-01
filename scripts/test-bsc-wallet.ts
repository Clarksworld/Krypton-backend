import { generateUserEVMAddress } from "../lib/blockchain/evm";
import { env } from "../lib/config";

async function main() {
  console.log("Testing BSC Wallet Generation...");
  console.log("Mnemonic length:", env.WALLET_MASTER_MNEMONIC.split(" ").length, "words");
  
  for (let i = 1; i <= 5; i++) {
    const address = generateUserEVMAddress(i);
    console.log(`User Index ${i}: ${address}`);
  }
}

main().catch(console.error);
