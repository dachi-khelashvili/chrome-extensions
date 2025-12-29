# Time Tracker Chrome Extension

A simple Chrome extension to track time day by day in Vladivostok timezone, where each day runs from 7pm to 7pm the next day.

## Features

- Track time with task descriptions
- Day cycle: 7pm to 7pm next day (Vladivostok time)
- Date picker to view entries for any day
- Simple start/stop button interface
- Persistent storage of all time entries

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this directory (`time-tracker`)

## Usage

1. Enter a task description in the input box
2. Click "Start" to begin tracking
3. The input becomes disabled and the button changes to "End"
4. Click "End" when finished - the time entry is saved
5. Use the date picker to view entries for different days
6. All entries are displayed in the list below

## How It Works

- Time is tracked in Vladivostok timezone (Asia/Vladivostok, UTC+10)
- Each tracking day starts at 7pm and ends at 7pm the next day
- All data is stored locally in Chrome's storage
- Active tracking sessions persist even if you close the popup

