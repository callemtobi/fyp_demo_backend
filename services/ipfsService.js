import { PinataSDK } from "pinata";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Initialize Pinata
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.NEXT_PUBLIC_GATEWAY_URL || "gateway.pinata.cloud",
});

/**
 * Generate SHA-256 hash of a file
 */
const generateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (error) => reject(error));
  });
};

/**
 * Upload file to IPFS via Pinata
 * This version works with your specific Pinata SDK
 */
const uploadToIPFS = async (filePath, fileName, metadata = {}) => {
  try {
    console.log("📤 Uploading to IPFS:", fileName);
    console.log("📂 File path:", filePath);

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    console.log("📊 File size:", stats.size, "bytes");

    // Generate file hash for integrity
    const fileHash = await generateFileHash(filePath);
    console.log("🔐 File hash generated:", fileHash);

    // Read file as buffer
    // const fileBuffer = fs.readFileSync(filePath);
    console.log("📖 File read into buffer");
    const fileBuffer = fs.readFileSync(filePath);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    );
    console.log("📎 File buffer prepared for upload");
    console.log("⬆️  Uploading to Pinata...");
    // uploading using the method that worked in your test
    const upload = await pinata.upload.public.file(
      new File([arrayBuffer], fileName, {
        type: "application/octet-stream",
      }),
    );
    console.log("   CID:", upload.cid || upload.IpfsHash);

    // Convert buffer to ArrayBuffer (this is what worked in your test)
    // const arrayBuffer = fileBuffer.buffer.slice(
    //   fileBuffer.byteOffset,
    //   fileBuffer.byteOffset + fileBuffer.byteLength,
    // );

    // Create File object
    const file = new File([arrayBuffer], fileName, {
      type: "application/octet-stream",
    });

    console.log("📦 File object created");
    console.log("   Name:", file.name);
    console.log("   Size:", file.size);

    // // Upload to Pinata using the method that worked in your test
    // const upload = await pinata.upload.file(file);

    // // Your SDK returns 'cid' property
    const ipfsHash = upload.cid || upload.IpfsHash || upload.ipfsHash;

    if (!ipfsHash) {
      console.error("Upload response:", upload);
      throw new Error("No IPFS hash in upload response");
    }

    console.log("✅ File uploaded to IPFS");
    console.log("📍 IPFS Hash (CID):", ipfsHash);

    const gatewayUrl = `https://${process.env.NEXT_PUBLIC_GATEWAY_URL}/ipfs/${ipfsHash}`;
    console.log("🌐 Gateway URL:", gatewayUrl);

    return {
      success: true,
      ipfsHash: ipfsHash,
      fileHash: fileHash,
      pinSize: file.size,
      timestamp: new Date().toISOString(),
      gatewayUrl: gatewayUrl,
    };
  } catch (error) {
    console.error("❌ IPFS upload error:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("\n📋 Full error details:", uploadError);

    throw new Error(`Failed to upload to IPFS: ${error.message}`);
  }
};

/**
 * Retrieve file from IPFS
 */
