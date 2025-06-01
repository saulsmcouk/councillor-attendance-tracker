import * as cheerio from 'cheerio';

// baseUrl eg https://council.lancashire.gov.uk/

const getCouncillorsPage = async (councilName, baseUrl) => {
    const memberListUrl = 'mgMemberIndex.aspx?VW=TABLE&PIC=1&FN=';

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

const getReformCouncillors = (councillorsPageHtml) => {
    const $ = cheerio.load(councillorsPageHtml);
    const $councillorRows = $(
        '.mgContent:first > table:first > tbody:first > tr',
    );
    const $reformCouncillorRows = $councillorRows.filter((i, el) => {
        const partyCol = $(el).children('td')[2];
        return $(partyCol).text().slice(0, 9) === 'Reform UK';
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

const main = async () => {
    const lancsCouncillorsHtml = await getCouncillorsPage(
        'Lancashire',
        'https://council.lancashire.gov.uk/',
    );
    const reformUIDs = getReformCouncillors(lancsCouncillorsHtml);
};

main();
