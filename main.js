const parser = new ContentParser({
    currentDivision: 'MX',
    disclaimerContainerId: 'cheilDisclaimers'
});
parser.insertPageContents();

const parser2 = new ContentParser({
    jsonURL: 'https://raw.githubusercontent.com/aith85/ss/refs/heads/main/test.json',
    currentDivision: 'ALL',
    allowedDomains: [
        'www.samsung.com',
        'p6-qa.samsung.com',
        'p6-eu-author.samsung.com/content/samsung',
    ],
    disclaimerContainerId: 'cheilDisclaimers'
});
parser2.insertPageContents();