const retrieveFromIPFS = async (ipfsHash) => {
  try {
    console.log("📥 Retrieving from IPFS:", ipfsHash);

    const gatewayUrl = `https://${process.env.NEXT_PUBLIC_GATEWAY_URL}/ipfs/${ipfsHash}`;

    // Fetch from your dedicated gateway
    const response = await fetch(gatewayUrl);

    if (!response.ok) {
      throw new Error(
        `Gateway returned ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.blob();
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    console.log("✅ File retrieved from IPFS");
    console.log("   Content-Type:", contentType);
    console.log("   Size:", data.size, "bytes");

    return {
      success: true,
      data: data,
      contentType: contentType,
      gatewayUrl: gatewayUrl,
    };
  } catch (error) {
    console.error("❌ IPFS retrieval error:", error);
    throw new Error(`Failed to retrieve from IPFS: ${error.message}`);
  }
};

/**
 * Get file info from Pinata
 */
const getFileInfo = async (ipfsHash) => {
  try {
    // Your SDK has files.list available
    const files = await pinata.files.list().cid(ipfsHash);

    if (files.files && files.files.length > 0) {
      return {
        success: true,
        info: files.files[0],
      };
    }

    return {
      success: false,
      message: "File not found",
    };
  } catch (error) {
    console.error("❌ Error getting file info:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Delete/unpin file from IPFS (optional - for testing)
 */
const deleteFromIPFS = async (ipfsHash) => {
  try {
    // Check if SDK has unpin method
    if (typeof pinata.unpin === "function") {
      await pinata.unpin([ipfsHash]);
    } else if (pinata.files && typeof pinata.files.delete === "function") {
      await pinata.files.delete([ipfsHash]);
    } else {
      throw new Error("Unpin method not available in SDK");
    }

    console.log("🗑️  File unpinned from IPFS:", ipfsHash);

    return {
      success: true,
      message: "File unpinned successfully",
    };
  } catch (error) {
    console.error("❌ Error unpinning file:", error);
    throw new Error(`Failed to unpin file: ${error.message}`);
  }
};

export {
  uploadToIPFS,
  retrieveFromIPFS,
  getFileInfo,
  deleteFromIPFS,
  generateFileHash,
};

// ------------------------------------------------------------------------
// import { PinataSDK } from "pinata";
// import fs from "fs";
// import crypto from "crypto";

// Initialize Pinata
// const pinata = new PinataSDK({
//   pinataJwt: process.env.PINATA_JWT,
//   pinataGateway: `${process.env.NEXT_PUBLIC_GATEWAY_URL}`,
// });

/**
 * Generate SHA-256 hash of a file
 */
// const generateFileHash = (filePath) => {
//   return new Promise((resolve, reject) => {
//     const hash = crypto.createHash("sha256");
//     const stream = fs.createReadStream(filePath);

//     stream.on("data", (data) => hash.update(data));
//     stream.on("end", () => resolve(hash.digest("hex")));
//     stream.on("error", (error) => reject(error));
//   });
// };

/**
 * Upload file to IPFS via Pinata
 */
// const uploadToIPFS = async (filePath, fileName, metadata = {}) => {
//   try {
//     console.log("📤 Uploading to IPFS:", fileName);

//     // Generate file hash for integrity
//     const fileHash = await generateFileHash(filePath);
//     console.log("🔐 File hash generated:", fileHash);

//     // Read file
//     const fileStream = fs.createReadStream(filePath);

//     // Upload to Pinata
//     const upload = await pinata.upload.file(fileStream);

//     console.log("✅ File uploaded to IPFS");
//     console.log("📍 IPFS Hash (CID):", upload.IpfsHash);

//     // Optional: Add metadata to the pin
//     if (Object.keys(metadata).length > 0) {
//       await pinata.files.update({
//         id: upload.id,
//         name: fileName,
//         keyvalues: metadata,
//       });
//     }

//     return {
//       success: true,
//       ipfsHash: upload.IpfsHash,
//       fileHash: fileHash,
//       pinSize: upload.PinSize,
//       timestamp: upload.Timestamp,
//       gatewayUrl: `https://gateway.pinata.cloud/ipfs/${upload.IpfsHash}`,
//     };
//   } catch (error) {
//     console.error("❌ IPFS upload error:", error);
//     throw new Error(`Failed to upload to IPFS: ${error.message}`);
//   }
// };

/**
 * Retrieve file from IPFS
 */
// const retrieveFromIPFS = async (ipfsHash) => {
//   try {
//     console.log("📥 Retrieving from IPFS:", ipfsHash);

//     // Get file data
//     const data = await pinata.gateways.get(ipfsHash);

//     console.log("✅ File retrieved from IPFS");

//     return {
//       success: true,
//       data: data.data,
//       contentType: data.contentType,
//       gatewayUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
//     };
//   } catch (error) {
//     console.error("❌ IPFS retrieval error:", error);
//     throw new Error(`Failed to retrieve from IPFS: ${error.message}`);
//   }
// };

/**
 * Get file info from Pinata
 */
// const getFileInfo = async (ipfsHash) => {
//   try {
//     const files = await pinata.files.list().cid(ipfsHash);

//     if (files.files && files.files.length > 0) {
//       return {
//         success: true,
//         info: files.files[0],
//       };
//     }

//     return {
//       success: false,
//       message: "File not found",
//     };
//   } catch (error) {
//     console.error("❌ Error getting file info:", error);
//     throw new Error(`Failed to get file info: ${error.message}`);
//   }
// };

/**
 * Delete/unpin file from IPFS (optional - for testing)
 */
// const deleteFromIPFS = async (ipfsHash) => {
//   try {
//     await pinata.unpin([ipfsHash]);
//     console.log("🗑️  File unpinned from IPFS:", ipfsHash);

//     return {
//       success: true,
//       message: "File unpinned successfully",
//     };
//   } catch (error) {
//     console.error("❌ Error unpinning file:", error);
//     throw new Error(`Failed to unpin file: ${error.message}`);
//   }
// };

// export {
//   uploadToIPFS,
//   retrieveFromIPFS,
//   getFileInfo,
//   deleteFromIPFS,
//   generateFileHash,
// };
