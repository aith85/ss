// All default settings
const parser1 = new ContentParser();

// Specific division
const parser2 = new ContentParser({
    currentDivision: 'MX'
});

// Multiple divisions and custom JSON URL
const parser3 = new ContentParser({
    jsonURL: 'https://custom-disclaimers.com/file.json',
    currentDivision: 'MX, AV',
    allowedDomains: [
        'www.samsung.com',
        'custom-samsung-domain.com'
    ]
});
