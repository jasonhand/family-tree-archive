<script>
  import { familyData, familyRelationships, selectedPerson } from '../stores/familyStore.js';

  let containerWidth = 1000;
  let container;

  // View mode: 'family' shows relatives of selected person, 'generation' shows by birth decade
  let viewMode = 'family';
  
  // Selected person for family view
  let focusPerson = null;
  let searchQuery = '';
  
  // Generation view settings
  let selectedDecade = null;

  $: searchResults = searchQuery.length > 1 
    ? $familyData.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 10)
    : [];

  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }

  function selectFocusPerson(person) {
    focusPerson = person;
    searchQuery = '';
    viewMode = 'family';
  }

  // Get all people with valid birth years for the timeline
  $: peopleWithDates = $familyData
    .filter(p => extractYear(p.birth_date))
    .map(p => ({
      ...p,
      birthYear: extractYear(p.birth_date),
      deathYear: extractYear(p.death_date) || (p.death_date ? null : new Date().getFullYear()),
      isLiving: !p.death_date
    }))
    .sort((a, b) => a.birthYear - b.birthYear);

  // Get min/max years for the timeline
  $: timelineRange = (() => {
    if (peopleWithDates.length === 0) return { min: 1800, max: 2025 };
    const births = peopleWithDates.map(p => p.birthYear);
    const deaths = peopleWithDates.map(p => p.deathYear).filter(Boolean);
    return {
      min: Math.min(...births) - 10,
      max: Math.max(...deaths, new Date().getFullYear()) + 5
    };
  })();

  // Get family members for family view
  $: familyMembers = (() => {
    if (!focusPerson || viewMode !== 'family') return [];
    
    const rels = $familyRelationships[focusPerson.id];
    if (!rels) return [focusPerson];

    const members = new Map();
    
    // Add focus person
    members.set(focusPerson.id, { ...focusPerson, relation: 'self' });

    // Add parents
    rels.parents?.forEach(p => {
      if (!members.has(p.id)) members.set(p.id, { ...p, relation: 'parent' });
    });

    // Add siblings
    rels.siblings?.forEach(p => {
      if (!members.has(p.id)) members.set(p.id, { ...p, relation: 'sibling' });
    });

    // Add spouses
    rels.spouses?.forEach(p => {
      if (!members.has(p.id)) members.set(p.id, { ...p, relation: 'spouse' });
    });

    // Add children
    rels.children?.forEach(p => {
      if (!members.has(p.id)) members.set(p.id, { ...p, relation: 'child' });
    });

    // Add grandparents
    rels.parents?.forEach(parent => {
      const parentRels = $familyRelationships[parent.id];
      parentRels?.parents?.forEach(gp => {
        if (!members.has(gp.id)) members.set(gp.id, { ...gp, relation: 'grandparent' });
      });
    });

    // Add grandchildren
    rels.children?.forEach(child => {
      const childRels = $familyRelationships[child.id];
      childRels?.children?.forEach(gc => {
        if (!members.has(gc.id)) members.set(gc.id, { ...gc, relation: 'grandchild' });
      });
    });

    return Array.from(members.values())
      .map(p => {
        const birthYear = extractYear(p.birth_date);
        const deathYear = extractYear(p.death_date);
        return {
          ...p,
          birthYear: birthYear,
          deathYear: deathYear || (p.death_date ? null : new Date().getFullYear()),
          isLiving: !p.death_date,
          noBirthDate: !birthYear
        };
      })
      .sort((a, b) => {
        // Sort by birth year, but put people without birth dates at the end
        if (a.birthYear === null && b.birthYear === null) return 0;
        if (a.birthYear === null) return 1;
        if (b.birthYear === null) return -1;
        return a.birthYear - b.birthYear;
      });
  })();

  // Get people by decade for generation view
  $: decadeGroups = (() => {
    const groups = {};
    peopleWithDates.forEach(p => {
      const decade = Math.floor(p.birthYear / 10) * 10;
      if (!groups[decade]) groups[decade] = [];
      groups[decade].push(p);
    });
    return Object.entries(groups)
      .map(([decade, people]) => ({ decade: parseInt(decade), people }))
      .sort((a, b) => a.decade - b.decade);
  })();

  // Get display data based on view mode
  $: displayPeople = viewMode === 'family' 
    ? familyMembers 
    : selectedDecade !== null 
      ? decadeGroups.find(g => g.decade === selectedDecade)?.people || []
      : peopleWithDates.slice(0, 50);

  // Calculate who was alive when focus person was born
  $: aliveAtBirth = (() => {
    if (!focusPerson) return [];
    const focusBirth = extractYear(focusPerson.birth_date);
    if (!focusBirth) return [];

    return familyMembers.filter(p => {
      if (p.id === focusPerson.id) return false;
      if (!p.birthYear) return false;
      const deathYear = p.deathYear || new Date().getFullYear();
      return p.birthYear <= focusBirth && deathYear >= focusBirth;
    });
  })();

  // Calculate shared years between focus person and each family member
  function getSharedYears(person) {
    if (!focusPerson || person.id === focusPerson.id) return null;
    
    const focusBirth = extractYear(focusPerson.birth_date);
    const focusDeath = extractYear(focusPerson.death_date) || new Date().getFullYear();
    
    if (!focusBirth || !person.birthYear) return null;
    
    const personDeath = person.deathYear || new Date().getFullYear();
    
    const overlapStart = Math.max(focusBirth, person.birthYear);
    const overlapEnd = Math.min(focusDeath, personDeath);
    
    if (overlapEnd < overlapStart) return 0;
    return overlapEnd - overlapStart;
  }

  // Calculate position on timeline
  function getTimelinePosition(year) {
    const range = timelineRange.max - timelineRange.min;
    return ((year - timelineRange.min) / range) * 100;
  }

  // Color by relation type
  const relationColors = {
    self: '#d4a853',
    parent: '#7a9e7e',
    grandparent: '#5d8a61',
    sibling: '#4a7c9b',
    spouse: '#c47a5a',
    child: '#9b6b8a',
    grandchild: '#8b7e9b',
    default: '#6b6560'
  };

  function getColor(person) {
    return relationColors[person.relation] || relationColors.default;
  }

  function handlePersonClick(person) {
    selectedPerson.set(person);
  }

  // Initialize with a default person
  $: if (!focusPerson && $familyData.length > 0) {
    const personWithFamily = $familyData.find(p => {
      const rels = $familyRelationships[p.id];
      return rels?.parents?.length > 0 || rels?.children?.length > 0;
    });
    focusPerson = personWithFamily || $familyData[0];
  }
