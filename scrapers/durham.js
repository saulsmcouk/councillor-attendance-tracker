import fetch from 'node-fetch';

const councillorPageUrls = {
    "Durham City Council": "https://democracy.durham.gov.uk/mgMemberIndex.aspx?VW=TABLE&PIC=1&FN="
};

async function getCouncillorUrls(council = "Durham") {
    // get the list of city councillors
    const URL = councillorPageUrls[council];

    try {
        const response = await fetch(URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        return html; // Returning the raw HTML string
    } catch (error) {
        console.error(`Error fetching councillor page for ${council}:`, error);
        return null;
    }
}

// Example of how to use the function to get the HTML
async function main() {
    const durhamCouncillorsHTML = await getCouncillorUrls("Durham City Council");
    if (durhamCouncillorsHTML) {
        console.log("Successfully fetched the HTML content for Durham City Council.");
        // You can now pass 'durhamCouncillorsHTML' to a parsing function
        // console.log(durhamCouncillorsHTML.substring(0, 500)); // To see a snippet of the HTML
    } else {
        console.log("Failed to fetch the HTML content for Durham City Council.");
    }
}

main();