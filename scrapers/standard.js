import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';

// TODO:
// Double check that redirects work (eg tunbridgeWells probably has a redirect) - looks like they dont so fix that
// ok redirects probably do work - tunbridge wells just has a different issue fsr

const getCouncillorsPage = async (councilName, baseUrl) => {
    const memberListUrl = 'mgMemberIndex.aspx?VW=TABLE&PIC=1';

    try {
        const response = await fetch(baseUrl + memberListUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'text/html',
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        return html; // Returning the raw HTML string
    } catch (error) {
        console.error(
            `Error fetching councillor page for ${councilName}:`,
            error
        );
        return null;
    }
};

const getAttendancePage = async (
    councilName,
    baseUrl,
    startDate = { day: 1, month: 5, year: 2025 },
    endDate = { day: 31, month: 12, year: 2040 }
) => {
    const attendanceUrl = 'mgUserAttendanceSummary.aspx';

    let params = `?XXR=0&DR=${startDate.day}%2f${startDate.month}%2f${startDate.year}-${endDate.day}%2f${endDate.month}%2f${endDate.year}`;

    try {
        const response = await fetch(baseUrl + attendanceUrl + params, {
            method: 'GET',
            headers: {
                'Content-Type': 'text/html',
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        return html; // Returning the raw HTML string
    } catch (error) {
        console.error(
            `Error fetching councillor page for ${councilName}:`,
            error
        );
        return null;
    }
};

const getReformCouncillorUrls = (councillorsPageHtml) => {
    const $ = cheerio.load(councillorsPageHtml);

    const $councillorRows = $('table.mgStatsTable:first > tbody:first > tr');

    console.log(`${$councillorRows.length} councillors found.`);

    const $reformCouncillorRows = $councillorRows.filter((i, el) => {
        const partyCol = $(el).children('td')[2];
        return (
            $(partyCol)
                .text()
                .replaceAll('(', '')
                .replaceAll(')', '')
                .replaceAll(' ', '')
                .slice(0, 6) === 'Reform'
        ); // If someone wants to add more parties to this modify this line
    });

    let UIDs = [];
    $reformCouncillorRows.each((i, el) => {
        const infoCol = $(el).children('td')[1];
        const uid = $($($(infoCol).children('p')[0]).children('a')[0])
            .attr('href')
            .slice(20);
        UIDs.push(uid);
    });

    console.log(`${UIDs.length} reform councillors found`);

    return UIDs;
};

const getReformAttendanceData = (attendanceHtml, UIDs) => {
    const $ = cheerio.load(attendanceHtml);

    const $rows = $('table.mgStatsTable:first > tbody:first > tr');

    const $reformRows = $rows.filter((i, el) => {
        const councillorCol = $(el).children('td')[0];
        const councillorUrl = $($(councillorCol).children('a')[0]).attr('href');
        const params = councillorUrl.slice(22);
        const uid = params.split('&')[0];
        return UIDs.includes(uid);
    });

    let data = []; // {uid: str, name: str, expected: int, present: int}
    $reformRows.each((i, el) => {
        const children = $(el).children('td');

        const councillorCol = children[0];
        const councillorUrl = $($(councillorCol).children('a')[0]).attr('href');
        const params = councillorUrl.slice(22);

        const uid = params.split('&')[0];
        const name = $($(councillorCol).children('a')[0]).text();
        const expected = parseInt($(children[1]).text());
        const present = parseInt($(children[2]).text());

        data.push({ uid, name, expected, present });
    });
    return data;
};

export const collectReformAttendanceData = async (
    councilName,
    baseUrl,
    startDate = { day: 1, month: 5, year: 2025 },
    endDate = { day: 31, month: 12, year: 2040 }
) => {
    const councillorsHtml = await getCouncillorsPage(councilName, baseUrl);
    const reformUIDs = getReformCouncillorUrls(councillorsHtml);

    const attendanceHtml = await getAttendancePage(
        councilName,
        baseUrl,
        startDate,
        endDate
    );
    const attendanceData = getReformAttendanceData(attendanceHtml, reformUIDs);

    return attendanceData;
};

const main = async () => {
    const jsonCouncils = await fs.readFile('./councils.json');
    const councils = JSON.parse(jsonCouncils);

    for (let { fileName, councilName, baseUrl } of councils) {
        try {
            console.log(`Gathering data for: ${councilName}`);
            const data = await collectReformAttendanceData(
                councilName,
                baseUrl
            );
            const obj = { councilName, reformAttendanceData: data };
            const jsonStr = JSON.stringify(obj);
            await fs.writeFile(`./out/${fileName}Data.json`, jsonStr);
        } catch (err) {
            console.log(`${councilName} didnt work`);
            console.error(err);
        }
    }
};

main();
