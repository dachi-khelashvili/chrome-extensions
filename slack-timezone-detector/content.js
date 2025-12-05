// Timezone data - mapping of timezone offsets to countries/cities
const TIMEZONE_DATA = {
  '-12:00': ['Baker Island', 'Howland Island'],
  '-11:00': ['American Samoa', 'Midway Island', 'Niue'],
  '-10:00': ['Hawaii', 'Alaska (Aleutian Islands)', 'French Polynesia (Tahiti)'],
  '-09:30': ['French Polynesia (Marquesas)'],
  '-09:00': ['Alaska', 'French Polynesia (Gambier)'],
  '-08:00': ['Pacific Time (US & Canada)', 'Los Angeles', 'Vancouver', 'Tijuana'],
  '-07:00': ['Mountain Time (US & Canada)', 'Arizona', 'Denver', 'Phoenix', 'Calgary'],
  '-06:00': ['Central Time (US & Canada)', 'Chicago', 'Mexico City', 'Dallas', 'Winnipeg'],
  '-05:00': ['Eastern Time (US & Canada)', 'New York', 'Toronto', 'Lima', 'Bogota'],
  '-04:00': ['Atlantic Time (Canada)', 'Caracas', 'La Paz', 'Santiago', 'Halifax'],
  '-03:30': ['Newfoundland'],
  '-03:00': ['Brasilia', 'Buenos Aires', 'Montevideo', 'São Paulo', 'Rio de Janeiro'],
  '-02:00': ['Mid-Atlantic'],
  '-01:00': ['Azores', 'Cape Verde'],
  '+00:00': ['London', 'Dublin', 'Lisbon', 'Casablanca', 'Accra', 'Reykjavik'],
  '+01:00': ['Paris', 'Berlin', 'Rome', 'Madrid', 'Amsterdam', 'Brussels', 'Warsaw', 'Stockholm', 'Vienna', 'Prague', 'Budapest', 'Copenhagen'],
  '+02:00': ['Athens', 'Cairo', 'Helsinki', 'Jerusalem', 'Johannesburg', 'Kiev', 'Bucharest', 'Sofia', 'Tallinn', 'Riga', 'Vilnius'],
  '+03:00': ['Moscow', 'Istanbul', 'Nairobi', 'Baghdad', 'Riyadh', 'Kuwait', 'Doha', 'Nairobi', 'Minsk'],
  '+03:30': ['Tehran'],
  '+04:00': ['Dubai', 'Abu Dhabi', 'Baku', 'Tbilisi', 'Yerevan', 'Mauritius'],
  '+04:30': ['Kabul'],
  '+05:00': ['Karachi', 'Islamabad', 'Tashkent', 'Lahore'],
  '+05:30': ['Mumbai', 'New Delhi', 'Chennai', 'Kolkata', 'Bangalore', 'Hyderabad'],
  '+05:45': ['Kathmandu'],
  '+06:00': ['Dhaka', 'Almaty', 'Colombo', 'Thimphu'],
  '+06:30': ['Yangon', 'Cocos Islands'],
  '+07:00': ['Bangkok', 'Jakarta', 'Hanoi', 'Ho Chi Minh City', 'Phnom Penh', 'Vientiane'],
  '+08:00': ['Beijing', 'Shanghai', 'Hong Kong', 'Singapore', 'Manila', 'Kuala Lumpur', 'Perth', 'Taipei'],
  '+08:45': ['Eucla'],
  '+09:00': ['Tokyo', 'Seoul', 'Seoul', 'Pyongyang', 'Osaka', 'Sapporo'],
  '+09:30': ['Adelaide', 'Darwin'],
  '+10:00': ['Sydney', 'Melbourne', 'Brisbane', 'Port Moresby', 'Vladivostok'],
  '+10:30': ['Lord Howe Island'],
  '+11:00': ['New Caledonia', 'Solomon Islands', 'Norfolk Island'],
  '+12:00': ['Auckland', 'Wellington', 'Fiji', 'Kamchatka'],
  '+12:45': ['Chatham Islands'],
  '+13:00': ['Tonga', 'Samoa', 'Tokelau'],
  '+14:00': ['Line Islands']
};

