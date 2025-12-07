import { writable, derived, get } from 'svelte/store';

// ============== STORES ==============

// Raw family data
export const familyData = writable([]);

// Loading and error states
export const isLoading = writable(false);
export const error = writable(null);

// Selected person for detail view
export const selectedPerson = writable(null);

// Search and filter
export const searchQuery = writable('');
export const sortOrder = writable('name');
export const filterOptions = writable({
  sex: 'all',
  hasDeathDate: 'all',
  birthCentury: 'all',
  birthState: null,
  birthCity: null,
  birthCountry: null,
  deathState: null,
  deathCity: null,
  residenceState: null,
  residenceCity: null,
  ageMin: null,
  ageMax: null,
  hasNotes: 'all'
});

// ============== DATA LOADING (READ-ONLY) ==============

// Load family data from JSON file
export async function loadFamilyData() {
  isLoading.set(true);
  error.set(null);

  try {
    const response = await fetch('/HandFamilyTree.json');
    if (!response.ok) throw new Error('Failed to load JSON file');
    const data = await response.json();
    familyData.set(data);
    console.log(`✅ Loaded ${data.length} records from JSON file`);
  } catch (err) {
    console.error('Failed to load family data:', err);
    error.set('Failed to load family data');
  } finally {
    isLoading.set(false);
  }
}

// Alias for backward compatibility
export const loadDefaultFamilyData = loadFamilyData;

// ============== FAVORITES (READ-ONLY) ==============

export const favorites = derived(familyData, $familyData => {
  const favs = new Set();
  $familyData.forEach(p => {
    if (p.is_favorite) favs.add(p.id);
  });
  return favs;
});

// Load favorites (no-op for API mode, kept for compatibility)
export function loadFavorites() {
  // Favorites are now loaded with the main data
}

// ============== FLAGS (READ-ONLY) ==============

export const flaggedRecords = derived(familyData, $familyData => {
  const flags = new Map();
  $familyData.forEach(p => {
    if (p.is_flagged) {
      flags.set(p.id, { reason: p.flag_reason, date: p.flag_date });
    }
  });
  return flags;
});

// Load flagged records (no-op for API mode, kept for compatibility)
export function loadFlaggedRecords() {
  // Flags are now loaded with the main data
}

// ============== IMMIGRANTS (READ-ONLY) ==============

export const immigrants = derived(familyData, $familyData => {
  return $familyData.filter(p => p.is_immigrant);
});

// ============== HELPER FUNCTIONS ==============

// Helper to extract year from date string or use normalized field
function extractYear(dateStr, normalizedYear = null) {
  // Prefer normalized year if available
  if (normalizedYear !== null && normalizedYear !== undefined) {
    return normalizedYear;
  }
  // Fallback to parsing date string
  if (!dateStr) return null;
  const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
  return match ? parseInt(match[1]) : null;
}

// Helper to check if person is deceased (has any death_date, even without a year)
function isDeceased(person) {
  return !!person.death_date;
}

// Helper to calculate age
// Returns null if:
// - No birth year
// - Deceased but no death year (can't calculate age at death)
export function getAge(person) {
  // Prefer normalized birth_year, fallback to parsing birth_date
  const birthYear = extractYear(person.birth_date, person.birth_year);
  if (!birthYear) return null;

  // If deceased, try to calculate age at death
  if (isDeceased(person)) {
    // Prefer normalized death_year, fallback to parsing death_date
    const deathYear = extractYear(person.death_date, person.death_year);
    // Only return age if we have a death year to calculate from
    return deathYear ? deathYear - birthYear : null;
  }

  // Living person - calculate current age
  return new Date().getFullYear() - birthYear;
}

// ============== DERIVED STORES ==============

