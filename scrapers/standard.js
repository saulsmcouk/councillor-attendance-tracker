import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';

// prettier-ignore
import councils from './councils.json' with { type: 'json' };

// baseUrl eg https://council.lancashire.gov.uk/

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
            error,
        );
        return null;
    }
};

const getAttendancePage = async (
    councilName,
    baseUrl,
    startDate = { day: 1, month: 5, year: 2025 },
    endDate = { day: 31, month: 12, year: 2040 },
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
            error,
        );
        return null;
    }
};

const getReformCouncillorUrls = (councillorsPageHtml) => {
    const $ = cheerio.load(councillorsPageHtml);

    const $councillorRows = $(
        '.mgContent:first > table:first > tbody:first > tr',
    );

    const $reformCouncillorRows = $councillorRows.filter((i, el) => {
        const partyCol = $(el).children('td')[2];
        return $(partyCol).text().slice(0, 9) === 'Reform UK'; // If someone wants to add more parties to this modify this line
    });

    let UIDs = [];
    $reformCouncillorRows.each((i, el) => {
        const infoCol = $(el).children('td')[1];
        const uid = $($($(infoCol).children('p')[0]).children('a')[0])
            .attr('href')
            .slice(20);
        UIDs.push(uid);
    });

    return UIDs;
};

const getReformAttendanceData = (attendanceHtml, UIDs) => {
    const $ = cheerio.load(attendanceHtml);

    const $rows = $('.mgContent:first > table:first > tbody:first > tr');

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

const collectReformAttendanceData = async (
    councilName,
    baseUrl,
    startDate = { day: 1, month: 5, year: 2025 },
    endDate = { day: 31, month: 12, year: 2040 },
) => {
    const councillorsHtml = await getCouncillorsPage(councilName, baseUrl);
    const reformUIDs = getReformCouncillorUrls(councillorsHtml);

    const attendanceHtml = await getAttendancePage(
        councilName,
        baseUrl,
        startDate,
        endDate,
    );
    const attendanceData = getReformAttendanceData(attendanceHtml, reformUIDs);

    return attendanceData;
};

const main = async () => {
    for (let { fileName, councilName, baseUrl } of councils) {
        try {
            const data = await collectReformAttendanceData(
                councilName,
                baseUrl,
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
