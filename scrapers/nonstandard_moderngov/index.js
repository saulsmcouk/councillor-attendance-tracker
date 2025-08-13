import fs from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import cliProgress from 'cli-progress';
import { processPDFsInDirectory } from './minutes_to_attendance.js';

async function ensureDirExists(dirPath) {
  try {
    await fs.promises.access(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.promises.mkdir(dirPath, { recursive: true });
      console.log(`Directory created: ${dirPath}`);
    } else {
      throw error;
    }
  }
}

async function loadJSON(filePath) {
  try {
    const absolutePath = resolve(filePath);
    const fileContent = await readFile(absolutePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error loading or parsing JSON:', error);
    return null;
  }
}

async function writeJsonToFileES6(filePath, jsonData) {
  try {
    const dirPath = resolve(filePath, '..');
    await ensureDirExists(dirPath);
    const jsonString = JSON.stringify(jsonData, null, 2);
    await fs.promises.writeFile(filePath, jsonString, 'utf8');
    console.log(`JSON data written to ${filePath}`);
  } catch (error) {
    console.error('Error writing to file:', error);
  }
}

async function main(councillorDataPath, minutesDirectoryPath) {
  // Step 1: Get councillors and their committees
  const councillorData = await loadJSON(councillorDataPath);
  if (councillorData) {
    console.log('Councillor Data:', councillorData);
  }

  // Step 2: Get all committees and their minutes
  const committees = {};
  try {
    await ensureDirExists(minutesDirectoryPath);
    const committeeDirectories = await readdir(minutesDirectoryPath);
    for (const committeeDir of committeeDirectories) {
      const committeePath = join(minutesDirectoryPath, committeeDir);
      const isDirectory = (await stat(committeePath)).isDirectory();
      if (isDirectory) {
        const minuteFiles = await readdir(committeePath);
        committees[committeeDir] = minuteFiles.filter(file => file.endsWith('.txt') || file.endsWith('.pdf')); // Include .pdf as well
      }
    }
  } catch (error) {
    console.error("Error reading minutes directory:", error);
  }
  console.log('Committees and their files:', committees);

  let minutesFilesLists = {};
  for (const dirName of Object.keys(committees)) {
    const committeeDir = join(minutesDirectoryPath, dirName);
    try {
      const minutesFiles = await readdir(committeeDir);
      minutesFilesLists[dirName] = minutesFiles;
    } catch (error) {
      console.error(`Error reading directory ${committeeDir}:`, error);
      minutesFilesLists[dirName] = [];
    }
  }
  console.log('Minutes Files Lists:', minutesFilesLists);

  // Step 3: Extract attendance from those committees
  console.log('\nProcessing attendance from minutes...');
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  const totalDirectories = Object.keys(minutesFilesLists).length;
  progressBar.start(totalDirectories, 0);

  let attendanceResults = {};
  let processedCount = 0;
  const attendanceResultsFilePath = 'attendance_extraction_results.json';

  for (const minutesFileDirName of Object.keys(minutesFilesLists)) {
    const directoryPath = join(minutesDirectoryPath, minutesFileDirName);
    const result = await processPDFsInDirectory(directoryPath);
    attendanceResults[minutesFileDirName] = result;

    // Incrementally save after processing each directory
    await writeJsonToFileES6(attendanceResultsFilePath, attendanceResults);

    processedCount++;
    progressBar.update(processedCount);
  }

  progressBar.stop();
  console.log('Attendance Results:', attendanceResults);
  console.log(`Attendance results saved incrementally to: ${attendanceResultsFilePath}`);

  // Step 5: Cross-reference (currently empty)
}

async function runMain() {
  await main('scrapers/nonstandard_moderngov/durham_councillors.json', 'minutes/');
}

runMain();
