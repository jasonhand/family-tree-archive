import { writable, derived } from 'svelte/store';

// Store for historical events data
export const historyData = writable({});
export const historyLoaded = writable(false);
export const historyError = writable(null);

// Load historical data from JSON file
export async function loadHistoryData() {
  try {
    const response = await fetch('/world_history_sorted_by_year.json');
    if (!response.ok) throw new Error('Failed to load history data');
    const data = await response.json();
    historyData.set(data);
    historyLoaded.set(true);
  } catch (error) {
    console.error('Error loading history data:', error);
    historyError.set(error.message);
  }
}

// Parse year from various formats (handles "1754 BC", "2024", etc.)
function parseYear(yearStr) {
  if (!yearStr) return null;
  const str = String(yearStr).trim();
  
  // Check for BC years
  const bcMatch = str.match(/(\d+)\s*BC/i);
  if (bcMatch) {
    return -parseInt(bcMatch[1]);
  }
  
  // Regular year
  const yearMatch = str.match(/\b(\d{1,4})\b/);
  if (yearMatch) {
    return parseInt(yearMatch[1]);
  }
  
  return null;
}

// Get events for a specific year range (person's lifetime)
export function getEventsForLifetime(historyDataValue, birthYear, deathYear) {
  if (!historyDataValue || !birthYear) return [];
  
  const events = [];
  const startYear = birthYear;
  const endYear = deathYear || new Date().getFullYear();
  
  // Iterate through the history data and find matching years
  for (const [yearKey, yearEvents] of Object.entries(historyDataValue)) {
    const year = parseYear(yearKey);
    if (year !== null && year >= startYear && year <= endYear) {
      yearEvents.forEach(event => {
        events.push({
          ...event,
          parsedYear: year
        });
      });
    }
  }
  
  // Sort by year
  return events.sort((a, b) => a.parsedYear - b.parsedYear);
}

// Get events for a specific decade
export function getEventsForDecade(historyDataValue, decade) {
  if (!historyDataValue) return [];
  
  const events = [];
  const startYear = decade;
  const endYear = decade + 9;
  
  for (const [yearKey, yearEvents] of Object.entries(historyDataValue)) {
    const year = parseYear(yearKey);
    if (year !== null && year >= startYear && year <= endYear) {
      yearEvents.forEach(event => {
        events.push({
          ...event,
          parsedYear: year
        });
      });
    }
  }
  
  return events.sort((a, b) => a.parsedYear - b.parsedYear);
}

// Get milestone events (birth year, significant years, death year)
export function getMilestoneEvents(historyDataValue, birthYear, deathYear) {
  if (!historyDataValue || !birthYear) return { birth: [], death: [], significant: [] };
  
  const result = {
    birth: [],
    death: [],
    significant: []
  };
  
  // Get events from birth year
  for (const [yearKey, yearEvents] of Object.entries(historyDataValue)) {
    const year = parseYear(yearKey);
    if (year === birthYear) {
      result.birth = yearEvents.map(e => ({ ...e, parsedYear: year }));
    }
    if (deathYear && year === deathYear) {
      result.death = yearEvents.map(e => ({ ...e, parsedYear: year }));
    }
  }
  
  // Get some significant events during their lifetime (sample every 10 years)
  const endYear = deathYear || birthYear + 80;
  for (let y = birthYear + 10; y < endYear; y += 10) {
    for (const [yearKey, yearEvents] of Object.entries(historyDataValue)) {
      const year = parseYear(yearKey);
      if (year === y && yearEvents.length > 0) {
        result.significant.push({
          ...yearEvents[0],
          parsedYear: year
        });
        break;
      }
    }
  }
  
  return result;
}

// Get event type icon
export function getEventTypeIcon(eventType) {
  const type = (eventType || '').toLowerCase();
  
  if (type.includes('war') || type.includes('battle') || type.includes('military')) return '⚔️';
  if (type.includes('political') || type.includes('election')) return '🏛️';
  if (type.includes('scientific') || type.includes('invention') || type.includes('discovery')) return '🔬';
  if (type.includes('cultural') || type.includes('art')) return '🎨';
  if (type.includes('economic') || type.includes('trade')) return '💰';
  if (type.includes('religious')) return '⛪';
  if (type.includes('natural') || type.includes('disaster')) return '🌋';
  if (type.includes('social') || type.includes('civil')) return '✊';
  if (type.includes('colonial') || type.includes('exploration')) return '🧭';
  if (type.includes('revolution')) return '🔥';
  if (type.includes('treaty') || type.includes('peace') || type.includes('diplomatic')) return '🕊️';
  if (type.includes('independence')) return '🗽';
  if (type.includes('civilization') || type.includes('urban')) return '🏙️';
  if (type.includes('legal') || type.includes('law')) return '⚖️';
  
  return '📜';
}

// Get event outcome class
export function getOutcomeClass(outcome) {
  const o = (outcome || '').toLowerCase();
  if (o === 'positive') return 'positive';
  if (o === 'negative') return 'negative';
  return 'neutral';
}

