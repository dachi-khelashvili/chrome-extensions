// Vladivostok timezone: Asia/Vladivostok (UTC+10)
const VLADIVOSTOK_TIMEZONE = 'Asia/Vladivostok';

// Get current date in Vladivostok timezone
function getVladivostokDate() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: VLADIVOSTOK_TIMEZONE }));
}

// Get the tracking day (7pm to 7pm next day)
function getTrackingDay(date = null) {
  const vladDate = date || getVladivostokDate();
  const year = vladDate.getFullYear();
  const month = vladDate.getMonth();
  const day = vladDate.getDate();
  const hour = vladDate.getHours();
  
  // If before 7pm (19:00), it's still the previous day's tracking period
  if (hour < 19) {
    const prevDay = new Date(year, month, day - 1);
    return formatDateKey(prevDay);
  }
  
  return formatDateKey(vladDate);
}

// Format date as YYYY-MM-DD for storage key (in Vladivostok timezone)
function formatDateKey(date) {
  // Convert to Vladivostok timezone string and extract date parts
  const vladStr = date.toLocaleString('en-US', { 
    timeZone: VLADIVOSTOK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // Format is MM/DD/YYYY, convert to YYYY-MM-DD
  const [month, day, year] = vladStr.split('/');
  return `${year}-${month}-${day}`;
}

// Format date for date picker (YYYY-MM-DD)
function formatDateForPicker(date) {
  return formatDateKey(date);
}

// Format time for display
function formatTime(date) {
  return date.toLocaleTimeString('en-US', { 
    timeZone: VLADIVOSTOK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Format duration in hours and minutes
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// Get stored entries for a specific day
async function getEntriesForDay(dayKey) {
  const result = await chrome.storage.local.get([dayKey]);
  return result[dayKey] || [];
}

// Save entries for a specific day
async function saveEntriesForDay(dayKey, entries) {
  await chrome.storage.local.set({ [dayKey]: entries });
}

// Add a new entry
async function addEntry(dayKey, entry) {
  const entries = await getEntriesForDay(dayKey);
  entries.push(entry);
  await saveEntriesForDay(dayKey, entries);
  return entries;
}

// Render the list of entries
async function renderList(dayKey) {
  const entries = await getEntriesForDay(dayKey);
  const listElement = document.getElementById('timeList');
  
  if (entries.length === 0) {
    listElement.innerHTML = '<li class="empty-message">No entries for this day</li>';
    return;
  }
  
  listElement.innerHTML = entries.map(entry => {
    const startTime = new Date(entry.start);
    const endTime = new Date(entry.end);
    const duration = endTime - startTime;
    
    return `
      <li>
        <div class="task-name">${entry.description}</div>
        <div class="task-time">${formatTime(startTime)} - ${formatTime(endTime)}</div>
        <div class="task-duration">Duration: ${formatDuration(duration)}</div>
      </li>
    `;
  }).join('');
}

// Initialize the popup
let currentTrackingDay = null;
let isTracking = false;
let startTime = null;
let currentDayKey = null;

async function init() {
  // Set date picker to today's calendar date
  const today = getVladivostokDate();
  const todayKey = formatDateForPicker(today);
  document.getElementById('datePicker').value = todayKey;
  
  // Show entries for today's tracking period (from today 7pm to tomorrow 7pm)
  // The date picker value (YYYY-MM-DD) is used directly as the tracking day key
  currentDayKey = todayKey;
  await renderList(currentDayKey);
  
  // Check if there's an active tracking session
  const activeSession = await chrome.storage.local.get(['activeSession']);
  if (activeSession.activeSession) {
    const session = activeSession.activeSession;
    const sessionDayKey = getTrackingDay(new Date(session.start));
    
    // If session is for the current viewing day, restore it
    if (sessionDayKey === currentDayKey) {
      isTracking = true;
      startTime = new Date(session.start);
      document.getElementById('taskInput').value = session.description;
      document.getElementById('taskInput').disabled = true;
      document.getElementById('trackButton').textContent = 'End';
      document.getElementById('trackButton').classList.add('end');
    }
  }
  
  // Date picker change handler
  document.getElementById('datePicker').addEventListener('change', async (e) => {
    // The date picker value is already in YYYY-MM-DD format
    // For a selected date, the tracking period is the one that starts on that date
    // (i.e., from 7pm on that date to 7pm next day)
    // So we can use the date string directly as the tracking day key
    currentDayKey = e.target.value;
    await renderList(currentDayKey);
  });
  
  // Button click handler
  document.getElementById('trackButton').addEventListener('click', async () => {
    const input = document.getElementById('taskInput');
    const button = document.getElementById('trackButton');
    
    if (!isTracking) {
      // Start tracking
      const description = input.value.trim();
      if (!description) {
        alert('Please enter a task description');
        return;
      }
      
      startTime = getVladivostokDate();
      isTracking = true;
      input.disabled = true;
      button.textContent = 'End';
      button.classList.add('end');
      
      // Save active session
      await chrome.storage.local.set({
        activeSession: {
          description,
          start: startTime.toISOString()
        }
      });
    } else {
      // End tracking
      const endTime = getVladivostokDate();
      const description = input.value.trim();
      
      // Determine which day this entry belongs to
      const entryDayKey = getTrackingDay(startTime);
      
      // Add entry
      await addEntry(entryDayKey, {
        description,
        start: startTime.toISOString(),
        end: endTime.toISOString()
      });
      
      // Clear active session
      await chrome.storage.local.remove(['activeSession']);
      
      // Reset UI
      isTracking = false;
      input.disabled = false;
      input.value = '';
      button.textContent = 'Start';
      button.classList.remove('end');
      startTime = null;
      
      // Refresh list if viewing the same day
      if (entryDayKey === currentDayKey) {
        await renderList(currentDayKey);
      }
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

