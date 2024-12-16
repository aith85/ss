/**
 * ContentParser class for handling Samsung disclaimers
 * Manages disclaimer content based on URL, date, and division rules
 */
class ContentParser {
    /**
     * Initialize the ContentParser with configuration options
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        // Verify jQuery dependency
        if (typeof $ === 'undefined') {
            console.error('dParser > jQuery not loaded');
            throw new Error('jQuery not loaded');
        }

        // Source URL for disclaimer configuration
        this.dataURL = options.dataURL || 'https://raw.githubusercontent.com/aith85/ss/refs/heads/main/test.json';

        // Optional inline data for testing
        this.qaJSON = options.qaJSON || null;
        this.qaXML = options.qaXML || null;

        // Country code for URL matching (default: 'it')
        this.countryURL = options.countryURL || 'it';

        // List of QA domains where qaDate can be used
        this.qaDomains = [
            'p6-eu-author.samsung.com',
            'p6-qa.samsung.com',
            'p6-pre-qa2.samsung.com',
            'p6-aem-sa.samsung.com',
            'p6-qaweb-sa.samsung.com'
        ];

        // Allowed domains for URL matching
        this.allowedDomains = [
            'www.samsung.com',
            ...this.qaDomains
        ];

        // QA Date for testing disclaimer validity (ISO format: YYYY-MM-DD HH:mm:ss)
        this.qaDate = options.qaDate || null;

        // Division filter (comma-separated list or 'ALL')
        this.currentDivision = (options.currentDivision || 'ALL').toUpperCase().replace(/\s/g, '');

        // DOM container ID for disclaimers
        this.disclaimerContainerId = options.disclaimerContainerId || 'cheilDisclaimers';

        // Ignore apex for sorting (default: false)
        this.ignoreApex = options.ignoreApex || false;

        // Internal state
        this.data = null;
        this.initPromise = null;
        this.isExecuted = false;
    }

    /**
     * Validate ISO date format
     * @param {string} dateString - Date string to validate
     * @returns {boolean} True if valid ISO format
     */
    isValidISODate(dateString) {
        const isoFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        if (!isoFormat.test(dateString)) return false;
        
        const date = new Date(dateString.replace(' ', 'T'));
        return !isNaN(date.getTime());
    }

    /**
     * Validate Samsung URL format
     * @param {string} url - URL to validate
     * @returns {boolean} True if URL matches Samsung format
     */
    isValidSamsungURL(url) {
        try {
            const urlPattern = new RegExp(`^https://www\\.samsung\\.com/[a-z]{2}/.*$`);
            return urlPattern.test(url);
        } catch (error) {
            return false;
        }
    }

    /**
     * Extract the path after country code from URL
     * @param {string} url - URL to process
     * @returns {string} Normalized path or null if invalid
     */
    extractPathAfterCountry(url) {
        try {
            const parsedUrl = new URL(url);
            
            // Remove query parameters and hash
            let path = parsedUrl.pathname;
            
            // Remove trailing .html and slashes
            path = path.replace(/\.html$/, '')
                      .replace(/^\/|\/$/g, '');

            // Find country code position
            const parts = path.split('/');
            const countryIndex = parts.findIndex(part => part.length === 2);
            
            if (countryIndex === -1) return null;
            
            // Return path after country code
            return parts.slice(countryIndex + 1).join('/');
        } catch (error) {
            console.error('dParser > Error processing URL:', error);
            return null;
        }
    }

    /**
     * Validate URLs in disclaimer
     * @param {Object} disclaimer - Disclaimer object to validate
     * @returns {boolean} True if URLs are valid
     */
    validateDisclaimerURLs(disclaimer) {
        if (!disclaimer.URLs || !Array.isArray(disclaimer.URLs)) {
            return false;
        }

        return disclaimer.URLs.every(url => {
            if (!this.isValidSamsungURL(url)) {
                console.error('dParser > invalid URLs');
                return false;
            }
            return true;
        });
    }

