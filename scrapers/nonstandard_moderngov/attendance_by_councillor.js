import * as cheerio from 'cheerio';
import cliProgress from 'cli-progress';
import path from 'path';
import fs from 'fs/promises'; // Import the promises API for fs

async function fetchPage(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`Error fetching page at ${url}:`, error);
        return null;
    }
}

async function getCouncillorPageUrls(html, selector, searchText, baseUrl = null) {
    const $ = cheerio.load(html);
    const urls = [];
    $(selector).each((i, element) => {
        $(element).find(`a[href*="${searchText}"]`).each((j, link) => {
            const href = $(link).attr('href');
            if (href) {
                let absoluteUrl = href;
                if (baseUrl && !href.startsWith('http')) {
                    absoluteUrl = new URL(href, baseUrl).toString();
                }
                urls.push(absoluteUrl);
            }
        });
    });
    return urls;
}

const councillorInfoUrls = {
    "Durham City Council": "https://democracy.durham.gov.uk/",
    "Hackney Council": "https://hackney.moderngov.co.uk"
};

async function getCouncillorProfileUrls(council = "Durham City Council") {
    const baseUrl = councillorInfoUrls[council];
    const fullUrl = baseUrl + "mgMemberIndex.aspx?VW=TABLE&PIC=1&FN=";

    try {
        const response = await fetch(fullUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        return getCouncillorPageUrls(html, '#mgTable1 tr', 'mgUserInfo.aspx', baseUrl);
    } catch (error) {
        console.error(`Error fetching councillor list for ${council}:`, error);
        return [];
    }
}

async function getCouncillorDetailsPage(profileUrl) {
    return await fetchPage(profileUrl);
}

async function getCouncillorNameAndUid(profileHTML, profileUrl) {
    if (!profileHTML) {
        return null;
    }
    const $ = cheerio.load(profileHTML);
    const nameElement = $('h1.mgMainTitleTxt.title').first();
    const name = nameElement.text().trim();
    const urlParts = new URL(profileUrl);
    const searchParams = new URLSearchParams(urlParts.search);
    const uid = searchParams.get('UID');
    if (name && uid) {
        return { Name: name, UID: uid };
    }
    return null;
}

async function getCouncillorsList() {
    console.log("--- Councillor Information ---");
    const councillorUrls = await getCouncillorProfileUrls("Durham City Council");
    if (councillorUrls.length > 0) {
        console.log(`Found ${councillorUrls.length} councillor profile URLs.`);
        const councillorData = [];
        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        progressBar.start(councillorUrls.length, 0);
        for (let i = 0; i < councillorUrls.length; i++) {
            const url = councillorUrls[i];
            const detailPageHTML = await getCouncillorDetailsPage(url);
            if (detailPageHTML) {
                const data = await getCouncillorNameAndUid(detailPageHTML, url);
                if (data) {
                    councillorData.push(data);
                }
            }
            progressBar.update(i + 1);
        }
        progressBar.stop();
        console.log(councillorData);
        return councillorData;
    } else {
        console.log("No councillor URLs found.");
    }
}

async function getCouncillorCommitteeMemberships(uid, council = "Durham City Council") {
    const baseUrl = councillorInfoUrls[council];
    const detailsExtension = "mgUserInfo.aspx?UID=";
    const fullUrl = baseUrl + detailsExtension + uid;

    console.log(`Fetching committee memberships for UID: ${uid}`);
    console.log(`URL: ${fullUrl}`);

    const html = await fetchPage(fullUrl);
    if (html) {
        const $ = cheerio.load(html);
        const committees = [];

        // Find all links whose href includes "mgCommitteeDetails"
        $('a[href*="mgCommitteeDetails"]').each((i, element) => {
            const linkText = $(element).text().trim();
            if (linkText) {
                committees.push(linkText);
            }
        });

        console.log(`Found ${committees.length} committees: ${committees.join(', ')}`);

        return committees;
    } else {
        console.log(`Failed to fetch HTML for UID: ${uid}`);
        return [];
    }
}

async function getAttendanceForACouncillor(councillorObj) {
    // councillorObj: {Name, UID}
    const committees = await getCouncillorCommitteeMemberships(councillorObj["UID"]);

    return {
        Councillor: {
            Name: councillorObj["Name"],
            UID: councillorObj["UID"],
            Committees: committees
        }
    };
}

async function saveDataToFile(data, filename) {
    try {
        // Create the directory if it doesn't exist
        const dir = path.dirname(filename);
        await fs.mkdir(dir, { recursive: true });

        // Write the data to file
        await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Data successfully saved to ${filename}`);
        console.log(`Total councillors saved: ${Object.keys(data).length}`); // Corrected count
    } catch (error) {
        console.error(`Error saving data to file:`, error);
    }
}

async function main() {
    const councillorsList = await getCouncillorsList();
    let results = {};

    if (councillorsList && councillorsList.length > 0) {
        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        progressBar.start(councillorsList.length, 0);
        let completedCount = 0;

        for (const councillor of councillorsList) {
            const result = await getAttendanceForACouncillor(councillor);
            results[councillor["Name"]] = result;
            completedCount++;
            progressBar.update(completedCount);
        }
        progressBar.stop();
    } else {
        console.log("No councillors found to process.");
    }

    const res = await saveDataToFile(results, "durham_councillors.json");
    console.log("Data saved to durham_councillors.json");
}

main();