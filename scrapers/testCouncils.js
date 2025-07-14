import * as fs from 'fs/promises';
import { collectReformAttendanceData } from './standard.js';

const getCouncilsTable = async () => {
    try {
        const response = await fetch(
            'https://raw.githubusercontent.com/DemocracyClub/yournextrepresentative/refs/heads/master/ynr/apps/resultsbot/election_id_to_url.csv'
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csv = await response.text();
        return csv;
    } catch (err) {
        console.error(err);
        return;
    }
};

const readCSV = (csv) => {
    let dcCouncilList = [];
    for (let line of csv.split('\n')) {
        if (line !== '') {
            let values = line.split(',');
            let dcID = values[0];
            let url = values[1].split('mg')[0];
            let dcObj = { dcID, url };
            dcCouncilList.push(dcObj);
        }
    }

    return dcCouncilList;
};

const getTestInputData = async (dcCouncilList) => {
    let testCouncils = [];
    for (let { dcID, url } of dcCouncilList) {
        const dcRes = await fetch(
            `https://elections.democracyclub.org.uk/api/elections/${dcID}`
        );
        const dcJSON = await dcRes.json();
        const fn = dcJSON.organisation.slug;
        const cn = dcJSON.organisation.official_name;
        if (
            !testCouncils.find(
                ({ fileName, councilName }) =>
                    fileName === fn || councilName === cn
            )
        ) {
            testCouncils.push({ fileName: fn, councilName: cn, baseUrl: url });
        }
    }

    return testCouncils;
};

const testCouncils = async (councils) => {
    let working = [];
    let notWorking = [];

    for (let { fileName, councilName, baseUrl } of councils) {
        try {
            console.log(`Gathering data for: ${councilName}`);
            const data = await collectReformAttendanceData(
                councilName,
                baseUrl
            );
            const obj = { councilName, reformAttendanceData: data };
            const jsonStr = JSON.stringify(obj);
            await fs.writeFile(`./testOut/${fileName}Data.json`, jsonStr);
            console.log(`${councilName} had no errors`);
            working.push({ fileName, councilName, baseUrl });
        } catch (err) {
            console.log(`${councilName} didnt work`);
            console.error(err);
            notWorking.push({ fileName, councilName, baseUrl });
        }
    }

    const workingJsonStr = JSON.stringify(working);
    const notWorkingJsonStr = JSON.stringify(notWorking);
    await fs.writeFile('./noErrorsCouncils.json', workingJsonStr);
    await fs.writeFile('./failedCouncils.json', notWorkingJsonStr);
    console.log(
        `${working.length} councils had no errors, ${notWorking.length} councils failed`
    );
};

const main = async () => {
    const csv = await getCouncilsTable();
    const dcCouncilList = readCSV(csv);
    const untestedCouncils = await getTestInputData(dcCouncilList);
    const untestedJsonStr = JSON.stringify(untestedCouncils);
    await fs.writeFile('./untestedCouncils.json', untestedJsonStr);
    await testCouncils(untestedCouncils);
};

main();