    /**
     * Normalize text by escaping HTML and removing illegal characters
     * @param {string} text - Text to normalize
     * @returns {string} Normalized text
     */
    normalizeText(text) {
        if (typeof text !== 'string') return '';
        
        return text
            // Convert special characters to HTML entities
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            // Remove control characters and non-printable characters
            .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
            // Replace multiple spaces with single space
            .replace(/\s+/g, ' ')
            // Trim whitespace
            .trim();
    }

    /**
     * Convert URLs in text to HTML anchors
     * @param {string} text - Text containing URLs
     * @returns {string} Text with URLs converted to anchors
     */
    convertUrlsToAnchors(text) {
        if (typeof text !== 'string') return '';

        // URL pattern that matches http/https URLs
        const urlPattern = /(https?:\/\/[^\s<>"]+)/g;

        return text.replace(urlPattern, url => {
            try {
                // Parse URL to validate it
                new URL(url);
                // Create anchor tag with target="_blank"
                return `<a href="${this.normalizeText(url)}" target="_blank" rel="noopener noreferrer">${this.normalizeText(url)}</a>`;
            } catch (e) {
                // If URL is invalid, return it unchanged
                return url;
            }
        });
    }

    /**
     * Process text content with normalization and URL conversion
     * @param {string} text - Text to process
     * @returns {string} Processed text
     */
    processText(text) {
        // First normalize the text
        let processed = this.normalizeText(text);
        // Then convert URLs to anchors
        processed = this.convertUrlsToAnchors(processed);
        return processed;
    }

    /**
     * Validate disclaimer object structure and field formats
     * @param {Object} disclaimer - Disclaimer object to validate
     * @returns {boolean} True if valid
     */
    validateDisclaimer(disclaimer) {
        // Check mandatory fields
        const mandatoryFields = ['id', 'index', 'title', 'text', 'URLs'];
        const missingFields = mandatoryFields.filter(field => !disclaimer[field]);
        
        if (missingFields.length > 0) {
            console.error(`dParser > invalid JSON format: missing mandatory fields (${missingFields.join(', ')})`);
            return false;
        }

        // Validate id format (non-empty string or number)
        if (typeof disclaimer.id !== 'string' && typeof disclaimer.id !== 'number') {
            console.error('dParser > invalid JSON format: id must be string or number');
            return false;
        }

        // Validate title format (non-empty string)
        if (typeof disclaimer.title !== 'string' || disclaimer.title.trim() === '') {
            console.error('dParser > invalid JSON format: title must be non-empty string');
            return false;
        }

        // Validate text format (non-empty string)
        if (typeof disclaimer.text !== 'string' || disclaimer.text.trim() === '') {
            console.error('dParser > invalid JSON format: text must be non-empty string');
            return false;
        }

        // Validate URLs
        if (!Array.isArray(disclaimer.URLs) || disclaimer.URLs.length === 0) {
            console.error('dParser > invalid JSON format: URLs must be non-empty array');
            return false;
        }

        if (!this.validateDisclaimerURLs(disclaimer)) {
            return false;
        }

        // Validate optional fields if present
        if (disclaimer.div && typeof disclaimer.div !== 'string') {
            console.error('dParser > invalid JSON format: div must be string');
            return false;
        }

        // Validate dates if present
        if (disclaimer.startDate && !this.isValidISODate(disclaimer.startDate)) {
            console.error('dParser > invalid JSON format: startDate must be ISO format (YYYY-MM-DD HH:mm:ss)');
            return false;
        }

        if (disclaimer.endDate && !this.isValidISODate(disclaimer.endDate)) {
            console.error('dParser > invalid JSON format: endDate must be ISO format (YYYY-MM-DD HH:mm:ss)');
            return false;
        }

        return true;
    }

    /**
     * Detect format from content
     * @param {string} content - Content to check
     * @returns {string} Format ('json' or 'xml')
     */
    detectFormat(content) {
        try {
            // Remove whitespace and comments
            content = content.trim().replace(/<!--[\s\S]*?-->/g, '');

            // Check for XML declaration or root element
            if (content.startsWith('<?xml') || /<[^>]+>/.test(content)) {
                // Validate XML structure
                const parser = new DOMParser();
                const doc = parser.parseFromString(content, 'text/xml');
                if (!doc.querySelector('parsererror')) {
                    return 'xml';
                }
            }

            // Try parsing as JSON
            JSON.parse(content);
            return 'json';
        } catch (e) {
            // If both XML and JSON parsing fail, default to JSON
            console.warn('dParser > Could not detect format, defaulting to JSON');
            return 'json';
        }
    }

    /**
     * Load and validate disclaimer data
     * @returns {Promise} Promise resolving with loaded data
     */
    loadData() {
        return new Promise((resolve, reject) => {
            // Handle inline test data
            if (this.qaJSON || this.qaXML) {
                try {
                    let data;
                    if (this.qaJSON) {
                        data = typeof this.qaJSON === 'string' ? JSON.parse(this.qaJSON) : this.qaJSON;
                    } else {
                        data = this.parseXML(this.qaXML);
                    }

                    if (!data || !data.disclaimers) {
                        reject(new Error('dParser > invalid DATA format: missing disclaimers'));
                        return;
                    }

                    // Process disclaimers
                    const { validDisclaimers, invalidDisclaimers } = this.processDisclaimers(data.disclaimers);

                    if (invalidDisclaimers.length > 0) {
                        console.warn('dParser > Skipped invalid disclaimers:', invalidDisclaimers);
                    }

                    this.data = { disclaimers: validDisclaimers };
                    resolve(this.data);
                } catch (error) {
                    reject(new Error('dParser > invalid DATA format: ' + error.message));
                }
                return;
            }

            // Load data from URL and auto-detect format
            $.get(this.dataURL)
                .done(content => {
                    try {
                        let data;
                        const format = this.detectFormat(content);

                        if (format === 'xml') {
                            data = this.parseXML(content);
                        } else {
                            data = typeof content === 'string' ? JSON.parse(content) : content;
                        }

                        if (!data || !data.disclaimers) {
                            reject(new Error('dParser > invalid DATA format: missing disclaimers'));
                            return;
                        }

                        // Process disclaimers
                        const { validDisclaimers, invalidDisclaimers } = this.processDisclaimers(data.disclaimers);

                        if (invalidDisclaimers.length > 0) {
                            console.warn('dParser > Skipped invalid disclaimers:', invalidDisclaimers);
                        }

                        this.data = { disclaimers: validDisclaimers };
                        resolve(this.data);
                    } catch (error) {
                        reject(new Error('dParser > invalid DATA format: ' + error.message));
                    }
                })
                .fail((jqXHR, textStatus, errorThrown) => {
                    reject(new Error('dParser > failed to load DATA: ' + textStatus));
                });
        });
    }

    /**
     * Process and validate disclaimers
     * @param {Array|Object} disclaimers - Raw disclaimers array or object
     * @returns {Object} Object containing valid and invalid disclaimers
     */
    processDisclaimers(disclaimers) {
        const validDisclaimers = {};
        const invalidDisclaimers = [];

        // Convert to array if object
        const disclaimerArray = Array.isArray(disclaimers) ? disclaimers : Object.values(disclaimers);
    
        disclaimerArray.forEach(disclaimer => {
            if (this.validateDisclaimer(disclaimer)) {
                // Use id field as key
                disclaimer.title = this.normalizeText(disclaimer.title);
                disclaimer.text = this.processText(disclaimer.text);
                validDisclaimers[disclaimer.id] = disclaimer;
            } else {
                invalidDisclaimers.push(disclaimer.id || 'unknown');
            }
        });
    
        return { validDisclaimers, invalidDisclaimers };
    }

    /**
     * Parse XML data into the same format as JSON
     * @param {string|Document} xml - XML string or document
     * @returns {Object} Parsed data in JSON format
     */
    parseXML(xml) {
        // Convert string to XML document if needed
        const xmlDoc = typeof xml === 'string' ? new DOMParser().parseFromString(xml, 'text/xml') : xml;
        
        // Check for parsing errors
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid XML format');
        }

        // Create array for disclaimers
        const result = { disclaimers: [] };
        const disclaimers = xmlDoc.getElementsByTagName('disclaimer');

        Array.from(disclaimers).forEach(disclaimer => {
            const data = {
                id: disclaimer.getElementsByTagName('id')[0]?.textContent || '',
                index: disclaimer.getElementsByTagName('index')[0]?.textContent || '',
                title: disclaimer.getElementsByTagName('title')[0]?.textContent || '',        
                text: disclaimer.getElementsByTagName('text')[0]?.textContent || '',
                div: disclaimer.getElementsByTagName('div')[0]?.textContent || 'ALL',
                startDate: disclaimer.getElementsByTagName('startDate')[0]?.textContent || '',
                endDate: disclaimer.getElementsByTagName('endDate')[0]?.textContent || ''
            };

            // Handle URLs
            const urls = disclaimer.getElementsByTagName('url');
            if (urls.length > 0) {
                data.URLs = Array.from(urls).map(url => url.textContent).filter(Boolean);
            }

            result.disclaimers.push(data);
        });

        return result;
    }

    /**
     * Initialize by loading and validating JSON configuration
     * @returns {Promise} Promise resolving to parsed JSON data
     */
    init() {
        if (!this.initPromise) {
            this.initPromise = this.loadData().then(data => {
                // Validate each disclaimer
                const invalidDisclaimers = Object.values(data.disclaimers).some(
                    disclaimer => !this.validateDisclaimer(disclaimer)
                );

                if (invalidDisclaimers) {
                    throw new Error('Invalid JSON format');
                }

                console.log('dParser > JSON loaded:', data);
                return data;
            });
        }
        return this.initPromise;
    }

    /**
     * Validate if domain is *.samsung.com
     * @param {string} url - URL to validate
     * @returns {boolean} True if domain is valid
     */
    isValidDomain(url) {
        try {
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname.toLowerCase();
            return this.allowedDomains.includes(hostname);
        } catch (error) {
            console.error('dParser > Error in domain validation:', error);
            return false;
        }
    }

    /**
     * Parse date string in ISO format
     * @param {string} dateString - Date in ISO format (YYYY-MM-DD HH:mm:ss)
     * @returns {Date|null} Parsed Date object or null if invalid
     */
    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            if (!this.isValidISODate(dateString)) {
                console.error('dParser > invalid date format, use ISO format YYYY-MM-DD HH:mm:ss');
                return null;
            }

            return new Date(dateString.replace(' ', 'T'));
        } catch (error) {
            console.error('dParser > Error parsing date:', dateString, error);
            return null;
        }
    }

    /**
     * Check if disclaimer is active based on date range
     * @param {Object} disclaimer - Disclaimer object to check
     * @returns {boolean} True if disclaimer is active
     */
    isDisclaimerActive(disclaimer) {
        // Determine if we're in a QA environment
        const isQADomain = this.qaDomains.some(domain => 
            window.location.hostname.includes(domain)
        );

        // Use QA date only in QA environment, otherwise use current date
        const checkDate = isQADomain && this.qaDate 
            ? this.parseDate(this.qaDate)
            : new Date();

        // If no dates specified, disclaimer is always active
        if (!disclaimer.startDate && !disclaimer.endDate) return true;

        // If only startDate is specified, use it (or current date if not set)
        const startDate = disclaimer.startDate ? this.parseDate(disclaimer.startDate) : checkDate;

        // If only endDate is specified, check against it
        const endDate = disclaimer.endDate ? this.parseDate(disclaimer.endDate) : null;

        // Check if current date is within range
        if (checkDate < startDate) return false;
        if (endDate && checkDate > endDate) return false;

        return true;
    }

    /**
     * Check if disclaimer URLs match current page
     * @param {Object} disclaimer - Disclaimer object to check
     * @returns {boolean} True if URLs match
     */
    isUrlMatch(disclaimer) {
        if (!disclaimer.URLs || disclaimer.URLs.length === 0) return true;

        // Check if current domain is allowed
        if (!this.isValidDomain(window.location.href)) {
            console.log('dParser > Domain not allowed:', window.location.href);
            return false;
        }

        // Get current page path after country code
        const currentPath = this.extractPathAfterCountry(window.location.href);
        if (!currentPath) return false;

        // Check if any disclaimer URL matches
        return disclaimer.URLs.some(url => {
            const disclaimerPath = this.extractPathAfterCountry(url);
            return disclaimerPath === currentPath;
        });
    }

    /**
     * Check if disclaimer division matches current division
     * @param {Object} disclaimer - Disclaimer object to check
     * @returns {boolean} True if divisions match
     */
    isDivisionMatch(disclaimer) {
        // If no division specified, treat as "ALL"
        if (!disclaimer.div) return true;
        
        // If current division is "ALL", match all disclaimers
        if (this.currentDivision === 'ALL') return true;
        
        // Check if disclaimer division matches any of the current divisions
        const allowedDivisions = this.currentDivision.split(',');
        return allowedDivisions.includes(disclaimer.div.toUpperCase());
    }

    /**
     * Insert applicable disclaimers into the page
     * @returns {Promise<Object>} Result object with success and failed arrays
     */
    async insertPageContents() {
        // Prevent multiple executions
        if (this.isExecuted) {
            console.error('dParser > Too many calls');
            throw new Error('Too many calls');
        }

        try {
            this.isExecuted = true;

            // Load data if not already loaded
            if (!this.data) {
                await this.init();
            }

            // Get or create container
            let disclaimerContainer = document.getElementById(this.disclaimerContainerId);
            if (!disclaimerContainer) {
                disclaimerContainer = document.createElement('div');
                disclaimerContainer.id = this.disclaimerContainerId;
                document.body.appendChild(disclaimerContainer);
            }

            // Clear existing content
            disclaimerContainer.textContent = '';

            // Filter applicable disclaimers
            const applicableDisclaimers = Object.values(this.data.disclaimers)
                .filter(disclaimer => 
                    this.isDisclaimerActive(disclaimer) && 
                    this.isUrlMatch(disclaimer) &&
                    this.isDivisionMatch(disclaimer)
                );

            // Sort disclaimers based on ignoreApex option
            const sortedDisclaimers = this.ignoreApex 
                ? applicableDisclaimers // Keep original order from JSON
                : applicableDisclaimers.sort((a, b) => {
                    // If apex is missing or same, preserve original order
                    if (!a.apex && !b.apex) return 0;
                    if (!a.apex) return 1;
                    if (!b.apex) return -1;
                    return a.apex - b.apex;
                });

            // Insert each applicable disclaimer
            sortedDisclaimers.forEach((disclaimer, index) => {
                const disclaimerElement = document.createElement('div');
                disclaimerElement.className = 'disclaimer';

                if (disclaimer.title) {
                    const titleElement = document.createElement('h3');
                    titleElement.textContent = disclaimer.title;
                    disclaimerElement.appendChild(titleElement);
                }

                const textElement = document.createElement('p');
                // Use consecutive numbers if ignoreApex is true, otherwise use apex or id
                const prefix = this.ignoreApex ? `${index + 1}` : (disclaimer.apex || disclaimer.id);
                textElement.innerHTML = `${prefix}. ${disclaimer.text}`;
                disclaimerElement.appendChild(textElement);

                disclaimerContainer.appendChild(disclaimerElement);
            });

            console.log('dParser > Disclaimers inserted:', applicableDisclaimers.length);
            return { 
                success: applicableDisclaimers.map(d => d.id),
                failed: []
            };
        } catch (error) {
            console.error('dParser > Error inserting contents:', error);
            return { success: [], failed: [] };
        }
    }
}

