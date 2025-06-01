import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import extract from 'pdf-text-extract';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIRECTORY_PATH = resolve(__dirname, '../minutes/County_Council');

function extractTextFromPDF(filePath) {
    return new Promise((resolve, reject) => {
        extract(filePath, (err, pages) => {
            if (err) return reject(err);
            // pages is array of strings, each string is a page's text
            resolve(pages.join('\n\n'));
        });
    });
}

async function processPDFsInDirectory(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
        console.error('Directory does not exist:', directoryPath);
        return;
    }

    const files = fs.readdirSync(directoryPath);
    const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

    for (const file of pdfFiles) {
        const filePath = path.join(directoryPath, file);
        try {
            const text = await extractTextFromPDF(filePath);
            console.log(`${file}\n${'-'.repeat(file.length)}\n${text}\n`);
        } catch (err) {
            console.error(`Failed to process ${file}: ${err.message}`);
        }
    }
}

await processPDFsInDirectory(DIRECTORY_PATH);
