import { PDFParse } from "pdf-parse";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY_EVI;
const YOUR_SITE_URL = process.env.YOUR_SITE_URL || "http://localhost:8000";
const YOUR_SITE_NAME =
  process.env.YOUR_SITE_NAME || "Forensic Case Management System";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": YOUR_SITE_URL,
    "X-OpenRouter-Title": YOUR_SITE_NAME,
  },
});

/**
 * Extract text from a PDF file
 * Converts PDF buffer into clean, readable text
 * @param {Buffer|string} filePathOrBuffer - File path or buffer containing PDF data
 * @returns {Promise<{success: boolean, text: string, error?: string}>}
 */
export const extractPDFText = async (filePathOrBuffer) => {
  try {
    let buffer;

    // Handle both file path and buffer inputs
    if (typeof filePathOrBuffer === "string") {
      buffer = fs.readFileSync(filePathOrBuffer);
    } else {
      buffer = filePathOrBuffer;
    }

    // Parse the PDF
    const data = await pdfParse(buffer);

    // Extract text and clean it up
    const text = data.text
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .replace(/\n+/g, "\n") // Replace multiple newlines with single newline
      .trim();

    console.log(`✅ PDF text extracted successfully. Pages: ${data.numpages}`);

    return {
      success: true,
      text: text,
      pageCount: data.numpages,
      metadata: {
        producer: data.info?.Producer,
        creator: data.info?.Creator,
        creationDate: data.info?.CreationDate,
      },
    };
  } catch (error) {
    console.error("❌ PDF extraction error:", error.message);
    return {
      success: false,
      text: "",
      error: `Failed to extract PDF text: ${error.message}`,
    };
  }
};

/**
 * Generate image caption using OpenAI GPT-4o-mini
 * Analyzes image and generates a brief forensic caption
 * @param {string} imagePath - Path to the image file
 * @param {string} description - Description of the evidence from database
 * @returns {Promise<{success: boolean, caption: string, error?: string}>}
 */
export const generateImageCaption = async (imagePath, description = "") => {
  try {
    if (!OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY is not configured in environment variables",
      );
    }

    // Read image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    // Determine media type from file extension
    const ext = path.extname(imagePath).toLowerCase();
    const mediaTypeMap = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const mediaType = mediaTypeMap[ext] || "image/jpeg";

    console.log(`🔄 Generating caption for image: ${path.basename(imagePath)}`);

    // Build the prompt with description context if available
    let textPrompt = `You are a forensic evidence analyst. Analyze this image and provide a brief, professional caption describing what you see. Focus on:
1. Type of evidence (if identifiable)
2. Key details and objects visible
3. Condition and state of the evidence
4. Any notable features or marks

Keep the caption concise (4 sentences) but informative. Do not speculate beyond what is visible in the image. Use professional forensic terminology when appropriate.`;

    if (description && description.trim()) {
      textPrompt += `\n\nEvidence Description from Database: ${description}`;
    }

    // Call OpenAI API with vision capabilities
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: textPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mediaType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      temperature: 0.5,
      max_tokens: 200,
    });

    const caption = completion.choices[0].message.content.trim();

    console.log(`✅ Image caption generated successfully`);

    return {
      success: true,
      caption: caption,
    };
  } catch (error) {
    console.error("❌ Image caption generation error:", error.message);
    return {
      success: false,
      caption: "",
      error: `Failed to generate image caption: ${error.message}`,
    };
  }
};

/**
 * Process evidence file based on type
 * Extracts text from PDFs and generates captions for images
 * @param {string} filePath - Path to the file
 * @param {string} fileType - MIME type of the file
 * @param {string} description - Description of the evidence from database
 * @returns {Promise<{pdfText: string|null, imageCaption: string|null, aiProcessingStatus: string}>}
 */
export const processEvidenceFile = async (
  filePath,
  fileType,
  description = "",
) => {
  const result = {
    pdfText: null,
    imageCaption: null,
    aiProcessingStatus: "pending",
  };

  try {
    result.aiProcessingStatus = "processing";

    // Extract text from PDFs
    if (fileType === "application/pdf") {
      console.log("📄 Processing PDF file...");
      const pdfResult = await extractPDFText(filePath);

      if (pdfResult.success) {
        result.pdfText = pdfResult.text;
        result.aiProcessingStatus = "completed";
      } else {
        console.warn("⚠️ PDF extraction failed:", pdfResult.error);
        result.aiProcessingStatus = "failed";
      }
    }
    // Generate captions for images
    else if (fileType.startsWith("image/")) {
      console.log("🖼️  Processing image file...");
      const captionResult = await generateImageCaption(filePath, description);

      if (captionResult.success) {
        result.imageCaption = captionResult.caption;
        result.aiProcessingStatus = "completed";
      } else {
        console.warn("⚠️ Caption generation failed:", captionResult.error);
        result.aiProcessingStatus = "failed";
      }
    } else {
      // File type doesn't require processing
      result.aiProcessingStatus = "completed";
    }

    return result;
  } catch (error) {
    console.error("❌ File processing error:", error.message);
    result.aiProcessingStatus = "failed";
    return result;
  }
};
