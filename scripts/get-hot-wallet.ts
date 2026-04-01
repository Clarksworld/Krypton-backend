import { HDNodeWallet, Mnemonic } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Manually load .env from the root directory
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function main() {
  const mnemonicPhrase = process.env.WALLET_MASTER_MNEMONIC;

  if (!mnemonicPhrase) {
    console.error("❌ WALLET_MASTER_MNEMONIC is not set in your .env file.");
    process.exit(1);
  }

  try {
    const mnemonic = Mnemonic.fromPhrase(mnemonicPhrase.replace(/"/g, ''));
    const path = `m/44'/60'/0'/0/0`; // Index 0 is the Hot Wallet
    const wallet = HDNodeWallet.fromMnemonic(mnemonic, path);

    console.log("==================================================");
    console.log("🔥 KRYPTON HOT WALLET DETAILS 🔥");
    console.log("==================================================");
    console.log("Address:    ", wallet.address);
    console.log("Private Key:", wallet.privateKey);
    console.log("==================================================");
    console.log("Use the official Binance Smart Chain Testnet Faucet");
    console.log("to send Testnet BNB to the Address above.");
  } catch (err: any) {
    console.error("Failed to generate Hot Wallet:", err.message);
  }
}

main();
