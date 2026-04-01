import { HDNodeWallet, Mnemonic, JsonRpcProvider, Contract, parseUnits } from "ethers";
import { env } from "@/lib/config";

/**
 * Generates a deterministic BSC/EVM deposit address for a user based on their userIndex.
 * Uses the standard BIP44 derivation path: m/44'/60'/0'/0/index
 * 
 * @param userIndex The auto-incrementing index of the user from the database.
 * @returns The 0x... EVM address
 */
export function generateUserEVMAddress(userIndex: number): string {
  const mnemonic = Mnemonic.fromPhrase(env.WALLET_MASTER_MNEMONIC);
  
  // Directly derive the wallet using the full path from the mnemonic
  // BIP44 path for Ethereum/BSC: m/44'/60'/0'/0/index
  const path = `m/44'/60'/0'/0/${userIndex}`;
  const userWallet = HDNodeWallet.fromMnemonic(mnemonic, path);
  
  return userWallet.address;
}

/**
 * Validates if a string is a valid EVM address.
 */
export function isValidEVMAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Returns the central Krypton Hot Wallet (index 0) connected to the provider.
 */
export function getHotWallet(provider?: JsonRpcProvider): HDNodeWallet {
  const mnemonic = Mnemonic.fromPhrase(env.WALLET_MASTER_MNEMONIC);
  const path = `m/44'/60'/0'/0/0`; // Index 0 is the Hot Wallet
  const wallet = HDNodeWallet.fromMnemonic(mnemonic, path);
  if (provider) return wallet.connect(provider);
  return wallet;
}

/**
 * Sends funds from the Hot Wallet to an external address.
 * 
 * @param provider Connected JsonRpcProvider
 * @param toAddress External EVM address
 * @param amount Amount to send as a string
 * @param contractAddress If BEP20, the contract address. If null, sends native BNB.
 * @returns txHash
 */
export async function sendFromHotWallet(
  provider: JsonRpcProvider,
  toAddress: string,
  amount: string,
  contractAddress: string | null
): Promise<string> {
  const wallet = getHotWallet(provider);

  if (contractAddress) {
    // Send BEP20 token
    const abi = ["function transfer(address to, uint256 value) public returns (bool)"];
    const contract = new Contract(contractAddress, abi, wallet);
    
    // Ensure we parse correctly using 18 decimals
    const amountInWei = parseUnits(amount, 18);
    
    // We can just rely on default gas estimation for now
    const tx = await contract.transfer(toAddress, amountInWei);
    return tx.hash;
  } else {
    // Send Native BNB
    const amountInWei = parseUnits(amount, 18);
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: amountInWei
    });
    return tx.hash;
  }
}
