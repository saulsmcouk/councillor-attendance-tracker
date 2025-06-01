import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { GoogleGenAI } from '@google/genai';    
import extract from 'pdf-text-extract';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_RATE_LIMIT = parseInt(process.env.GEMINI_RATE_LIMIT, 10) || 60; // Default 60 requests per minute
const GEMINI_MODEL_CODE = process.env.GEMINI_MODEL_CODE || 'gemini-1.5-flash';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIRECTORY_PATH = resolve(__dirname, '../minutes/County_Council');

// Initialize Google GenAI
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Rate limiting helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const rateLimitDelay = Math.ceil(60000 / GEMINI_RATE_LIMIT); // Convert rate limit to delay in ms

function extractTextFromPDF(filePath) {
    return new Promise((resolve, reject) => {
        extract(filePath, (err, pages) => {
            if (err) return reject(err);
            // pages is array of strings, each string is a page's text
            resolve(pages.join('\n\n'));
        });
    });
}

async function extractAttendanceWithGenAI(text, filename) {
    const prompt = `
Please analyze the following council meeting minutes text and extract the attendance information. 
Look for sections that list who was present, absent, or attended the meeting.

Please return a JSON object with the following structure:
{
    "meeting_title": "Title of the meeting if available",
    "meeting_date": "Date of the meeting if available", 
    "present": ["Councillor Name 1", "Councillor Name 2", "Councillor Name 3"],
    "absent": ["Councillor Name 4", "Councillor Name 5"],
    "officers_present": ["Officer Name 1", "Officer Name 2"],
    "apologies": ["Councillor Name 6", "Councillor Name 7"],
    "notes": "Any additional notes about attendance"
}

IMPORTANT: 
- For the "present" array, list each councillor's name as a separate string in the array
- Include full names (e.g. "Councillor John Smith", "Cllr Jane Doe")
- Each name should be a separate array element
- If any category is not found or mentioned, include it as an empty array or empty string
- Only extract names that are clearly identified as attendees

Meeting minutes text:
${text.substring(0, 8000)} // Limit text to avoid token limits
`;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL_CODE,
            contents: prompt,
        });
        
        // Extract the generated text from response
        const generatedText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            throw new Error("No text found in Gemini API response");
        }
        
        // Try to parse JSON from the response
        try {
            // Look for JSON in the response (sometimes wrapped in code blocks)
            const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            } else {
                // If no JSON found, return the raw response
                return {
                    meeting_title: filename,
                    meeting_date: "",
                    present: [],
                    absent: [],
                    officers_present: [],
                    apologies: [],
                    notes: generatedText
                };
            }
        } catch (parseError) {
            console.warn(`Failed to parse JSON for ${filename}, returning raw response`);
            return {
                meeting_title: filename,
                meeting_date: "",
                present: [],
                absent: [],
                officers_present: [],
                apologies: [],
                notes: generatedText
            };
        }
    } catch (error) {
        console.error(`GenAI error for ${filename}:`, error.message);
        return {
            meeting_title: filename,
            meeting_date: "",
            present: [],
            absent: [],
            officers_present: [],
            apologies: [],
            notes: `Error processing: ${error.message}`
        };
    }
}

async function processPDFsInDirectory(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
        console.error('Directory does not exist:', directoryPath);
        return;
    }

    const files = fs.readdirSync(directoryPath);
    const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');
    const attendanceResults = [];

    for (let i = 0; i < pdfFiles.length; i++) {
        console.log(i/pdfFiles.length)
        const file = pdfFiles[i];
        const filePath = path.join(directoryPath, file);
        
        try {
            // Extract text from PDF
            const text = await extractTextFromPDF(filePath);
            
            // Extract attendance using GenAI
            const attendance = await extractAttendanceWithGenAI(text, file);
            
            // Add metadata
            attendance.filename = file;
            attendance.filepath = filePath;
            attendance.processed_at = new Date().toISOString();
            
            attendanceResults.push(attendance);
            
            // Rate limiting delay
            if (i < pdfFiles.length - 1) { // Don't delay after the last file
                await delay(rateLimitDelay);
            }
            
        } catch (err) {
            attendanceResults.push({
                filename: file,
                filepath: filePath,
                processed_at: new Date().toISOString(),
                error: err.message,
                meeting_title: file,
                meeting_date: "",
                present: [],
                absent: [],
                officers_present: [],
                apologies: [],
                notes: `Processing failed: ${err.message}`
            });
        }
    }

    // Save results to JSON file
    const outputPath = path.join(directoryPath, 'attendance_results.json');
    try {
        fs.writeFileSync(outputPath, JSON.stringify(attendanceResults, null, 2));
    } catch (saveError) {
        console.error('Failed to save results:', saveError.message);
    }

    return attendanceResults;
}

// Run the processing
console.log('Starting PDF attendance extraction...');
console.log(`Using model: ${GEMINI_MODEL_CODE}`);
console.log(`Rate limit: ${GEMINI_RATE_LIMIT} requests per minute`);
console.log(`Processing directory: ${DIRECTORY_PATH}`);

await processPDFsInDirectory(DIRECTORY_PATH);