// Filtered and sorted data
export const filteredData = derived(
  [familyData, searchQuery, filterOptions, sortOrder],
  ([$familyData, $searchQuery, $filterOptions, $sortOrder]) => {
    let result = $familyData;

    // Apply search
    if ($searchQuery.trim()) {
      const query = $searchQuery.toLowerCase();
      result = result.filter(person =>
        person.name?.toLowerCase().includes(query) ||
        person.birth_place?.toLowerCase().includes(query) ||
        person.death_place?.toLowerCase().includes(query)
      );
    }

    // Apply sex filter
    if ($filterOptions.sex !== 'all') {
      result = result.filter(person => person.sex === $filterOptions.sex);
    }

    // Apply living/deceased filter
    if ($filterOptions.hasDeathDate === 'living') {
      result = result.filter(person => !person.death_date);
    } else if ($filterOptions.hasDeathDate === 'deceased') {
      result = result.filter(person => person.death_date);
    }

    // Apply birth century filter
    if ($filterOptions.birthCentury !== 'all') {
      result = result.filter(person => {
        const year = extractYear(person.birth_date, person.birth_year);
        if (!year) return false;
        const century = Math.ceil(year / 100);
        return century === parseInt($filterOptions.birthCentury);
      });
    }

    // Apply location filters
    if ($filterOptions.birthState) {
      result = result.filter(person => person.birth_state === $filterOptions.birthState);
    }
    if ($filterOptions.birthCity) {
      result = result.filter(person => {
        if (!person.birth_city) return false;
        const personCity = person.birth_state
          ? `${person.birth_city}, ${person.birth_state}`
          : person.birth_city;
        return personCity === $filterOptions.birthCity || person.birth_city === $filterOptions.birthCity;
      });
    }
    if ($filterOptions.birthCountry) {
      result = result.filter(person => person.birth_country === $filterOptions.birthCountry);
    }
    if ($filterOptions.deathState) {
      result = result.filter(person => person.death_state === $filterOptions.deathState);
    }
    if ($filterOptions.deathCity) {
      result = result.filter(person => {
        if (!person.death_city) return false;
        const personCity = person.death_state
          ? `${person.death_city}, ${person.death_state}`
          : person.death_city;
        return personCity === $filterOptions.deathCity || person.death_city === $filterOptions.deathCity;
      });
    }
    if ($filterOptions.residenceState) {
      result = result.filter(person =>
        person.residences?.some(r => r.state === $filterOptions.residenceState)
      );
    }
    if ($filterOptions.residenceCity) {
      result = result.filter(person =>
        person.residences?.some(r => {
          if (!r.city) return false;
          const resCity = r.state ? `${r.city}, ${r.state}` : r.city;
          return resCity === $filterOptions.residenceCity || r.city === $filterOptions.residenceCity;
        })
      );
    }

    // Apply age filter
    if ($filterOptions.ageMin !== null || $filterOptions.ageMax !== null) {
      result = result.filter(person => {
        const age = getAge(person);
        if (age === null) return false;
        if ($filterOptions.ageMin !== null && age < $filterOptions.ageMin) return false;
        if ($filterOptions.ageMax !== null && age > $filterOptions.ageMax) return false;
        return true;
      });
    }

    // Apply notes filter
    if ($filterOptions.hasNotes === 'yes') {
      result = result.filter(person => {
        const notes = person.notes || person.biography || '';
        return notes.trim().length > 0;
      });
    } else if ($filterOptions.hasNotes === 'no') {
      result = result.filter(person => {
        const notes = person.notes || person.biography || '';
        return notes.trim().length === 0;
      });
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      switch ($sortOrder) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'age-young':
          const ageA1 = getAge(a);
          const ageB1 = getAge(b);
          if (ageA1 === null && ageB1 === null) return 0;
          if (ageA1 === null) return 1;
          if (ageB1 === null) return -1;
          return ageA1 - ageB1;
        case 'age-old':
          const ageA2 = getAge(a);
          const ageB2 = getAge(b);
          if (ageA2 === null && ageB2 === null) return 0;
          if (ageA2 === null) return 1;
          if (ageB2 === null) return -1;
          return ageB2 - ageA2;
        case 'birth-old':
          const yearA1 = extractYear(a.birth_date, a.birth_year) || 9999;
          const yearB1 = extractYear(b.birth_date, b.birth_year) || 9999;
          return yearA1 - yearB1;
        case 'birth-new':
          const yearA2 = extractYear(a.birth_date, a.birth_year) || 0;
          const yearB2 = extractYear(b.birth_date, b.birth_year) || 0;
          return yearB2 - yearA2;
        case 'death-old':
          const deathYearA1 = extractYear(a.death_date, a.death_year) || 9999;
          const deathYearB1 = extractYear(b.death_date, b.death_year) || 9999;
          return deathYearA1 - deathYearB1;
        case 'death-new':
          const deathYearA2 = extractYear(a.death_date, a.death_year) || 0;
          const deathYearB2 = extractYear(b.death_date, b.death_year) || 0;
          return deathYearB2 - deathYearA2;
        default:
          return 0;
      }
    });

    return result;
  }
);

