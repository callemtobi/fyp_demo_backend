import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load contract ABI
const contractABIPath = path.join(
  __dirname,
  "../contracts/EvidenceRegistry.json",
);
const contractABI = JSON.parse(fs.readFileSync(contractABIPath, "utf8")).abi;
// const contractABI = path.join(__dirname, "../config/contractABI.json");

// Initialize provider
const provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL);

// Initialize wallet
const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);

// Initialize contract
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  contractABI,
  wallet,
);

console.log("🔗 Blockchain Service Initialized");
console.log("   Network: Polygon Amoy");
console.log("   Chain ID:", process.env.CHAIN_ID);
console.log("   Contract:", process.env.CONTRACT_ADDRESS);
console.log("   Wallet:", wallet.address);

/**
 * Register evidence on blockchain
 */
const registerEvidence = async (ipfsHash, fileHash) => {
  try {
    console.log("📝 Registering evidence on blockchain...");
    console.log("   IPFS Hash:", ipfsHash);
    console.log("   File Hash:", fileHash);

    // Call smart contract
    const tx = await contract.registerEvidence(ipfsHash, fileHash);

    console.log("⏳ Transaction submitted:", tx.hash);
    console.log("   Waiting for confirmation...");

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    console.log("✅ Transaction confirmed!");
    console.log("   Block:", receipt.blockNumber);
    console.log("   Gas used:", receipt.gasUsed.toString());

    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch (error) {
    console.error("❌ Blockchain registration error:", error);

    // Handle specific errors
    if (error.message.includes("Evidence already registered")) {
      return {
        success: false,
        error: "Evidence already registered on blockchain",
      };
    }

    if (error.message.includes("insufficient funds")) {
      return {
        success: false,
        error: "Insufficient MATIC balance for gas fees",
      };
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Verify evidence on blockchain
 */
const verifyEvidence = async (ipfsHash) => {
  try {
    console.log("🔍 Verifying evidence on blockchain...");
    console.log("   IPFS Hash:", ipfsHash);

    // Call smart contract view function
    const result = await contract.verifyEvidence(ipfsHash);

    const evidenceData = {
      fileHash: result[0],
      uploader: result[1],
      timestamp: Number(result[2]),
      exists: result[3],
    };

    console.log("✅ Evidence verification complete");
    console.log("   Exists:", evidenceData.exists);

    return {
      success: true,
      data: evidenceData,
    };
  } catch (error) {
    console.error("❌ Verification error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Log evidence view on blockchain
 */
const logEvidenceView = async (ipfsHash) => {
  try {
    console.log("👁️  Logging evidence view on blockchain...");

    const tx = await contract.viewEvidence(ipfsHash);
    console.log("⏳ Transaction submitted:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ View logged on blockchain");

    return {
      success: true,
      transactionHash: tx.hash,
    };
  } catch (error) {
    console.error("❌ Log view error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Check wallet balance
 */
const checkBalance = async () => {
  try {
    const balance = await provider.getBalance(wallet.address);
    const balanceInMatic = ethers.formatEther(balance);

    console.log("💰 Wallet Balance:", balanceInMatic, "MATIC");

    return {
      balance: balanceInMatic,
      address: wallet.address,
    };
  } catch (error) {
    console.error("❌ Balance check error:", error);
    return {
      error: error.message,
    };
  }
};

/**
 * Get transaction receipt
 */
const getTransactionReceipt = async (txHash) => {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    return receipt;
  } catch (error) {
    console.error("❌ Get receipt error:", error);
    return null;
  }
};

/**
 * Verify user-signed transaction on blockchain
 */
const verifyUserTransaction = async (transactionHash, ipfsHash, fileHash) => {
  try {
    console.log("🔍 Verifying user-signed transaction...");
    console.log("   Transaction Hash:", transactionHash);

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(transactionHash);

    if (!receipt) {
      return {
        success: false,
        error: "Transaction not found on blockchain",
      };
    }

    console.log("✅ Transaction verified");
    console.log("   Block Number:", receipt.blockNumber);
    console.log("   Status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("   Gas Used:", receipt.gasUsed.toString());

    return {
      success: true,
      transactionHash: transactionHash,
      blockNumber: receipt.blockNumber,
      blockTimestamp: receipt.timestamp,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? "success" : "failed",
      from: receipt.from,
      to: receipt.to,
    };
  } catch (error) {
    console.error("❌ Transaction verification error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export {
  registerEvidence,
  verifyEvidence,
  logEvidenceView,
  checkBalance,
  getTransactionReceipt,
  verifyUserTransaction,
};
