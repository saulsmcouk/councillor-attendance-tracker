import { readFile } from 'fs/promises';

// load the big data file 
const BIG_DATA_PATH = "attendance_extraction_results.json"

async function loadJSON(filePath) {
    try {
        const data = await readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading JSON:', error);
        throw error;
    }
}

// Usage

function areEquivalent(str1, str2) {
    const normalize = str => str
        .toLowerCase()
        .replace(/\b(mr|mrs|ms|dr|prof)\b\.?/g, '')  // Remove titles
        .replace(/[\s_-]+/g, '_')
        .replace(/[^\w]/g, '')
        .replace(/committee/g, 'cmte')              // Handle common abbreviations
        .replace(/street/g, 'st')
        .replace(/avenue/g, 'ave');
    return normalize(str1) === normalize(str2);
}

function removeCouncillorPrefix(str) {
    return str.replace(/.*councillor\s*/gi, '');
}


async function getCouncillorAttendanceAtCmte(councillorName, cmte, bigDataObj, startDate = new Date('2021-05-18'), endDate = 0) {
    // iterate over every meeting, see if it applies
    // get the councillor name

    let meetings = 0;
    let attended = 0;

    const words = removeCouncillorPrefix(councillorName).split(' ');
    const surname = words[words.length - 1];
    const firstInitial = words[0] ? words[0][0] : ''; // Handle empty strings
    // console.log(`${firstInitial} ${surname}`);
    for (const key of Object.keys(bigDataObj)) {
        // console.log(`${key}: ${cmte} are equivalent: ${areEquivalent(key, cmte)}`)
        if (areEquivalent(key, cmte)) {
            const meetingsOfThisCmte = bigDataObj[key]
            for (const meeting of meetingsOfThisCmte) {
                const presentPeople = meeting.present.map(removeCouncillorPrefix);
                if (new Date(meeting.meeting_date) >= startDate) {
                    meetings++;

                    // console.log(presentPeople)
                    if (presentPeople.includes(`${firstInitial} ${surname}`)) {
                        attended++;
                    }
                };

            }
        }
    }

    return [attended, meetings]

}

async function evaluateCouncillor(councillorObj) {

}

async function main() {
    // load the attendance data 
    const bigData = await loadJSON(BIG_DATA_PATH)
    const data = await loadJSON("scrapers/nonstandard_moderngov/durham_councillors.json")
    const names = Object.keys(data)

    let results = []

    for (const name of names) {
        // get their committees 
        const committees = data[name]['Councillor']['Committees']
       
        for (const committee of committees) {
            results.push(getCouncillorAttendanceAtCmte(name, committee, bigData))
        }

    }

    console.log(results)
}

main()