class ContentParser {
    constructor(options = {}) {
        // URL of the JSON configuration file
        this.jsonURL = options.jsonURL || 'https://raw.githubusercontent.com/aith85/ss/refs/heads/main/test.json';

        // Allowed domains for URL matching
        this.allowedDomains = options.allowedDomains || [
            'www.samsung.com',
            'p6-qa.samsung.com',
            'p6-eu-author.samsung.com/content/samsung',
        ];

        // QA Date for testing disclaimer validity
        this.QAdate = options.QAdate || null;

        // Current division(s) for filtering disclaimers
        this.currentDivision = (options.currentDivision || 'ALL').toUpperCase().replace(/\s/g, '');

        // HTML container ID for disclaimers
        this.disclaimerContainerId = options.disclaimerContainerId || 'cheilDisclaimers';

        this.data = null;
        this.initPromise = null;
    }

    // ... other existing methods ...

    // Modified method to handle QA date testing
    isDisclaimerActive(disclaimer) {
        // Check if in QA environment and QA date is provided
        const isQADomain = ['p6-qa.samsung.com', 'p6-eu-author.samsung.com'].some(domain => 
            window.location.hostname.includes(domain)
        );

        // Determine the date to use for checking
        const checkDate = isQADomain && this.QAdate 
            ? this.parseDate(this.QAdate)
            : new Date();

        // If no start/end dates, consider always active
        if (!disclaimer.startDate && !disclaimer.endDate) return true;

        // Parsing dates with format DD/MM/YYYY HH:mm is now handled by parseDate method
        const startDate = disclaimer.startDate ? this.parseDate(disclaimer.startDate) : null;
        const endDate = disclaimer.endDate ? this.parseDate(disclaimer.endDate) : null;

        // Check if current/QA date is within the disclaimer's active period
        if (startDate && checkDate < startDate) return false;
        if (endDate && checkDate > endDate) return false;

        return true;
    }

    // Centralized date parsing method
    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            const [day, month, yearTime] = dateString.split('/');
            const [year, time] = yearTime.split(' ');
            const [hours, minutes] = time.split(':');
            
            // Ensure all parts are converted to numbers
            const parsedDate = new Date(
                parseInt(year), 
                parseInt(month) - 1, 
                parseInt(day), 
                parseInt(hours), 
                parseInt(minutes)
            );

            // Validate the date
            if (isNaN(parsedDate.getTime())) {
                console.error('Invalid date format:', dateString);
                return null;
            }

            return parsedDate;
        } catch (error) {
            console.error('Error parsing date:', dateString, error);
            return null;
        }
    }
}

// Example usage with QA date
const parser = new ContentParser({
    // Optional QA date for testing (now in dd/mm/yyyy HH:mm format)
    QAdate: '15/01/2024 10:30',
    
    // Other existing options
    currentDivision: 'MX, AV',
    allowedDomains: [
        'www.samsung.com',
        'p6-qa.samsung.com',
        'p6-eu-author.samsung.com/content/samsung'
    ]
});
