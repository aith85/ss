class ContentParser {
    constructor(options = {}) {
        // URL of the JSON configuration file
        // This allows flexibility in setting the JSON source dynamically
        this.jsonURL = options.jsonURL || 'https://raw.githubusercontent.com/aith85/ss/refs/heads/main/test.json';

        // Allowed domains for URL matching
        // This list can be easily expanded to include new domains
        this.allowedDomains = options.allowedDomains || [
            'www.samsung.com',
            'p6-qa.samsung.com',
            'p6-eu-author.samsung.com',
            'sites.html/content/samsung'
        ];

        // Current division(s) for filtering disclaimers
        // Can be:
        // - 'ALL': match disclaimers for all divisions
        // - 'MX, AV': match multiple specific divisions (case-insensitive)
        // - 'MX': match a single specific division
        this.currentDivision = (options.currentDivision || 'ALL').toUpperCase().replace(/\s/g, '');

        this.data = null;
        this.initPromise = null;
    }

    init() {
        if (!this.initPromise) {
            this.initPromise = new Promise((resolve, reject) => {
                $.getJSON(this.jsonURL)
                    .done(data => {
                        console.log('JSON caricato:', data);
                        this.data = data;
                        resolve(data);
                    })
                    .fail((jqXHR, textStatus, errorThrown) => {
                        console.error('Errore nel caricamento:', textStatus, errorThrown);
                        reject(errorThrown);
                    });
            });
        }
        return this.initPromise;
    }

    // Normalizza l'URL estraendo solo il percorso relativo
    normalizeUrl(url) {
        try {
            // Converti l'URL in un oggetto URL
            const parsedUrl = new URL(url, 'https://www.samsung.com');
            
            // Estrai il percorso relativo
            let cleanUrl = parsedUrl.pathname;
            
            // Rimuove .html finale
            cleanUrl = cleanUrl.replace(/\.html$/, '');
            
            // Rimuove slash iniziale e finale
            cleanUrl = cleanUrl.replace(/^\/|\/$/g, '');
            
            return cleanUrl;
        } catch (error) {
            console.error('Errore nella normalizzazione URL:', error);
            return url;
        }
    }

    // Verifica se l'URL corrente è in un dominio consentito
    isValidDomain(url) {
        try {
            const parsedUrl = new URL(url);
            return this.allowedDomains.some(domain => 
                parsedUrl.hostname.includes(domain) || 
                domain.includes(parsedUrl.hostname)
            );
        } catch (error) {
            console.error('Errore nel controllo del dominio:', error);
            return false;
        }
    }

    // Verifica se l'URL corrente corrisponde agli URL del disclaimer
    isUrlMatch(disclaimer) {
        // Se non sono specificate URL, considera il disclaimer applicabile ovunque
        if (!disclaimer.URLs || disclaimer.URLs.length === 0) return true;

        // Verifica che l'URL corrente sia in un dominio consentito
        if (!this.isValidDomain(window.location.href)) {
            console.log('Dominio non consentito:', window.location.href);
            return false;
        }

        // Normalizza l'URL corrente
        const currentUrl = this.normalizeUrl(window.location.href);

        // Controlla se l'URL corrente è tra quelli specificati
        return disclaimer.URLs.some(url => {
            // Normalizza l'URL del disclaimer
            const disclaimerUrl = this.normalizeUrl(url);
            return disclaimerUrl === currentUrl;
        });
    }

    // Verifica se il disclaimer è per la divisione corrente
    isDivisionMatch(disclaimer) {
        // Se currentDivision è 'ALL', o non è specificata una divisione nel disclaimer, 
        // considera il disclaimer applicabile
        if (this.currentDivision === 'ALL' || !disclaimer.div) return true;

        // Se currentDivision contiene più divisioni
        const allowedDivisions = this.currentDivision.split(',');
        
        // Controlla se la divisione del disclaimer è tra le divisioni consentite
        return allowedDivisions.includes(disclaimer.div.toUpperCase());
    }

    // Resto dell'implementazione rimane invariato
    // ... (metodi insertPageContents, insertContents, ecc.)
}

// Esempio di utilizzo
const parser = new ContentParser({
    // URL del file JSON (opzionale)
    jsonURL: 'https://example.com/disclaimers.json',
    
    // Divisioni correnti (opzionale, default 'ALL')
    currentDivision: 'MX, AV',
    
    // Domini aggiuntivi (opzionale)
    allowedDomains: [
        'www.samsung.com',
        'p6-qa.samsung.com',
        'p6-eu-author.samsung.com',
        'sites.html/content/samsung',
        'nuovodominio.samsung.com'
    ]
});

// Carica i disclaimers per la pagina corrente
parser.insertPageContents()
    .then(result => {
        console.log('Disclaimers inseriti con successo:', result.success);
        console.log('Disclaimers falliti:', result.failed);
    })
    .catch(error => {
        console.error('Errore durante l\'inserimento:', error);
    });
