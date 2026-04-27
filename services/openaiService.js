import OpenAI from "openai";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY_CASE;
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
 * Generate a comprehensive case analysis summary using OpenAI via OpenRouter
 * @param {Object} caseData - The case data to summarize
 * @returns {Promise<string>} - The AI-generated case analysis summary
 */
export const generateCaseAnalysisSummary = async (caseData) => {
  try {
    if (!OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY is not configured in environment variables",
      );
    }

    // Build a comprehensive prompt with all case details
    const hasEvidences = caseData.evidence && caseData.evidence.length > 0;
    const caseDetails = `
Case Number: ${caseData.caseNumber || "N/A"}
Case Title: ${caseData.title || "N/A"}
Case Type: ${caseData.caseType || "N/A"}
Jurisdiction: ${caseData.jurisdiction || "N/A"}
Status: ${caseData.status || "N/A"}
Date Opened: ${caseData.dateOpened ? new Date(caseData.dateOpened).toLocaleDateString() : "N/A"}
Description: ${caseData.description || "N/A"}
Evidence Status: ${hasEvidences ? `${caseData.evidence.length} evidence file(s) uploaded` : "No evidences uploaded yet"}

Crime Details:
- Offense Type: ${caseData.crime?.offenseType || "N/A"}
- Classification: ${caseData.crime?.classification || "N/A"}
- Location: ${caseData.crime?.location || "N/A"}
- Occurred At: ${caseData.crime?.occurredAt ? new Date(caseData.crime.occurredAt).toLocaleDateString() : "N/A"}

Victim Information:
- Name: ${caseData.victim?.fullName || "N/A"}
- Phone: ${caseData.victim?.contact?.phone || "N/A"}
- Email: ${caseData.victim?.contact?.email || "N/A"}
- Statement: ${caseData.victim?.statement || "N/A"}
- Injury Description: ${caseData.victim?.injuryDescription || "N/A"}

Witness Information:
- Name: ${caseData.witness?.fullName || "N/A"}
- Phone: ${caseData.witness?.contact?.phone || "N/A"}
- Email: ${caseData.witness?.contact?.email || "N/A"}
- Testimony: ${caseData.witness?.testimony || "N/A"}

Suspect Information:
- Name: ${caseData.suspect?.fullName || "N/A"}
- Status: ${caseData.suspect?.status || "N/A"}
- Phone: ${caseData.suspect?.contact?.phone || "N/A"}
- Email: ${caseData.suspect?.contact?.email || "N/A"}
- Alibi: ${caseData.suspect?.alibi || "N/A"}

Additional Notes: ${caseData.metadata?.notes || "N/A"}
Tags: ${caseData.tags?.join(", ") || "N/A"}
    `;

    const systemPrompt = `You are a 145 IQ Summary Expert - a highly skilled forensic analyst and legal professional with extensive experience in case analysis.
    Your role is to provide an authentic, comprehensive, and detailed forensic report on cases presented to you.

    Your analysis should include:
    1. Executive Summary - A brief overview of the case
    2. Case Classification - The nature and severity of the case
    3. Key Facts Analysis - Critical details extracted from the case information
    4. Parties Involved - Analysis of victim, suspect, and witnesses
    5. Evidence Assessment - What evidence is critical based on the case details
    6. Timeline Analysis - Chronological understanding of events
    7. Risk Assessment - Potential risks or critical concerns
    8. Recommendations - Next steps for investigation or case management

    Provide thorough, professional analysis in the format of an authentic forensic report.`;

    console.log("🔄 Calling OpenAI API via OpenRouter...");

    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Please generate a brief forensic report and analysis for the following case:\n\n${caseDetails}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    // Extract the summary from the response
    const summary = completion.choices[0]?.message?.content;

    if (!summary) {
      throw new Error("No summary generated from OpenAI API");
    }

    console.log("✅ Case analysis summary generated successfully");
    return summary;
  } catch (error) {
    console.error("❌ Error generating case analysis summary:", error.message);
    // Return null if API fails, case will still be created
    return null;
  }
};

/**
 * Generate evidence summary using OpenAI based on uploaded evidence
 * @param {Array} evidences - Array of evidence objects with pdfText, imageCaption, fileType, fileName
 * @returns {Promise<string>} - The AI-generated evidence summary
 */
export const generateEvidenceSummary = async (evidences) => {
  try {
    if (!OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY is not configured in environment variables",
      );
    }

    // Check if there are evidences
    if (!evidences || evidences.length === 0) {
      return "No evidences have been uploaded for this case yet. Evidence files such as PDFs, images, and videos will be analyzed and summarized as they are uploaded.";
    }

    // Build evidence details from the array
    let evidenceDetails = "Evidence Details:\n\n";

    evidences.forEach((evidence, index) => {
      evidenceDetails += `Evidence ${index + 1}: ${evidence.fileName}\n`;
      evidenceDetails += `File Type: ${evidence.fileType}\n`;

      // Handle different file types
      if (evidence.fileType === "application/pdf" && evidence.pdfText) {
        // For PDFs, include the extracted text
        const truncatedText = evidence.pdfText.substring(0, 500); // Truncate to first 500 chars
        evidenceDetails += `Content (PDF - First 500 chars): ${truncatedText}...\n`;
      } else if (
        evidence.fileType.startsWith("image/") &&
        evidence.imageCaption
      ) {
        // For images, include the AI-generated caption
        evidenceDetails += `Description (AI-Generated Caption): ${evidence.imageCaption}\n`;
      } else if (evidence.fileType.startsWith("video/")) {
        // For videos, just mention it's a video with the name
        evidenceDetails += `Type: Video Evidence\n`;
      }

      evidenceDetails += "\n";
    });

    const systemPrompt = `You are a forensic evidence analyst. Your role is to analyze and summarize evidence provided to you in a case.

    Your analysis should include:
    1. Evidence Overview - Brief overview of all evidence submitted
    2. Evidence Classification - Type and nature of each evidence item
    3. Key Findings - Important details and observations from the evidence
    4. Interconnections - How different evidence pieces relate to each other
    5. Forensic Significance - What this evidence means for the investigation
    6. Evidence Quality - Integrity and reliability of the evidence
    7. Recommendations - Suggested next steps based on the evidence

    Provide thorough, professional analysis in a structured forensic report format.`;

    console.log("🔄 Generating evidence summary with OpenAI...");

    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Please analyze and summarize the following evidence for a forensic case:\n\n${evidenceDetails}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    // Extract the summary from the response
    const summary = completion.choices[0]?.message?.content;

    if (!summary) {
      throw new Error("No evidence summary generated from OpenAI API");
    }

    console.log("✅ Evidence summary generated successfully");
    return summary;
  } catch (error) {
    console.error("❌ Error generating evidence summary:", error.message);
    // Return null if API fails, case will still be created
    return null;
  }
};

export default {
  generateCaseAnalysisSummary,
  generateEvidenceSummary,
};