// Example usage
const parser = new ContentParser({
    // URL of data file (optional)
    // dataURL: 'https://raw.githubusercontent.com/aith85/ss/refs/heads/main/test.json',
    // dataURL: 'https://p6-qa.samsung.com/content/dam/samsung/it/test123/testJSON.bin',
    dataURL: 'https://images.samsung.com/is/content/samsung/assets/it/test123/testXML.xml',
    
    // Inline JSON for testing (optional)
    /* 
    qaJSON: {
        "disclaimers": [
            {
                "id": "disclaimer1",
                "index": 1,
                "title": "Disclaimer title 1",
                "text": "Lorem ipsum 1  see full legals at https://www.samsung.com/it/test123",
                "URLs": [
                    "https://www.samsung.com/it/",
                    "https://www.samsung.com/it/test123/"
                ],
                "div": "MX",
                "startDate": "2024-01-01 00:00:00",
                "endDate": "2024-12-31 23:59:59"
            },
            {
                "id": "disclaimer2",
                "index": 2,
                "title": "Disclaimer title 2",
                "text": "Lorem ipsum 2 with missing mandatory fields",
                "div": "AV"
            },
            {
                "id": "disclaimer3",
                "index": 3,
                "title": "Disclaimer title 3",
                "text": "Lorem ipsum 3",
                "startDate": "2024-01-15 00:00:00",
                "URLs": [
                    "https://www.samsung.com/it/test123"
                ]
            },
            {
                "id": "disclaimer4",
                "index": 4,
                "title": "Disclaimer title 4",
                "text": "Lorem ipsum 4",
                "URLs": [
                    "https://www.samsung.com/it/test123"
                ]
            }
        ]
    }, */

    // Inline XML for testing (optional)
    
    qaXML: `<?xml version="1.0" encoding="UTF-8"?>
    <disclaimers>
        <disclaimer>
            <id>disclaimer1</id>
            <index>1</index>
            <title>Disclaimer title 1</title>
            <text>Lorem ipsum 1  see full legals at https://www.samsung.com/it/test123</text>
            <url>https://www.samsung.com/it/</url>
            <url>https://www.samsung.com/it/test123/</url>
            <div>MX</div>
            <startDate>2024-01-01 00:00:00</startDate>
            <endDate>2024-12-31 23:59:59</endDate>
        </disclaimer>
        <disclaimer>
            <id>disclaimer2</id>
            <index>2</index>
            <title>Disclaimer title 2</title>
            <text>Lorem ipsum 2 with missing mandatory fields</text>
            <div>AV</div>
        </disclaimer>
        <disclaimer>
            <id>disclaimer3</id>
            <index>3</index>
            <title>Disclaimer title 3</title>
            <text>Lorem ipsum 3</text>
            <startDate>2024-01-15 00:00:00</startDate>
            <url>https://www.samsung.com/it/test123</url>
        </disclaimer>
        <disclaimer>
            <id>disclaimer4</id>
            <index>4</index>
            <title>Disclaimer title 4</title>
            <text>Lorem ipsum 4</text>
            <url>https://www.samsung.com/it/test123</url>
        </disclaimer>
    </disclaimers>`,
   
    
    // Country code for URL matching (optional, default: 'it')
    countryURL: 'it',
    
    // QA Date for testing (optional, ISO format: YYYY-MM-DD HH:mm:ss)
    qaDate: '2024-01-15 10:30:00',
    
    // Current divisions (optional, default 'ALL')
    currentDivision: 'MX, AV',
    
    // ID of disclaimers container (optional)
    disclaimerContainerId: 'cheilDisclaimers',
    
    // Ignore apex for sorting (optional, default: false)
    ignoreApex: true
});

// Load disclaimers for current page
parser.insertPageContents()
    .then(result => {
        console.log('dParser > Disclaimers inserted successfully:', result.success);
        console.log('dParser > Failed disclaimers:', result.failed);
    })
    .catch(error => {
        console.error('dParser > Error during insertion:', error);
    });
