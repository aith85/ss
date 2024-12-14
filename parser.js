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

    init() {
        if (!this.initPromise) {
            this.initPromise = new Promise((resolve, reject) => {
                $.getJSON(this.jsonURL)
                    .done(data => {
                        // Validate JSON structure
                        if (!data || !data.disclaimers) {
                            console.error('JSON incompleto: mancano i disclaimers');
                            reject(new Error('JSON incompleto'));
                            return;
                        }

                        // Validate each disclaimer has required fields
                        Object.values(data.disclaimers).forEach(disclaimer => {
                            if (!disclaimer.id || !disclaimer.text) {
                                console.error('JSON incompleto: disclaimer mancante di campi obbligatori', disclaimer);
                            }
                        });

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

    // Metodo centralizzato per il parsing delle date
    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            const [day, month, yearTime] = dateString.split('/');
            const [year, time] = yearTime.split(' ');
            const [hours, minutes] = time.includes(':') ? time.split(':') : [time, '0'];
            
            // Ensure all parts are converted to numbers
            const parsedDate = new Date(
                parseInt(year), 
                parseInt(month) - 1, 
                parseInt(day), 
                parseInt(hours), 
                parseInt(minutes || '0')
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

    // Verifica se un disclaimer è attivo in base alla data corrente
    isDisclaimerActive(disclaimer) {
        // Check if in QA environment and QA date is provided
        const isQADomain = ['p6-qa.samsung.com', 'p6-eu-author.samsung.com'].some(domain => 
            window.location.hostname.includes(domain)
        );

        // Determine the date to use for checking
        const checkDate = isQADomain && this.QAdate 
            ? this.parseDate(this.QAdate)
            : new Date();

        // Se mancano startDate e endDate, considera il disclaimer sempre attivo
        if (!disclaimer.startDate && !disclaimer.endDate) return true;

        // Parsing delle date con formato DD/MM/YYYY HH:mm
        const startDate = disclaimer.startDate ? this.parseDate(disclaimer.startDate) : null;
        const endDate = disclaimer.endDate ? this.parseDate(disclaimer.endDate) : null;

        // Controlla se la data corrente è nell'intervallo
        if (startDate && checkDate < startDate) return false;
        if (endDate && checkDate > endDate) return false;

        return true;
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

    // Inserisce i contenuti dei disclaimer per la pagina corrente
    async insertPageContents() {
        try {
            // Inizializza i dati se non già caricati
            if (!this.data) {
                await this.init();
            }

            // Trova i container dei disclaimer
            let disclaimerContainer = document.getElementById(this.disclaimerContainerId);
            
            // Se il container non esiste, crealo
            if (!disclaimerContainer) {
                disclaimerContainer = document.createElement('div');
                disclaimerContainer.id = this.disclaimerContainerId;
                document.body.appendChild(disclaimerContainer);
            }

            // Pulisci il container esistente
            disclaimerContainer.innerHTML = '';

            // Trova i disclaimers applicabili
            const applicableDisclaimers = Object.values(this.data.disclaimers)
                .filter(disclaimer => 
                    this.isDisclaimerActive(disclaimer) && 
                    this.isUrlMatch(disclaimer) &&
                    this.isDivisionMatch(disclaimer)
                );

            // Inserisce i disclaimers trovati
            applicableDisclaimers.forEach(disclaimer => {
                // Crea l'elemento per questo disclaimer
                const disclaimerElement = document.createElement('div');
                disclaimerElement.className = 'disclaimer';

                // Aggiungi titolo se presente
                if (disclaimer.title) {
                    const titleElement = document.createElement('h3');
                    titleElement.textContent = disclaimer.title;
                    disclaimerElement.appendChild(titleElement);
                }

                // Aggiungi testo con numerazione
                const textElement = document.createElement('p');
                textElement.innerHTML = `${disclaimer.id}. ${disclaimer.text}`;
                disclaimerElement.appendChild(textElement);

                // Aggiungi al container
                disclaimerContainer.appendChild(disclaimerElement);
            });

            console.log('Disclaimers inseriti:', applicableDisclaimers.length);
            return { 
                success: applicableDisclaimers.map(d => d.id),
                failed: []
            };
        } catch (error) {
            console.error('Errore nell\'inserimento dei contenuti:', error);
            return { success: [], failed: [] };
        }
    }
}

// Esempio di utilizzo
const parser = new ContentParser({
    // URL del file JSON (opzionale)
    jsonURL: 'https://example.com/disclaimers.json',
    
    // Data QA per test (opzionale)
    QAdate: '15/01/2024 10:30',
    
    // Divisioni correnti (opzionale, default 'ALL')
    currentDivision: 'MX, AV',
    
    // Domini aggiuntivi (opzionale)
    allowedDomains: [
        'www.samsung.com',
        'p6-qa.samsung.com',
        'p6-eu-author.samsung.com/content/samsung'
    ],

    // ID del container dei disclaimers (opzionale)
    disclaimerContainerId: 'cheilDisclaimers'
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
