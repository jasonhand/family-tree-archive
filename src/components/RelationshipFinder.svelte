<script>
  import { familyData, familyRelationships, selectedPerson } from '../stores/familyStore.js';

  let person1 = null;
  let person2 = null;
  let searchQuery1 = '';
  let searchQuery2 = '';
  let showSearch1 = true;
  let showSearch2 = true;
  let relationshipPath = null;
  let relationshipDescription = '';

  $: searchResults1 = searchQuery1.length >= 2
    ? $familyData.filter(p => p.name?.toLowerCase().includes(searchQuery1.toLowerCase())).slice(0, 8)
    : [];

  $: searchResults2 = searchQuery2.length >= 2
    ? $familyData.filter(p => p.name?.toLowerCase().includes(searchQuery2.toLowerCase()) && p.id !== person1?.id).slice(0, 8)
    : [];

  function selectPerson1(person) {
    person1 = person;
    searchQuery1 = '';
    showSearch1 = false;
    if (person2) findRelationship();
  }

  function selectPerson2(person) {
    person2 = person;
    searchQuery2 = '';
    showSearch2 = false;
    if (person1) findRelationship();
  }

  function resetPerson1() {
    person1 = null;
    showSearch1 = true;
    relationshipPath = null;
    relationshipDescription = '';
  }

  function resetPerson2() {
    person2 = null;
    showSearch2 = true;
    relationshipPath = null;
    relationshipDescription = '';
  }

  function swapPersons() {
    const temp = person1;
    person1 = person2;
    person2 = temp;
    if (person1 && person2) findRelationship();
  }

  // Find the relationship path using BFS
  function findRelationship() {
    if (!person1 || !person2) return;

    const visited = new Set();
    const queue = [[person1, [{ person: person1, relation: 'self' }]]];
    
    while (queue.length > 0) {
      const [current, path] = queue.shift();
      
      if (current.id === person2.id) {
        relationshipPath = path;
        relationshipDescription = describeRelationship(path);
        return;
      }
      
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      
      const rels = $familyRelationships[current.id];
      if (!rels) continue;
      
      // Add parents
      if (rels.parents) {
        for (const parent of rels.parents) {
          if (!visited.has(parent.id)) {
            queue.push([parent, [...path, { person: parent, relation: 'parent' }]]);
          }
        }
      }
      
      // Add children
      if (rels.children) {
        for (const child of rels.children) {
          if (!visited.has(child.id)) {
            queue.push([child, [...path, { person: child, relation: 'child' }]]);
          }
        }
      }
      
      // Add spouses
      if (rels.spouses) {
        for (const spouse of rels.spouses) {
          if (!visited.has(spouse.id)) {
            queue.push([spouse, [...path, { person: spouse, relation: 'spouse' }]]);
          }
        }
      }
      
      // Add siblings
      if (rels.siblings) {
        for (const sibling of rels.siblings) {
          if (!visited.has(sibling.id)) {
            queue.push([sibling, [...path, { person: sibling, relation: 'sibling' }]]);
          }
        }
      }
    }
    
    // No path found
    relationshipPath = null;
    relationshipDescription = 'No direct family connection found';
  }

  function describeRelationship(path) {
    if (path.length === 1) return 'Same person';
    if (path.length === 2) {
      const rel = path[1].relation;
      if (rel === 'parent') return person1.sex === 'F' ? 'Mother' : person1.sex === 'M' ? 'Father' : 'Parent';
      if (rel === 'child') return person2.sex === 'F' ? 'Daughter' : person2.sex === 'M' ? 'Son' : 'Child';
      if (rel === 'spouse') return 'Spouse';
      if (rel === 'sibling') return person2.sex === 'F' ? 'Sister' : person2.sex === 'M' ? 'Brother' : 'Sibling';
    }

    // Analyze the path to determine relationship
    const relations = path.slice(1).map(p => p.relation);
    
    // Count generations up and down
    let up = 0;
    let down = 0;
    let hasSpouse = false;
    let hasSibling = false;
    let siblingIndex = -1;
    
    relations.forEach((rel, i) => {
      if (rel === 'parent') up++;
      else if (rel === 'child') down++;
      else if (rel === 'spouse') hasSpouse = true;
      else if (rel === 'sibling') {
        hasSibling = true;
        siblingIndex = i;
      }
    });

    // Direct ancestor/descendant
    if (!hasSibling && !hasSpouse && down === 0) {
      if (up === 2) return person2.sex === 'F' ? 'Grandmother' : person2.sex === 'M' ? 'Grandfather' : 'Grandparent';
      if (up === 3) return person2.sex === 'F' ? 'Great-Grandmother' : person2.sex === 'M' ? 'Great-Grandfather' : 'Great-Grandparent';
      if (up === 4) return person2.sex === 'F' ? 'Great-Great-Grandmother' : person2.sex === 'M' ? 'Great-Great-Grandfather' : 'Great-Great-Grandparent';
      if (up > 4) return `${up - 2}x Great-Grand${person2.sex === 'F' ? 'mother' : person2.sex === 'M' ? 'father' : 'parent'}`;
    }
    
    if (!hasSibling && !hasSpouse && up === 0) {
      if (down === 2) return person2.sex === 'F' ? 'Granddaughter' : person2.sex === 'M' ? 'Grandson' : 'Grandchild';
      if (down === 3) return person2.sex === 'F' ? 'Great-Granddaughter' : person2.sex === 'M' ? 'Great-Grandson' : 'Great-Grandchild';
      if (down === 4) return person2.sex === 'F' ? 'Great-Great-Granddaughter' : person2.sex === 'M' ? 'Great-Great-Grandson' : 'Great-Great-Grandchild';
      if (down > 4) return `${down - 2}x Great-Grand${person2.sex === 'F' ? 'daughter' : person2.sex === 'M' ? 'son' : 'child'}`;
    }

    // Aunts/Uncles/Niblings
    if (hasSibling && up === 1 && down === 0) {
      return person2.sex === 'F' ? 'Aunt' : person2.sex === 'M' ? 'Uncle' : 'Aunt/Uncle';
    }
    
    if (hasSibling && up === 0 && down === 1) {
      return person2.sex === 'F' ? 'Niece' : person2.sex === 'M' ? 'Nephew' : 'Niece/Nephew';
    }

    // Great aunts/uncles
    if (hasSibling && up === 2 && down === 0) {
      return person2.sex === 'F' ? 'Great-Aunt' : person2.sex === 'M' ? 'Great-Uncle' : 'Great-Aunt/Uncle';
    }
    
    if (hasSibling && up === 0 && down === 2) {
      return person2.sex === 'F' ? 'Grand-Niece' : person2.sex === 'M' ? 'Grand-Nephew' : 'Grand-Niece/Nephew';
    }

    // Cousins
    if (hasSibling && up > 0 && down > 0) {
      const cousinDegree = Math.min(up, down);
      const removed = Math.abs(up - down);
      
      let cousinLabel = '';
      if (cousinDegree === 1) cousinLabel = '1st Cousin';
      else if (cousinDegree === 2) cousinLabel = '2nd Cousin';
      else if (cousinDegree === 3) cousinLabel = '3rd Cousin';
      else cousinLabel = `${cousinDegree}th Cousin`;
      
      if (removed > 0) {
        cousinLabel += ` ${removed}x Removed`;
      }
      
      return cousinLabel;
    }

    // In-laws through spouse
    if (hasSpouse) {
      const spouseIndex = relations.indexOf('spouse');
      const beforeSpouse = relations.slice(0, spouseIndex);
      const afterSpouse = relations.slice(spouseIndex + 1);
      
      if (beforeSpouse.length === 0) {
        // Person2 is related to person1's spouse
        if (afterSpouse.length === 1 && afterSpouse[0] === 'parent') {
          return person2.sex === 'F' ? 'Mother-in-Law' : person2.sex === 'M' ? 'Father-in-Law' : 'Parent-in-Law';
        }
        if (afterSpouse.length === 1 && afterSpouse[0] === 'sibling') {
          return person2.sex === 'F' ? 'Sister-in-Law' : person2.sex === 'M' ? 'Brother-in-Law' : 'Sibling-in-Law';
        }
      }
      
      if (afterSpouse.length === 0) {
        // Person1 is the spouse of someone related to person2
        if (beforeSpouse.length === 1 && beforeSpouse[0] === 'child') {
          return person2.sex === 'F' ? 'Daughter-in-Law' : person2.sex === 'M' ? 'Son-in-Law' : 'Child-in-Law';
        }
      }
      
      return 'Related by Marriage';
    }

    // Fallback
    return `Related (${path.length - 1} steps)`;
  }

  function getRelationLabel(relation, person) {
    const sex = person.sex;
    switch (relation) {
      case 'parent': return sex === 'F' ? 'Mother' : sex === 'M' ? 'Father' : 'Parent';
      case 'child': return sex === 'F' ? 'Daughter' : sex === 'M' ? 'Son' : 'Child';
      case 'spouse': return 'Spouse';
      case 'sibling': return sex === 'F' ? 'Sister' : sex === 'M' ? 'Brother' : 'Sibling';
      default: return relation;
    }
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

  function getBirthYear(person) {
    return person?.birth_date?.match(/\d{4}/)?.[0] || '';
  }

  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }

  // Timeline data for the connection path
  $: timelineData = (() => {
    if (!relationshipPath || relationshipPath.length === 0) {
      return { people: [], minYear: 1900, maxYear: 2020 };
    }

    let minYear = Infinity;
    let maxYear = -Infinity;
    const currentYear = new Date().getFullYear();

    const people = relationshipPath.map((step, index) => {
      const birthYear = extractYear(step.person.birth_date);
      const deathYear = extractYear(step.person.death_date);
      const endYear = deathYear || currentYear;
      
      if (birthYear) {
        minYear = Math.min(minYear, birthYear);
        maxYear = Math.max(maxYear, endYear);
      }

      return {
        ...step.person,
        birthYear,
        deathYear,
        endYear: birthYear ? endYear : null,
        isLiving: birthYear && !step.person.death_date,
        relation: step.relation,
        index
      };
    });

    // Pad the timeline range
    if (minYear !== Infinity) {
      minYear = Math.floor(minYear / 10) * 10;
      maxYear = Math.ceil(maxYear / 10) * 10;
    } else {
      minYear = 1900;
      maxYear = currentYear;
    }

    return { people, minYear, maxYear };
  })();

  // Generate year markers for timeline
  $: yearMarkers = (() => {
    const markers = [];
    const range = timelineData.maxYear - timelineData.minYear;
    const step = range > 100 ? 20 : range > 50 ? 10 : 5;
    for (let year = timelineData.minYear; year <= timelineData.maxYear; year += step) {
      markers.push(year);
    }
    return markers;
  })();

  // Calculate position percentage on timeline
  function getTimelinePosition(year) {
    const range = timelineData.maxYear - timelineData.minYear;
    if (range === 0) return 0;
    return ((year - timelineData.minYear) / range) * 100;
  }

  // Calculate bar width percentage
  function getBarWidth(startYear, endYear) {
    const range = timelineData.maxYear - timelineData.minYear;
    if (range === 0) return 0;
    return ((endYear - startYear) / range) * 100;
  }

  // Find overlap periods between consecutive people
  $: overlapPeriods = (() => {
    if (!timelineData.people || timelineData.people.length < 2) return [];
    
    const overlaps = [];
    for (let i = 0; i < timelineData.people.length - 1; i++) {
      const person1 = timelineData.people[i];
      const person2 = timelineData.people[i + 1];
      
      if (person1.birthYear && person2.birthYear) {
        const overlapStart = Math.max(person1.birthYear, person2.birthYear);
        const overlapEnd = Math.min(person1.endYear, person2.endYear);
        
        if (overlapStart < overlapEnd) {
          overlaps.push({
            startYear: overlapStart,
            endYear: overlapEnd,
            duration: overlapEnd - overlapStart,
            person1Name: person1.name?.split(' ')[0],
            person2Name: person2.name?.split(' ')[0]
          });
        } else {
          overlaps.push({
            startYear: null,
            endYear: null,
            duration: 0,
            person1Name: person1.name?.split(' ')[0],
            person2Name: person2.name?.split(' ')[0],
            gap: overlapStart - overlapEnd
          });
        }
      } else {
        overlaps.push(null);
      }
    }
    return overlaps;
  })();

  // Check if any lifespan data exists
  $: hasTimelineData = timelineData.people.some(p => p.birthYear);