const LAST_TIME_ATTR = 'data-tz-detector-last-time';
const OFFSET_LIST = Object.entries(TIMEZONE_DATA).map(([offset, locations]) => ({
  minutes: offsetToMinutes(offset),
  locations
}));

// Get current UTC time
function getCurrentUTCTime() {
  const now = new Date();
  return {
    hours: now.getUTCHours(),
    minutes: now.getUTCMinutes()
  };
}

// Parse time from text like "7:51 PM" or "7:51 PM local time"
function parseTime(timeText) {
  const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!timeMatch) return null;
  
  let hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const period = timeMatch[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return { hours, minutes };
}

// Convert timezone offset to minutes from UTC
function offsetToMinutes(offset) {
  const isNegative = offset.startsWith('-');
  const numeric = offset.slice(1).split(':').map(Number);
  const totalMinutes = numeric[0] * 60 + (numeric[1] || 0);
  return isNegative ? -totalMinutes : totalMinutes;
}

// Find timezones that match the given local time
function findMatchingTimezones(localTime) {
  const utcTime = getCurrentUTCTime();
  const localMinutes = localTime.hours * 60 + localTime.minutes;
  const utcMinutes = utcTime.hours * 60 + utcTime.minutes;
  
  // Calculate offset needed
  let offsetMinutes = localMinutes - utcMinutes;
  
  // Normalize to -12 to +14 range
  while (offsetMinutes < -12 * 60) offsetMinutes += 24 * 60;
  while (offsetMinutes > 14 * 60) offsetMinutes -= 24 * 60;
  
  // Round to nearest 15 minutes (some timezones have 30/45 minute offsets)
  const roundedOffset = Math.round(offsetMinutes / 15) * 15;
  
  // Find matching timezones
  const matches = OFFSET_LIST
    .filter(entry => Math.abs(entry.minutes - roundedOffset) <= 15)
    .flatMap(entry => entry.locations);
  
  return matches;
}

// Create or update country display element
function addCountryDisplay(spanElement, countries) {
  let container = spanElement.nextElementSibling;
  if (!container || !container.classList.contains('timezone-detector')) {
    container = document.createElement('span');
    container.className = 'timezone-detector';
    container.style.cssText = 'margin-left: 8px; color: #666; font-size: 0.9em;';
    spanElement.insertAdjacentElement('afterend', container);
  }

  if (countries.length > 0) {
    const countriesText = countries.slice(0, 5).join(', ');
    const moreText = countries.length > 5 ? ` (+${countries.length - 5} more)` : '';
    container.textContent = `🌍 ${countriesText}${moreText}`;
    container.title = countries.join(', ');
  } else {
    container.textContent = '🌍 Timezone not found';
    container.removeAttribute('title');
  }
}

function processTimeSpan(span) {
  if (!span) return;

  const timeText = span.textContent.trim();
  if (!timeText || span.getAttribute(LAST_TIME_ATTR) === timeText) {
    return;
  }

  const parsedTime = parseTime(timeText);
  if (!parsedTime) return;

  const matchingCountries = findMatchingTimezones(parsedTime);
  addCountryDisplay(span, matchingCountries);
  span.setAttribute(LAST_TIME_ATTR, timeText);
}

function processInitialSpans() {
  document.querySelectorAll('span.p-local_time__text').forEach(processTimeSpan);
}

function handleMutations(mutations) {
  mutations.forEach(mutation => {
    if (mutation.type !== 'childList') return;

    mutation.addedNodes.forEach(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      if (node.matches && node.matches('span.p-local_time__text')) {
        processTimeSpan(node);
      }

      node.querySelectorAll && node.querySelectorAll('span.p-local_time__text').forEach(processTimeSpan);
    });
  });
}

function init() {
  if (!document.body) return;

  processInitialSpans();

  const observer = new MutationObserver(handleMutations);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

