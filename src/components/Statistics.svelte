<script>
  import { createEventDispatcher } from 'svelte';
  import { statistics, familyData, selectedPerson, familyRelationships, immigrants, filterOptions } from '../stores/familyStore.js';

  const dispatch = createEventDispatcher();

  function filterByName(name) {
    dispatch('filterByName', name);
  }

  // Filter by location and switch to gallery view
  function filterByLocation(type, value) {
    // Clear other location filters first, then set the new one
    filterOptions.update(opts => ({
      ...opts,
      birthState: null,
      birthCity: null,
      birthCountry: null,
      deathState: null,
      deathCity: null,
      residenceState: null,
      residenceCity: null,
      [type]: value
    }));
    dispatch('filterByLocation', { type, value });
  }

  // Delete functionality removed for read-only public interface
  // State for bulk delete confirmation
  let showDeleteAllDisconnected = false;
  let deletingDisconnected = false;

  // Delete functions disabled in public interface
  function confirmDeleteAllDisconnected() {
    // Disabled in public interface
  }

  function cancelDeleteAllDisconnected() {
    showDeleteAllDisconnected = false;
  }

  async function executeDeleteAllDisconnected() {
    // Disabled in public interface
  }

  $: sortedCenturies = Object.entries($statistics.birthCenturies)
    .sort(([a], [b]) => parseInt(b) - parseInt(a));

  $: topPlaces = Object.entries($statistics.places)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  $: maxPlaceCount = Math.max(...topPlaces.map(([, count]) => count));

  function getCenturyLabel(century) {
    const num = parseInt(century);
    if (num === 21) return '2000s';
    if (num === 20) return '1900s';
    if (num === 19) return '1800s';
    if (num === 18) return '1700s';
    if (num === 17) return '1600s';
    return `${num}00s`;
  }

  $: maxCenturyCount = Math.max(...Object.values($statistics.birthCenturies));

  // Extract last name from full name
  function extractLastName(name) {
    if (!name) return null;
    // Remove any slashes (GEDCOM format sometimes uses /LastName/)
    const cleaned = name.replace(/\//g, '').trim();
    const parts = cleaned.split(/\s+/);
    if (parts.length === 0) return null;
    // Last word is typically the surname
    return parts[parts.length - 1];
  }

  // Calculate last name statistics
  $: lastNameStats = (() => {
    const counts = {};
    $familyData.forEach(person => {
      const lastName = extractLastName(person.name);
      if (lastName && lastName.length > 1) {
        counts[lastName] = (counts[lastName] || 0) + 1;
      }
    });
    return counts;
  })();

  $: topLastNames = Object.entries(lastNameStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);

  $: totalLastNames = Object.keys(lastNameStats).length;

  $: maxLastNameCount = topLastNames.length > 0 
    ? Math.max(...topLastNames.map(([, count]) => count)) 
    : 0;

  // Find the first person of each surname (earliest birth year)
  let showAllFirstSurnames = false;
  
  $: firstOfSurname = (() => {
    const surnameMap = new Map();
    
    $familyData.forEach(person => {
      const lastName = extractLastName(person.name);
      if (!lastName || lastName.length <= 1) return;
      
      const birthYear = extractYear(person.birth_date);
      if (!birthYear) return; // Skip people without birth years
      
      if (!surnameMap.has(lastName)) {
        surnameMap.set(lastName, person);
      } else {
        const existing = surnameMap.get(lastName);
        const existingYear = extractYear(existing.birth_date);
        if (existingYear && birthYear < existingYear) {
          surnameMap.set(lastName, person);
        }
      }
    });
    
    return Array.from(surnameMap.values())
      .sort((a, b) => {
        const yearA = extractYear(a.birth_date) || 9999;
        const yearB = extractYear(b.birth_date) || 9999;
        return yearA - yearB;
      });
  })();

  // Extract first name from full name
  function extractFirstName(name) {
    if (!name) return null;
    // Remove any slashes (GEDCOM format sometimes uses /LastName/)
    const cleaned = name.replace(/\//g, '').trim();
    const parts = cleaned.split(/\s+/);
    if (parts.length === 0) return null;
    // First word is the first name, but skip titles
    let firstName = parts[0];
    // Skip common titles
    if (['Mr', 'Mrs', 'Ms', 'Dr', 'Rev', 'Sir'].includes(firstName.replace('.', ''))) {
      firstName = parts[1] || null;
    }
    return firstName && firstName.length > 1 ? firstName : null;
  }

  // Calculate first name statistics
  $: firstNameStats = (() => {
    const counts = {};
    $familyData.forEach(person => {
      const firstName = extractFirstName(person.name);
      if (firstName && firstName.length > 1) {
        // Normalize case
        const normalized = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        counts[normalized] = (counts[normalized] || 0) + 1;
      }
    });
    return counts;
  })();

  $: topFirstNames = Object.entries(firstNameStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);

  $: totalFirstNames = Object.keys(firstNameStats).length;

  $: maxFirstNameCount = topFirstNames.length > 0 
    ? Math.max(...topFirstNames.map(([, count]) => count)) 
    : 0;

  // People with most children
  $: mostChildren = (() => {
    const peopleWithChildren = $familyData
      .map(person => {
        const rels = $familyRelationships[person.id];
        return {
          ...person,
          childCount: rels?.children?.length || 0
        };
      })
      .filter(p => p.childCount > 0)
      .sort((a, b) => b.childCount - a.childCount)
      .slice(0, 10);
    return peopleWithChildren;
  })();

  // People with most spouses
  $: mostSpouses = (() => {
    const peopleWithSpouses = $familyData
      .map(person => {
        const rels = $familyRelationships[person.id];
        return {
          ...person,
          spouseCount: rels?.spouses?.length || 0
        };
      })
      .filter(p => p.spouseCount > 1) // Only show people with 2+ spouses
      .sort((a, b) => b.spouseCount - a.spouseCount)
      .slice(0, 10);
    return peopleWithSpouses;
  })();

  // Living centenarians (over 100 without death date)
  $: livingCentenarians = (() => {
    const currentYear = new Date().getFullYear();
    return $familyData
      .filter(person => {
        // Must not have a death date
        if (person.death_date) return false;
        
        // Must have a birth year
        const birthYear = extractYear(person.birth_date);
        if (!birthYear) return false;
        
        // Calculate age
        const age = currentYear - birthYear;
        return age >= 100;
      })
      .map(person => {
        const birthYear = extractYear(person.birth_date);
        return {
          ...person,
          age: currentYear - birthYear
        };
      })
      .sort((a, b) => b.age - a.age);
  })();

  // Disconnected/Orphan Records - people with no family connections
  $: disconnectedRecords = (() => {
    return $familyData.filter(person => {
      const rels = $familyRelationships[person.id];
      if (!rels) return true; // No relationships at all
      
      const hasParents = rels.parents?.length > 0;
      const hasChildren = rels.children?.length > 0;
      const hasSpouses = rels.spouses?.length > 0;
      const hasSiblings = rels.siblings?.length > 0;
      
      // Person is disconnected if they have no parents AND no children
      // (they may still have a spouse or siblings, but are "dead ends" in the tree)
      return !hasParents && !hasChildren;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  })();

  // No Family of Their Own - people with no kids AND no spouse
  $: noFamilyOfOwn = (() => {
    return $familyData.filter(person => {
      const rels = $familyRelationships[person.id];
      if (!rels) return true;
      
      const hasChildren = rels.children?.length > 0;
      const hasSpouses = rels.spouses?.length > 0;
      
      // Person has no family of their own if they have no spouse AND no children
      return !hasChildren && !hasSpouses;
    }).sort((a, b) => {
      // Sort by birth year (oldest first)
      const yearA = extractYear(a.birth_date) || 9999;
      const yearB = extractYear(b.birth_date) || 9999;
      return yearA - yearB;
    });
  })();

  // Children but No Spouse - people with children but no spouse recorded (potential data issue)
  $: childrenNoSpouse = (() => {
    return $familyData.filter(person => {
      const rels = $familyRelationships[person.id];
      if (!rels) return false;
      
      const hasChildren = rels.children?.length > 0;
      const hasSpouses = rels.spouses?.length > 0;
      
      // Person has children but no spouse recorded
      return hasChildren && !hasSpouses;
    }).map(person => {
      const rels = $familyRelationships[person.id];
      return {
        ...person,
        childCount: rels?.children?.length || 0
      };
    }).sort((a, b) => {
      // Sort by number of children (most first), then by name
      if (b.childCount !== a.childCount) return b.childCount - a.childCount;
      return (a.name || '').localeCompare(b.name || '');
    });
  })();

  // No Parents - people with no parents recorded (root ancestors or missing data)
  let noParentsSortOrder = 'birth-old'; // 'name', 'birth-old', 'birth-new'
  
  $: noParents = (() => {
    const filtered = $familyData.filter(person => {
      const rels = $familyRelationships[person.id];
      if (!rels) return true;
      
      const hasParents = rels.parents?.length > 0;
      return !hasParents;
    });
    
    // Apply sorting based on selected order
    return filtered.sort((a, b) => {
      switch (noParentsSortOrder) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'birth-old':
          const yearA1 = extractYear(a.birth_date) || 9999;
          const yearB1 = extractYear(b.birth_date) || 9999;
          return yearA1 - yearB1;
        case 'birth-new':
          const yearA2 = extractYear(a.birth_date) || 0;
          const yearB2 = extractYear(b.birth_date) || 0;
          return yearB2 - yearA2;
        default:
          return 0;
      }
    });
  })();

  // No Dates - people with no birth date AND no death date (missing date data)
  let showAllNoDates = false;
  
  $: noDates = (() => {
    return $familyData
      .filter(person => !person.birth_date && !person.death_date)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  })();

  // People with Notes - people who have something in their notes field
  let showAllWithNotes = false;
  
  $: peopleWithNotes = (() => {
    return $familyData
      .filter(person => person.notes && person.notes.trim().length > 0)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  })();

  // Most Widowed - people who lost the most spouses (spouse died before them)
  let showAllWidowed = false;
  
  $: mostWidowed = (() => {
    const widowedCounts = new Map();
    
    $familyData.forEach(person => {
      const rels = $familyRelationships[person.id];
      if (!rels?.spouses || rels.spouses.length === 0) return;
      
      const personDeathYear = extractYear(person.death_date);
      let widowedCount = 0;
      const widowedSpouses = [];
      
      rels.spouses.forEach(spouse => {
        const spouseDeathYear = extractYear(spouse.death_date);
        
        // Person was widowed if:
        // 1. Spouse has a death date
        // 2. Person either has no death date (still living) OR person died after spouse
        if (spouseDeathYear) {
          if (!personDeathYear || personDeathYear > spouseDeathYear) {
            widowedCount++;
            widowedSpouses.push({
              name: spouse.name,
              deathYear: spouseDeathYear
            });
          }
        }
      });
      
      if (widowedCount > 0) {
        widowedCounts.set(person.id, {
          person,
          widowedCount,
          widowedSpouses
        });
      }
    });
    
    return Array.from(widowedCounts.values())
      .sort((a, b) => b.widowedCount - a.widowedCount)
      .map(item => ({
        ...item.person,
        widowedCount: item.widowedCount,
        widowedSpouses: item.widowedSpouses
      }));
  })();
  
  $: mostWidowedMale = mostWidowed.filter(p => p.sex === 'M');
  $: mostWidowedFemale = mostWidowed.filter(p => p.sex === 'F');

  // Early Deaths - people who died at age 21 or less
  let showAllEarlyDeaths = false;
  
  $: earlyDeaths = (() => {
    return $familyData
      .map(person => {
        const birthYear = extractYear(person.birth_date);
        const deathYear = extractYear(person.death_date);
        
        // Must have both birth and death dates to calculate age
        if (!birthYear || !deathYear) return null;
        
        const ageAtDeath = deathYear - birthYear;
        
        // Include if age at death is 21 or less
        if (ageAtDeath <= 21 && ageAtDeath >= 0) {
          return {
            ...person,
            ageAtDeath,
            birthYear,
            deathYear
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.ageAtDeath - b.ageAtDeath || (a.name || '').localeCompare(b.name || ''));
  })();

  // Duplicate Detection
  function normalizeName(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/\//g, '') // Remove GEDCOM slashes
      .replace(/[^a-z\s]/g, '') // Remove non-letters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }

  function getNameParts(name) {
    if (!name) return { first: '', last: '' };
    const normalized = normalizeName(name);
    const parts = normalized.split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return { first: '', last: '' };
    if (parts.length === 1) return { first: parts[0], last: '' };
    return { 
      first: parts[0], 
      last: parts[parts.length - 1] 
    };
  }

  // Find potential duplicates
  $: potentialDuplicates = (() => {
    const groups = {};
    
    $familyData.forEach(person => {
      const { first, last } = getNameParts(person.name);
      if (!first || !last) return;
      
      const birthYear = extractYear(person.birth_date);
      
      // Create a key based on first name initial + last name
      const key = `${first[0]}_${last}`;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push({
        ...person,
        normalizedName: normalizeName(person.name),
        birthYear
      });
    });

    // Filter to only groups with potential duplicates
    const duplicateGroups = [];
    
    Object.entries(groups).forEach(([key, people]) => {
      if (people.length < 2) return;
      
      // Check for people with very similar names within this group
      const checked = new Set();
      
      for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
          const p1 = people[i];
          const p2 = people[j];
          
          // Skip if already in a group together
          const pairKey = [p1.id, p2.id].sort().join('_');
          if (checked.has(pairKey)) continue;
          checked.add(pairKey);
          
          // Calculate similarity
          const nameSimilarity = calculateSimilarity(p1.normalizedName, p2.normalizedName);
          
          // Check birth year proximity
          const yearDiff = (p1.birthYear && p2.birthYear) 
            ? Math.abs(p1.birthYear - p2.birthYear) 
            : null;
          
          // Consider as potential duplicate if:
          // - Names are very similar (>80% match)
          // - OR names start the same and birth years are within 10 years
          const isPotentialDuplicate = 
            nameSimilarity > 0.8 ||
            (nameSimilarity > 0.6 && yearDiff !== null && yearDiff <= 10);
          
          if (isPotentialDuplicate) {
            duplicateGroups.push({
              people: [p1, p2],
              similarity: nameSimilarity,
              yearDiff,
              reason: nameSimilarity > 0.8 
                ? 'Very similar names' 
                : `Similar names, ${yearDiff} year difference`
            });
          }
        }
      }
    });

    // Sort by similarity (highest first)
    return duplicateGroups.sort((a, b) => b.similarity - a.similarity);
  })();

  // Simple string similarity (Dice coefficient)
  function calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (str1.length < 2 || str2.length < 2) return 0;

    const bigrams1 = new Set();
    for (let i = 0; i < str1.length - 1; i++) {
      bigrams1.add(str1.substring(i, i + 2));
    }

    let matches = 0;
    for (let i = 0; i < str2.length - 1; i++) {
      if (bigrams1.has(str2.substring(i, i + 2))) {
        matches++;
      }
    }

    return (2 * matches) / (str1.length + str2.length - 2);
  }

  function selectPerson(person) {
    selectedPerson.set(person);
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
      .filter(part => !part.startsWith('/') && !part.endsWith('/'))
      .map(part => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function getGenderClass(sex) {
    if (sex === 'M') return 'male';
    if (sex === 'F') return 'female';
    return 'unknown';
  }

  // Sort immigrants by birth year (oldest first)
  $: sortedImmigrants = [...$immigrants].sort((a, b) => {
    const yearA = extractYear(a.birth_date) || 9999;
    const yearB = extractYear(b.birth_date) || 9999;
    return yearA - yearB;
  });

  // Group immigrants by century
  $: immigrantsByCentury = (() => {
    const centuries = {};
    $immigrants.forEach(person => {
      const year = extractYear(person.birth_date);
      if (year) {
        const century = Math.floor(year / 100) * 100; // 1756 -> 1700
        centuries[century] = (centuries[century] || 0) + 1;
      } else {
        centuries['Unknown'] = (centuries['Unknown'] || 0) + 1;
      }
    });
    // Sort centuries (oldest first), with Unknown at the end
    return Object.entries(centuries)
      .sort(([a], [b]) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return parseInt(a) - parseInt(b);
      });
  })();

  $: maxImmigrantCenturyCount = immigrantsByCentury.length > 0 
    ? Math.max(...immigrantsByCentury.filter(([c]) => c !== 'Unknown').map(([, count]) => count))
    : 0;

  // ============== LOCATION STATISTICS ==============

  // Birth States
  $: birthStateStats = (() => {
    const counts = {};
    $familyData.forEach(person => {
      if (person.birth_state) {
        counts[person.birth_state] = (counts[person.birth_state] || 0) + 1;
      }
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  })();

  $: topBirthStates = birthStateStats.slice(0, 10);
  $: maxBirthStateCount = topBirthStates.length > 0 ? topBirthStates[0][1] : 0;

  // Birth Cities
  $: birthCityStats = (() => {
    const counts = {};
    $familyData.forEach(person => {
      if (person.birth_city) {
        const key = person.birth_state ? `${person.birth_city}, ${person.birth_state}` : person.birth_city;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  })();

  $: topBirthCities = birthCityStats.slice(0, 10);
  $: maxBirthCityCount = topBirthCities.length > 0 ? topBirthCities[0][1] : 0;

  // Birth Countries
  $: birthCountryStats = (() => {
    const counts = {};
    $familyData.forEach(person => {
      if (person.birth_country) {
        counts[person.birth_country] = (counts[person.birth_country] || 0) + 1;
      }
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  })();

  $: topBirthCountries = birthCountryStats.slice(0, 10);
  $: maxBirthCountryCount = topBirthCountries.length > 0 ? topBirthCountries[0][1] : 0;

  // Birth Counties
  $: birthCountyStats = (() => {
    const counts = {};
    $familyData.forEach(person => {
      if (person.birth_county) {
        const key = person.birth_state ? `${person.birth_county}, ${person.birth_state}` : person.birth_county;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  })();

  $: topBirthCounties = birthCountyStats.slice(0, 10);
  $: maxBirthCountyCount = topBirthCounties.length > 0 ? topBirthCounties[0][1] : 0;

  // Death States
  $: deathStateStats = (() => {
    const counts = {};
    $familyData.forEach(person => {
      if (person.death_state) {
        counts[person.death_state] = (counts[person.death_state] || 0) + 1;
      }
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  })();

  $: topDeathStates = deathStateStats.slice(0, 10);
  $: maxDeathStateCount = topDeathStates.length > 0 ? topDeathStates[0][1] : 0;

  // Death Cities
  $: deathCityStats = (() => {
    const counts = {};
    $familyData.forEach(person => {
      if (person.death_city) {
        const key = person.death_state ? `${person.death_city}, ${person.death_state}` : person.death_city;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  })();

  $: topDeathCities = deathCityStats.slice(0, 10);
  $: maxDeathCityCount = topDeathCities.length > 0 ? topDeathCities[0][1] : 0;

  // Residence States (from all residences)
  $: residenceStateStats = (() => {
    const counts = {};
    $familyData.forEach(person => {
      if (person.residences) {
        // Use a Set to count each state only once per person
        const statesForPerson = new Set();
        person.residences.forEach(r => {
          if (r.state) statesForPerson.add(r.state);
        });
        statesForPerson.forEach(state => {
          counts[state] = (counts[state] || 0) + 1;
        });
      }
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  })();

  $: topResidenceStates = residenceStateStats.slice(0, 10);
  $: maxResidenceStateCount = topResidenceStates.length > 0 ? topResidenceStates[0][1] : 0;

  // Residence Cities
  $: residenceCityStats = (() => {
    const counts = {};
    $familyData.forEach(person => {
      if (person.residences) {
        const citiesForPerson = new Set();
        person.residences.forEach(r => {
          if (r.city) {
            const key = r.state ? `${r.city}, ${r.state}` : r.city;
            citiesForPerson.add(key);
          }
        });
        citiesForPerson.forEach(city => {
          counts[city] = (counts[city] || 0) + 1;
        });
      }
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  })();

  $: topResidenceCities = residenceCityStats.slice(0, 15);
  $: maxResidenceCityCount = topResidenceCities.length > 0 ? topResidenceCities[0][1] : 0;

  // Migration Patterns (born in one state, died in another)
  $: migrationPatterns = (() => {
    const patterns = {};
    $familyData.forEach(person => {
      if (person.birth_state && person.death_state && person.birth_state !== person.death_state) {
        const key = `${person.birth_state} → ${person.death_state}`;
        if (!patterns[key]) {
          patterns[key] = { from: person.birth_state, to: person.death_state, count: 0, people: [] };
        }
        patterns[key].count++;
        patterns[key].people.push(person);
      }
    });
    return Object.values(patterns).sort((a, b) => b.count - a.count);
  })();

  $: topMigrations = migrationPatterns.slice(0, 10);
  $: maxMigrationCount = topMigrations.length > 0 ? topMigrations[0].count : 0;

  // Location Data Coverage Stats
  $: locationCoverage = (() => {
    const total = $familyData.length;
    const withBirthCity = $familyData.filter(p => p.birth_city).length;
    const withBirthState = $familyData.filter(p => p.birth_state).length;
    const withBirthCountry = $familyData.filter(p => p.birth_country).length;
    const withDeathCity = $familyData.filter(p => p.death_city).length;
    const withDeathState = $familyData.filter(p => p.death_state).length;
    const withResidences = $familyData.filter(p => p.residences?.length > 0).length;
    
    return {
      total,
      birthCity: { count: withBirthCity, pct: ((withBirthCity / total) * 100).toFixed(1) },
      birthState: { count: withBirthState, pct: ((withBirthState / total) * 100).toFixed(1) },
      birthCountry: { count: withBirthCountry, pct: ((withBirthCountry / total) * 100).toFixed(1) },
      deathCity: { count: withDeathCity, pct: ((withDeathCity / total) * 100).toFixed(1) },
      deathState: { count: withDeathState, pct: ((withDeathState / total) * 100).toFixed(1) },
      residences: { count: withResidences, pct: ((withResidences / total) * 100).toFixed(1) }
    };
  })();

  // Active location tab
  let activeLocationTab = 'birth';

  // ============== DATA QUALITY FLAGS ==============

  // Impossible Dates - death before birth
  $: impossibleDates = (() => {
    return $familyData.filter(person => {
      const birthYear = extractYear(person.birth_date);
      const deathYear = extractYear(person.death_date);
      if (!birthYear || !deathYear) return false;
      return deathYear < birthYear;
    }).map(person => ({
      ...person,
      issue: 'Death before birth',
      birthYear: extractYear(person.birth_date),
      deathYear: extractYear(person.death_date)
    }));
  })();

  // Children born before parents
  $: childrenBeforeParents = (() => {
    const issues = [];
    $familyData.forEach(person => {
      const childBirth = extractYear(person.birth_date);
      if (!childBirth) return;
      
      const rels = $familyRelationships[person.id];
      if (!rels?.parents) return;
      
      rels.parents.forEach(parent => {
        const parentBirth = extractYear(parent.birth_date);
        if (!parentBirth) return;
        
        if (childBirth <= parentBirth) {
          issues.push({
            child: person,
            parent: parent,
            issue: `${person.name} born ${childBirth}, but parent ${parent.name} born ${parentBirth}`,
            childBirth,
            parentBirth
          });
        } else if (childBirth - parentBirth < 12) {
          issues.push({
            child: person,
            parent: parent,
            issue: `${parent.name} would have been ${childBirth - parentBirth} when ${person.name} was born`,
            childBirth,
            parentBirth,
            parentAge: childBirth - parentBirth
          });
        }
      });
    });
    return issues;
  })();

  // Suspicious Ages - very old, very young parents, large spouse age gaps
  $: suspiciousAges = (() => {
    const issues = [];
    
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      const deathYear = extractYear(person.death_date);
      
      // Check for impossibly old
      if (birthYear && deathYear) {
        const age = deathYear - birthYear;
        if (age > 110) {
          issues.push({
            person,
            type: 'extreme-age',
            issue: `Lived to ${age} years old`,
            value: age
          });
        }
      }
      
      // Check for young parents
      const rels = $familyRelationships[person.id];
      if (rels?.children && birthYear) {
        rels.children.forEach(child => {
          const childBirth = extractYear(child.birth_date);
          if (childBirth) {
            const parentAge = childBirth - birthYear;
            if (parentAge < 14 && parentAge > 0) {
              issues.push({
                person,
                type: 'young-parent',
                issue: `Had ${child.name} at age ${parentAge}`,
                value: parentAge,
                child
              });
            }
            if (parentAge > 60 && person.sex === 'F') {
              issues.push({
                person,
                type: 'old-mother',
                issue: `Had ${child.name} at age ${parentAge}`,
                value: parentAge,
                child
              });
            }
            if (parentAge > 80) {
              issues.push({
                person,
                type: 'old-parent',
                issue: `Had ${child.name} at age ${parentAge}`,
                value: parentAge,
                child
              });
            }
          }
        });
      }
      
      // Check spouse age gaps
      if (rels?.spouses && birthYear) {
        rels.spouses.forEach(spouse => {
          const spouseBirth = extractYear(spouse.birth_date);
          if (spouseBirth) {
            const gap = Math.abs(birthYear - spouseBirth);
            if (gap > 30) {
              issues.push({
                person,
                type: 'spouse-gap',
                issue: `${gap} year age gap with spouse ${spouse.name}`,
                value: gap,
                spouse
              });
            }
          }
        });
      }
    });
    
    return issues.sort((a, b) => b.value - a.value);
  })();

  // Potential Twins - same parents, same or very close birth dates
  $: potentialTwins = (() => {
    const twins = [];
    const checked = new Set();
    
    $familyData.forEach(person => {
      if (!person.child_family_id || !person.birth_date) return;
      
      const birthYear = extractYear(person.birth_date);
      if (!birthYear) return;
      
      // Find siblings with same birth year
      const siblings = $familyData.filter(p => 
        p.id !== person.id && 
        p.child_family_id === person.child_family_id &&
        extractYear(p.birth_date) === birthYear
      );
      
      siblings.forEach(sibling => {
        const pairKey = [person.id, sibling.id].sort().join('_');
        if (checked.has(pairKey)) return;
        checked.add(pairKey);
        
        twins.push({
          person1: person,
          person2: sibling,
          birthYear,
          sameBirthDate: person.birth_date === sibling.birth_date
        });
      });
    });
    
    return twins.sort((a, b) => (b.sameBirthDate ? 1 : 0) - (a.sameBirthDate ? 1 : 0));
  })();

  // Missing Critical Data
  $: missingCriticalData = (() => {
    const issues = [];
    
    $familyData.forEach(person => {
      const rels = $familyRelationships[person.id];
      const missing = [];
      
      // Has children but no birth date
      if (rels?.children?.length > 0 && !person.birth_date) {
        missing.push('Has children but no birth date');
      }
      
      // Has spouse but no birth date
      if (rels?.spouses?.length > 0 && !person.birth_date) {
        missing.push('Has spouse but no birth date');
      }
      
      // No name
      if (!person.name || person.name.trim() === '') {
        missing.push('No name recorded');
      }
      
      // No sex/gender
      if (!person.sex) {
        missing.push('No gender recorded');
      }
      
      if (missing.length > 0) {
        issues.push({ person, missing });
      }
    });
    
    return issues;
  })();

  // ============== LIFESPAN ANALYSIS ==============

  // Oldest ancestors (earliest birth dates)
  $: oldestAncestors = (() => {
    const withBirthYear = $familyData
      .filter(person => extractYear(person.birth_date))
      .map(person => ({
        ...person,
        birthYear: extractYear(person.birth_date),
        deathYear: extractYear(person.death_date)
      }))
      .sort((a, b) => a.birthYear - b.birthYear);

    const oldestMale = withBirthYear.find(p => p.sex === 'M');
    const oldestFemale = withBirthYear.find(p => p.sex === 'F');
    const oldestOverall = withBirthYear[0];

    return { oldestMale, oldestFemale, oldestOverall };
  })();

  // Longest-lived people (with actual death dates)
  $: longestLived = (() => {
    return $familyData
      .filter(person => {
        const birthYear = extractYear(person.birth_date);
        const deathYear = extractYear(person.death_date);
        return birthYear && deathYear && deathYear > birthYear;
      })
      .map(person => {
        const birthYear = extractYear(person.birth_date);
        const deathYear = extractYear(person.death_date);
        return { ...person, lifespan: deathYear - birthYear, birthYear, deathYear };
      })
      .sort((a, b) => b.lifespan - a.lifespan)
      .slice(0, 15);
  })();

  // Shortest lives (early deaths)
  $: shortestLives = (() => {
    return $familyData
      .filter(person => {
        const birthYear = extractYear(person.birth_date);
        const deathYear = extractYear(person.death_date);
        return birthYear && deathYear && deathYear >= birthYear;
      })
      .map(person => {
        const birthYear = extractYear(person.birth_date);
        const deathYear = extractYear(person.death_date);
        return { ...person, lifespan: deathYear - birthYear, birthYear, deathYear };
      })
      .sort((a, b) => a.lifespan - b.lifespan)
      .slice(0, 15);
  })();

  // Average lifespan by century
  $: lifespanByCentury = (() => {
    const centuries = {};
    
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      const deathYear = extractYear(person.death_date);
      if (!birthYear || !deathYear || deathYear < birthYear) return;
      
      const century = Math.floor(birthYear / 100) * 100;
      const lifespan = deathYear - birthYear;
      
      if (!centuries[century]) {
        centuries[century] = { total: 0, count: 0 };
      }
      centuries[century].total += lifespan;
      centuries[century].count++;
    });
    
    return Object.entries(centuries)
      .map(([century, data]) => ({
        century: parseInt(century),
        label: `${century}s`,
        average: Math.round(data.total / data.count),
        count: data.count
      }))
      .sort((a, b) => a.century - b.century);
  })();

  $: maxLifespanAvg = lifespanByCentury.length > 0 
    ? Math.max(...lifespanByCentury.map(c => c.average))
    : 0;

  // ============== BIRTH PATTERNS ==============

  // Birth month distribution
  $: birthMonthDistribution = (() => {
    const months = {
      'Jan': 0, 'Feb': 0, 'Mar': 0, 'Apr': 0, 'May': 0, 'Jun': 0,
      'Jul': 0, 'Aug': 0, 'Sep': 0, 'Oct': 0, 'Nov': 0, 'Dec': 0
    };
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    $familyData.forEach(person => {
      if (!person.birth_date) return;
      
      // Try to extract month from date string
      const dateStr = person.birth_date.toLowerCase();
      
      // Match patterns like "15 Jan 1900", "January 15, 1900", "Jan 1900", etc.
      const monthPatterns = [
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i
      ];
      
      for (const pattern of monthPatterns) {
        const match = dateStr.match(pattern);
        if (match) {
          const monthAbbr = match[1].substring(0, 3);
          const monthKey = monthAbbr.charAt(0).toUpperCase() + monthAbbr.slice(1).toLowerCase();
          if (months.hasOwnProperty(monthKey)) {
            months[monthKey]++;
            break;
          }
        }
      }
    });
    
    return monthNames.map(month => ({
      month,
      count: months[month]
    }));
  })();

  $: maxBirthMonth = Math.max(...birthMonthDistribution.map(m => m.count));
  $: totalBirthsWithMonth = birthMonthDistribution.reduce((sum, m) => sum + m.count, 0);

  // Average age at first child
  $: avgAgeAtFirstChild = (() => {
    const ages = { male: [], female: [] };
    
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      if (!birthYear) return;
      
      const rels = $familyRelationships[person.id];
      if (!rels?.children?.length) return;
      
      // Find earliest child birth
      let earliestChildBirth = Infinity;
      rels.children.forEach(child => {
        const childBirth = extractYear(child.birth_date);
        if (childBirth && childBirth < earliestChildBirth) {
          earliestChildBirth = childBirth;
        }
      });
      
      if (earliestChildBirth !== Infinity) {
        const ageAtFirstChild = earliestChildBirth - birthYear;
        if (ageAtFirstChild > 10 && ageAtFirstChild < 60) {
          if (person.sex === 'M') ages.male.push(ageAtFirstChild);
          else if (person.sex === 'F') ages.female.push(ageAtFirstChild);
        }
      }
    });
    
    const avgMale = ages.male.length > 0 
      ? (ages.male.reduce((a, b) => a + b, 0) / ages.male.length).toFixed(1)
      : null;
    const avgFemale = ages.female.length > 0 
      ? (ages.female.reduce((a, b) => a + b, 0) / ages.female.length).toFixed(1)
      : null;
    
    return {
      male: { avg: avgMale, count: ages.male.length },
      female: { avg: avgFemale, count: ages.female.length }
    };
  })();

  // Average age at first child by century
  $: ageAtFirstChildByCentury = (() => {
    const centuries = {};
    
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      if (!birthYear) return;
      
      const rels = $familyRelationships[person.id];
      if (!rels?.children?.length) return;
      
      let earliestChildBirth = Infinity;
      rels.children.forEach(child => {
        const childBirth = extractYear(child.birth_date);
        if (childBirth && childBirth < earliestChildBirth) {
          earliestChildBirth = childBirth;
        }
      });
      
      if (earliestChildBirth !== Infinity) {
        const ageAtFirstChild = earliestChildBirth - birthYear;
        if (ageAtFirstChild > 10 && ageAtFirstChild < 60) {
          const century = Math.floor(birthYear / 100) * 100;
          if (!centuries[century]) {
            centuries[century] = { male: [], female: [] };
          }
          if (person.sex === 'M') centuries[century].male.push(ageAtFirstChild);
          else if (person.sex === 'F') centuries[century].female.push(ageAtFirstChild);
        }
      }
    });
    
    return Object.entries(centuries)
      .map(([century, data]) => ({
        century: parseInt(century),
        label: `${century}s`,
        maleAvg: data.male.length > 0 ? (data.male.reduce((a, b) => a + b, 0) / data.male.length).toFixed(1) : null,
        femaleAvg: data.female.length > 0 ? (data.female.reduce((a, b) => a + b, 0) / data.female.length).toFixed(1) : null,
        maleCount: data.male.length,
        femaleCount: data.female.length
      }))
      .sort((a, b) => a.century - b.century);
  })();

  // ============== FAMILY STRUCTURE ANALYSIS ==============

  // Most total descendants
  $: mostDescendants = (() => {
    const descendantCounts = {};
    
    // Build descendant tree for each person
    function countDescendants(personId, visited = new Set()) {
      if (visited.has(personId)) return 0;
      visited.add(personId);
      
      const rels = $familyRelationships[personId];
      if (!rels?.children?.length) return 0;
      
      let count = rels.children.length;
      rels.children.forEach(child => {
        count += countDescendants(child.id, visited);
      });
      return count;
    }
    
    $familyData.forEach(person => {
      descendantCounts[person.id] = countDescendants(person.id);
    });
    
    return $familyData
      .filter(p => descendantCounts[p.id] > 0)
      .map(p => ({ ...p, descendantCount: descendantCounts[p.id] }))
      .sort((a, b) => b.descendantCount - a.descendantCount)
      .slice(0, 15);
  })();

  // Family lines that ended (people with no descendants)
  $: endOfLines = (() => {
    return $familyData.filter(person => {
      const rels = $familyRelationships[person.id];
      // Has no children
      if (rels?.children?.length > 0) return false;
      // But has parents (so they're not a root ancestor)
      if (!rels?.parents?.length) return false;
      // And is deceased
      if (!person.death_date) return false;
      return true;
    }).sort((a, b) => {
      const yearA = extractYear(a.death_date) || 0;
      const yearB = extractYear(b.death_date) || 0;
      return yearB - yearA;
    });
  })();

  // Longest ancestor chain
  $: longestAncestorChain = (() => {
    function getAncestorDepth(personId, visited = new Set()) {
      if (visited.has(personId)) return 0;
      visited.add(personId);
      
      const rels = $familyRelationships[personId];
      if (!rels?.parents?.length) return 0;
      
      let maxDepth = 0;
      rels.parents.forEach(parent => {
        const depth = 1 + getAncestorDepth(parent.id, new Set(visited));
        if (depth > maxDepth) maxDepth = depth;
      });
      return maxDepth;
    }
    
    let maxChain = { person: null, depth: 0, chain: [] };
    
    $familyData.forEach(person => {
      const depth = getAncestorDepth(person.id);
      if (depth > maxChain.depth) {
        maxChain = { person, depth };
      }
    });
    
    // Build the actual chain
    if (maxChain.person) {
      const chain = [maxChain.person];
      let current = maxChain.person;
      while (true) {
        const rels = $familyRelationships[current.id];
        if (!rels?.parents?.length) break;
        // Pick the parent with the longest chain
        let bestParent = null;
        let bestDepth = -1;
        rels.parents.forEach(parent => {
          const depth = getAncestorDepth(parent.id);
          if (depth > bestDepth) {
            bestDepth = depth;
            bestParent = parent;
          }
        });
        if (bestParent) {
          chain.push(bestParent);
          current = bestParent;
        } else {
          break;
        }
      }
      maxChain.chain = chain;
    }
    
    return maxChain;
  })();

  // Generation statistics
  $: generationStats = (() => {
    const generations = [];
    
    // Find generation gap (average years between parent and child birth)
    const gaps = [];
    $familyData.forEach(person => {
      const childBirth = extractYear(person.birth_date);
      if (!childBirth) return;
      
      const rels = $familyRelationships[person.id];
      if (!rels?.parents) return;
      
      rels.parents.forEach(parent => {
        const parentBirth = extractYear(parent.birth_date);
        if (parentBirth && childBirth > parentBirth) {
          gaps.push(childBirth - parentBirth);
        }
      });
    });
    
    const avgGenerationGap = gaps.length > 0 
      ? (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1)
      : null;
    
    return {
      avgGenerationGap,
      gapCount: gaps.length
    };
  })();

  // ============== GEOGRAPHIC TIMELINE ==============

  // Migration over time (by decade)
  $: migrationTimeline = (() => {
    const timeline = {};
    
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      const birthState = person.birth_state;
      if (!birthYear || !birthState) return;
      
      const decade = Math.floor(birthYear / 10) * 10;
      if (!timeline[decade]) {
        timeline[decade] = {};
      }
      timeline[decade][birthState] = (timeline[decade][birthState] || 0) + 1;
    });
    
    return Object.entries(timeline)
      .map(([decade, states]) => ({
        decade: parseInt(decade),
        label: `${decade}s`,
        states: Object.entries(states).sort((a, b) => b[1] - a[1])
      }))
      .sort((a, b) => a.decade - b.decade);
  })();

  // Active stats tab
  let activeStatsTab = 'quality';

  // "Show more" toggle states
  let showAllImpossibleDates = false;
  let showAllChildrenBeforeParents = false;
  let showAllSuspiciousAges = false;
  let showAllTwins = false;
  let showAllMissingData = false;
  let showAllEndOfLines = false;
  let showAllDisconnected = false;
  let showAllNoFamily = false;
  let showAllChildrenNoSpouse = false;
  let showAllNoParents = false;
  let showAllDuplicates = false;
</script>

<div class="statistics-container">
  <div class="stats-grid">
    <div class="stat-card highlight">
      <div class="stat-icon">
        <svg viewBox="0 0 24 24" width="32" height="32">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="2"/>
          <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
      </div>
      <div class="stat-value">{$statistics.total.toLocaleString()}</div>
      <div class="stat-label">Total Family Members</div>
    </div>

    <div class="stat-card">
      <div class="stat-icon male">
        <span>♂</span>
      </div>
      <div class="stat-value">{$statistics.male.toLocaleString()}</div>
      <div class="stat-label">Male</div>
      <div class="stat-percent">{(($statistics.male / $statistics.total) * 100).toFixed(1)}%</div>
    </div>

    <div class="stat-card">
      <div class="stat-icon female">
        <span>♀</span>
      </div>
      <div class="stat-value">{$statistics.female.toLocaleString()}</div>
      <div class="stat-label">Female</div>
      <div class="stat-percent">{(($statistics.female / $statistics.total) * 100).toFixed(1)}%</div>
    </div>

    <div class="stat-card">
      <div class="stat-icon living">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor"/>
        </svg>
      </div>
      <div class="stat-value">{$statistics.living.toLocaleString()}</div>
      <div class="stat-label">Living</div>
    </div>

    <div class="stat-card">
      <div class="stat-icon deceased">
        <span>✝</span>
      </div>
      <div class="stat-value">{$statistics.deceased.toLocaleString()}</div>
      <div class="stat-label">Deceased</div>
    </div>
  </div>

  <div class="charts-row">
    <div class="chart-card">
      <h3>Birth Century Distribution</h3>
      <div class="century-chart">
        {#each sortedCenturies as [century, count]}
          <div class="century-bar">
            <span class="century-label">{getCenturyLabel(century)}</span>
            <div class="bar-container">
              <div 
                class="bar" 
                style="width: {(count / maxCenturyCount) * 100}%"
              ></div>
            </div>
            <span class="bar-value">{count}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="chart-card">
      <h3>Top Birthplaces (Original)</h3>
      <div class="places-chart">
        {#each topPlaces as [place, count], i}
          <div class="place-row">
            <span class="place-rank">{i + 1}</span>
            <div class="place-info">
              <span class="place-name">{place}</span>
              <div class="place-bar-container">
                <div 
                  class="place-bar" 
                  style="width: {(count / maxPlaceCount) * 100}%"
                ></div>
              </div>
            </div>
            <span class="place-count">{count}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Location Statistics Section -->
  <div class="location-stats-section">
    <h2 class="section-title">
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
      Location Analytics
    </h2>

    <!-- Location Data Coverage -->
    <div class="coverage-card">
      <h3>Data Coverage</h3>
      <div class="coverage-grid">
        <div class="coverage-item">
          <span class="coverage-label">Birth City</span>
          <div class="coverage-bar-container">
            <div class="coverage-bar" style="width: {locationCoverage.birthCity.pct}%"></div>
          </div>
          <span class="coverage-value">{locationCoverage.birthCity.count} ({locationCoverage.birthCity.pct}%)</span>
        </div>
        <div class="coverage-item">
          <span class="coverage-label">Birth State</span>
          <div class="coverage-bar-container">
            <div class="coverage-bar" style="width: {locationCoverage.birthState.pct}%"></div>
          </div>
          <span class="coverage-value">{locationCoverage.birthState.count} ({locationCoverage.birthState.pct}%)</span>
        </div>
        <div class="coverage-item">
          <span class="coverage-label">Birth Country</span>
          <div class="coverage-bar-container">
            <div class="coverage-bar" style="width: {locationCoverage.birthCountry.pct}%"></div>
          </div>
          <span class="coverage-value">{locationCoverage.birthCountry.count} ({locationCoverage.birthCountry.pct}%)</span>
        </div>
        <div class="coverage-item">
          <span class="coverage-label">Death City</span>
          <div class="coverage-bar-container">
            <div class="coverage-bar death" style="width: {locationCoverage.deathCity.pct}%"></div>
          </div>
          <span class="coverage-value">{locationCoverage.deathCity.count} ({locationCoverage.deathCity.pct}%)</span>
        </div>
        <div class="coverage-item">
          <span class="coverage-label">Death State</span>
          <div class="coverage-bar-container">
            <div class="coverage-bar death" style="width: {locationCoverage.deathState.pct}%"></div>
          </div>
          <span class="coverage-value">{locationCoverage.deathState.count} ({locationCoverage.deathState.pct}%)</span>
        </div>
        <div class="coverage-item">
          <span class="coverage-label">Residences</span>
          <div class="coverage-bar-container">
            <div class="coverage-bar residence" style="width: {locationCoverage.residences.pct}%"></div>
          </div>
          <span class="coverage-value">{locationCoverage.residences.count} ({locationCoverage.residences.pct}%)</span>
        </div>
      </div>
    </div>

    <!-- Location Tabs -->
    <div class="location-tabs">
      <button 
        class="location-tab" 
        class:active={activeLocationTab === 'birth'}
        on:click={() => activeLocationTab = 'birth'}
      >
        <span class="tab-icon">★</span> Birth Locations
      </button>
      <button 
        class="location-tab" 
        class:active={activeLocationTab === 'death'}
        on:click={() => activeLocationTab = 'death'}
      >
        <span class="tab-icon">✝</span> Death Locations
      </button>
      <button 
        class="location-tab" 
        class:active={activeLocationTab === 'residence'}
        on:click={() => activeLocationTab = 'residence'}
      >
        <span class="tab-icon">🏠</span> Residences
      </button>
      <button 
        class="location-tab" 
        class:active={activeLocationTab === 'migration'}
        on:click={() => activeLocationTab = 'migration'}
      >
        <span class="tab-icon">→</span> Migration
      </button>
    </div>

    <!-- Birth Locations Tab -->
    {#if activeLocationTab === 'birth'}
      <div class="location-charts-grid">
        <div class="location-chart-card">
          <h4>Top Birth States</h4>
          <p class="chart-subtitle clickable-hint">Click to filter gallery</p>
          <div class="location-chart">
            {#each topBirthStates as [state, count], i}
              <button class="location-row clickable" on:click={() => filterByLocation('birthState', state)}>
                <span class="location-rank">{i + 1}</span>
                <span class="location-name">{state}</span>
                <div class="location-bar-container">
                  <div class="location-bar birth" style="width: {(count / maxBirthStateCount) * 100}%"></div>
                </div>
                <span class="location-count">{count}</span>
              </button>
            {/each}
            {#if topBirthStates.length === 0}
              <p class="no-data">No birth state data available</p>
            {/if}
          </div>
        </div>

        <div class="location-chart-card">
          <h4>Top Birth Cities</h4>
          <p class="chart-subtitle clickable-hint">Click to filter gallery</p>
          <div class="location-chart">
            {#each topBirthCities as [city, count], i}
              <button class="location-row clickable" on:click={() => filterByLocation('birthCity', city)}>
                <span class="location-rank">{i + 1}</span>
                <span class="location-name">{city}</span>
                <div class="location-bar-container">
                  <div class="location-bar birth" style="width: {(count / maxBirthCityCount) * 100}%"></div>
                </div>
                <span class="location-count">{count}</span>
              </button>
            {/each}
            {#if topBirthCities.length === 0}
              <p class="no-data">No birth city data available</p>
            {/if}
          </div>
        </div>

        <div class="location-chart-card">
          <h4>Top Birth Counties</h4>
          <div class="location-chart">
            {#each topBirthCounties as [county, count], i}
              <div class="location-row">
                <span class="location-rank">{i + 1}</span>
                <span class="location-name">{county}</span>
                <div class="location-bar-container">
                  <div class="location-bar birth" style="width: {(count / maxBirthCountyCount) * 100}%"></div>
                </div>
                <span class="location-count">{count}</span>
              </div>
            {/each}
            {#if topBirthCounties.length === 0}
              <p class="no-data">No birth county data available</p>
            {/if}
          </div>
        </div>

        <div class="location-chart-card">
          <h4>Birth Countries</h4>
          <p class="chart-subtitle clickable-hint">Click to filter gallery</p>
          <div class="location-chart">
            {#each topBirthCountries as [country, count], i}
              <button class="location-row clickable" on:click={() => filterByLocation('birthCountry', country)}>
                <span class="location-rank">{i + 1}</span>
                <span class="location-name country-flag">{country}</span>
                <div class="location-bar-container">
                  <div class="location-bar birth" style="width: {(count / maxBirthCountryCount) * 100}%"></div>
                </div>
                <span class="location-count">{count}</span>
              </button>
            {/each}
            {#if topBirthCountries.length === 0}
              <p class="no-data">No birth country data available</p>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Death Locations Tab -->
    {#if activeLocationTab === 'death'}
      <div class="location-charts-grid">
        <div class="location-chart-card">
          <h4>Top Death States</h4>
          <p class="chart-subtitle clickable-hint">Click to filter gallery</p>
          <div class="location-chart">
            {#each topDeathStates as [state, count], i}
              <button class="location-row clickable" on:click={() => filterByLocation('deathState', state)}>
                <span class="location-rank">{i + 1}</span>
                <span class="location-name">{state}</span>
                <div class="location-bar-container">
                  <div class="location-bar death" style="width: {(count / maxDeathStateCount) * 100}%"></div>
                </div>
                <span class="location-count">{count}</span>
              </button>
            {/each}
            {#if topDeathStates.length === 0}
              <p class="no-data">No death state data available</p>
            {/if}
          </div>
        </div>

        <div class="location-chart-card">
          <h4>Top Death Cities</h4>
          <p class="chart-subtitle clickable-hint">Click to filter gallery</p>
          <div class="location-chart">
            {#each topDeathCities as [city, count], i}
              <button class="location-row clickable" on:click={() => filterByLocation('deathCity', city)}>
                <span class="location-rank">{i + 1}</span>
                <span class="location-name">{city}</span>
                <div class="location-bar-container">
                  <div class="location-bar death" style="width: {(count / maxDeathCityCount) * 100}%"></div>
                </div>
                <span class="location-count">{count}</span>
              </button>
            {/each}
            {#if topDeathCities.length === 0}
              <p class="no-data">No death city data available</p>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Residences Tab -->
    {#if activeLocationTab === 'residence'}
      <div class="location-charts-grid">
        <div class="location-chart-card">
          <h4>Top Residence States</h4>
          <p class="chart-subtitle clickable-hint">Click to filter gallery • States where family members have lived</p>
          <div class="location-chart">
            {#each topResidenceStates as [state, count], i}
              <button class="location-row clickable" on:click={() => filterByLocation('residenceState', state)}>
                <span class="location-rank">{i + 1}</span>
                <span class="location-name">{state}</span>
                <div class="location-bar-container">
                  <div class="location-bar residence" style="width: {(count / maxResidenceStateCount) * 100}%"></div>
                </div>
                <span class="location-count">{count}</span>
              </button>
            {/each}
            {#if topResidenceStates.length === 0}
              <p class="no-data">No residence state data available</p>
            {/if}
          </div>
        </div>

        <div class="location-chart-card wide">
          <h4>Top Residence Cities</h4>
          <p class="chart-subtitle clickable-hint">Click to filter gallery • Cities where family members have lived</p>
          <div class="location-chart">
            {#each topResidenceCities as [city, count], i}
              <button class="location-row clickable" on:click={() => filterByLocation('residenceCity', city)}>
                <span class="location-rank">{i + 1}</span>
                <span class="location-name">{city}</span>
                <div class="location-bar-container">
                  <div class="location-bar residence" style="width: {(count / maxResidenceCityCount) * 100}%"></div>
                </div>
                <span class="location-count">{count}</span>
              </button>
            {/each}
            {#if topResidenceCities.length === 0}
              <p class="no-data">No residence city data available</p>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Migration Tab -->
    {#if activeLocationTab === 'migration'}
      <div class="migration-section">
        <div class="location-chart-card wide">
          <h4>Migration Patterns</h4>
          <p class="chart-subtitle">People who were born in one state and died in another</p>
          {#if topMigrations.length > 0}
            <div class="migration-chart">
              {#each topMigrations as pattern, i}
                <div class="migration-row">
                  <span class="location-rank">{i + 1}</span>
                  <div class="migration-flow">
                    <span class="migration-from">{pattern.from}</span>
                    <span class="migration-arrow">→</span>
                    <span class="migration-to">{pattern.to}</span>
                  </div>
                  <div class="location-bar-container">
                    <div class="location-bar migration" style="width: {(pattern.count / maxMigrationCount) * 100}%"></div>
                  </div>
                  <span class="location-count">{pattern.count} {pattern.count === 1 ? 'person' : 'people'}</span>
                </div>
              {/each}
            </div>
          {:else}
            <p class="no-data">No migration data available (requires both birth and death state information)</p>
          {/if}
        </div>

        {#if topMigrations.length > 0}
          <div class="migration-people-list">
            <h4>Recent Migrants</h4>
            <div class="migrants-grid">
              {#each migrationPatterns.flatMap(p => p.people).slice(0, 12) as person}
                <button class="migrant-card" on:click={() => selectPerson(person)}>
                  <div class="migrant-avatar {getGenderClass(person.sex)}">
                    {getInitials(person.name)}
                  </div>
                  <div class="migrant-info">
                    <span class="migrant-name">{person.name}</span>
                    <span class="migrant-journey">{person.birth_state} → {person.death_state}</span>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Advanced Statistics Section -->
  <div class="advanced-stats-section">
    <h2 class="section-title">
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M12 20V10M18 20V4M6 20v-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
      Advanced Analytics
    </h2>

    <!-- Stats Tabs -->
    <div class="stats-tabs">
      <button class="stats-tab" class:active={activeStatsTab === 'quality'} on:click={() => activeStatsTab = 'quality'}>
        🚩 Data Quality
        {#if impossibleDates.length + childrenBeforeParents.length + suspiciousAges.length > 0}
          <span class="tab-badge warning">{impossibleDates.length + childrenBeforeParents.length + suspiciousAges.length}</span>
        {/if}
      </button>
      <button class="stats-tab" class:active={activeStatsTab === 'lifespan'} on:click={() => activeStatsTab = 'lifespan'}>
        ⏳ Lifespan Analysis
      </button>
      <button class="stats-tab" class:active={activeStatsTab === 'patterns'} on:click={() => activeStatsTab = 'patterns'}>
        📅 Birth Patterns
      </button>
      <button class="stats-tab" class:active={activeStatsTab === 'family'} on:click={() => activeStatsTab = 'family'}>
        👨‍👩‍👧‍👦 Family Structure
      </button>
      <button class="stats-tab" class:active={activeStatsTab === 'timeline'} on:click={() => activeStatsTab = 'timeline'}>
        🗺️ Geographic Timeline
      </button>
    </div>

    <!-- Data Quality Tab -->
    {#if activeStatsTab === 'quality'}
      <div class="quality-dashboard">
        <!-- Summary Cards -->
        <div class="quality-summary">
          <div class="quality-card" class:has-issues={impossibleDates.length > 0}>
            <span class="quality-icon">⚠️</span>
            <span class="quality-count">{impossibleDates.length}</span>
            <span class="quality-label">Impossible Dates</span>
          </div>
          <div class="quality-card" class:has-issues={childrenBeforeParents.length > 0}>
            <span class="quality-icon">👶</span>
            <span class="quality-count">{childrenBeforeParents.length}</span>
            <span class="quality-label">Parent/Child Issues</span>
          </div>
          <div class="quality-card" class:has-issues={suspiciousAges.length > 0}>
            <span class="quality-icon">🔍</span>
            <span class="quality-count">{suspiciousAges.length}</span>
            <span class="quality-label">Suspicious Ages</span>
          </div>
          <div class="quality-card twins" class:has-issues={potentialTwins.length > 0}>
            <span class="quality-icon">👯</span>
            <span class="quality-count">{potentialTwins.length}</span>
            <span class="quality-label">Potential Twins</span>
          </div>
          <div class="quality-card" class:has-issues={missingCriticalData.length > 0}>
            <span class="quality-icon">📝</span>
            <span class="quality-count">{missingCriticalData.length}</span>
            <span class="quality-label">Missing Data</span>
          </div>
        </div>

        <!-- Impossible Dates -->
        {#if impossibleDates.length > 0}
          <div class="quality-section">
            <h4>⚠️ Death Before Birth ({impossibleDates.length})</h4>
            <div class="issue-list">
              {#each showAllImpossibleDates ? impossibleDates : impossibleDates.slice(0, 10) as item}
                <button class="issue-item" on:click={() => selectPerson(item)}>
                  <span class="issue-name">{item.name}</span>
                  <span class="issue-detail">Born {item.birthYear}, Died {item.deathYear}</span>
                </button>
              {/each}
              {#if impossibleDates.length > 10}
                <button class="show-more-btn" on:click={() => showAllImpossibleDates = !showAllImpossibleDates}>
                  {showAllImpossibleDates ? '← Show less' : `Show all ${impossibleDates.length} records →`}
                </button>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Children Before Parents -->
        {#if childrenBeforeParents.length > 0}
          <div class="quality-section">
            <h4>👶 Parent/Child Date Issues ({childrenBeforeParents.length})</h4>
            <div class="issue-list">
              {#each showAllChildrenBeforeParents ? childrenBeforeParents : childrenBeforeParents.slice(0, 10) as item}
                <div class="issue-item compound">
                  <button class="issue-person" on:click={() => selectPerson(item.child)}>
                    {item.child.name}
                  </button>
                  <span class="issue-detail">{item.issue}</span>
                </div>
              {/each}
              {#if childrenBeforeParents.length > 10}
                <button class="show-more-btn" on:click={() => showAllChildrenBeforeParents = !showAllChildrenBeforeParents}>
                  {showAllChildrenBeforeParents ? '← Show less' : `Show all ${childrenBeforeParents.length} records →`}
                </button>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Suspicious Ages -->
        {#if suspiciousAges.length > 0}
          <div class="quality-section">
            <h4>🔍 Suspicious Ages ({suspiciousAges.length})</h4>
            <div class="issue-list">
              {#each showAllSuspiciousAges ? suspiciousAges : suspiciousAges.slice(0, 15) as item}
                <button class="issue-item" on:click={() => selectPerson(item.person)}>
                  <span class="issue-name">{item.person.name}</span>
                  <span class="issue-detail">{item.issue}</span>
                  <span class="issue-type-badge {item.type}">{item.type.replace('-', ' ')}</span>
                </button>
              {/each}
              {#if suspiciousAges.length > 15}
                <button class="show-more-btn" on:click={() => showAllSuspiciousAges = !showAllSuspiciousAges}>
                  {showAllSuspiciousAges ? '← Show less' : `Show all ${suspiciousAges.length} records →`}
                </button>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Potential Twins -->
        {#if potentialTwins.length > 0}
          <div class="quality-section twins-section">
            <h4>👯 Potential Twins ({potentialTwins.length} pairs)</h4>
            <div class="twins-list">
              {#each showAllTwins ? potentialTwins : potentialTwins.slice(0, 10) as pair}
                <div class="twin-pair" class:same-date={pair.sameBirthDate}>
                  <button class="twin-person" on:click={() => selectPerson(pair.person1)}>
                    {pair.person1.name}
                  </button>
                  <span class="twin-connector">&</span>
                  <button class="twin-person" on:click={() => selectPerson(pair.person2)}>
                    {pair.person2.name}
                  </button>
                  <span class="twin-year">({pair.birthYear})</span>
                  {#if pair.sameBirthDate}
                    <span class="same-date-badge">Same date!</span>
                  {/if}
                </div>
              {/each}
              {#if potentialTwins.length > 10}
                <button class="show-more-btn" on:click={() => showAllTwins = !showAllTwins}>
                  {showAllTwins ? '← Show less' : `Show all ${potentialTwins.length} pairs →`}
                </button>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Missing Data -->
        {#if missingCriticalData.length > 0}
          <div class="quality-section">
            <h4>📝 Missing Critical Data ({missingCriticalData.length})</h4>
            <div class="issue-list">
              {#each showAllMissingData ? missingCriticalData : missingCriticalData.slice(0, 10) as item}
                <button class="issue-item" on:click={() => selectPerson(item.person)}>
                  <span class="issue-name">{item.person.name || '(No name)'}</span>
                  <span class="issue-detail">{item.missing.join(', ')}</span>
                </button>
              {/each}
              {#if missingCriticalData.length > 10}
                <button class="show-more-btn" on:click={() => showAllMissingData = !showAllMissingData}>
                  {showAllMissingData ? '← Show less' : `Show all ${missingCriticalData.length} records →`}
                </button>
              {/if}
            </div>
          </div>
        {/if}

        {#if impossibleDates.length === 0 && childrenBeforeParents.length === 0 && suspiciousAges.length === 0}
          <div class="all-clear">
            <span class="all-clear-icon">✅</span>
            <p>No major data quality issues found!</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Lifespan Analysis Tab -->
    {#if activeStatsTab === 'lifespan'}
      <div class="lifespan-dashboard">
        <!-- Oldest Ancestors -->
        <div class="oldest-ancestors-section">
          <h4>👴 Oldest Known Ancestors</h4>
          <p class="section-note">The earliest born individuals in your family tree</p>
          <div class="oldest-ancestors-grid">
            {#if oldestAncestors.oldestMale}
              <button class="oldest-ancestor-card male" on:click={() => selectPerson(oldestAncestors.oldestMale)}>
                <div class="ancestor-icon">♂</div>
                <div class="ancestor-info">
                  <span class="ancestor-label">Oldest Male</span>
                  <span class="ancestor-name">{oldestAncestors.oldestMale.name}</span>
                  <span class="ancestor-dates">
                    Born {oldestAncestors.oldestMale.birthYear}
                    {#if oldestAncestors.oldestMale.deathYear}
                      — Died {oldestAncestors.oldestMale.deathYear}
                    {/if}
                  </span>
                  {#if oldestAncestors.oldestMale.birth_place || oldestAncestors.oldestMale.birth_city}
                    <span class="ancestor-place">
                      📍 {oldestAncestors.oldestMale.birth_city || ''}{oldestAncestors.oldestMale.birth_city && oldestAncestors.oldestMale.birth_state ? ', ' : ''}{oldestAncestors.oldestMale.birth_state || oldestAncestors.oldestMale.birth_country || oldestAncestors.oldestMale.birth_place || ''}
                    </span>
                  {/if}
                </div>
                <div class="ancestor-year-badge">{oldestAncestors.oldestMale.birthYear}</div>
              </button>
            {:else}
              <div class="oldest-ancestor-card empty">
                <span class="no-data">No male ancestors with birth dates</span>
              </div>
            {/if}

            {#if oldestAncestors.oldestFemale}
              <button class="oldest-ancestor-card female" on:click={() => selectPerson(oldestAncestors.oldestFemale)}>
                <div class="ancestor-icon">♀</div>
                <div class="ancestor-info">
                  <span class="ancestor-label">Oldest Female</span>
                  <span class="ancestor-name">{oldestAncestors.oldestFemale.name}</span>
                  <span class="ancestor-dates">
                    Born {oldestAncestors.oldestFemale.birthYear}
                    {#if oldestAncestors.oldestFemale.deathYear}
                      — Died {oldestAncestors.oldestFemale.deathYear}
                    {/if}
                  </span>
                  {#if oldestAncestors.oldestFemale.birth_place || oldestAncestors.oldestFemale.birth_city}
                    <span class="ancestor-place">
                      📍 {oldestAncestors.oldestFemale.birth_city || ''}{oldestAncestors.oldestFemale.birth_city && oldestAncestors.oldestFemale.birth_state ? ', ' : ''}{oldestAncestors.oldestFemale.birth_state || oldestAncestors.oldestFemale.birth_country || oldestAncestors.oldestFemale.birth_place || ''}
                    </span>
                  {/if}
                </div>
                <div class="ancestor-year-badge">{oldestAncestors.oldestFemale.birthYear}</div>
              </button>
            {:else}
              <div class="oldest-ancestor-card empty">
                <span class="no-data">No female ancestors with birth dates</span>
              </div>
            {/if}
          </div>
        </div>

        <div class="lifespan-grid">
          <!-- Longest Lived -->
          <div class="lifespan-card">
            <h4>🏆 Longest Lives</h4>
            <div class="lifespan-list">
              {#each longestLived as person, i}
                <button class="lifespan-item" on:click={() => selectPerson(person)}>
                  <span class="lifespan-rank">{i + 1}</span>
                  <span class="lifespan-name">{person.name}</span>
                  <span class="lifespan-years">{person.lifespan} years</span>
                  <span class="lifespan-dates">{person.birthYear}–{person.deathYear}</span>
                </button>
              {/each}
            </div>
          </div>

          <!-- Shortest Lives -->
          <div class="lifespan-card">
            <h4>🕯️ Shortest Lives</h4>
            <p class="card-note">Early deaths and infant mortality</p>
            <div class="lifespan-list">
              {#each shortestLives as person, i}
                <button class="lifespan-item short" on:click={() => selectPerson(person)}>
                  <span class="lifespan-rank">{i + 1}</span>
                  <span class="lifespan-name">{person.name}</span>
                  <span class="lifespan-years">{person.lifespan === 0 ? '<1' : person.lifespan} {person.lifespan === 1 ? 'year' : 'years'}</span>
                  <span class="lifespan-dates">{person.birthYear}–{person.deathYear}</span>
                </button>
              {/each}
            </div>
          </div>
        </div>

        <!-- Average Lifespan by Century -->
        <div class="century-lifespan-card">
          <h4>📊 Average Lifespan by Birth Century</h4>
          <div class="century-lifespan-chart">
            {#each lifespanByCentury as century}
              <div class="century-lifespan-row">
                <span class="century-label">{century.label}</span>
                <div class="century-bar-container">
                  <div class="century-bar lifespan" style="width: {(century.average / maxLifespanAvg) * 100}%">
                    <span class="bar-value">{century.average} years</span>
                  </div>
                </div>
                <span class="century-count">({century.count} people)</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Birth Patterns Tab -->
    {#if activeStatsTab === 'patterns'}
      <div class="patterns-dashboard">
        <!-- Birth Month Distribution -->
        <div class="month-distribution-card">
          <h4>📅 Birth Month Distribution</h4>
          <p class="card-note">{totalBirthsWithMonth} births with month data</p>
          <div class="month-chart">
            {#each birthMonthDistribution as month}
              <div class="month-bar-wrapper">
                <div class="month-bar-vertical" style="height: {maxBirthMonth > 0 ? (month.count / maxBirthMonth) * 100 : 0}%"></div>
                <span class="month-label">{month.month}</span>
                <span class="month-count">{month.count}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Age at First Child -->
        <div class="first-child-card">
          <h4>👶 Average Age at First Child</h4>
          <div class="first-child-overall">
            {#if avgAgeAtFirstChild.female.avg}
              <div class="first-child-stat female">
                <span class="stat-icon">♀</span>
                <span class="stat-value">{avgAgeAtFirstChild.female.avg}</span>
                <span class="stat-label">years (mothers)</span>
                <span class="stat-count">{avgAgeAtFirstChild.female.count} records</span>
              </div>
            {/if}
            {#if avgAgeAtFirstChild.male.avg}
              <div class="first-child-stat male">
                <span class="stat-icon">♂</span>
                <span class="stat-value">{avgAgeAtFirstChild.male.avg}</span>
                <span class="stat-label">years (fathers)</span>
                <span class="stat-count">{avgAgeAtFirstChild.male.count} records</span>
              </div>
            {/if}
          </div>

          <!-- By Century -->
          {#if ageAtFirstChildByCentury.length > 0}
            <h5>By Birth Century</h5>
            <div class="first-child-by-century">
              {#each ageAtFirstChildByCentury as century}
                <div class="century-row">
                  <span class="century-label">{century.label}</span>
                  <div class="century-ages">
                    {#if century.femaleAvg}
                      <span class="age-badge female">♀ {century.femaleAvg}</span>
                    {/if}
                    {#if century.maleAvg}
                      <span class="age-badge male">♂ {century.maleAvg}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Generation Gap -->
        {#if generationStats.avgGenerationGap}
          <div class="generation-card">
            <h4>🔄 Average Generation Gap</h4>
            <div class="generation-stat">
              <span class="generation-value">{generationStats.avgGenerationGap}</span>
              <span class="generation-label">years between generations</span>
            </div>
            <p class="card-note">Based on {generationStats.gapCount} parent-child relationships</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Family Structure Tab -->
    {#if activeStatsTab === 'family'}
      <div class="family-structure-dashboard">
        <div class="family-grid">
          <!-- Most Descendants -->
          <div class="family-card">
            <h4>👑 Most Descendants</h4>
            <div class="descendants-list">
              {#each mostDescendants as person, i}
                <button class="descendant-item" on:click={() => selectPerson(person)}>
                  <span class="descendant-rank">{i + 1}</span>
                  <div class="descendant-avatar {getGenderClass(person.sex)}">
                    {getInitials(person.name)}
                  </div>
                  <div class="descendant-info">
                    <span class="descendant-name">{person.name}</span>
                    {#if extractYear(person.birth_date)}
                      <span class="descendant-dates">b. {extractYear(person.birth_date)}</span>
                    {/if}
                  </div>
                  <span class="descendant-count">{person.descendantCount}</span>
                </button>
              {/each}
            </div>
          </div>

          <!-- Longest Ancestor Chain -->
          {#if longestAncestorChain.person}
            <div class="family-card chain-card">
              <h4>🌳 Longest Ancestor Chain</h4>
              <p class="chain-depth">{longestAncestorChain.depth} generations back</p>
              <div class="ancestor-chain">
                {#each longestAncestorChain.chain as ancestor, i}
                  <button class="chain-person" on:click={() => selectPerson(ancestor)}>
                    <span class="chain-gen">{i === 0 ? 'Start' : `Gen ${i}`}</span>
                    <span class="chain-name">{ancestor.name}</span>
                    {#if extractYear(ancestor.birth_date)}
                      <span class="chain-year">{extractYear(ancestor.birth_date)}</span>
                    {/if}
                  </button>
                  {#if i < longestAncestorChain.chain.length - 1}
                    <span class="chain-arrow">↑</span>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- End of Lines -->
        <div class="end-of-lines-card">
          <h4>🍂 Family Lines That Ended ({endOfLines.length})</h4>
          <p class="card-note">Deceased individuals with no recorded descendants</p>
          <div class="end-lines-grid">
            {#each showAllEndOfLines ? endOfLines : endOfLines.slice(0, 20) as person}
              <button class="end-line-person" on:click={() => selectPerson(person)}>
                <div class="end-line-avatar {getGenderClass(person.sex)}">
                  {getInitials(person.name)}
                </div>
                <span class="end-line-name">{person.name}</span>
                {#if extractYear(person.death_date)}
                  <span class="end-line-year">d. {extractYear(person.death_date)}</span>
                {/if}
              </button>
            {/each}
          </div>
          {#if endOfLines.length > 20}
            <button class="show-more-btn" on:click={() => showAllEndOfLines = !showAllEndOfLines}>
              {showAllEndOfLines ? '← Show less' : `Show all ${endOfLines.length} records →`}
            </button>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Geographic Timeline Tab -->
    {#if activeStatsTab === 'timeline'}
      <div class="timeline-dashboard">
        <h4>🗺️ Where Family Members Were Born Over Time</h4>
        <p class="card-note">Birth locations by decade</p>
        
        <div class="geographic-timeline">
          {#each migrationTimeline as decade}
            <div class="timeline-decade">
              <span class="decade-marker">{decade.label}</span>
              <div class="decade-states">
                {#each decade.states.slice(0, 5) as [state, count]}
                  <button 
                    class="state-bubble" 
                    style="font-size: {Math.max(0.7, Math.min(1.2, 0.7 + count * 0.1))}rem"
                    on:click={() => filterByLocation('birthState', state)}
                    title="{count} born in {state} in the {decade.label}"
                  >
                    {state} <span class="bubble-count">({count})</span>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>

        {#if migrationTimeline.length === 0}
          <p class="no-data">No geographic timeline data available</p>
        {/if}
      </div>
    {/if}
  </div>

  <div class="surnames-section">
    <div class="chart-card surnames-card">
      <h3>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="2"/>
          <circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        Family Surnames
      </h3>
      <div class="surnames-summary">
        <div class="summary-stat">
          <span class="summary-value">{totalLastNames}</span>
          <span class="summary-label">Unique Surnames</span>
        </div>
        <div class="summary-stat">
          <span class="summary-value">{topLastNames[0]?.[0] || '—'}</span>
          <span class="summary-label">Most Common</span>
        </div>
      </div>
      <div class="surnames-chart">
        {#each topLastNames as [surname, count], i}
          <button class="surname-row clickable" on:click={() => filterByName(surname)} title="Click to filter gallery by {surname}">
            <span class="surname-rank">{i + 1}</span>
            <div class="surname-stats">
              <span class="surname-count">{count}</span>
              <span class="surname-percent">{((count / $statistics.total) * 100).toFixed(1)}%</span>
            </div>
            <div class="surname-info">
              <span class="surname-name">{surname}</span>
              <div class="surname-bar-container">
                <div 
                  class="surname-bar" 
                  style="width: {(count / maxLastNameCount) * 100}%"
                ></div>
              </div>
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- First Names Section -->
  <div class="firstnames-section">
    <div class="chart-card firstnames-card">
      <h3>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        Most Common First Names
      </h3>
      <div class="surnames-summary">
        <div class="summary-stat">
          <span class="summary-value">{totalFirstNames}</span>
          <span class="summary-label">Unique Names</span>
        </div>
        <div class="summary-stat">
          <span class="summary-value">{topFirstNames[0]?.[0] || '—'}</span>
          <span class="summary-label">Most Common</span>
        </div>
      </div>
      <div class="surnames-chart">
        {#each topFirstNames as [firstName, count], i}
          <div class="surname-row">
            <span class="surname-rank">{i + 1}</span>
            <div class="surname-stats">
              <span class="surname-count">{count}</span>
              <span class="surname-percent">{((count / $statistics.total) * 100).toFixed(1)}%</span>
            </div>
            <div class="surname-info">
              <span class="surname-name">{firstName}</span>
              <div class="surname-bar-container">
                <div 
                  class="surname-bar firstname-bar" 
                  style="width: {(count / maxFirstNameCount) * 100}%"
                ></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Notable Family Members Section -->
  <div class="notable-section">
    <div class="notable-grid">
      <!-- Most Children -->
      <div class="notable-card">
        <h3>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <circle cx="9" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="15" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M3 21v-2a4 4 0 0 1 4-4h2" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M15 15h2a4 4 0 0 1 4 4v2" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="12" cy="14" r="2" fill="currentColor"/>
          </svg>
          Most Children
        </h3>
        {#if mostChildren.length === 0}
          <p class="no-data">No data available</p>
        {:else}
          <div class="notable-list">
            {#each mostChildren as person, i}
              <button class="notable-person" on:click={() => selectPerson(person)}>
                <span class="notable-rank">#{i + 1}</span>
                <div class="notable-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
                  {getInitials(person.name)}
                </div>
                <div class="notable-info">
                  <span class="notable-name">{person.name}</span>
                  {#if person.birth_date}
                    <span class="notable-dates">{extractYear(person.birth_date) || ''}</span>
                  {/if}
                </div>
                <span class="notable-count">{person.childCount} 👶</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Most Spouses -->
      <div class="notable-card">
        <h3>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <circle cx="8" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
            <circle cx="16" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M3 21v-2a4 4 0 0 1 4-4h2" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M15 15h2a4 4 0 0 1 4 4v2" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M12 11v6M10 14h4" stroke="currentColor" stroke-width="2"/>
          </svg>
          Most Spouses
        </h3>
        {#if mostSpouses.length === 0}
          <p class="no-data">No one with multiple spouses found</p>
        {:else}
          <div class="notable-list">
            {#each mostSpouses as person, i}
              <button class="notable-person" on:click={() => selectPerson(person)}>
                <span class="notable-rank">#{i + 1}</span>
                <div class="notable-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
                  {getInitials(person.name)}
                </div>
                <div class="notable-info">
                  <span class="notable-name">{person.name}</span>
                  {#if person.birth_date}
                    <span class="notable-dates">{extractYear(person.birth_date) || ''}</span>
                  {/if}
                </div>
                <span class="notable-count">{person.spouseCount} 💍</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Living Centenarians Section -->
  <div class="centenarians-card">
    <h3>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
        <text x="12" y="16" text-anchor="middle" font-size="10" fill="currentColor" font-weight="bold">100</text>
      </svg>
      Centenarians Without Death Date
      {#if livingCentenarians.length > 0}
        <span class="centenarian-count">{livingCentenarians.length}</span>
      {/if}
    </h3>
    
    {#if livingCentenarians.length === 0}
      <div class="no-centenarians">
        <span class="check-icon">✓</span>
        <p>No records of people over 100 without death dates</p>
      </div>
    {:else}
      <p class="centenarians-intro">
        These individuals are recorded as being over 100 years old but have no death date. 
        They may need their records updated.
      </p>
      <div class="centenarians-list">
        {#each livingCentenarians as person}
          <button class="centenarian-person" on:click={() => selectPerson(person)}>
            <div class="centenarian-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
              {getInitials(person.name)}
            </div>
            <div class="centenarian-info">
              <span class="centenarian-name">{person.name}</span>
              <span class="centenarian-birth">Born: {person.birth_date}</span>
            </div>
            <div class="centenarian-age">
              <span class="age-number">{person.age}</span>
              <span class="age-label">years</span>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Immigrants Section -->
  <div class="immigrants-card">
    <h3>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
      Immigrants
      {#if $immigrants.length > 0}
        <span class="immigrants-count">{$immigrants.length}</span>
      {/if}
    </h3>
    
    {#if $immigrants.length === 0}
      <div class="no-immigrants">
        <span class="globe-icon">🌍</span>
        <p>No individuals have been marked as immigrants yet</p>
        <p class="hint">You can mark someone as an immigrant from their detail view</p>
      </div>
    {:else}
      <p class="immigrants-intro">
        These individuals have been identified as having immigrated during their lifetime.
      </p>
      
      <!-- Century Breakdown -->
      {#if immigrantsByCentury.length > 0}
        <div class="immigrants-century-chart">
          <h4>By Century</h4>
          <div class="century-bars">
            {#each immigrantsByCentury as [century, count]}
              <div class="immigrant-century-bar">
                <span class="immigrant-century-label">
                  {century === 'Unknown' ? 'Unknown' : `${century}s`}
                </span>
                <div class="immigrant-bar-container">
                  <div 
                    class="immigrant-bar" 
                    style="width: {century === 'Unknown' ? 30 : (count / maxImmigrantCenturyCount) * 100}%"
                  ></div>
                </div>
                <span class="immigrant-bar-value">{count}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="immigrants-list">
        {#each sortedImmigrants as person}
          <button class="immigrant-item" on:click={() => selectPerson(person)}>
            <div class="immigrant-avatar {getGenderClass(person.sex)}">
              {getInitials(person.name)}
            </div>
            <div class="immigrant-info">
              <span class="immigrant-name">{person.name}</span>
              {#if person.birth_date}
                <span class="immigrant-year">b. {extractYear(person.birth_date) || '?'}</span>
              {/if}
              {#if person.birth_place}
                <span class="immigrant-origin">From: {person.birth_place}</span>
              {/if}
              {#if person.immigrant_notes}
                <span class="immigrant-notes">{person.immigrant_notes}</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Disconnected Records Section -->
  <div class="disconnected-card">
    <div class="disconnected-header">
      <h3>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
        </svg>
        Disconnected Records
        {#if disconnectedRecords.length > 0}
          <span class="disconnected-count">{disconnectedRecords.length}</span>
        {/if}
      </h3>
      <!-- Remove All button hidden in public read-only interface -->
      {#if false && disconnectedRecords.length > 0}
        <button class="remove-all-btn" on:click={confirmDeleteAllDisconnected}>
          <svg viewBox="0 0 24 24" width="16" height="16">
            <polyline points="3 6 5 6 21 6" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
          Remove All
        </button>
      {/if}
    </div>

    <!-- Delete All Confirmation Dialog - Hidden in public read-only interface -->
    {#if false && showDeleteAllDisconnected}
      <div class="delete-all-overlay" on:click={cancelDeleteAllDisconnected}>
        <div class="delete-all-dialog" on:click|stopPropagation>
          <div class="delete-all-icon">
            <svg viewBox="0 0 24 24" width="48" height="48">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <h3>Remove All Disconnected Records?</h3>
          <p>You are about to permanently remove <strong>{disconnectedRecords.length} records</strong> that have no family connections.</p>
          <p class="delete-all-warning">
            ⚠️ This action cannot be undone. Make sure to download your data first if you want to keep a backup.
          </p>
          <div class="delete-all-actions">
            <button class="cancel-btn" on:click={cancelDeleteAllDisconnected} disabled={deletingDisconnected}>
              Cancel
            </button>
            <button class="confirm-delete-btn" on:click={executeDeleteAllDisconnected} disabled={deletingDisconnected}>
              {#if deletingDisconnected}
                Removing...
              {:else}
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <polyline points="3 6 5 6 21 6" fill="none" stroke="currentColor" stroke-width="2"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
                Remove {disconnectedRecords.length} Records
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}
    
    {#if disconnectedRecords.length === 0}
      <div class="no-disconnected">
        <span class="check-icon">✓</span>
        <p>All records are connected to the family tree</p>
      </div>
    {:else}
      <p class="disconnected-intro">
        These individuals have no parents and no children recorded — they are "dead ends" in the family tree. 
        They may have a spouse, but don't connect to other generations.
      </p>
      <div class="disconnected-list">
        {#each showAllDisconnected ? disconnectedRecords : disconnectedRecords.slice(0, 30) as person}
          <button class="disconnected-person" on:click={() => selectPerson(person)}>
            <div class="disconnected-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
              {getInitials(person.name)}
            </div>
            <div class="disconnected-info">
              <span class="disconnected-name">{person.name}</span>
              {#if person.birth_date}
                <span class="disconnected-dates">b. {extractYear(person.birth_date) || person.birth_date}</span>
              {:else}
                <span class="disconnected-dates no-date">No dates</span>
              {/if}
            </div>
          </button>
        {/each}
        {#if disconnectedRecords.length > 30}
          <button class="show-more-btn" on:click={() => showAllDisconnected = !showAllDisconnected}>
            {showAllDisconnected ? '← Show less' : `Show all ${disconnectedRecords.length} records →`}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- No Family of Own Section -->
  <div class="no-family-card">
    <h3>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="2"/>
        <line x1="18" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="2" opacity="0.4"/>
        <line x1="20" y1="6" x2="20" y2="10" stroke="currentColor" stroke-width="2" opacity="0.4"/>
      </svg>
      No Spouse or Children
      {#if noFamilyOfOwn.length > 0}
        <span class="no-family-count">{noFamilyOfOwn.length}</span>
      {/if}
    </h3>
    
    {#if noFamilyOfOwn.length === 0}
      <div class="no-results">
        <p>Everyone has a recorded spouse or children</p>
      </div>
    {:else}
      <p class="no-family-intro">
        These individuals have no spouse and no children recorded. They may have parents or siblings but never started their own family (or data is missing).
      </p>
      <div class="no-family-list">
        {#each showAllNoFamily ? noFamilyOfOwn : noFamilyOfOwn.slice(0, 30) as person}
          <button class="no-family-person" on:click={() => selectPerson(person)}>
            <div class="no-family-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
              {getInitials(person.name)}
            </div>
            <div class="no-family-info">
              <span class="no-family-name">{person.name}</span>
              {#if person.birth_date}
                <span class="no-family-dates">b. {extractYear(person.birth_date) || person.birth_date}</span>
              {:else}
                <span class="no-family-dates no-date">No dates</span>
              {/if}
            </div>
          </button>
        {/each}
        {#if noFamilyOfOwn.length > 30}
          <button class="show-more-btn" on:click={() => showAllNoFamily = !showAllNoFamily}>
            {showAllNoFamily ? '← Show less' : `Show all ${noFamilyOfOwn.length} records →`}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Children but No Spouse Section -->
  <div class="children-no-spouse-card">
    <h3>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <circle cx="9" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="19" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
        <line x1="17" y1="11" x2="21" y2="11" stroke="currentColor" stroke-width="2" opacity="0.3"/>
      </svg>
      Children but No Spouse
      {#if childrenNoSpouse.length > 0}
        <span class="children-no-spouse-count">{childrenNoSpouse.length}</span>
      {/if}
    </h3>
    
    {#if childrenNoSpouse.length === 0}
      <div class="no-results">
        <span class="check-icon">✓</span>
        <p>Everyone with children has a spouse recorded</p>
      </div>
    {:else}
      <p class="children-no-spouse-intro">
        These individuals have children recorded but no spouse. This may indicate missing spouse data, or they may have been single parents.
      </p>
      <div class="children-no-spouse-list">
        {#each showAllChildrenNoSpouse ? childrenNoSpouse : childrenNoSpouse.slice(0, 30) as person}
          <button class="children-no-spouse-person" on:click={() => selectPerson(person)}>
            <div class="children-no-spouse-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
              {getInitials(person.name)}
            </div>
            <div class="children-no-spouse-info">
              <span class="children-no-spouse-name">{person.name}</span>
              {#if person.birth_date}
                <span class="children-no-spouse-dates">b. {extractYear(person.birth_date) || person.birth_date}</span>
              {:else}
                <span class="children-no-spouse-dates no-date">No dates</span>
              {/if}
            </div>
            <span class="children-no-spouse-child-count">{person.childCount} 👶</span>
          </button>
        {/each}
        {#if childrenNoSpouse.length > 30}
          <button class="show-more-btn" on:click={() => showAllChildrenNoSpouse = !showAllChildrenNoSpouse}>
            {showAllChildrenNoSpouse ? '← Show less' : `Show all ${childrenNoSpouse.length} records →`}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- No Parents Section -->
  <div class="no-parents-card">
    <div class="no-parents-header">
      <h3>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <circle cx="12" cy="16" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M8 4h8M12 4v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
          <line x1="6" y1="2" x2="10" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
          <line x1="18" y1="2" x2="14" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
        </svg>
        No Parents Recorded
        {#if noParents.length > 0}
          <span class="no-parents-count">{noParents.length}</span>
        {/if}
      </h3>
      {#if noParents.length > 0}
        <div class="no-parents-sort">
          <span class="sort-label">Sort:</span>
          <button class:active={noParentsSortOrder === 'name'} on:click={() => noParentsSortOrder = 'name'}>
            Name
          </button>
          <button class:active={noParentsSortOrder === 'birth-old'} on:click={() => noParentsSortOrder = 'birth-old'}>
            Oldest
          </button>
          <button class:active={noParentsSortOrder === 'birth-new'} on:click={() => noParentsSortOrder = 'birth-new'}>
            Newest
          </button>
        </div>
      {/if}
    </div>
    
    {#if noParents.length === 0}
      <div class="no-results">
        <p>Everyone has at least one parent recorded</p>
      </div>
    {:else}
      <p class="no-parents-intro">
        These individuals have no parents recorded. They are either the oldest known ancestors in their line, or their parent data is missing.
      </p>
      <div class="no-parents-list">
        {#each showAllNoParents ? noParents : noParents.slice(0, 30) as person}
          <button class="no-parents-person" on:click={() => selectPerson(person)}>
            <div class="no-parents-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
              {getInitials(person.name)}
            </div>
            <div class="no-parents-info">
              <span class="no-parents-name">{person.name}</span>
              {#if person.birth_date}
                <span class="no-parents-dates">b. {extractYear(person.birth_date) || person.birth_date}</span>
              {:else}
                <span class="no-parents-dates no-date">No dates</span>
              {/if}
            </div>
          </button>
        {/each}
        {#if noParents.length > 30}
          <button class="show-more-btn" on:click={() => showAllNoParents = !showAllNoParents}>
            {showAllNoParents ? '← Show less' : `Show all ${noParents.length} records →`}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- No Dates Section -->
  <div class="no-dates-card">
    <div class="no-dates-header">
      <h3>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
          <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/>
          <line x1="9" y1="14" x2="15" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
          <line x1="9" y1="18" x2="15" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
        </svg>
        No Dates Recorded
        {#if noDates.length > 0}
          <span class="no-dates-count">{noDates.length}</span>
        {/if}
      </h3>
    </div>
    
    {#if noDates.length === 0}
      <div class="no-results">
        <span class="check-icon">✓</span>
        <p>Everyone has at least one date recorded</p>
      </div>
    {:else}
      <p class="no-dates-intro">
        These individuals have neither a birth date nor a death date recorded. Consider researching and adding date information.
      </p>
      <div class="no-dates-list">
        {#each showAllNoDates ? noDates : noDates.slice(0, 30) as person}
          <button class="no-dates-person" on:click={() => selectPerson(person)}>
            <div class="no-dates-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
              {getInitials(person.name)}
            </div>
            <div class="no-dates-info">
              <span class="person-name">{person.name || 'Unknown'}</span>
              {#if person.birth_place}
                <span class="person-place">{person.birth_place}</span>
              {/if}
            </div>
          </button>
        {/each}
        {#if noDates.length > 30}
          <button class="show-more-btn" on:click={() => showAllNoDates = !showAllNoDates}>
            {showAllNoDates ? '← Show less' : `Show all ${noDates.length} records →`}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- People with Notes Section -->
  <div class="with-notes-card">
    <div class="with-notes-header">
      <h3>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2"/>
          <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="2"/>
          <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="8" y1="17" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        People with Notes
        {#if peopleWithNotes.length > 0}
          <span class="with-notes-count">{peopleWithNotes.length}</span>
        {/if}
      </h3>
    </div>
    
    {#if peopleWithNotes.length === 0}
      <div class="no-results">
        <p>No one has notes recorded yet</p>
      </div>
    {:else}
      <p class="with-notes-intro">
        These individuals have additional notes or biographical information recorded. Click to view their details.
      </p>
      <div class="with-notes-list">
        {#each showAllWithNotes ? peopleWithNotes : peopleWithNotes.slice(0, 30) as person}
          <button class="with-notes-person" on:click={() => selectPerson(person)}>
            <div class="with-notes-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
              {getInitials(person.name)}
            </div>
            <div class="with-notes-info">
              <span class="person-name">{person.name || 'Unknown'}</span>
              <span class="notes-preview">{person.notes.slice(0, 50)}{person.notes.length > 50 ? '...' : ''}</span>
            </div>
          </button>
        {/each}
        {#if peopleWithNotes.length > 30}
          <button class="show-more-btn" on:click={() => showAllWithNotes = !showAllWithNotes}>
            {showAllWithNotes ? '← Show less' : `Show all ${peopleWithNotes.length} records →`}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Early Deaths Section -->
  <div class="early-deaths-card">
    <div class="early-deaths-header">
      <h3>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
          <line x1="12" y1="6" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="12" y1="12" x2="16" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Early Deaths (21 years or less)
        {#if earlyDeaths.length > 0}
          <span class="early-deaths-count">{earlyDeaths.length}</span>
        {/if}
      </h3>
    </div>
    
    {#if earlyDeaths.length === 0}
      <div class="no-results">
        <span class="check-icon">✓</span>
        <p>No early deaths recorded (all deceased individuals lived past 21 years)</p>
      </div>
    {:else}
      <p class="early-deaths-intro">
        These individuals died at age 21 or younger. Click to view their details.
      </p>
      <div class="early-deaths-list">
        {#each showAllEarlyDeaths ? earlyDeaths : earlyDeaths.slice(0, 30) as person}
          <button class="early-deaths-person" on:click={() => selectPerson(person)}>
            <div class="early-deaths-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
              {getInitials(person.name)}
            </div>
            <div class="early-deaths-info">
              <span class="person-name">{person.name || 'Unknown'}</span>
              <span class="age-info">
                Died at age {person.ageAtDeath} ({person.birthYear} - {person.deathYear})
              </span>
            </div>
          </button>
        {/each}
        {#if earlyDeaths.length > 30}
          <button class="show-more-btn" on:click={() => showAllEarlyDeaths = !showAllEarlyDeaths}>
            {showAllEarlyDeaths ? '← Show less' : `Show all ${earlyDeaths.length} records →`}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- First of Surname Section -->
  <div class="first-surname-card">
    <div class="first-surname-header">
      <h3>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M2 17l10 5 10-5" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M2 12l10 5 10-5" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        First of Each Surname
        {#if firstOfSurname.length > 0}
          <span class="first-surname-count">{firstOfSurname.length}</span>
        {/if}
      </h3>
    </div>
    
    {#if firstOfSurname.length === 0}
      <div class="no-results">
        <p>No surname data available</p>
      </div>
    {:else}
      <p class="first-surname-intro">
        These individuals are the earliest known person with their surname in the family tree (based on birth year). They represent the origin point for each family name.
      </p>
      <div class="first-surname-list">
        {#each showAllFirstSurnames ? firstOfSurname : firstOfSurname.slice(0, 30) as person}
          {@const lastName = extractLastName(person.name)}
          <button class="first-surname-person" on:click={() => selectPerson(person)}>
            <div class="first-surname-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
              {getInitials(person.name)}
            </div>
            <div class="first-surname-info">
              <span class="person-name">{person.name || 'Unknown'}</span>
              <div class="surname-badge">
                <span class="surname-label">First {lastName}</span>
                {#if person.birth_date}
                  <span class="surname-year">b. {extractYear(person.birth_date) || person.birth_date}</span>
                {/if}
              </div>
            </div>
          </button>
        {/each}
        {#if firstOfSurname.length > 30}
          <button class="show-more-btn" on:click={() => showAllFirstSurnames = !showAllFirstSurnames}>
            {showAllFirstSurnames ? '← Show less' : `Show all ${firstOfSurname.length} records →`}
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Most Widowed Section -->
  <div class="most-widowed-card">
    <div class="most-widowed-header">
      <h3>
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
        </svg>
        Most Widowed
        {#if mostWidowed.length > 0}
          <span class="most-widowed-count">{mostWidowed.length}</span>
        {/if}
      </h3>
    </div>
    
    {#if mostWidowed.length === 0}
      <div class="no-results">
        <p>No widowed individuals found</p>
      </div>
    {:else}
      <p class="most-widowed-intro">
        These individuals lost one or more spouses (spouse died before them). The count shows how many times each person was widowed.
      </p>
      
      {#if mostWidowedMale.length > 0}
        <div class="widowed-gender-section">
          <h4 class="gender-section-title">
            <span class="gender-icon male">♂</span>
            Most Widowed Men
          </h4>
          <div class="widowed-list">
            {#each showAllWidowed ? mostWidowedMale : mostWidowedMale.slice(0, 15) as person}
              <button class="widowed-person" on:click={() => selectPerson(person)}>
                <div class="widowed-avatar male">
                  {getInitials(person.name)}
                </div>
                <div class="widowed-info">
                  <span class="person-name">{person.name || 'Unknown'}</span>
                  <div class="widowed-details">
                    <span class="widowed-count-badge">{person.widowedCount} {person.widowedCount === 1 ? 'spouse lost' : 'spouses lost'}</span>
                    {#if person.widowedSpouses && person.widowedSpouses.length > 0}
                      <span class="widowed-spouses">
                        {person.widowedSpouses.map(s => s.name).join(', ')}
                      </span>
                    {/if}
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}
      
      {#if mostWidowedFemale.length > 0}
        <div class="widowed-gender-section">
          <h4 class="gender-section-title">
            <span class="gender-icon female">♀</span>
            Most Widowed Women
          </h4>
          <div class="widowed-list">
            {#each showAllWidowed ? mostWidowedFemale : mostWidowedFemale.slice(0, 15) as person}
              <button class="widowed-person" on:click={() => selectPerson(person)}>
                <div class="widowed-avatar female">
                  {getInitials(person.name)}
                </div>
                <div class="widowed-info">
                  <span class="person-name">{person.name || 'Unknown'}</span>
                  <div class="widowed-details">
                    <span class="widowed-count-badge">{person.widowedCount} {person.widowedCount === 1 ? 'spouse lost' : 'spouses lost'}</span>
                    {#if person.widowedSpouses && person.widowedSpouses.length > 0}
                      <span class="widowed-spouses">
                        {person.widowedSpouses.map(s => s.name).join(', ')}
                      </span>
                    {/if}
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}
      
      {#if (mostWidowedMale.length > 15 || mostWidowedFemale.length > 15)}
        <button class="show-more-btn" on:click={() => showAllWidowed = !showAllWidowed}>
          {showAllWidowed ? '← Show less' : `Show all widowed individuals →`}
        </button>
      {/if}
    {/if}
  </div>

  <div class="gender-ratio-card">
    <h3>Gender Ratio</h3>
    <div class="ratio-bar">
      <div 
        class="ratio-segment male" 
        style="width: {($statistics.male / ($statistics.male + $statistics.female)) * 100}%"
      >
        <span>Male {(($statistics.male / ($statistics.male + $statistics.female)) * 100).toFixed(0)}%</span>
      </div>
      <div 
        class="ratio-segment female" 
        style="width: {($statistics.female / ($statistics.male + $statistics.female)) * 100}%"
      >
        <span>Female {(($statistics.female / ($statistics.male + $statistics.female)) * 100).toFixed(0)}%</span>
      </div>
    </div>
  </div>

  <!-- Potential Duplicates Section -->
  <div class="duplicates-card">
    <h3>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
        <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2"/>
      </svg>
      Potential Duplicates
      {#if potentialDuplicates.length > 0}
        <span class="duplicate-count">{potentialDuplicates.length} found</span>
      {/if}
    </h3>
    
    {#if potentialDuplicates.length === 0}
      <div class="no-duplicates">
        <span class="check-icon">✓</span>
        <p>No potential duplicates detected</p>
      </div>
    {:else}
      <p class="duplicates-intro">
        The following records may be duplicates based on similar names and birth dates. 
        Click on a person to view their details.
      </p>
      <div class="duplicates-list">
        {#each showAllDuplicates ? potentialDuplicates : potentialDuplicates.slice(0, 20) as group, i}
          <div class="duplicate-group">
            <div class="duplicate-header">
              <span class="group-number">#{i + 1}</span>
              <span class="similarity-badge" class:high={group.similarity > 0.9} class:medium={group.similarity > 0.7 && group.similarity <= 0.9}>
                {Math.round(group.similarity * 100)}% match
              </span>
              <span class="reason">{group.reason}</span>
            </div>
            <div class="duplicate-people">
              {#each group.people as person}
                <button class="duplicate-person" on:click={() => selectPerson(person)}>
                  <div class="person-avatar" class:male={person.sex === 'M'} class:female={person.sex === 'F'}>
                    {getInitials(person.name)}
                  </div>
                  <div class="person-info">
                    <span class="person-name">{person.name}</span>
                    <span class="person-dates">
                      {#if person.birth_date}b. {person.birth_date}{/if}
                      {#if person.death_date} — d. {person.death_date}{/if}
                    </span>
                    {#if person.birth_place}
                      <span class="person-place">{person.birth_place}</span>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/each}
        {#if potentialDuplicates.length > 20}
          <button class="show-more-btn" on:click={() => showAllDuplicates = !showAllDuplicates}>
            {showAllDuplicates ? '← Show less' : `Show all ${potentialDuplicates.length} duplicates →`}
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .statistics-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    text-align: center;
    border: 1px solid var(--border-subtle);
    transition: all 0.2s ease;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-soft);
  }

  .stat-card.highlight {
    background: linear-gradient(135deg, var(--bg-card) 0%, rgba(212, 168, 83, 0.1) 100%);
    border-color: rgba(212, 168, 83, 0.3);
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 1rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated);
    color: var(--accent-gold);
  }

  .stat-icon.male {
    background: rgba(74, 124, 155, 0.2);
    color: #4a7c9b;
    font-size: 1.5rem;
  }

  .stat-icon.female {
    background: rgba(155, 107, 138, 0.2);
    color: #9b6b8a;
    font-size: 1.5rem;
  }

  .stat-icon.living {
    background: rgba(122, 158, 126, 0.2);
    color: var(--accent-sage);
  }

  .stat-icon.deceased {
    background: rgba(139, 126, 111, 0.2);
    color: var(--text-muted);
    font-size: 1.3rem;
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: 2.2rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-percent {
    font-size: 0.8rem;
    color: var(--accent-soft);
    margin-top: 0.25rem;
  }

  .charts-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .chart-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
  }

  .chart-card h3 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1.25rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .century-chart {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .century-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .century-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    min-width: 50px;
  }

  .bar-container {
    flex: 1;
    height: 24px;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-gold) 0%, var(--accent-copper) 100%);
    border-radius: var(--radius-sm);
    transition: width 0.5s ease;
  }

  .bar-value {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    min-width: 40px;
    text-align: right;
  }

  .places-chart {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .place-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .place-rank {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .place-row:nth-child(-n+3) .place-rank {
    background: var(--accent-gold);
    color: var(--bg-deep);
  }

  .place-info {
    flex: 1;
    min-width: 0;
  }

  .place-name {
    font-size: 0.85rem;
    color: var(--text-primary);
    display: block;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .place-bar-container {
    height: 6px;
    background: var(--bg-elevated);
    border-radius: 3px;
    overflow: hidden;
  }

  .place-bar {
    height: 100%;
    background: var(--accent-sage);
    border-radius: 3px;
    transition: width 0.5s ease;
  }

  .place-count {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    min-width: 30px;
    text-align: right;
  }

  /* ============== LOCATION STATISTICS STYLES ============== */
  
  .location-stats-section {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
  }

  .location-stats-section .section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1.5rem 0;
  }

  .location-stats-section .section-title svg {
    color: var(--accent-gold);
  }

  /* Coverage Card */
  .coverage-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .coverage-card h3 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 1rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .coverage-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
  }

  .coverage-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .coverage-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    min-width: 90px;
  }

  .coverage-bar-container {
    flex: 1;
    height: 6px;
    background: var(--bg-card);
    border-radius: 3px;
    overflow: hidden;
  }

  .coverage-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-sage) 0%, #9bc49e 100%);
    border-radius: 3px;
    transition: width 0.5s ease;
  }

  .coverage-bar.death {
    background: linear-gradient(90deg, #8b7e6f 0%, #a69485 100%);
  }

  .coverage-bar.residence {
    background: linear-gradient(90deg, #4a7c9b 0%, #6a9cbb 100%);
  }

  .coverage-value {
    font-size: 0.75rem;
    color: var(--text-secondary);
    min-width: 80px;
    text-align: right;
  }

  /* Location Tabs */
  .location-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .location-tab {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 1rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 0.85rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .location-tab:hover {
    background: var(--bg-card);
    color: var(--text-primary);
  }

  .location-tab.active {
    background: var(--accent-gold);
    color: var(--bg-primary);
    border-color: var(--accent-gold);
    font-weight: 600;
  }

  .tab-icon {
    font-size: 1rem;
  }

  /* Location Charts Grid */
  .location-charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .location-chart-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1.25rem;
  }

  .location-chart-card.wide {
    grid-column: 1 / -1;
  }

  .location-chart-card h4 {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .location-chart-card .chart-subtitle {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0 0 1rem 0;
  }

  .location-chart {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .location-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    background: transparent;
    border: none;
    padding: 0;
    font-family: var(--font-body);
    text-align: left;
  }

  .location-row.clickable {
    cursor: pointer;
    padding: 0.4rem 0.5rem;
    margin: -0.4rem -0.5rem;
    border-radius: var(--radius-sm);
    transition: all 0.15s ease;
  }

  .location-row.clickable:hover {
    background: var(--bg-card);
    transform: translateX(4px);
  }

  .location-row.clickable:hover .location-name {
    color: var(--accent-gold);
  }

  .clickable-hint {
    color: var(--accent-sage) !important;
    font-size: 0.75rem !important;
  }

  .location-rank {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    width: 20px;
    text-align: center;
  }

  .location-name {
    font-size: 0.85rem;
    color: var(--text-primary);
    width: 160px;
    min-width: 160px;
    max-width: 160px;
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .location-name.country-flag {
    font-weight: 500;
  }

  .location-bar-container {
    flex: 1;
    height: 8px;
    background: var(--bg-card);
    border-radius: 4px;
    overflow: hidden;
    min-width: 60px;
  }

  .location-bar {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s ease;
  }

  .location-bar.birth {
    background: linear-gradient(90deg, var(--accent-sage) 0%, #9bc49e 100%);
  }

  .location-bar.death {
    background: linear-gradient(90deg, #8b7e6f 0%, #a69485 100%);
  }

  .location-bar.residence {
    background: linear-gradient(90deg, #4a7c9b 0%, #6a9cbb 100%);
  }

  .location-bar.migration {
    background: linear-gradient(90deg, var(--accent-gold) 0%, #e8c464 100%);
  }

  .location-count {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
    width: 40px;
    min-width: 40px;
    flex-shrink: 0;
    text-align: right;
  }

  /* Migration Section */
  .migration-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .migration-chart {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .migration-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .migration-flow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 200px;
  }

  .migration-from {
    font-size: 0.85rem;
    color: var(--accent-sage);
    font-weight: 500;
  }

  .migration-arrow {
    font-size: 1rem;
    color: var(--text-muted);
  }

  .migration-to {
    font-size: 0.85rem;
    color: var(--accent-gold);
    font-weight: 500;
  }

  .migration-people-list h4 {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
  }

  .migrants-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.75rem;
  }

  .migrant-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    font-family: var(--font-body);
  }

  .migrant-card:hover {
    border-color: var(--accent-gold);
    transform: translateY(-2px);
  }

  .migrant-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .migrant-avatar.male {
    background: linear-gradient(135deg, #4a7c9b 0%, #2d5a7b 100%);
  }

  .migrant-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .migrant-avatar.unknown {
    background: linear-gradient(135deg, #8b7e6f 0%, #6b5e4f 100%);
  }

  .migrant-info {
    flex: 1;
    min-width: 0;
  }

  .migrant-name {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .migrant-journey {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .no-data {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
    padding: 1rem;
  }

  /* ============== END LOCATION STATISTICS STYLES ============== */

  /* ============== ADVANCED STATISTICS STYLES ============== */

  .advanced-stats-section {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
    margin-top: 1.5rem;
  }

  .advanced-stats-section .section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1.5rem 0;
  }

  .advanced-stats-section .section-title svg {
    color: var(--accent-sage);
  }

  /* Stats Tabs */
  .stats-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .stats-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 0.85rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .stats-tab:hover {
    background: var(--bg-card);
    color: var(--text-primary);
  }

  .stats-tab.active {
    background: var(--accent-sage);
    color: white;
    border-color: var(--accent-sage);
    font-weight: 600;
  }

  .tab-badge {
    font-size: 0.7rem;
    padding: 0.15rem 0.4rem;
    border-radius: 10px;
    font-weight: 600;
  }

  .tab-badge.warning {
    background: var(--accent-copper);
    color: white;
  }

  /* Quality Dashboard */
  .quality-dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .quality-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .quality-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem 1.5rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    border: 2px solid transparent;
    min-width: 120px;
  }

  .quality-card.has-issues {
    border-color: var(--accent-copper);
    background: rgba(181, 101, 67, 0.1);
  }

  .quality-card.twins.has-issues {
    border-color: var(--accent-sage);
    background: rgba(139, 169, 131, 0.1);
  }

  .quality-icon {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .quality-count {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-display);
  }

  .quality-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
  }

  .quality-section {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1rem;
  }

  .quality-section h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.75rem 0;
  }

  .issue-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .issue-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    font-family: var(--font-body);
    width: 100%;
  }

  .issue-item:hover {
    border-color: var(--accent-gold);
    transform: translateX(4px);
  }

  .issue-item.compound {
    flex-wrap: wrap;
  }

  .issue-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .issue-detail {
    font-size: 0.8rem;
    color: var(--text-muted);
    flex: 1;
  }

  .issue-person {
    background: none;
    border: none;
    color: var(--accent-gold);
    font-family: var(--font-body);
    font-weight: 500;
    cursor: pointer;
    padding: 0;
  }

  .issue-person:hover {
    text-decoration: underline;
  }

  .issue-type-badge {
    font-size: 0.65rem;
    padding: 0.2rem 0.5rem;
    border-radius: 10px;
    background: var(--bg-elevated);
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .issue-type-badge.extreme-age { background: rgba(181, 101, 67, 0.2); color: var(--accent-copper); }
  .issue-type-badge.young-parent { background: rgba(181, 101, 67, 0.3); color: var(--accent-copper); }
  .issue-type-badge.old-mother { background: rgba(181, 101, 67, 0.2); color: var(--accent-copper); }
  .issue-type-badge.old-parent { background: rgba(181, 101, 67, 0.2); color: var(--accent-copper); }
  .issue-type-badge.spouse-gap { background: rgba(212, 168, 83, 0.2); color: var(--accent-gold); }

  .show-more-btn {
    display: block;
    width: 100%;
    padding: 0.6rem 1rem;
    margin-top: 0.5rem;
    background: linear-gradient(135deg, rgba(212, 168, 83, 0.1) 0%, rgba(212, 168, 83, 0.05) 100%);
    border: 1px dashed var(--accent-gold);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.85rem;
    color: var(--accent-gold);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  .show-more-btn:hover {
    background: var(--accent-gold);
    color: var(--bg-deep);
    border-style: solid;
  }

  .more-issues {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
    margin-top: 0.5rem;
  }

  /* Twins Section */
  .twins-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .twin-pair {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    flex-wrap: wrap;
  }

  .twin-pair.same-date {
    border-color: var(--accent-sage);
    background: rgba(139, 169, 131, 0.1);
  }

  .twin-person {
    background: none;
    border: none;
    color: var(--accent-gold);
    font-family: var(--font-body);
    font-weight: 500;
    cursor: pointer;
    padding: 0;
  }

  .twin-person:hover {
    text-decoration: underline;
  }

  .twin-connector {
    color: var(--text-muted);
  }

  .twin-year {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .same-date-badge {
    font-size: 0.7rem;
    background: var(--accent-sage);
    color: white;
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    font-weight: 600;
  }

  .all-clear {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    background: rgba(139, 169, 131, 0.1);
    border-radius: var(--radius-md);
    border: 1px solid var(--accent-sage);
  }

  .all-clear-icon {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }

  .all-clear p {
    color: var(--accent-sage);
    font-weight: 500;
  }

  /* Lifespan Dashboard */
  .lifespan-dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .oldest-ancestors-section {
    background: linear-gradient(135deg, rgba(212, 168, 83, 0.08) 0%, rgba(122, 158, 126, 0.05) 100%);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 1.25rem;
  }

  .oldest-ancestors-section h4 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .oldest-ancestors-section .section-note {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  .oldest-ancestors-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .oldest-ancestor-card {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
    font-family: var(--font-body);
    position: relative;
    overflow: hidden;
  }

  .oldest-ancestor-card:hover {
    border-color: var(--accent-gold);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .oldest-ancestor-card.male {
    border-left: 4px solid #4a7c9b;
  }

  .oldest-ancestor-card.female {
    border-left: 4px solid #c47a9b;
  }

  .oldest-ancestor-card.empty {
    cursor: default;
    opacity: 0.5;
  }

  .oldest-ancestor-card.empty:hover {
    transform: none;
    box-shadow: none;
  }

  .ancestor-icon {
    font-size: 1.5rem;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .oldest-ancestor-card.male .ancestor-icon {
    background: rgba(74, 124, 155, 0.2);
    color: #4a7c9b;
  }

  .oldest-ancestor-card.female .ancestor-icon {
    background: rgba(196, 122, 155, 0.2);
    color: #c47a9b;
  }

  .ancestor-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .ancestor-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .ancestor-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ancestor-dates {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .ancestor-place {
    font-size: 0.8rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ancestor-year-badge {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: var(--accent-gold);
    color: var(--bg-deep);
    font-family: var(--font-display);
    font-size: 0.9rem;
    font-weight: 700;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
  }

  .lifespan-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .lifespan-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1rem;
  }

  .lifespan-card h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .card-note {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 0 0 0.75rem 0;
  }

  .lifespan-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .lifespan-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    font-family: var(--font-body);
    width: 100%;
  }

  .lifespan-item:hover {
    border-color: var(--accent-gold);
  }

  .lifespan-item.short {
    border-left: 3px solid var(--accent-copper);
  }

  .lifespan-rank {
    font-size: 0.75rem;
    color: var(--text-muted);
    width: 20px;
    text-align: center;
  }

  .lifespan-name {
    flex: 1;
    font-size: 0.85rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lifespan-years {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--accent-sage);
  }

  .lifespan-item.short .lifespan-years {
    color: var(--accent-copper);
  }

  .lifespan-dates {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  /* Century Lifespan Chart */
  .century-lifespan-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1rem;
  }

  .century-lifespan-card h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
  }

  .century-lifespan-chart {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .century-lifespan-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .century-lifespan-row .century-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    min-width: 60px;
  }

  .century-lifespan-row .century-bar-container {
    flex: 1;
    height: 24px;
    background: var(--bg-card);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .century-bar.lifespan {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-sage) 0%, #9bc49e 100%);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 0.5rem;
    min-width: 60px;
  }

  .century-bar .bar-value {
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
  }

  .century-count {
    font-size: 0.75rem;
    color: var(--text-muted);
    min-width: 80px;
  }

  /* Birth Patterns */
  .patterns-dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .month-distribution-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1rem;
    grid-column: 1 / -1;
  }

  .month-distribution-card h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
  }

  .month-chart {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    height: 150px;
    padding-top: 1rem;
    gap: 0.25rem;
  }

  .month-bar-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    height: 100%;
  }

  .month-bar-vertical {
    width: 100%;
    max-width: 40px;
    background: linear-gradient(180deg, var(--accent-gold) 0%, #e8c464 100%);
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    margin-top: auto;
    min-height: 4px;
    transition: height 0.5s ease;
  }

  .month-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }

  .month-count {
    font-size: 0.65rem;
    color: var(--text-secondary);
    font-weight: 600;
  }

  /* First Child Card */
  .first-child-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1rem;
  }

  .first-child-card h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.75rem 0;
  }

  .first-child-card h5 {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 1rem 0 0.5rem 0;
  }

  .first-child-overall {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .first-child-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 1.5rem;
    background: var(--bg-card);
    border-radius: var(--radius-sm);
    border: 2px solid transparent;
  }

  .first-child-stat.female {
    border-color: rgba(155, 107, 138, 0.3);
  }

  .first-child-stat.male {
    border-color: rgba(74, 124, 155, 0.3);
  }

  .first-child-stat .stat-icon {
    font-size: 1.2rem;
    margin-bottom: 0.25rem;
  }

  .first-child-stat.female .stat-icon { color: #9b6b8a; }
  .first-child-stat.male .stat-icon { color: #4a7c9b; }

  .first-child-stat .stat-value {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-display);
  }

  .first-child-stat .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .first-child-stat .stat-count {
    font-size: 0.65rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }

  .first-child-by-century {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .first-child-by-century .century-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .first-child-by-century .century-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    min-width: 50px;
  }

  .century-ages {
    display: flex;
    gap: 0.5rem;
  }

  .age-badge {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: 10px;
    font-weight: 500;
  }

  .age-badge.female {
    background: rgba(155, 107, 138, 0.2);
    color: #9b6b8a;
  }

  .age-badge.male {
    background: rgba(74, 124, 155, 0.2);
    color: #4a7c9b;
  }

  /* Generation Card */
  .generation-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1rem;
    text-align: center;
  }

  .generation-card h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.75rem 0;
  }

  .generation-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .generation-value {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--accent-gold);
    font-family: var(--font-display);
  }

  .generation-label {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  /* Family Structure Dashboard */
  .family-structure-dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .family-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .family-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1rem;
  }

  .family-card h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.75rem 0;
  }

  .descendants-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .descendant-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    font-family: var(--font-body);
    width: 100%;
  }

  .descendant-item:hover {
    border-color: var(--accent-gold);
  }

  .descendant-rank {
    font-size: 0.75rem;
    color: var(--text-muted);
    width: 20px;
    text-align: center;
  }

  .descendant-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 600;
    color: white;
  }

  .descendant-avatar.male { background: linear-gradient(135deg, #4a7c9b 0%, #2d5a7b 100%); }
  .descendant-avatar.female { background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%); }
  .descendant-avatar.unknown { background: linear-gradient(135deg, #8b7e6f 0%, #6b5e4f 100%); }

  .descendant-info {
    flex: 1;
    min-width: 0;
  }

  .descendant-name {
    display: block;
    font-size: 0.85rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .descendant-dates {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .descendant-count {
    font-size: 1rem;
    font-weight: 700;
    color: var(--accent-gold);
    min-width: 40px;
    text-align: right;
  }

  /* Ancestor Chain */
  .chain-card {
    max-height: 500px;
    overflow-y: auto;
  }

  .chain-depth {
    font-size: 0.9rem;
    color: var(--accent-sage);
    font-weight: 600;
    margin: 0 0 0.75rem 0;
  }

  .ancestor-chain {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .chain-person {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    font-family: var(--font-body);
    width: 100%;
  }

  .chain-person:hover {
    border-color: var(--accent-gold);
  }

  .chain-gen {
    font-size: 0.65rem;
    color: var(--text-muted);
    background: var(--bg-elevated);
    padding: 0.15rem 0.4rem;
    border-radius: 8px;
  }

  .chain-name {
    flex: 1;
    font-size: 0.85rem;
    color: var(--text-primary);
  }

  .chain-year {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .chain-arrow {
    color: var(--accent-sage);
    font-size: 1rem;
  }

  /* End of Lines */
  .end-of-lines-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1rem;
  }

  .end-of-lines-card h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
  }

  .end-lines-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .end-line-person {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    font-family: var(--font-body);
  }

  .end-line-person:hover {
    border-color: var(--accent-copper);
  }

  .end-line-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .end-line-avatar.male { background: linear-gradient(135deg, #4a7c9b 0%, #2d5a7b 100%); }
  .end-line-avatar.female { background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%); }
  .end-line-avatar.unknown { background: linear-gradient(135deg, #8b7e6f 0%, #6b5e4f 100%); }

  .end-line-name {
    flex: 1;
    font-size: 0.8rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .end-line-year {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  /* Geographic Timeline */
  .timeline-dashboard {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1rem;
  }

  .timeline-dashboard h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
  }

  .geographic-timeline {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .timeline-decade {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background: var(--bg-card);
    border-radius: var(--radius-sm);
  }

  .decade-marker {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--accent-gold);
    min-width: 50px;
  }

  .decade-states {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .state-bubble {
    padding: 0.25rem 0.5rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 15px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font-body);
  }

  .state-bubble:hover {
    background: var(--accent-sage);
    color: white;
    border-color: var(--accent-sage);
  }

  .bubble-count {
    font-size: 0.7em;
    opacity: 0.8;
  }

  /* ============== END ADVANCED STATISTICS STYLES ============== */

  .gender-ratio-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
  }

  .gender-ratio-card h3 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }

  .ratio-bar {
    display: flex;
    height: 48px;
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .ratio-segment {
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.9rem;
    font-weight: 500;
    transition: width 0.5s ease;
  }

  .ratio-segment.male {
    background: linear-gradient(90deg, #2d5a7b, #4a7c9b);
  }

  .ratio-segment.female {
    background: linear-gradient(90deg, #7b4a6a, #9b6b8a);
  }

  .ratio-segment span {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .surnames-section {
    margin-bottom: 0;
  }

  .surnames-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
  }

  .surnames-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .surnames-card h3 svg {
    color: var(--accent-gold);
  }

  .surnames-summary {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.25rem;
    padding: 1rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
  }

  .summary-stat {
    display: flex;
    flex-direction: column;
  }

  .summary-value {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent-gold);
  }

  .summary-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .surnames-chart {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .surname-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.35rem 0;
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    font-family: inherit;
  }

  .surname-row.clickable {
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: 0.5rem;
    margin: -0.15rem 0;
    transition: all 0.15s ease;
  }

  .surname-row.clickable:hover {
    background: var(--bg-elevated);
  }

  .surname-row.clickable:hover .surname-name {
    color: var(--accent-gold);
  }

  .surname-rank {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .surname-row:nth-child(-n+3) .surname-rank {
    background: var(--accent-copper);
    color: white;
  }

  .surname-info {
    flex: 1;
    min-width: 0;
  }

  .surname-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
    display: block;
    margin-bottom: 0.2rem;
  }

  .surname-bar-container {
    height: 6px;
    background: var(--bg-elevated);
    border-radius: 3px;
    overflow: hidden;
  }

  .surname-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-copper) 0%, var(--accent-gold) 100%);
    border-radius: 3px;
    transition: width 0.5s ease;
  }

  .surname-stats {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 55px;
    flex-shrink: 0;
  }

  .surname-count {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .surname-percent {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  @media (max-width: 600px) {
    .ratio-segment span {
      font-size: 0.75rem;
    }

    .surnames-summary {
      flex-direction: column;
      gap: 1rem;
    }
  }

  /* Duplicates Section */
  .duplicates-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
  }

  .duplicates-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }

  .duplicates-card h3 svg {
    color: var(--accent-copper);
  }

  .duplicate-count {
    font-size: 0.8rem;
    background: var(--accent-copper);
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 500;
    margin-left: auto;
  }

  .no-duplicates {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .check-icon {
    font-size: 2rem;
    color: var(--accent-sage);
    margin-bottom: 0.5rem;
  }

  .duplicates-intro {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .duplicates-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 600px;
    overflow-y: auto;
  }

  .duplicate-group {
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    padding: 1rem;
    border-left: 3px solid var(--accent-copper);
  }

  .duplicate-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .group-number {
    font-weight: 600;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .similarity-badge {
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    background: var(--bg-card);
    color: var(--text-muted);
  }

  .similarity-badge.high {
    background: rgba(196, 122, 90, 0.2);
    color: var(--accent-copper);
  }

  .similarity-badge.medium {
    background: rgba(212, 168, 83, 0.2);
    color: var(--accent-gold);
  }

  .reason {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .duplicate-people {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .duplicate-person {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.6rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    flex: 1;
    min-width: 200px;
    max-width: 300px;
  }

  .duplicate-person:hover {
    border-color: var(--accent-gold);
    transform: translateY(-2px);
  }

  .person-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .person-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .person-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .person-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .person-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .person-dates {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .person-place {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .more-duplicates {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
    font-style: italic;
    padding: 1rem;
  }

  /* First Names Section */
  .firstnames-section {
    margin-top: 1rem;
  }

  .firstnames-card h3 svg {
    color: var(--accent-sage);
  }

  .firstname-bar {
    background: linear-gradient(90deg, var(--accent-sage) 0%, #9bc49e 100%) !important;
  }

  /* Notable Section (Most Children / Most Spouses) */
  .notable-section {
    margin-top: 1rem;
  }

  .notable-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .notable-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
  }

  .notable-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .notable-card h3 svg {
    color: var(--accent-gold);
  }

  .notable-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .notable-person {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem;
    background: var(--bg-elevated);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .notable-person:hover {
    border-color: var(--accent-gold);
    transform: translateX(4px);
  }

  .notable-rank {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    min-width: 24px;
  }

  .notable-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .notable-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .notable-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .notable-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .notable-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .notable-dates {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .notable-count {
    font-size: 1rem;
    font-weight: 600;
    color: var(--accent-gold);
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .no-data {
    color: var(--text-muted);
    font-size: 0.9rem;
    padding: 1.5rem;
    text-align: center;
  }

  /* Centenarians Section */
  .centenarians-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
    border-left: 3px solid var(--accent-gold);
  }

  .centenarians-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }

  .centenarians-card h3 svg {
    color: var(--accent-gold);
  }

  .centenarian-count {
    font-size: 0.8rem;
    background: var(--accent-gold);
    color: var(--bg-deep);
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
    margin-left: auto;
  }

  .no-centenarians {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .centenarians-intro {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    line-height: 1.5;
    padding: 0.75rem;
    background: rgba(212, 168, 83, 0.1);
    border-radius: var(--radius-sm);
  }

  .centenarians-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .centenarian-person {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .centenarian-person:hover {
    border-color: var(--accent-gold);
    transform: translateY(-2px);
  }

  .centenarian-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .centenarian-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .centenarian-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .centenarian-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .centenarian-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .centenarian-birth {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .centenarian-age {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.3rem 0.6rem;
    background: var(--accent-gold);
    color: var(--bg-deep);
    border-radius: var(--radius-sm);
    min-width: 50px;
  }

  .centenarian-age .age-number {
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 700;
    line-height: 1;
  }

  .centenarian-age .age-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Immigrants Section */
  .immigrants-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
    border-left: 3px solid var(--accent-sage);
  }

  .immigrants-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }

  .immigrants-card h3 svg {
    color: var(--accent-sage);
  }

  .immigrants-count {
    font-size: 0.8rem;
    background: var(--accent-sage);
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
  }

  .no-immigrants {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--text-muted);
  }

  .no-immigrants .globe-icon {
    font-size: 2.5rem;
    display: block;
    margin-bottom: 0.75rem;
    opacity: 0.7;
  }

  .no-immigrants p {
    margin: 0.25rem 0;
  }

  .no-immigrants .hint {
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .immigrants-intro {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  .immigrants-century-chart {
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .immigrants-century-chart h4 {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .century-bars {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .immigrant-century-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .immigrant-century-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    min-width: 70px;
    font-weight: 500;
  }

  .immigrant-bar-container {
    flex: 1;
    height: 20px;
    background: var(--bg-card);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .immigrant-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-sage) 0%, #9bc49e 100%);
    border-radius: var(--radius-sm);
    transition: width 0.5s ease;
    min-width: 4px;
  }

  .immigrant-bar-value {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    min-width: 30px;
    text-align: right;
  }

  .immigrants-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .immigrant-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .immigrant-item:hover {
    background: var(--bg-card);
    border-color: var(--accent-sage);
    transform: translateX(4px);
  }

  .immigrant-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .immigrant-avatar.male {
    background: rgba(74, 124, 155, 0.2);
    color: var(--accent-steel);
  }

  .immigrant-avatar.female {
    background: rgba(155, 107, 138, 0.2);
    color: var(--accent-rose);
  }

  .immigrant-avatar.unknown {
    background: var(--bg-elevated);
    color: var(--text-muted);
  }

  .immigrant-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .immigrant-name {
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .immigrant-year {
    font-size: 0.75rem;
    color: var(--accent-gold);
    font-weight: 500;
  }

  .immigrant-origin {
    font-size: 0.8rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .immigrant-item .immigrant-notes {
    font-size: 0.75rem;
    color: var(--accent-sage);
    font-style: italic;
  }

  /* Disconnected Records Section */
  .disconnected-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
    border-left: 3px solid var(--accent-sage);
    position: relative;
  }

  .disconnected-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .disconnected-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }

  .disconnected-card h3 svg {
    color: var(--accent-sage);
  }

  .disconnected-count {
    font-size: 0.8rem;
    background: var(--accent-sage);
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
  }

  .remove-all-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--accent-copper);
    border-radius: var(--radius-sm);
    color: var(--accent-copper);
    font-family: var(--font-body);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .remove-all-btn:hover {
    background: var(--accent-copper);
    color: white;
  }

  .remove-all-btn svg {
    flex-shrink: 0;
  }

  /* Delete All Confirmation Dialog */
  .delete-all-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .delete-all-dialog {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 2rem;
    max-width: 480px;
    width: 90%;
    text-align: center;
    border: 1px solid var(--border-subtle);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  }

  .delete-all-icon {
    color: var(--accent-copper);
    margin-bottom: 1rem;
  }

  .delete-all-dialog h3 {
    font-family: var(--font-display);
    font-size: 1.4rem;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }

  .delete-all-dialog > p {
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
  }

  .delete-all-warning {
    padding: 0.75rem;
    background: rgba(196, 122, 90, 0.15);
    border: 1px solid var(--accent-copper);
    border-radius: var(--radius-sm);
    color: var(--accent-copper);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .delete-all-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }

  .delete-all-actions .cancel-btn {
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .delete-all-actions .cancel-btn:hover:not(:disabled) {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .delete-all-actions .confirm-delete-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--accent-copper);
    border: none;
    border-radius: var(--radius-sm);
    color: white;
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .delete-all-actions .confirm-delete-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .delete-all-actions .confirm-delete-btn:disabled,
  .delete-all-actions .cancel-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .no-disconnected {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .disconnected-intro {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    line-height: 1.5;
    padding: 0.75rem;
    background: rgba(122, 158, 126, 0.1);
    border-radius: var(--radius-sm);
  }

  .disconnected-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .disconnected-person {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .disconnected-person:hover {
    border-color: var(--accent-sage);
    transform: translateY(-2px);
  }

  .disconnected-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .disconnected-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .disconnected-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .disconnected-info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .disconnected-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .disconnected-dates {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .disconnected-dates.no-date {
    font-style: italic;
    opacity: 0.7;
  }

  .more-disconnected {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-style: italic;
    padding: 0.75rem;
  }

  /* No Family of Own Section */
  .no-family-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
    border-left: 3px solid var(--accent-copper);
  }

  .no-family-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .no-family-card h3 svg {
    color: var(--accent-copper);
  }

  .no-family-count {
    font-size: 0.8rem;
    background: var(--accent-copper);
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
  }

  .no-family-intro {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .no-family-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.5rem;
  }

  .no-family-person {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    transition: all 0.15s ease;
  }

  .no-family-person:hover {
    border-color: var(--accent-copper);
    background: rgba(196, 122, 90, 0.1);
  }

  .no-family-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    background: #6a6a6a;
    flex-shrink: 0;
  }

  .no-family-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .no-family-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .no-family-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .no-family-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .no-family-dates {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .no-family-dates.no-date {
    font-style: italic;
    opacity: 0.7;
  }

  .more-no-family {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-style: italic;
    padding: 0.75rem;
  }

  /* Children but No Spouse Section */
  .children-no-spouse-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
    border-left: 3px solid #b8860b;
  }

  .children-no-spouse-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .children-no-spouse-card h3 svg {
    color: #b8860b;
  }

  .children-no-spouse-count {
    font-size: 0.8rem;
    background: #b8860b;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
  }

  .children-no-spouse-intro {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
    line-height: 1.5;
    padding: 0.75rem;
    background: rgba(184, 134, 11, 0.1);
    border-radius: var(--radius-sm);
  }

  .children-no-spouse-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .children-no-spouse-person {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    transition: all 0.15s ease;
  }

  .children-no-spouse-person:hover {
    border-color: #b8860b;
    background: rgba(184, 134, 11, 0.1);
  }

  .children-no-spouse-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    background: #6a6a6a;
    flex-shrink: 0;
  }

  .children-no-spouse-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .children-no-spouse-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .children-no-spouse-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .children-no-spouse-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .children-no-spouse-dates {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .children-no-spouse-dates.no-date {
    font-style: italic;
    opacity: 0.7;
  }

  .children-no-spouse-child-count {
    font-size: 0.9rem;
    font-weight: 600;
    color: #b8860b;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    flex-shrink: 0;
  }

  .more-children-no-spouse {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-style: italic;
    padding: 0.75rem;
  }

  /* No Parents Section */
  .no-parents-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
    border-left: 3px solid #7a9e7e;
  }

  .no-parents-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .no-parents-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary);
  }

  .no-parents-sort {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .no-parents-sort .sort-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-right: 0.5rem;
  }

  .no-parents-sort button {
    padding: 0.35rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .no-parents-sort button:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .no-parents-sort button.active {
    background: #7a9e7e;
    border-color: #7a9e7e;
    color: white;
  }

  .no-parents-card h3 svg {
    color: #7a9e7e;
  }

  .no-parents-count {
    font-size: 0.8rem;
    background: #7a9e7e;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
  }

  .no-parents-intro {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .no-parents-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.5rem;
  }

  .no-parents-person {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    transition: all 0.15s ease;
  }

  .no-parents-person:hover {
    border-color: #7a9e7e;
    background: rgba(122, 158, 126, 0.1);
  }

  .no-parents-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    background: #6a6a6a;
    flex-shrink: 0;
  }

  .no-parents-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .no-parents-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .no-parents-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .no-parents-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .no-parents-dates {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .no-parents-dates.no-date {
    font-style: italic;
    opacity: 0.7;
  }

  .more-no-parents {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-style: italic;
    padding: 0.75rem;
  }

  /* No Dates Section */
  .no-dates-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
  }

  .no-dates-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .no-dates-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary);
    font-family: var(--font-display);
    font-weight: 600;
  }

  .no-dates-card h3 svg {
    color: #c9873d;
  }

  .no-dates-count {
    font-size: 0.8rem;
    background: #c9873d;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
  }

  .no-dates-intro {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .no-dates-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.5rem;
  }

  .no-dates-person {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    transition: all 0.15s ease;
  }

  .no-dates-person:hover {
    border-color: #c9873d;
    background: rgba(201, 135, 61, 0.1);
  }

  .no-dates-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    background: #6a6a6a;
    flex-shrink: 0;
  }

  .no-dates-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .no-dates-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .no-dates-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .no-dates-info .person-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .no-dates-info .person-place {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* People with Notes Section */
  .with-notes-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
  }

  .with-notes-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .with-notes-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary);
    font-family: var(--font-display);
    font-weight: 600;
  }

  .with-notes-card h3 svg {
    color: #6b8cce;
  }

  .with-notes-count {
    font-size: 0.8rem;
    background: #6b8cce;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
  }

  .with-notes-intro {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .with-notes-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.5rem;
  }

  .with-notes-person {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    transition: all 0.15s ease;
  }

  .with-notes-person:hover {
    border-color: #6b8cce;
    background: rgba(107, 140, 206, 0.1);
  }

  .with-notes-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    background: #6a6a6a;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .with-notes-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .with-notes-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .with-notes-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 0.2rem;
  }

  .with-notes-info .person-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .with-notes-info .notes-preview {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Early Deaths Section */
  .early-deaths-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
    margin-top: 1.5rem;
  }

  .early-deaths-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .early-deaths-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .early-deaths-card h3 svg {
    color: var(--accent-copper);
  }

  .early-deaths-count {
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.2rem 0.5rem;
    background: var(--accent-copper);
    color: white;
    border-radius: var(--radius-sm);
  }

  .early-deaths-intro {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .early-deaths-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.5rem;
  }

  .early-deaths-person {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .early-deaths-person:hover {
    border-color: var(--accent-copper);
    background: rgba(181, 101, 67, 0.1);
  }

  .early-deaths-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.85rem;
    flex-shrink: 0;
    background: var(--bg-main);
    color: var(--text-primary);
  }

  .early-deaths-avatar.male {
    background: rgba(94, 122, 148, 0.2);
    color: var(--accent-blue);
  }

  .early-deaths-avatar.female {
    background: rgba(155, 107, 138, 0.2);
    color: var(--accent-purple);
  }

  .early-deaths-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }

  .early-deaths-info .person-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .early-deaths-info .age-info {
    font-size: 0.8rem;
    color: var(--accent-copper);
    font-weight: 500;
  }

  /* First of Surname Section */
  .first-surname-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
  }

  .first-surname-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .first-surname-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary);
    font-family: var(--font-display);
    font-weight: 600;
  }

  .first-surname-card h3 svg {
    color: #8b7e9b;
  }

  .first-surname-count {
    font-size: 0.8rem;
    background: #8b7e9b;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
  }

  .first-surname-intro {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .first-surname-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.5rem;
  }

  .first-surname-person {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    transition: all 0.15s ease;
  }

  .first-surname-person:hover {
    border-color: #8b7e9b;
    background: rgba(139, 126, 155, 0.1);
  }

  .first-surname-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    background: #6a6a6a;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .first-surname-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .first-surname-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .first-surname-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 0.3rem;
  }

  .first-surname-info .person-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .surname-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .surname-label {
    font-size: 0.75rem;
    background: rgba(139, 126, 155, 0.2);
    color: #8b7e9b;
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    font-weight: 600;
  }

  .surname-year {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
  }

  /* Most Widowed Section */
  .most-widowed-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    border: 1px solid var(--border-subtle);
  }

  .most-widowed-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .most-widowed-card h3 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary);
    font-family: var(--font-display);
    font-weight: 600;
  }

  .most-widowed-card h3 svg {
    color: #9b8a6b;
  }

  .most-widowed-count {
    font-size: 0.8rem;
    background: #9b8a6b;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-weight: 600;
  }

  .most-widowed-intro {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  .widowed-gender-section {
    margin-bottom: 1.5rem;
  }

  .widowed-gender-section:last-child {
    margin-bottom: 0;
  }

  .gender-section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
    font-family: var(--font-display);
  }

  .gender-icon {
    font-size: 1.2rem;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-weight: bold;
  }

  .gender-icon.male {
    background: rgba(94, 122, 148, 0.2);
    color: #5e7a94;
  }

  .gender-icon.female {
    background: rgba(155, 107, 138, 0.2);
    color: #9b6b8a;
  }

  .widowed-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.5rem;
  }

  .widowed-person {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    transition: all 0.15s ease;
  }

  .widowed-person:hover {
    border-color: #9b8a6b;
    background: rgba(155, 138, 107, 0.1);
  }

  .widowed-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .widowed-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .widowed-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .widowed-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 0.3rem;
  }

  .widowed-info .person-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .widowed-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .widowed-count-badge {
    font-size: 0.75rem;
    background: rgba(155, 138, 107, 0.2);
    color: #9b8a6b;
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    font-weight: 600;
    display: inline-block;
    width: fit-content;
  }

  .widowed-spouses {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