// Family relationships
export const familyRelationships = derived(familyData, ($familyData) => {
  const relationships = {};
  const familyGroups = {};

  // First pass: group people by their family IDs
  $familyData.forEach(person => {
    if (person.spouse_family_ids) {
      person.spouse_family_ids.forEach(famId => {
        if (!familyGroups[famId]) {
          familyGroups[famId] = { parents: [], children: [] };
        }
        familyGroups[famId].parents.push(person);
      });
    }

    if (person.child_family_id) {
      const famId = person.child_family_id;
      if (!familyGroups[famId]) {
        familyGroups[famId] = { parents: [], children: [] };
      }
      familyGroups[famId].children.push(person);
    }
  });

  // Second pass: build relationships for each person
  $familyData.forEach(person => {
    relationships[person.id] = {
      parents: [],
      siblings: [],
      spouses: [],
      children: []
    };

    // Find parents and siblings
    if (person.child_family_id && familyGroups[person.child_family_id]) {
      relationships[person.id].parents = familyGroups[person.child_family_id].parents;
      relationships[person.id].siblings = familyGroups[person.child_family_id].children
        .filter(c => c.id !== person.id);
    }

    if (!relationships[person.id].siblings.length && person.child_family_id) {
      const potentialSiblings = $familyData.filter(p =>
        p.id !== person.id &&
        p.child_family_id === person.child_family_id
      );
      if (potentialSiblings.length > 0) {
        relationships[person.id].siblings = potentialSiblings;
      }
    }

    // Find spouses and children
    if (person.spouse_family_ids) {
      person.spouse_family_ids.forEach(famId => {
        if (familyGroups[famId]) {
          const otherParents = familyGroups[famId].parents.filter(p => p.id !== person.id);
          relationships[person.id].spouses.push(...otherParents);
          relationships[person.id].children.push(...familyGroups[famId].children);
        }
      });
    }
  });

  return relationships;
});

// Statistics
export const statistics = derived(familyData, ($familyData) => {
  const stats = {
    total: $familyData.length,
    male: 0,
    female: 0,
    unknown: 0,
    living: 0,
    deceased: 0,
    birthCenturies: {},
    places: {}
  };

  $familyData.forEach(person => {
    if (person.sex === 'M') stats.male++;
    else if (person.sex === 'F') stats.female++;
    else stats.unknown++;

    if (person.death_date) stats.deceased++;
    else stats.living++;

    if (person.birth_date) {
      const year = extractYear(person.birth_date, person.birth_year);
      if (year) {
        const century = Math.ceil(year / 100);
        stats.birthCenturies[century] = (stats.birthCenturies[century] || 0) + 1;
      }
    }

    if (person.birth_place) {
      const place = person.birth_place.split(',').pop()?.trim() || person.birth_place;
      stats.places[place] = (stats.places[place] || 0) + 1;
    }
  });

  return stats;
});

// ============== COMPATIBILITY ==============

export function loadCustomFamilyData(data) {
  familyData.set(data);
}

// Deprecated - kept for compatibility
export const usingApi = writable(false);
export const apiAvailable = writable(false);
export const usingDefaultData = usingApi;