</script>

<div class="timeline-container">
  <div class="timeline-header">
    <h2>
      <svg viewBox="0 0 24 24" width="24" height="24">
        <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
        <circle cx="6" cy="12" r="2" fill="currentColor"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
        <circle cx="18" cy="12" r="2" fill="currentColor"/>
      </svg>
      Life Overlap Timeline
    </h2>
    <p>See when family members' lives overlapped — who could have known whom</p>
  </div>

  <div class="timeline-controls">
    <div class="view-toggle">
      <button 
        class:active={viewMode === 'family'} 
        on:click={() => viewMode = 'family'}
      >
        Family View
      </button>
      <button 
        class:active={viewMode === 'generation'} 
        on:click={() => viewMode = 'generation'}
      >
        By Decade
      </button>
    </div>

    {#if viewMode === 'family'}
      <div class="search-box">
        <input 
          type="text" 
          placeholder="Search to focus on a person..." 
          bind:value={searchQuery}
        />
        {#if searchResults.length > 0}
          <div class="search-results">
            {#each searchResults as person}
              <button class="search-result" on:click={() => selectFocusPerson(person)}>
                <span>{person.name}</span>
                {#if extractYear(person.birth_date)}
                  <span class="result-date">b. {extractYear(person.birth_date)}</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="decade-selector">
        <select bind:value={selectedDecade}>
          <option value={null}>All decades (first 50)</option>
          {#each decadeGroups as group}
            <option value={group.decade}>{group.decade}s ({group.people.length} people)</option>
          {/each}
        </select>
      </div>
    {/if}
  </div>

  {#if viewMode === 'family' && focusPerson}
    <div class="focus-info">
      <div class="focus-person">
        <strong>{focusPerson.name}</strong>
        {#if extractYear(focusPerson.birth_date)}
          <span class="focus-dates">
            {extractYear(focusPerson.birth_date)} - {extractYear(focusPerson.death_date) || 'Present'}
          </span>
        {/if}
      </div>
      {#if aliveAtBirth.length > 0}
        <div class="alive-at-birth">
          <span class="alive-label">Alive when {focusPerson.name.split(' ')[0]} was born:</span>
          <span class="alive-list">
            {aliveAtBirth.map(p => p.name.split(' ')[0]).join(', ')}
          </span>
        </div>
      {/if}
    </div>
  {/if}

  <div class="timeline-wrapper" bind:this={container}>
    <!-- Timeline axis -->
    <div class="timeline-axis">
      {#each Array(Math.ceil((timelineRange.max - timelineRange.min) / 25)) as _, i}
        {@const year = timelineRange.min + i * 25}
        <div class="axis-mark" style="left: {getTimelinePosition(year)}%">
          <span class="axis-year">{year}</span>
        </div>
      {/each}
    </div>

    <!-- Life bars -->
    <div class="timeline-bars">
      {#each displayPeople as person, i}
        {@const startPos = getTimelinePosition(person.birthYear)}
        {@const endPos = getTimelinePosition(person.deathYear || new Date().getFullYear())}
        {@const width = endPos - startPos}
        {@const sharedYears = viewMode === 'family' ? getSharedYears(person) : null}
        
        <div class="person-row">
          <div class="person-label">
            <button class="person-name" on:click={() => handlePersonClick(person)}>
              {person.name}
            </button>
            {#if viewMode === 'family' && person.relation}
              <span class="relation-badge" style="background: {getColor(person)}">
                {person.relation}
              </span>
            {/if}
            {#if sharedYears !== null && sharedYears > 0}
              <span class="shared-years">{sharedYears} shared years</span>
            {/if}
          </div>
          
          <div class="bar-container">
            <div 
              class="life-bar"
              class:living={person.isLiving}
              class:self={person.relation === 'self'}
              style="
                left: {startPos}%;
                width: {width}%;
                background: {getColor(person)};
              "
              on:click={() => handlePersonClick(person)}
              on:keydown={(e) => e.key === 'Enter' && handlePersonClick(person)}
              role="button"
              tabindex="0"
            >
              <span class="bar-years">{person.birthYear} - {person.deathYear || 'now'}</span>
            </div>
            
            {#if person.isLiving}
              <div class="living-indicator" style="left: {endPos}%"></div>
            {/if}
          </div>
        </div>
      {/each}

      <!-- Focus person birth line (for family view) -->
      {#if viewMode === 'family' && focusPerson}
        {@const focusBirth = extractYear(focusPerson.birth_date)}
        {#if focusBirth}
          <div class="birth-line-container">
            <div class="birth-line" style="left: {getTimelinePosition(focusBirth)}%">
              <span class="birth-line-label">{focusPerson.name.split(' ')[0]}'s birth</span>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>

  {#if viewMode === 'family'}
    <div class="legend">
      <div class="legend-title">Relationship to {focusPerson?.name?.split(' ')[0] || 'Focus Person'}</div>
      <div class="legend-items">
        {#each Object.entries(relationColors).filter(([k]) => k !== 'default') as [relation, color]}
          <div class="legend-item">
            <span class="legend-color" style="background: {color}"></span>
            <span>{relation}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .timeline-container {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .timeline-header {
    padding: 1.5rem;
    background: linear-gradient(135deg, rgba(74, 124, 155, 0.1) 0%, rgba(212, 168, 83, 0.05) 100%);
    border-bottom: 1px solid var(--border-subtle);
  }

  .timeline-header h2 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .timeline-header h2 svg {
    color: var(--accent-gold);
  }

  .timeline-header p {
    color: var(--text-muted);
    font-size: 0.95rem;
    margin-left: 2.75rem;
  }

  .timeline-controls {
    display: flex;
    gap: 1.5rem;
    padding: 1rem 1.5rem;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid var(--border-subtle);
    flex-wrap: wrap;
    align-items: center;
  }

  .view-toggle {
    display: flex;
    background: var(--bg-deep);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .view-toggle button {
    padding: 0.5rem 1rem;
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-toggle button:hover {
    color: var(--text-secondary);
  }

  .view-toggle button.active {
    background: var(--accent-gold);
    color: var(--bg-deep);
  }

  .search-box {
    flex: 1;
    min-width: 250px;
    position: relative;
  }

  .search-box input {
    width: 100%;
    padding: 0.5rem 1rem;
    background: var(--bg-deep);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--accent-gold);
  }

  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    margin-top: 0.25rem;
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
  }

  .search-result {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0.5rem 1rem;
    background: none;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-body);
    cursor: pointer;
    text-align: left;
  }

  .search-result:hover {
    background: rgba(212, 168, 83, 0.1);
  }

  .result-date {
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .decade-selector select {
    padding: 0.5rem 1rem;
    background: var(--bg-deep);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
  }

  .focus-info {
    padding: 1rem 1.5rem;
    background: rgba(212, 168, 83, 0.08);
    border-bottom: 1px solid var(--border-subtle);
  }

  .focus-person {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .focus-person strong {
    color: var(--accent-gold);
    font-size: 1.1rem;
  }

  .focus-dates {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .alive-at-birth {
    font-size: 0.9rem;
  }

  .alive-label {
    color: var(--text-muted);
  }

  .alive-list {
    color: var(--text-secondary);
    margin-left: 0.5rem;
  }

  .timeline-wrapper {
    position: relative;
    padding: 2rem 1.5rem 1rem 1.5rem;
    overflow-x: auto;
  }

  .timeline-axis {
    position: relative;
    height: 30px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 1rem;
    margin-left: 280px;
  }

  .axis-mark {
    position: absolute;
    transform: translateX(-50%);
  }

  .axis-mark::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 1px;
    height: 8px;
    background: var(--border-subtle);
  }

  .axis-year {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .timeline-bars {
    position: relative;
  }

  .person-row {
    display: flex;
    align-items: center;
    min-height: 36px;
    margin-bottom: 4px;
  }

  .person-label {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.5rem;
    padding-right: 1rem;
  }

  .person-name {
    background: none;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.85rem;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }

  .person-name:hover {
    color: var(--accent-gold);
  }

  .relation-badge {
    font-size: 0.65rem;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    flex-shrink: 0;
  }

  .shared-years {
    font-size: 0.7rem;
    color: var(--text-muted);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .bar-container {
    flex: 1;
    position: relative;
    height: 24px;
  }

  .life-bar {
    position: absolute;
    height: 100%;
    border-radius: 4px;
    cursor: pointer;
    transition: opacity 0.2s ease, transform 0.2s ease;
    display: flex;
    align-items: center;
    padding: 0 8px;
    min-width: 40px;
  }

  .life-bar:hover {
    opacity: 0.85;
    transform: scaleY(1.1);
    z-index: 10;
  }

  .life-bar.self {
    box-shadow: 0 0 0 2px var(--accent-gold), 0 0 12px rgba(212, 168, 83, 0.4);
  }

  .life-bar.living {
    border-right: 3px dashed rgba(255, 255, 255, 0.5);
  }

  .bar-years {
    font-size: 0.7rem;
    color: white;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .life-bar:hover .bar-years {
    opacity: 1;
  }

  .living-indicator {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    background: var(--accent-sage);
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.5); }
  }

  .birth-line-container {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 280px;
    right: 0;
    pointer-events: none;
  }

  .birth-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--accent-gold);
    opacity: 0.6;
    z-index: 5;
    transform: translateX(-50%);
  }

  .birth-line-label {
    position: absolute;
    top: -25px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.7rem;
    color: var(--accent-gold);
    white-space: nowrap;
    background: var(--bg-card);
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
  }

  .legend {
    padding: 1rem 1.5rem;
    background: rgba(0, 0, 0, 0.15);
    border-top: 1px solid var(--border-subtle);
  }

  .legend-title {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }

  .legend-items {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }

  @media (max-width: 768px) {
    .person-label {
      width: 160px;
    }

    .person-name {
      max-width: 100px;
    }

    .timeline-axis {
      margin-left: 160px;
    }

    .birth-line-container {
      left: calc(160px + 1.5rem);
    }

    .shared-years {
      font-size: 0.65rem;
    }
  }
</style>