</script>

<div class="finder-container">
  <header class="finder-header">
    <div class="header-icon">
      <svg viewBox="0 0 24 24" width="28" height="28">
        <circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="16" cy="16" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <h2>Relationship Finder</h2>
    <p>Select two family members to discover how they're connected</p>
  </header>

  <div class="person-selectors">
    <!-- Person 1 Selector -->
    <div class="selector-card">
      <div class="selector-label">First Person</div>
      
      {#if person1 && !showSearch1}
        <div class="selected-person">
          <div class="person-avatar {getGenderClass(person1.sex)}">
            {getInitials(person1.name)}
          </div>
          <div class="person-info">
            <span class="person-name">{person1.name}</span>
            {#if getBirthYear(person1)}
              <span class="person-year">b. {getBirthYear(person1)}</span>
            {/if}
          </div>
          <button class="change-btn" on:click={resetPerson1}>Change</button>
        </div>
      {:else}
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18">
            <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2"/>
          </svg>
          <input 
            type="text" 
            placeholder="Search by name..."
            bind:value={searchQuery1}
          />
        </div>
        
        {#if searchResults1.length > 0}
          <div class="search-results">
            {#each searchResults1 as person}
              <button class="result-item" on:click={() => selectPerson1(person)}>
                <div class="result-avatar {getGenderClass(person.sex)}">
                  {getInitials(person.name)}
                </div>
                <div class="result-info">
                  <span class="result-name">{person.name}</span>
                  {#if getBirthYear(person)}
                    <span class="result-year">b. {getBirthYear(person)}</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </div>

    <!-- Swap Button -->
    <button class="swap-btn" on:click={swapPersons} disabled={!person1 || !person2}>
      <svg viewBox="0 0 24 24" width="24" height="24">
        <polyline points="17 1 21 5 17 9" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M3 11V9a4 4 0 0 1 4-4h14" fill="none" stroke="currentColor" stroke-width="2"/>
        <polyline points="7 23 3 19 7 15" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M21 13v2a4 4 0 0 1-4 4H3" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
    </button>

    <!-- Person 2 Selector -->
    <div class="selector-card">
      <div class="selector-label">Second Person</div>
      
      {#if person2 && !showSearch2}
        <div class="selected-person">
          <div class="person-avatar {getGenderClass(person2.sex)}">
            {getInitials(person2.name)}
          </div>
          <div class="person-info">
            <span class="person-name">{person2.name}</span>
            {#if getBirthYear(person2)}
              <span class="person-year">b. {getBirthYear(person2)}</span>
            {/if}
          </div>
          <button class="change-btn" on:click={resetPerson2}>Change</button>
        </div>
      {:else}
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18">
            <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2"/>
          </svg>
          <input 
            type="text" 
            placeholder="Search by name..."
            bind:value={searchQuery2}
            disabled={!person1}
          />
        </div>
        
        {#if searchResults2.length > 0}
          <div class="search-results">
            {#each searchResults2 as person}
              <button class="result-item" on:click={() => selectPerson2(person)}>
                <div class="result-avatar {getGenderClass(person.sex)}">
                  {getInitials(person.name)}
                </div>
                <div class="result-info">
                  <span class="result-name">{person.name}</span>
                  {#if getBirthYear(person)}
                    <span class="result-year">b. {getBirthYear(person)}</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
        
        {#if !person1}
          <p class="hint">Select the first person first</p>
        {/if}
      {/if}
    </div>
  </div>

  {#if relationshipPath && person1 && person2}
    <div class="result-section">
      <div class="relationship-badge">
        <span class="badge-label">Relationship</span>
        <span class="badge-value">{relationshipDescription}</span>
      </div>

      <div class="connection-path">
        <h3>Connection Path</h3>
        <div class="path-visual">
          {#each relationshipPath as step, i}
            <div class="path-step">
              <button 
                class="step-node {getGenderClass(step.person.sex)}"
                class:start={i === 0}
                class:end={i === relationshipPath.length - 1}
                on:click={() => selectedPerson.set(step.person)}
              >
                <div class="node-avatar">
                  {getInitials(step.person.name)}
                </div>
                <div class="node-info">
                  <span class="node-name">{step.person.name}</span>
                  {#if i > 0}
                    <span class="node-relation">{getRelationLabel(step.relation, step.person)}</span>
                  {/if}
                </div>
              </button>
              
              {#if i < relationshipPath.length - 1}
                <div class="path-connector">
                  <div class="connector-line"></div>
                  <div class="connector-arrow">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2"/>
                    </svg>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <div class="path-summary">
          <span class="summary-steps">{relationshipPath.length - 1} step{relationshipPath.length !== 2 ? 's' : ''}</span>
          <span class="summary-sep">•</span>
          <span class="summary-direction">
            {relationshipPath.slice(1).map(s => s.relation).join(' → ')}
          </span>
        </div>
      </div>

      <!-- Timeline Visualization -->
      {#if hasTimelineData}
        <div class="timeline-section">
          <h3>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
              <circle cx="6" cy="12" r="2" fill="currentColor"/>
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
              <circle cx="18" cy="12" r="2" fill="currentColor"/>
            </svg>
            Lifespan Timeline
          </h3>

          <!-- Year axis -->
          <div class="timeline-axis">
            {#each yearMarkers as year}
              <div class="year-marker" style="left: {getTimelinePosition(year)}%">
                <span class="year-label">{year}</span>
                <div class="year-tick"></div>
              </div>
            {/each}
          </div>

          <!-- Lifespan bars -->
          <div class="timeline-bars">
            {#each timelineData.people as person, i}
              <div class="timeline-row" class:start-person={i === 0} class:end-person={i === timelineData.people.length - 1}>
                <button class="row-label" on:click={() => selectedPerson.set(person)}>
                  <div class="row-avatar {getGenderClass(person.sex)}">
                    {getInitials(person.name)}
                  </div>
                  <div class="row-info">
                    <span class="row-name">{person.name?.split(' ').slice(0, 2).join(' ')}</span>
                    {#if person.birthYear}
                      <span class="row-years">{person.birthYear}–{person.isLiving ? 'present' : (person.deathYear || '?')}</span>
                    {:else}
                      <span class="row-years unknown">Dates unknown</span>
                    {/if}
                  </div>
                </button>
                <div class="row-bar-container">
                  {#if person.birthYear}
                    <div 
                      class="lifespan-bar {getGenderClass(person.sex)}"
                      class:living={person.isLiving}
                      style="left: {getTimelinePosition(person.birthYear)}%; width: {getBarWidth(person.birthYear, person.endYear)}%"
                    >
                      <span class="bar-birth">★ {person.birthYear}</span>
                      {#if person.deathYear}
                        <span class="bar-death">✝ {person.deathYear}</span>
                      {/if}
                    </div>
                  {:else}
                    <div class="no-dates-bar">
                      <span>No dates available</span>
                    </div>
                  {/if}
                </div>
              </div>

              <!-- Overlap indicator between people -->
              {#if i < timelineData.people.length - 1 && overlapPeriods[i]}
                <div class="overlap-indicator">
                  {#if overlapPeriods[i].duration > 0}
                    <div class="overlap-bar" style="left: {getTimelinePosition(overlapPeriods[i].startYear)}%; width: {getBarWidth(overlapPeriods[i].startYear, overlapPeriods[i].endYear)}%">
                    </div>
                    <span class="overlap-label positive">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" fill="none" stroke="currentColor" stroke-width="2"/>
                        <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2"/>
                      </svg>
                      {overlapPeriods[i].duration} years overlap ({overlapPeriods[i].startYear}–{overlapPeriods[i].endYear})
                    </span>
                  {:else if overlapPeriods[i].gap}
                    <span class="overlap-label negative">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                        <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/>
                        <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>
                      </svg>
                      {overlapPeriods[i].gap} years apart (no overlap)
                    </span>
                  {/if}
                </div>
              {/if}
            {/each}
          </div>

          <!-- Legend -->
          <div class="timeline-legend">
            <div class="legend-item">
              <span class="legend-dot male"></span>
              <span>Male</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot female"></span>
              <span>Female</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot living"></span>
              <span>Living</span>
            </div>
            <div class="legend-item">
              <span class="legend-bar overlap"></span>
              <span>Lifespan Overlap</span>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {:else if person1 && person2 && relationshipDescription === 'No direct family connection found'}
    <div class="no-connection">
      <svg viewBox="0 0 24 24" width="48" height="48">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
        <line x1="8" y1="8" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
        <line x1="16" y1="8" x2="8" y2="16" stroke="currentColor" stroke-width="2"/>
      </svg>
      <p>No direct family connection found</p>
      <p class="hint">These two people may not be related in this family tree dataset</p>
    </div>
  {:else if !person1 || !person2}
    <div class="placeholder">
      <svg viewBox="0 0 24 24" width="64" height="64">
        <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/>
        <circle cx="16" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/>
        <path d="M10 10L14 14" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/>
      </svg>
      <p>Select two family members above to discover their relationship</p>
    </div>
  {/if}
</div>

<style>
  .finder-container {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .finder-header {
    text-align: center;
    padding: 2rem;
    background: linear-gradient(135deg, rgba(212, 168, 83, 0.1) 0%, rgba(122, 158, 126, 0.05) 100%);
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-icon {
    color: var(--accent-gold);
    margin-bottom: 0.75rem;
  }

  .finder-header h2 {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .finder-header p {
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  .person-selectors {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    align-items: flex-start;
  }

  .selector-card {
    flex: 1;
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1rem;
    min-height: 120px;
  }

  .selector-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
    font-weight: 500;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 0.75rem;
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-input-wrapper input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.95rem;
  }

  .search-input-wrapper input:focus {
    outline: none;
    border-color: var(--accent-gold);
  }

  .search-input-wrapper input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .search-input-wrapper input::placeholder {
    color: var(--text-muted);
  }

  .search-results {
    margin-top: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background: var(--bg-card);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-body);
    transition: all 0.15s ease;
  }

  .result-item:hover {
    border-color: var(--accent-gold);
    background: rgba(212, 168, 83, 0.05);
  }

  .result-avatar, .person-avatar {
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

  .result-avatar.male, .person-avatar.male {
    background: linear-gradient(135deg, #4a7c9b, #2d5a7b);
  }

  .result-avatar.female, .person-avatar.female {
    background: linear-gradient(135deg, #9b6b8a, #7b4a6a);
  }

  .result-avatar.unknown, .person-avatar.unknown {
    background: linear-gradient(135deg, #7a7a7a, #5a5a5a);
  }

  .result-info, .person-info {
    flex: 1;
    min-width: 0;
  }

  .result-name, .person-name {
    display: block;
    font-size: 0.9rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-year, .person-year {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .selected-person {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .change-btn {
    padding: 0.35rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 0.8rem;
    cursor: pointer;
    font-family: var(--font-body);
    transition: all 0.15s ease;
  }

  .change-btn:hover {
    border-color: var(--accent-gold);
    color: var(--accent-gold);
  }

  .hint {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 0.5rem;
  }

  .swap-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 50%;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    margin-top: 2.5rem;
  }

  .swap-btn:hover:not(:disabled) {
    background: var(--accent-gold);
    color: var(--bg-deep);
    border-color: var(--accent-gold);
  }

  .swap-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .result-section {
    padding: 1.5rem;
    border-top: 1px solid var(--border-subtle);
  }

  .relationship-badge {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .badge-label {
    display: block;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 0.35rem;
  }

  .badge-value {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, var(--accent-gold), var(--accent-copper));
    border-radius: 30px;
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--bg-deep);
  }

  .connection-path {
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 1.25rem;
  }

  .connection-path h3 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .path-visual {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .path-step {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .step-node {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    background: var(--bg-card);
    border: 2px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    transition: all 0.2s ease;
    min-width: 200px;
  }

  .step-node:hover {
    border-color: var(--accent-gold);
    transform: translateX(4px);
  }

  .step-node.start {
    border-color: var(--accent-gold);
    background: rgba(212, 168, 83, 0.1);
  }

  .step-node.end {
    border-color: var(--accent-sage);
    background: rgba(122, 158, 126, 0.1);
  }

  .node-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .step-node.male .node-avatar {
    background: linear-gradient(135deg, #4a7c9b, #2d5a7b);
  }

  .step-node.female .node-avatar {
    background: linear-gradient(135deg, #9b6b8a, #7b4a6a);
  }

  .step-node.unknown .node-avatar {
    background: linear-gradient(135deg, #7a7a7a, #5a5a5a);
  }

  .node-info {
    flex: 1;
  }

  .node-name {
    display: block;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .node-relation {
    font-size: 0.75rem;
    color: var(--accent-soft);
    font-weight: 500;
  }

  .path-connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.25rem 0;
    margin-left: 1.75rem;
  }

  .connector-line {
    width: 2px;
    height: 12px;
    background: var(--accent-muted);
  }

  .connector-arrow {
    color: var(--accent-muted);
  }

  .path-summary {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px dashed var(--border-subtle);
    font-size: 0.85rem;
    color: var(--text-muted);
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .summary-steps {
    color: var(--accent-gold);
    font-weight: 500;
  }

  .summary-sep {
    opacity: 0.5;
  }

  .no-connection, .placeholder {
    text-align: center;
    padding: 3rem;
    color: var(--text-muted);
  }

  .no-connection svg, .placeholder svg {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .placeholder svg {
    opacity: 0.3;
  }

  /* Timeline Section */
  .timeline-section {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    margin-top: 1.5rem;
    border: 1px solid var(--border-subtle);
  }

  .timeline-section h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent-gold);
    margin-bottom: 1rem;
    font-weight: 600;
  }

  .timeline-axis {
    position: relative;
    height: 28px;
    margin-bottom: 0.5rem;
    margin-left: 200px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .year-marker {
    position: absolute;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .year-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .year-tick {
    width: 1px;
    height: 6px;
    background: var(--border-subtle);
    margin-top: 2px;
  }

  .timeline-bars {
    display: flex;
    flex-direction: column;
  }

  .timeline-row {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 1rem;
    align-items: center;
    padding: 0.5rem 0;
  }

  .timeline-row.start-person {
    background: rgba(212, 168, 83, 0.08);
    margin: 0 -1rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
  }

  .timeline-row.end-person {
    background: rgba(122, 158, 126, 0.08);
    margin: 0 -1rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
  }

  .row-label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    background: none;
    border: none;
    padding: 0.35rem 0.5rem;
    margin: -0.35rem -0.5rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-body);
    text-align: left;
    transition: all 0.15s ease;
  }

  .row-label:hover {
    background: rgba(212, 168, 83, 0.1);
  }

  .row-label:hover .row-name {
    color: var(--accent-gold);
  }

  .row-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .row-avatar.male {
    background: linear-gradient(135deg, #4a7c9b, #2d5a7b);
  }

  .row-avatar.female {
    background: linear-gradient(135deg, #9b6b8a, #7b4a6a);
  }

  .row-avatar.unknown {
    background: linear-gradient(135deg, #7a7a7a, #5a5a5a);
  }

  .row-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .row-name {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-years {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .row-years.unknown {
    font-style: italic;
    opacity: 0.7;
  }

  .row-bar-container {
    position: relative;
    height: 26px;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
  }

  .lifespan-bar {
    position: absolute;
    height: 100%;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.5rem;
    min-width: 50px;
    box-sizing: border-box;
  }

  .lifespan-bar.male {
    background: linear-gradient(135deg, #4a7c9b 0%, #3d6a85 100%);
  }

  .lifespan-bar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #855a76 100%);
  }

  .lifespan-bar.unknown {
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .lifespan-bar.living {
    border-right: 3px solid #7dd39a;
  }

  .lifespan-bar.living.male {
    background: linear-gradient(135deg, #4a7a8c 0%, #3a6070 100%);
    border-right-color: #7dc3d3;
  }

  .lifespan-bar.living.female {
    background: linear-gradient(135deg, #8c5a7a 0%, #704a62 100%);
    border-right-color: #d37dba;
  }

  .bar-birth, .bar-death {
    font-size: 0.65rem;
    color: white;
    font-weight: 500;
    opacity: 0.9;
    white-space: nowrap;
  }

  .no-dates-bar {
    position: absolute;
    left: 0;
    right: 0;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: repeating-linear-gradient(
      45deg,
      var(--bg-elevated),
      var(--bg-elevated) 8px,
      rgba(90, 77, 63, 0.2) 8px,
      rgba(90, 77, 63, 0.2) 16px
    );
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-sm);
  }

  .no-dates-bar span {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-style: italic;
  }

  /* Overlap indicator */
  .overlap-indicator {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 1rem;
    align-items: center;
    padding: 0.25rem 0;
    margin: 0.25rem 0;
  }

  .overlap-bar {
    position: absolute;
    height: 6px;
    background: linear-gradient(90deg, rgba(122, 158, 126, 0.6), rgba(212, 168, 83, 0.6));
    border-radius: 3px;
    top: 50%;
    transform: translateY(-50%);
  }

  .overlap-label {
    grid-column: 2;
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    padding: 0.35rem 0.75rem;
    border-radius: var(--radius-sm);
    width: fit-content;
  }

  .overlap-label.positive {
    color: var(--accent-sage);
    background: rgba(122, 158, 126, 0.15);
  }

  .overlap-label.negative {
    color: var(--accent-copper);
    background: rgba(196, 122, 90, 0.15);
  }

  .timeline-legend {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-subtle);
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .legend-dot.male {
    background: linear-gradient(135deg, #4a7c9b, #2d5a7b);
  }

  .legend-dot.female {
    background: linear-gradient(135deg, #9b6b8a, #7b4a6a);
  }

  .legend-dot.living {
    background: linear-gradient(135deg, #4c8c5c, #346844);
    border-right: 2px solid #7dd39a;
  }

  .legend-bar {
    width: 24px;
    height: 6px;
    border-radius: 3px;
  }

  .legend-bar.overlap {
    background: linear-gradient(90deg, rgba(122, 158, 126, 0.8), rgba(212, 168, 83, 0.8));
  }

  @media (max-width: 768px) {
    .person-selectors {
      flex-direction: column;
    }

    .swap-btn {
      align-self: center;
      margin-top: 0;
      transform: rotate(90deg);
    }

    .timeline-axis {
      margin-left: 0;
    }

    .timeline-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .overlap-indicator {
      grid-template-columns: 1fr;
    }

    .overlap-label {
      grid-column: 1;
      margin-left: 0;
    }
  }
</style>

