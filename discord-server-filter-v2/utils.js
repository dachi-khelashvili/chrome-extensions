// Detect language from text - returns object with language and matched items
function detectLanguage(text) {
    if (!text || text.trim().length === 0) return { language: 'Unknown', matchedItems: [] };

    // Remove URLs from text before language detection
    const originalText = text;
    text = text.replace(/https?:\/\/[^\s]+/gi, ' ');

    const combinedText = text.toLowerCase();
    const matchedItems = [];

    // Character range checks
    const hasCyrillic = /[\u0400-\u04FF]/.test(text);
    const hasChinese = /[\u4E00-\u9FFF]/.test(text);
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
    const hasKorean = /[\uAC00-\uD7AF]/.test(text);
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    const hasThai = /[\u0E00-\u0E7F]/.test(text);
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    const hasGeorgian = /[\u10A0-\u10FF]/.test(text);
    const hasGreek = /[\u0370-\u03FF]/.test(text);

    // Language-specific character checks
    const hasHungarian = /[őű]/i.test(text);
    const hasPolish = /[ąćęłńóśźż]/i.test(text);
    const hasTurkish = /[ışğüöç]/i.test(text);
    const hasVietnamese = /[đĐ]/.test(text) || /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(text);
    const hasCzech = /[ěščřžýáíéúůóťďň]/i.test(text);
    const hasRomanian = /[țșăâî]/i.test(text);
    const hasScandinavian = /[åäöæø]/i.test(text); // Swedish, Norwegian, Danish, Finnish

    // Extract unique characters for character-based languages
    function extractUniqueChars(regex, max = 5) {
        const matches = originalText.match(regex);
        if (matches) {
            const unique = [...new Set(matches.map(m => m.toLowerCase()))].slice(0, max);
            return unique;
        }
        return [];
    }

    // Helper function to extract matched words from regex
    function extractMatchedWords(regex, max = 5) {
        const matches = originalText.match(regex);
        if (matches) {
            return [...new Set(matches.map(m => m.toLowerCase()))].slice(0, max);
        }
        return [];
    }

    // Language-specific patterns
    // The word lists are trimmed to avoid short/ambiguous words with English overlap, and some words are required to match at least TWO distinct typical words:
    // The following word lists have been pruned of words that may appear frequently in English text (such as "is", "in", "on", "and", "of", "by", "for", etc)
    const spanishWords = /\b(que|más|muy|también|estos|estas|del|los|las|unas)\b/i;
    const frenchWords = /\b(avec|plus|très|aussi|mais|cette|ces|du|des)\b/i;
    const germanWords = /\b(der|die|das|nicht|kein|über|mehr|aber|sind)\b/i;
    const italianWords = /\b(sono|della|delle|più|molto|anche|questo|questa|quello|quella)\b/i;
    const portugueseWords = /\b(está|são|dos|das|mais|muito|também|mas|sobre)\b/i;
    const russianWords = /\b(и|в|не|что|он|на|я|со|как|а|то|все|она|так|его|но|да|ты|же|вы|за|бы|только|её|мне|было|вот|от|меня|ещё|нет|ему|теперь|когда|даже|ну|вдруг|ли|если|уже|или|ни|быть|был|него|до|вас|нибудь|опять|уж|вам|ведь|там|потом|себя|ничего|ей|может|они|тут|где|есть|надо|ней|мы|тебя|их|чем|была|сам|чтоб|без|будто|человек|чего|раз|тоже|себе|под|будет|ж|тогда|кто|этот|того|потому|этого|какой|совсем|ним|здесь|этом|один|почти|мой|тем|чтобы|нее|сейчас|были|куда|зачем|всех|никогда|можно|при|наконец|два|об|другой|хоть|после|над|больше|тот|через|эти|нас|про|всего|них|какая|много|разве|три|эту|моя|впрочем|хорошо|свою|этой|перед|иногда|лучше|чуть|том|нельзя|такой|им|более|всегда|конечно|всю|между)\b/;
    const dutchWords = /\b(zijn|van|voor|maar|om|uit|over|naar|bij|hij|zij|jullie|uw|jouw|mijn)\b/i;
    const hungarianWords = /\b(és|vagy|hogy|van|az|egy|meg|mint|csak|kell|lesz|már|még|minden|néhány|később|először|utána|előtte|közben)\b/i;
    const polishWords = /\b(ale|czy|że|się|jest|są|był|była|było|byli|przy|dla|przez|nad|pod|przed|według|mimo|wśród)\b/i;
    const turkishWords = /\b(veya|ile|için|gibi|kadar|göre|karşı|rağmen|doğru|dolayı|sayesinde|vasıtasıyla|nedeniyle)\b/i;
    const vietnameseWords = /\b(và|hoặc|với|cho|để|trên|dưới|trong|ngoài|sau|trước|giữa|khi|nếu|thì|mà|nên|cũng|rất|rồi|đã|sẽ|đang)\b/i;
    const romanianWords = /\b(și|sau|cu|pentru|din|la|pe|prin|despre|asupra|sub|peste|lângă|între|după|înainte|dacă|când|cum|care|unde|cât)\b/i;
    const czechWords = /\b(nebo|pro|při|před|za|pod|nad|přes|kolem|mezi|podle|bez|kvůli|také|ještě|už|bude|byl|byla|bylo|jsou|jsme)\b/i;
    const swedishWords = /\b(och|men|med|för|av|från|över|under|efter|före|mellan|runt|bland|enligt|utan|trots|också|även|redan|kommer|hade)\b/i;
    const norwegianWords = /\b(men|med|for|av|från|over|under|etter|før|mellom|rundt|blant|ifølge|uten|tross|også|allerede|kommer|hadde)\b/i;
    const danishWords = /\b(men|med|for|af|från|over|under|efter|før|mellem|rundt|blandt|ifølge|uden|trods|også|allerede|kommer|havde)\b/i;
    const finnishWords = /\b(ja|tai|mutta|kanssa|varten|sta|ssa|lle|lta|lla|myös|vielä|tulee|onko|ovatko|jo)\b/i;
    const greekWords = /\b(και|ή|αλλά|με|για|από|πάνω|κάτω|μετά|πριν|ανάμεσα|γύρω|ανά|σύμφωνα|χωρίς|επίσης|ήδη|θα|ήταν|είναι)\b/i;
    const indonesianWords = /\b(dan|atau|tapi|dengan|untuk|dari|pada|atas|bawah|setelah|sebelum|antara|sekitar|menurut|tanpa|juga|sudah|akan|adalah|ada)\b/i;


    // Helper function to extract matched words from regex
    function extractMatchedWords(regex, max = 5) {
        const matches = originalText.match(regex);
        if (matches) {
            return [...new Set(matches.map(m => m.toLowerCase()))].slice(0, max);
        }
        return [];
    }

    // Check for specific scripts first
    if (hasChinese) {
        const chars = extractUniqueChars(/[\u4E00-\u9FFF]/g, 5);
        return { language: '中文', matchedItems: chars };
    }
    if (hasJapanese) {
        const chars = extractUniqueChars(/[\u3040-\u309F\u30A0-\u30FF]/g, 5);
        return { language: '日本語', matchedItems: chars };
    }
    if (hasKorean) {
        const chars = extractUniqueChars(/[\uAC00-\uD7AF]/g, 5);
        return { language: '한국어', matchedItems: chars };
    }
    if (hasArabic) {
        const chars = extractUniqueChars(/[\u0600-\u06FF]/g, 5);
        return { language: 'العربية', matchedItems: chars };
    }
    if (hasHebrew) {
        const chars = extractUniqueChars(/[\u0590-\u05FF]/g, 5);
        return { language: 'עברית', matchedItems: chars };
    }
    if (hasThai) {
        const chars = extractUniqueChars(/[\u0E00-\u0E7F]/g, 5);
        return { language: 'ไทย', matchedItems: chars };
    }
    if (hasDevanagari) {
        const chars = extractUniqueChars(/[\u0900-\u097F]/g, 5);
        return { language: 'हिन्दी', matchedItems: chars };
    }
    if (hasGeorgian) {
        const chars = extractUniqueChars(/[\u10A0-\u10FF]/g, 5);
        return { language: 'ქართული', matchedItems: chars };
    }
    if (hasGreek) {
        if (greekWords.test(combinedText)) {
            const words = extractMatchedWords(greekWords);
            return { language: 'Ελληνικά', matchedItems: words };
        }
        const chars = extractUniqueChars(/[\u0370-\u03FF]/g, 5);
        return { language: 'Greek', matchedItems: chars };
    }

    // Check languages with unique characters (before Cyrillic to avoid conflicts)
    if (hasHungarian) {
        if (hungarianWords.test(combinedText)) {
            const words = extractMatchedWords(hungarianWords);
            return { language: 'Magyar', matchedItems: words };
        }
        const chars = extractUniqueChars(/[őű]/gi, 5);
        return { language: 'Hungarian', matchedItems: chars };
    }
    if (hasPolish) {
        if (polishWords.test(combinedText)) {
            const words = extractMatchedWords(polishWords);
            return { language: 'Polski', matchedItems: words };
        }
        const chars = extractUniqueChars(/[ąćęłńóśźż]/gi, 5);
        return { language: 'Polish', matchedItems: chars };
    }
    if (hasTurkish) {
        if (turkishWords.test(combinedText)) {
            const words = extractMatchedWords(turkishWords);
            return { language: 'Türkçe', matchedItems: words };
        }
        const chars = extractUniqueChars(/[ışğüöç]/gi, 5);
        return { language: 'Turkish', matchedItems: chars };
    }
    if (hasVietnamese) {
        if (vietnameseWords.test(combinedText)) {
            const words = extractMatchedWords(vietnameseWords);
            return { language: 'Tiếng Việt', matchedItems: words };
        }
        const chars = extractUniqueChars(/[đĐàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/gi, 5);
        return { language: 'Vietnamese', matchedItems: chars };
    }
    if (hasCzech) {
        if (czechWords.test(combinedText)) {
            const words = extractMatchedWords(czechWords);
            return { language: 'Čeština', matchedItems: words };
        }
        const chars = extractUniqueChars(/[ěščřžýáíéúůóťďň]/gi, 5);
        return { language: 'Czech', matchedItems: chars };
    }
    if (hasRomanian) {
        if (romanianWords.test(combinedText)) {
            const words = extractMatchedWords(romanianWords);
            return { language: 'Română', matchedItems: words };
        }
        const chars = extractUniqueChars(/[țșăâî]/gi, 5);
        return { language: 'Romanian', matchedItems: chars };
    }
    if (hasScandinavian) {
        if (swedishWords.test(combinedText)) {
            const words = extractMatchedWords(swedishWords);
            return { language: 'Svenska', matchedItems: words };
        }
        if (norwegianWords.test(combinedText)) {
            const words = extractMatchedWords(norwegianWords);
            return { language: 'Norsk', matchedItems: words };
        }
        if (danishWords.test(combinedText)) {
            const words = extractMatchedWords(danishWords);
            return { language: 'Dansk', matchedItems: words };
        }
        if (finnishWords.test(combinedText)) {
            const words = extractMatchedWords(finnishWords);
            return { language: 'Suomi', matchedItems: words };
        }
        const chars = extractUniqueChars(/[åäöæø]/gi, 5);
        return { language: 'Scandinavian', matchedItems: chars };
    }

    if (hasCyrillic) {
        if (russianWords.test(combinedText)) {
            const words = extractMatchedWords(russianWords);
            return { language: 'Русский', matchedItems: words };
        }
        const chars = extractUniqueChars(/[\u0400-\u04FF]/g, 5);
        return { language: 'Cyrillic', matchedItems: chars };
    }

    // Check for Latin-based languages (order matters - more specific first)
    if (spanishWords.test(combinedText)) {
        const words = extractMatchedWords(spanishWords);
        return { language: 'Español', matchedItems: words };
    }
    if (frenchWords.test(combinedText)) {
        const words = extractMatchedWords(frenchWords);
        return { language: 'Français', matchedItems: words };
    }
    if (germanWords.test(combinedText)) {
        const words = extractMatchedWords(germanWords);
        return { language: 'Deutsch', matchedItems: words };
    }
    if (italianWords.test(combinedText)) {
        const words = extractMatchedWords(italianWords);
        return { language: 'Italiano', matchedItems: words };
    }
    if (portugueseWords.test(combinedText)) {
        const words = extractMatchedWords(portugueseWords);
        return { language: 'Português', matchedItems: words };
    }
    if (dutchWords.test(combinedText)) {
        const words = extractMatchedWords(dutchWords);
        return { language: 'Nederlands', matchedItems: words };
    }
    if (indonesianWords.test(combinedText)) {
        const words = extractMatchedWords(indonesianWords);
        return { language: 'Bahasa Indonesia', matchedItems: words };
    }

    // Default to English if no other language detected
    return { language: 'English', matchedItems: [] };
}

// Detect language from title and description - returns object with language and matchedItems
function detectServerLanguage(title, description) {
    const combinedText = `${title} ${description}`;
    return detectLanguage(combinedText);
}

// Detect LGBTQ+ related content - returns object with detection result and matched keywords
function detectLGBTQContent(title, description) {
    if (!title && !description) return { isLGBTQ: false, matchedKeywords: [] };

    const combinedText = `${title || ''} ${description || ''}`.toLowerCase();
    const originalText = `${title || ''} ${description || ''}`;
    const matchedKeywords = [];

    // Comprehensive list of LGBTQ+ related keywords
    const lgbtqKeywords = [
        // Identity terms
        'lgbtq', 'lgbt', 'lgbtq+', 'lgbtqia', 'lgbtqia+', 'lgbt+',
        'lesbian', 'gay', 'bisexual', 'transgender', 'genderqueer', 'genderfluid',
        'non-binary', 'nonbinary', 'intersex', 'asexual', 'aromantic', 'pansexual',
        'agender', 'bigender', 'demisexual',

        // Sex and transgender-related words (added, but omitting too-common/general like 'trans' or 'coming out')
        'mtf', 'ftm', 'transfeminine', 'transmasculine', 'gender dysphoria', 'assigned male at birth', 'assigned female at birth',
        'amab', 'afab', 'hrt', 'hormone replacement therapy', 'top surgery', 'bottom surgery', 'sex reassignment',
        'sex reassignment surgery', 'gender affirmation surgery',

        // Community and support terms
        'lgbtq+ community', 'lgbt community', 'pride month',
        'gay pride', 'lgbt rights', 'queer community',
        'lgbtq safe', 'lgbtq friendly', 'gay friendly',
        'egirl', 'eboy', 'e-girl', 'e-boy',
        'dating', 'romance', 'sfw',

        // Flags and symbols (as text)
        'pride flag', 'rainbow flag', 'trans flag', 'bi flag',
        'pan flag', 'non-binary flag', 'asexual flag',

        // Common variations and misspellings
        'lgbt', 'lgbt+', 'lgbtq', 'lgbtq+', 'glbt', 'lgbti',

        // Events and celebrations
        'pride parade', 'pride festival',

        // Support and resources
        'lgbtq support', 'lgbt support',
        'gender affirming', 'gender affirmation'
    ];

    // Check if any keyword appears in the text
    for (const keyword of lgbtqKeywords) {
        if (combinedText.includes(keyword)) {
            // Find the actual occurrence in original text (case-insensitive)
            const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            const matches = originalText.match(regex);
            if (matches) {
                matches.forEach(match => {
                    if (!matchedKeywords.includes(match.toLowerCase())) {
                        matchedKeywords.push(match.toLowerCase());
                    }
                });
            }
        }
    }

    // Also check for variations with spaces, dashes, etc.
    const patterns = [
        { pattern: /\blgbt[qi]*\+?/gi, label: 'LGBTQ+' },
        { pattern: /\btrans\s*(gender|rights|community|support|friendly)/gi, label: 'trans*' },
        { pattern: /\bgay\s*(community|pride|rights|friendly)/gi, label: 'gay*' },
        { pattern: /\blesbian\s*(community|pride)/gi, label: 'lesbian*' },
        { pattern: /\bqueer\s*(community|space|friendly)/gi, label: 'queer*' },
        { pattern: /\bpride\s*(month|parade|festival|flag)/gi, label: 'pride*' },
        { pattern: /\bnon[- ]?binary/gi, label: 'non-binary' },
        { pattern: /\bpan\s*sexual/gi, label: 'pansexual' }
    ];

    for (const { pattern, label } of patterns) {
        const matches = originalText.match(pattern);
        if (matches) {
            matches.forEach(match => {
                const normalized = match.toLowerCase().trim();
                // Use the actual matched text, but normalize common variations
                if (normalized.includes('lgbt')) {
                    if (!matchedKeywords.some(k => k.includes('lgbt'))) {
                        matchedKeywords.push(normalized);
                    }
                } else if (!matchedKeywords.includes(normalized)) {
                    matchedKeywords.push(normalized);
                }
            });
        }
    }

    return {
        isLGBTQ: matchedKeywords.length > 0,
        matchedKeywords: matchedKeywords.slice(0, 5) // Limit to 5 keywords to keep it readable
    };
}

// Make functions available globally for both content scripts and popup
if (typeof window !== 'undefined') {
    window.DiscordServerUtils = { detectServerLanguage, detectLGBTQContent };
}