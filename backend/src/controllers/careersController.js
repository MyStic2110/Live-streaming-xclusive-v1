import { query } from '../config/db.js';
import logger from '../config/logger.js';

/**
 * Helper to perform OCR on a base64-encoded PDF using Mistral's direct document URL API.
 */
async function performMistralOCR(resumeBase64) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not configured in environment variables.');
  }

  logger.info(`[CAREERS_OCR] Requesting OCR from Mistral using direct base64 data URL...`);
  const ocrResponse = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.MISTRAL_OCR_MODEL || 'mistral-ocr-2512',
      document: {
        type: 'document_url',
        document_url: resumeBase64
      }
    })
  });

  if (!ocrResponse.ok) {
    const errorText = await ocrResponse.text();
    throw new Error(`Mistral OCR request failed: ${ocrResponse.statusText} - ${errorText}`);
  }

  const ocrResult = await ocrResponse.json();

  // Combine extracted Markdown pages
  let markdownText = '';
  if (ocrResult.pages && Array.isArray(ocrResult.pages)) {
    markdownText = ocrResult.pages.map(page => page.markdown || '').join('\n\n');
  }

  logger.info(`[CAREERS_OCR] OCR completed successfully. Extracted ${markdownText.length} characters of Markdown.`);
  return markdownText;
}

/**
 * Helper to process raw resume markdown into structured JSON via Mistral Chat Completion.
 */
async function extractStructuredResume(markdownText) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is not configured in environment variables.');
  }

  logger.info(`[CAREERS_OCR] Querying Mistral Chat Completion to extract structured profile...`);
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      messages: [
        {
          role: 'system',
          content: `You are an expert resume parser. Analyze the provided resume text and extract the candidate profile into a clean, structured JSON object.
Return ONLY a valid JSON object matching the following structure:
{
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "years": "Duration/Years",
      "description": "Short description of key achievements"
    }
  ],
  "education": [
    {
      "degree": "Degree/Diploma Name",
      "school": "University/Institution",
      "year": "Graduation Year"
    }
  ],
  "summary": "Brief professional summary of the candidate"
}
Ensure there is no markdown codeblock wrapping the response, return only the raw JSON string.`
        },
        {
          role: 'user',
          content: markdownText
        }
      ],
      response_format: {
        type: 'json_object'
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral Chat completion failed: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;

  try {
    return JSON.parse(content);
  } catch (parseError) {
    logger.error(`[CAREERS_OCR] Failed to parse JSON response: ${content}`);
    return {
      skills: [],
      experience: [],
      education: [],
      summary: 'Fallback: JSON parser failed',
      raw_ocr_text: markdownText
    };
  }
}

/**
 * Helper to process OCR and LLM extraction asynchronously in the background.
 */
async function processOcrInBackground(applicationId, resumeBase64, resumeName) {
  logger.info(`[CAREERS_OCR] Starting background OCR for application ID ${applicationId}...`);
  try {
    // Clean base64 header if present (supports any mime type)
    const cleanedBase64 = resumeBase64.replace(/^data:[a-zA-Z0-9.+\/-]+;base64,/, '');
    const fileBuffer = Buffer.from(cleanedBase64, 'base64');

    // Check size limit: 5MB
    if (fileBuffer.length > 5 * 1024 * 1024) {
      throw new Error('Resume file exceeds the maximum 5MB size limit.');
    }

    // Step 1: Perform OCR to get Markdown
    const markdownText = await performMistralOCR(resumeBase64);

    // Step 2: Use LLM to extract structured metadata
    const extractedData = await extractStructuredResume(markdownText);

    // Step 3: Update database record
    await query(
      `UPDATE careers_applications SET resume_data = $1 WHERE id = $2;`,
      [extractedData, applicationId]
    );
    logger.info(`[CAREERS_OCR] Successfully processed and updated resume data for application ID ${applicationId}`);
  } catch (err) {
    logger.error(`[CAREERS_OCR] Background processing failed for application ID ${applicationId}: ${err.message}`);
    
    // Save error state in DB
    const errorStatus = {
      error: err.message,
      status: 'ocr_failed'
    };
    await query(
      `UPDATE careers_applications SET resume_data = $1 WHERE id = $2;`,
      [errorStatus, applicationId]
    ).catch(dbErr => {
      logger.error(`[CAREERS_OCR] Failed to save error status to database for application ID ${applicationId}: ${dbErr.message}`);
    });
  }
}

const generateBattleToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 4; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BATTLE-${token}`;
};

/**
 * POST /api/careers/apply
 * Submits a new career application to the database and schedules OCR parsing in the background.
 */
export const applyToRole = async (req, res) => {
  const { roleId, roleTitle, name, email, mobile, portfolio, message, resumeBase64, resumeName } = req.body;

  // Validation
  if (!roleId || !roleTitle || !name || !email || !mobile || !message) {
    return res.status(400).json({ error: 'Missing required fields. Please fill in name, email, mobile number, and message.' });
  }

  // Simple email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address format.' });
  }

  try {
    const initialStatus = resumeBase64 ? { status: 'processing' } : null;
    const battleToken = generateBattleToken();
    
    // 1. Insert record immediately with processing state
    const result = await query(
      `INSERT INTO careers_applications (role_id, role_title, name, email, mobile, portfolio, message, resume_data, battle_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at, battle_token;`,
      [roleId, roleTitle, name, email, mobile, portfolio || null, message, initialStatus, battleToken]
    );

    const newApplication = result.rows[0];
    const applicationId = newApplication.id;
    logger.info(`[CAREERS] Application submitted instantly by ${name} (${email}) for role "${roleTitle}" (ID: ${applicationId}, Token: ${battleToken})`);

    // 2. Respond to client instantly
    res.status(201).json({
      success: true,
      message: 'Application submitted successfully. Resume parsing scheduled in background.',
      applicationId,
      submittedAt: newApplication.created_at,
      battleToken: newApplication.battle_token
    });

    // 3. Fire-and-forget background OCR parsing
    if (resumeBase64) {
      processOcrInBackground(applicationId, resumeBase64, resumeName).catch(err => {
        logger.error(`[CAREERS] Deferred OCR startup failed for ID ${applicationId}: ${err.message}`);
      });
    }
  } catch (err) {
    logger.error(`[CAREERS] Failed to store application: ${err.message}`);
    return res.status(500).json({ error: 'Internal database error. Please try again later.' });
  }
};
