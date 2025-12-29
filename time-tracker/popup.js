// Vladivostok timezone: Asia/Vladivostok (UTC+10)
const VLADIVOSTOK_TIMEZONE = 'Asia/Vladivostok';

// Get current date/time in Vladivostok timezone
function getVladivostokDate() {
  return new Date();
}

// Get date components in Vladivostok timezone
function getVladivostokDateComponents(date) {
  const vladStr = date.toLocaleString('en-US', { 
    timeZone: VLADIVOSTOK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Format: "MM/DD/YYYY, HH:MM:SS"
  const [datePart, timePart] = vladStr.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  
  return {
    year: parseInt(year),
    month: parseInt(month) - 1, // JavaScript months are 0-indexed
    day: parseInt(day),
    hour: parseInt(hour),
    minute: parseInt(minute),
    second: parseInt(second)
  };
}

// Get the tracking day (7pm to 7pm next day) in Vladivostok timezone
function getTrackingDay(date = null) {
  const targetDate = date || getVladivostokDate();
  const components = getVladivostokDateComponents(targetDate);
  
  // If before 7pm (19:00) in Vladivostok, it's still the previous day's tracking period
  if (components.hour < 19) {
    // Get the previous day's date string in Vladivostok timezone
    const prevDate = new Date(targetDate);
    prevDate.setTime(prevDate.getTime() - 24 * 60 * 60 * 1000); // Subtract 24 hours
    return formatDateKey(prevDate);
  }
  
  return formatDateKey(targetDate);
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

// Delete an entry by index
async function deleteEntry(dayKey, index) {
  const entries = await getEntriesForDay(dayKey);
  entries.splice(index, 1);
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
  
  listElement.innerHTML = entries.map((entry, index) => {
    // Parse ISO strings and format in Vladivostok timezone
    const startTime = new Date(entry.start);
    const endTime = new Date(entry.end);
    const duration = endTime - startTime;
    
    return `
      <li>
        <div class="entry-content">
          <div class="task-name">${entry.description}</div>
          <div class="task-time">${formatTime(startTime)} - ${formatTime(endTime)}</div>
          <div class="task-duration">Duration: ${formatDuration(duration)}</div>
        </div>
        <button class="delete-btn" data-day-key="${dayKey}" data-index="${index}" title="Delete entry">×</button>
      </li>
    `;
  }).join('');
  
  // Add event listeners to delete buttons
  listElement.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const dayKey = btn.getAttribute('data-day-key');
      const index = parseInt(btn.getAttribute('data-index'));
      
      if (confirm('Are you sure you want to delete this entry?')) {
        await deleteEntry(dayKey, index);
        await renderList(dayKey);
      }
    });
  });
}

// Initialize the popup
let currentTrackingDay = null;
let isTracking = false;
let startTime = null;
let currentDayKey = null;

// Restore active session if it exists for the given day key
async function restoreActiveSession(dayKey) {
  // First, clear any existing UI state
  isTracking = false;
  startTime = null;
  const input = document.getElementById('taskInput');
  const button = document.getElementById('trackButton');
  input.disabled = false;
  input.value = '';
  button.textContent = 'Start';
  button.classList.remove('end');
  
  // Then check if there's an active session for this day
  const activeSession = await chrome.storage.local.get(['activeSession']);
  if (activeSession.activeSession) {
    const session = activeSession.activeSession;
    // Parse the stored ISO string and determine tracking day in Vladivostok timezone
    const sessionStartDate = new Date(session.start);
    const sessionDayKey = getTrackingDay(sessionStartDate);
    
    // If session is for the current viewing day, restore it
    if (sessionDayKey === dayKey) {
      isTracking = true;
      startTime = sessionStartDate;
      input.value = session.description;
      input.disabled = true;
      button.textContent = 'End';
      button.classList.add('end');
      return true;
    }
  }
  return false;
}

async function init() {
  // Set date picker to today's calendar date in Vladivostok
  const today = getVladivostokDate();
  const todayKey = formatDateForPicker(today);
  document.getElementById('datePicker').value = todayKey;
  
  // Get the actual tracking day key (which might be yesterday if before 7pm)
  const trackingDayKey = getTrackingDay(today);
  currentDayKey = trackingDayKey;
  
  // Update date picker to show the tracking day's date if different
  // This helps user understand which day they're viewing
  const trackingDayDate = new Date(today);
  const components = getVladivostokDateComponents(today);
  if (components.hour < 19) {
    // Before 7pm, tracking day is previous day, so show previous day in picker
    trackingDayDate.setTime(trackingDayDate.getTime() - 24 * 60 * 60 * 1000);
    document.getElementById('datePicker').value = formatDateForPicker(trackingDayDate);
  }
  
  await renderList(currentDayKey);
  
  // Check if there's an active tracking session and restore it
  await restoreActiveSession(currentDayKey);
  
  // Date picker change handler
  document.getElementById('datePicker').addEventListener('change', async (e) => {
    // The date picker value is already in YYYY-MM-DD format
    // For a selected date, the tracking period is the one that starts on that date
    // (i.e., from 7pm on that date to 7pm next day)
    // So we can use the date string directly as the tracking day key
    currentDayKey = e.target.value;
    await renderList(currentDayKey);
    
    // Check if there's an active session for this day
    await restoreActiveSession(currentDayKey);
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

