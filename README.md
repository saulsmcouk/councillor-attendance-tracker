# Reform UK Councillor Attendance Tracker

Stuff

## Standard Scraper `/scrapers/standard.js`

Generates reform councillor attendance json files for councils in `/scrapers/councils.json`. Works for all councils in that file currently. Other councils may also work - simply input the base URL of their modern gov council website (if they are using modern gov - will not work if they aren't). Will also not work if they aren't exposing the right data in the right way. They may also just not work for a variety of other reasons but so far at least a decent number do work.


Councils that i've tried that don't work:
Cambridgeshire
Doncaster
Durham
Gloucestershire
Lincolnshire
Nottinghamshire
Staffordshire


Run by:
1 - `npm i`
2 - `cd scrapers`
3 - `node standard.js`


Outputs json files to `/scrapers/out` folder.

# Frontend 

`$ cd views 
$ npm start` 

Navigate to localhost:3000, and voila. 

# Todo 
Transpose this entire list: https://github.com/poteris/council-scraper/blob/main/council_list_scraper/source_data/opencouncildata_councils.csv - probably an hour or two's work to transpose / check each one - and then we should have coverage of about 80% of councils
