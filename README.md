### Reform UK Councillor Attendance Tracker

Stuff

## Standard Scraper `/scrapers/standard.js`

Generates reform councillor attendance json files for councils in `/scrapers/councils.json`. Works for all councils in that file currently. Other councils may also work - simply input the base URL of their modern gov council website (if they are using modern gov - will not work if they aren't). Will also not work if they aren't exposing the right data in the right way. They may also just not work for a variety of other reasons but so far at least a decent number do work.


Councils that i've tried that don't work:
Buckinghamshire
Cambridgeshire
Devon
Doncaster
Durham
Gloucestershire
Hertfordshire
Leicestershire
Lincolnshire
Nottinghamshire
Oxfordshire
Staffordshire


Run by:
1 - `npm i`
2 - `cd scrapers`
3 - `node standard.js`


Outputs json files to `/scrapers/out` folder.
