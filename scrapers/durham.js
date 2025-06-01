import * as cheerio from 'cheerio';
import { writeFile, mkdir } from 'fs/promises';
import fs from 'fs';
import path from 'path';

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

async function getCommittees(committeesUrl) {
    const html = await fetchPage(committeesUrl);
    if (!html) {
        return [];
    }

    const $ = cheerio.load(html);
    const committees = [];
    const modgovDiv = $('#modgov');

    if (modgovDiv.length > 0) {
        modgovDiv.find('ul.mgBulletList').each((i, ulElement) => {
            $(ulElement).find('li a').each((j, aElement) => {
                const name = $(aElement).text().trim();
                const url = $(aElement).attr('href');
                if (name && url) {
                    const absoluteUrl = new URL(url, committeesUrl).toString();
                    committees.push({ Name: name, URL: absoluteUrl });
                }
            });
        });
    } else {
        console.log("Div with ID 'modgov' not found on the committees page.");
    }

    return committees;
}

async function scrapeMeetingLinks(baseUrl, councilURL, paginate = true) {
    const allMeetingPageUrls = new Set();
    let currentUrl = baseUrl;
    let pageCount = 0;

    console.log(`Starting to scrape meeting list pages from: ${currentUrl} (paginate: ${paginate})`);

    while (currentUrl && (paginate ? true : pageCount < 1) && pageCount < 50) {
        pageCount++;
        const html = await fetchPage(currentUrl);
        if (!html) {
            console.log(`Failed to fetch page: ${currentUrl}`);
            break;
        }
        const $ = cheerio.load(html);

        // Extract links to individual meeting pages
        $('li.mgTableOddRow > a:nth-child(1), li.mgTableEvenRow > a:nth-child(1)').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                allMeetingPageUrls.add(new URL(href, councilURL).toString());
            }
        });

        if (paginate) {
            // Find the "Earlier meetings" link
            const earlierLink = $('a').filter(function () {
                return $(this).text().trim() === 'Earlier meetings';
            }).attr('href');

            if (earlierLink) {
                currentUrl = new URL(earlierLink, councilURL).toString();
                console.log(`Found "Earlier meetings" link, navigating to: ${currentUrl}`);
            } else {
                console.log('No "Earlier meetings" link found on this page.');
                currentUrl = null; // Stop the loop
            }
        } else {
            currentUrl = null; // Stop after the first page if not paginating
        }

        // Basic delay to be polite
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return Array.from(allMeetingPageUrls);
}

function extractCommitteeIdFromUrl(url) {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('ID'); // The committee details page uses 'ID'
}

async function downloadFile(url, destinationPath) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to download from ${url}: ${response.status}`);
            return false;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await writeFile(destinationPath, buffer);
        console.log(`Downloaded: ${url} -> ${destinationPath}`);
        return true;
    } catch (error) {
        console.error(`Error downloading ${url}:`, error);
        return false;
    }
}

async function downloadMinutes(meetingPageUrl, committeeName) {
    console.log(`Attempting to find minutes on page: ${meetingPageUrl}`); // ADDED LOG
    const html = await fetchPage(meetingPageUrl);
    if (!html) {
        console.log(`Failed to fetch meeting page: ${meetingPageUrl}`);
        return;
    }
    const $ = cheerio.load(html);
    const minutesLinks = $('a').filter(function () {
        const text = $(this).text().toLowerCase();
        return text.includes('printed minutes') || text.trim().toLowerCase() === 'minutes';
    });

    if (minutesLinks.length > 0) {
        for (const el of minutesLinks.get()) {
            const minutesHref = $(el).attr('href');
            if (minutesHref) {
                const absoluteMinutesUrl = new URL(minutesHref, meetingPageUrl).toString();
                if (absoluteMinutesUrl.toLowerCase().startsWith(new URL(absoluteMinutesUrl).origin) && absoluteMinutesUrl.toLowerCase().includes('.pdf')) {
                    const filename = path.basename(new URL(absoluteMinutesUrl).pathname.split('?')[0]);
                    const committeeDir = path.join('minutes', committeeName.replace(/[^a-zA-Z0-9]/g, '_'));
                    await mkdir(committeeDir, { recursive: true });
                    const destinationPath = path.join(committeeDir, filename);
                    await downloadFile(absoluteMinutesUrl, destinationPath);
                } else {
                    console.log(`Link containing "printed minutes" or text "minutes" does not point to a PDF: ${absoluteMinutesUrl}`);
                }
            }
        }
    } else {
        console.log(`No link containing "printed minutes" or text "minutes" found on: ${meetingPageUrl}`);
    }
}

async function getMinutesForCouncil(councilURL) {
    // Ensure councilURL doesn't have trailing slash
    const baseURL = councilURL.endsWith('/') ? councilURL.slice(0, -1) : councilURL;
    
    const allCommitteesMeetingData = {};
    const committeeListUrl = `${baseURL}/mgListCommittees.aspx?bcr=1`;
    const shouldPaginate = false;
    const processOnlyFirstCommittee = true; // Development flag

    // Ensure the 'minutes' directory exists
    if (!fs.existsSync('minutes')) {
        await mkdir('minutes');
    }

    console.log(`--- Fetching Committee Information from ${baseURL} (Pagination: ${shouldPaginate}) ---`);
    const committees = await getCommittees(committeeListUrl);

    if (committees.length > 0) {
        const committeesToProcess = processOnlyFirstCommittee ? [committees[0]] : committees;

        for (const committee of committeesToProcess) {
            console.log(`\n--- Processing Committee: ${committee.Name} ---`);
            const committeeId = extractCommitteeIdFromUrl(committee.URL);
            let meetingPageUrls = [];

            if (committeeId) {
                const meetingsBaseUrl = `${baseURL}/ieListMeetings.aspx?CommitteeId=${committeeId}`;
                meetingPageUrls = await scrapeMeetingLinks(meetingsBaseUrl, baseURL, shouldPaginate);
                console.log(`Found ${meetingPageUrls.length} meeting page links for ${committee.Name}.`);

                // Download minutes for each meeting page URL
                for (const meetingPageUrl of meetingPageUrls) {
                    await downloadMinutes(meetingPageUrl, committee.Name);
                }

                allCommitteesMeetingData[committee.Name] = {
                    committeeUrl: committee.URL,
                    meetingPageUrls: meetingPageUrls
                };
            } else {
                console.log(`Could not extract Committee ID from: ${committee.URL}`);
                allCommitteesMeetingData[committee.Name] = {
                    committeeUrl: committee.URL,
                    meetingPageUrls: []
                };
            }
            if (processOnlyFirstCommittee) break;
        }

        const outputFileName = "committee_meeting_data.json";
        try {
            await writeFile(outputFileName, JSON.stringify(allCommitteesMeetingData, null, 2));
            console.log(`\nSuccessfully processed committee meeting data and attempted to download minutes.`);
        } catch (error) {
            console.error(`Error writing to file ${outputFileName}:`, error);
        }

    } else {
        console.log("Could not retrieve the list of committees.");
    }

    return allCommitteesMeetingData;
}

// Example usage:
getMinutesForCouncil('https://democracy.durham.gov.uk');

export { getMinutesForCouncil };

