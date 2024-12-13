// All default settings
const parser1 = new ContentParser();

// Specific division
const parser2 = new ContentParser({
    currentDivision: 'MX'
});

// Multiple divisions and custom JSON URL
const parser3 = new ContentParser({
    jsonURL: 'https://raw.githubusercontent.com/aith85/ss/refs/heads/main/test.json',
    currentDivision: 'ALL',
    allowedDomains: [
        'www.samsung.com',
        'p6-qa.samsung.com',
        'p6-eu-author.samsung.com/content/samsung',
    ]
});
