<script>
  import { familyData, selectedPerson } from '../stores/familyStore.js';

  let sortOrder = 'death-desc'; // 'death-asc', 'death-desc', 'name', 'age-desc', 'age-asc', 'birth-asc'

  const sortOptions = [
    { value: 'death-asc', label: 'Death Date (Oldest First)' },
    { value: 'death-desc', label: 'Death Date (Most Recent)' },
    { value: 'birth-asc', label: 'Birth Date (Oldest First)' },
    { value: 'name', label: 'Name (A-Z)' },
    { value: 'age-desc', label: 'Age at Death (Longest Life)' },
    { value: 'age-asc', label: 'Age at Death (Shortest Life)' }
  ];

  // Get all deceased members with death dates (unsorted)
  $: deceasedMembersRaw = $familyData
    .filter(person => person.death_date)
    .map(person => ({
      ...person,
      deathYear: extractYear(person.death_date),
      deathMonth: extractMonth(person.death_date),
      birthYear: extractYear(person.birth_date),
      age: calculateAge(person.birth_date, person.death_date)
    }))
    .filter(person => person.deathYear);

  // Sort based on selected order
  $: deceasedMembers = [...deceasedMembersRaw].sort((a, b) => {
    switch (sortOrder) {
      case 'death-asc':
        if (a.deathYear !== b.deathYear) return a.deathYear - b.deathYear;
        return (a.deathMonth || 0) - (b.deathMonth || 0);
      case 'death-desc':
        if (a.deathYear !== b.deathYear) return b.deathYear - a.deathYear;
        return (b.deathMonth || 0) - (a.deathMonth || 0);
      case 'birth-asc':
        return (a.birthYear || 9999) - (b.birthYear || 9999);
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'age-desc':
        return (b.age || 0) - (a.age || 0);
      case 'age-asc':
        return (a.age || 999) - (b.age || 999);
      default:
        return 0;
    }
  });

  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }

  function extractMonth(dateStr) {
    if (!dateStr) return null;
    const months = {
      'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
      'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    };
    const match = dateStr.toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
    return match ? months[match[1]] : null;
  }

  function calculateAge(birthDate, deathDate) {
    const birthYear = extractYear(birthDate);
    const deathYear = extractYear(deathDate);
    if (!birthYear || !deathYear) return null;
    return deathYear - birthYear;
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

  // Group by decade for the timeline (only used for death date sorts)
  $: decades = (() => {
    const groups = {};
    deceasedMembers.forEach(person => {
      const decade = Math.floor(person.deathYear / 10) * 10;
      if (!groups[decade]) {
        groups[decade] = [];
      }
      groups[decade].push(person);
    });
    const sorted = Object.entries(groups);
    if (sortOrder === 'death-desc') {
      return sorted.sort(([a], [b]) => parseInt(b) - parseInt(a));
    }
    return sorted.sort(([a], [b]) => parseInt(a) - parseInt(b));
  })();

  // Check if we should show decade grouping or flat list
  $: showDecadeGroups = sortOrder === 'death-asc' || sortOrder === 'death-desc';

  // Get grouping label based on sort
  function getGroupLabel(person) {
    switch (sortOrder) {
      case 'name':
        return person.name?.[0]?.toUpperCase() || '?';
      case 'age-desc':
      case 'age-asc':
        if (!person.age) return 'Unknown Age';
        if (person.age >= 90) return '90+ Years';
        if (person.age >= 80) return '80-89 Years';
        if (person.age >= 70) return '70-79 Years';
        if (person.age >= 60) return '60-69 Years';
        if (person.age >= 50) return '50-59 Years';
        return 'Under 50 Years';
      case 'birth-asc':
        return `${Math.floor(person.birthYear / 10) * 10}s`;
      default:
        return '';
    }
  }

  // Group by custom criteria
  $: customGroups = (() => {
    if (showDecadeGroups) return [];
    const groups = {};
    deceasedMembers.forEach(person => {
      const label = getGroupLabel(person);
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(person);
    });
    return Object.entries(groups);
  })();

  // Statistics
  $: stats = {
    total: deceasedMembers.length,
    avgAge: deceasedMembers.filter(p => p.age).length > 0
      ? Math.round(deceasedMembers.filter(p => p.age).reduce((sum, p) => sum + p.age, 0) / deceasedMembers.filter(p => p.age).length)
      : null,
    oldest: deceasedMembers.filter(p => p.age).sort((a, b) => b.age - a.age)[0],
    earliest: deceasedMembers[0],
    latest: deceasedMembers[deceasedMembers.length - 1]
  };

  // Year range for timeline
  $: yearRange = {
    start: stats.earliest?.deathYear || 1800,
    end: stats.latest?.deathYear || 2024
  };

  function getTimelinePosition(year) {
    const range = yearRange.end - yearRange.start;
    return ((year - yearRange.start) / range) * 100;
  }
</script>

<div class="memorial-container">
  <header class="memorial-header">
    <div class="header-icon">
      <svg viewBox="0 0 24 24" width="32" height="32">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 3.54 2.56 6.47 5.93 7.47L12 22l1.07-5.53C16.44 15.47 19 12.54 19 9c0-3.87-3.13-7-7-7z" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="12" cy="9" r="2" fill="currentColor"/>
      </svg>
    </div>
    <h2>In Our Memory</h2>
    <p class="subtitle">Honoring those who came before us</p>
  </header>

  <div class="memorial-controls">
    <div class="memorial-stats">
      <div class="stat-item">
        <span class="stat-value">{stats.total}</span>
        <span class="stat-label">Remembered</span>
      </div>
      {#if stats.avgAge}
        <div class="stat-item">
          <span class="stat-value">{stats.avgAge}</span>
          <span class="stat-label">Average Age</span>
        </div>
      {/if}
      {#if stats.oldest}
        <div class="stat-item">
          <span class="stat-value">{stats.oldest.age}</span>
          <span class="stat-label">Longest Life</span>
        </div>
      {/if}
      <div class="stat-item">
        <span class="stat-value">{yearRange.start}–{yearRange.end}</span>
        <span class="stat-label">Time Span</span>
      </div>
    </div>
    
    <div class="sort-control">
      <label for="sort-select">Sort by:</label>
      <select id="sort-select" bind:value={sortOrder}>
        {#each sortOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="timeline-overview">
    <div class="timeline-track">
      {#each deceasedMembers as person}
        <div 
          class="timeline-dot {getGenderClass(person.sex)}"
          style="left: {getTimelinePosition(person.deathYear)}%"
          title="{person.name} ({person.deathYear})"
        ></div>
      {/each}
    </div>
    <div class="timeline-labels">
      <span>{yearRange.start}</span>
      <span>{Math.round((yearRange.start + yearRange.end) / 2)}</span>
      <span>{yearRange.end}</span>
    </div>
  </div>

  <div class="decades-timeline">
    {#if showDecadeGroups}
      {#each decades as [decade, members]}
        <div class="decade-section">
          <div class="decade-marker">
            <span class="decade-year">{decade}s</span>
            <span class="decade-count">{members.length} {members.length === 1 ? 'soul' : 'souls'}</span>
          </div>
          
          <div class="decade-members">
            {#each members as person}
              <button 
                class="memorial-card {getGenderClass(person.sex)}"
                on:click={() => selectedPerson.set(person)}
              >
                <div class="card-candle">
                  <div class="flame"></div>
                  <div class="candle-body"></div>
                </div>
                
                <div class="card-content">
                  <div class="memorial-avatar">
                    <span>{getInitials(person.name)}</span>
                  </div>
                  
                  <div class="memorial-info">
                    <h3>{person.name}</h3>
                    <div class="life-dates">
                      {#if person.birthYear}
                        <span class="birth">{person.birthYear}</span>
                        <span class="separator">—</span>
                      {/if}
                      <span class="death">{person.deathYear}</span>
                    </div>
                    {#if person.age}
                      <span class="age-badge">{person.age} years</span>
                    {/if}
                  </div>
                </div>

                {#if person.death_city || person.death_state || person.death_place}
                  <div class="death-place">
                    <svg viewBox="0 0 24 24" width="12" height="12">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    {#if person.death_city || person.death_state}
                      <span>{person.death_city || ''}{person.death_city && person.death_state ? ', ' : ''}{person.death_state || ''}</span>
                    {:else}
                      <span>{person.death_place.split(',').slice(0, 2).join(',')}</span>
                    {/if}
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    {:else}
      {#each customGroups as [groupLabel, members]}
        <div class="decade-section">
          <div class="decade-marker">
            <span class="decade-year">{groupLabel}</span>
            <span class="decade-count">{members.length} {members.length === 1 ? 'soul' : 'souls'}</span>
          </div>
          
          <div class="decade-members">
            {#each members as person}
              <button 
                class="memorial-card {getGenderClass(person.sex)}"
                on:click={() => selectedPerson.set(person)}
              >
                <div class="card-candle">
                  <div class="flame"></div>
                  <div class="candle-body"></div>
                </div>
                
                <div class="card-content">
                  <div class="memorial-avatar">
                    <span>{getInitials(person.name)}</span>
                  </div>
                  
                  <div class="memorial-info">
                    <h3>{person.name}</h3>
                    <div class="life-dates">
                      {#if person.birthYear}
                        <span class="birth">{person.birthYear}</span>
                        <span class="separator">—</span>
                      {/if}
                      <span class="death">{person.deathYear}</span>
                    </div>
                    {#if person.age}
                      <span class="age-badge">{person.age} years</span>
                    {/if}
                  </div>
                </div>

                {#if person.death_city || person.death_state || person.death_place}
                  <div class="death-place">
                    <svg viewBox="0 0 24 24" width="12" height="12">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    {#if person.death_city || person.death_state}
                      <span>{person.death_city || ''}{person.death_city && person.death_state ? ', ' : ''}{person.death_state || ''}</span>
                    {:else}
                      <span>{person.death_place.split(',').slice(0, 2).join(',')}</span>
                    {/if}
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  {#if deceasedMembers.length === 0}
    <div class="no-data">
      <p>No memorial data available</p>
      <p class="hint">Death dates are required to display the memorial timeline</p>
    </div>
  {/if}

  <footer class="memorial-footer">
    <p>"Those we love don't go away, they walk beside us every day."</p>
  </footer>
</div>

<style>
  .memorial-container {
    background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-deep) 100%);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .memorial-header {
    text-align: center;
    padding: 2.5rem 2rem 2rem;
    background: linear-gradient(180deg, rgba(139, 126, 111, 0.15) 0%, transparent 100%);
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-icon {
    color: var(--accent-soft);
    margin-bottom: 1rem;
    opacity: 0.8;
  }

  .memorial-header h2 {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
    letter-spacing: 0.02em;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .memorial-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    background: var(--bg-elevated);
    flex-wrap: wrap;
    gap: 1rem;
  }

  .memorial-stats {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .sort-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .sort-control label {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .sort-control select {
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b7e6f' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
  }

  .sort-control select:focus {
    outline: none;
    border-color: var(--accent-gold);
  }

  .sort-control select:hover {
    border-color: var(--accent-soft);
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--accent-soft);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .timeline-overview {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .timeline-track {
    position: relative;
    height: 24px;
    background: var(--bg-elevated);
    border-radius: 12px;
    margin-bottom: 0.5rem;
  }

  .timeline-dot {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    opacity: 0.7;
    transition: all 0.2s ease;
  }

  .timeline-dot:hover {
    transform: translate(-50%, -50%) scale(2);
    opacity: 1;
    z-index: 10;
  }

  .timeline-dot.male {
    background: #4a7c9b;
  }

  .timeline-dot.female {
    background: #9b6b8a;
  }

  .timeline-dot.unknown {
    background: #7a7a7a;
  }

  .timeline-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .decades-timeline {
    padding: 1.5rem;
    max-height: 60vh;
    overflow-y: auto;
  }

  .decade-section {
    margin-bottom: 2rem;
  }

  .decade-marker {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px dashed var(--border-subtle);
  }

  .decade-year {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--accent-soft);
  }

  .decade-count {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .decade-members {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .memorial-card {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
    font-family: var(--font-body);
    overflow: hidden;
  }

  .memorial-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    opacity: 0.6;
  }

  .memorial-card.male::before {
    background: linear-gradient(90deg, transparent, #4a7c9b, transparent);
  }

  .memorial-card.female::before {
    background: linear-gradient(90deg, transparent, #9b6b8a, transparent);
  }

  .memorial-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    border-color: var(--accent-soft);
  }

  .card-candle {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .flame {
    width: 6px;
    height: 10px;
    background: linear-gradient(180deg, #fff4c4 0%, #ffb347 50%, #ff6b35 100%);
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    animation: flicker 1.5s ease-in-out infinite alternate;
    box-shadow: 0 0 8px rgba(255, 179, 71, 0.6);
  }

  @keyframes flicker {
    0%, 100% { transform: scale(1) rotate(-2deg); opacity: 0.9; }
    50% { transform: scale(1.1) rotate(2deg); opacity: 1; }
  }

  .candle-body {
    width: 4px;
    height: 16px;
    background: linear-gradient(180deg, #f5f0e6 0%, #d4c8b8 100%);
    border-radius: 0 0 2px 2px;
  }

  .card-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .memorial-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .memorial-card.male .memorial-avatar {
    background: linear-gradient(135deg, #4a7c9b 0%, #2d5a7b 100%);
  }

  .memorial-card.female .memorial-avatar {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .memorial-card.unknown .memorial-avatar {
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .memorial-info {
    flex: 1;
    min-width: 0;
  }

  .memorial-info h3 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.2rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 2rem;
  }

  .life-dates {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .separator {
    margin: 0 0.25rem;
    color: var(--text-muted);
  }

  .age-badge {
    display: inline-block;
    margin-top: 0.25rem;
    padding: 0.15rem 0.5rem;
    background: var(--bg-elevated);
    border-radius: 10px;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .death-place {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--border-subtle);
  }

  .death-place svg {
    opacity: 0.6;
    flex-shrink: 0;
  }

  .death-place span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .no-data {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }

  .no-data .hint {
    font-size: 0.9rem;
    margin-top: 0.5rem;
    opacity: 0.7;
  }

  .memorial-footer {
    text-align: center;
    padding: 2rem;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-elevated);
  }

  .memorial-footer p {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-style: italic;
    color: var(--text-muted);
  }

  @media (max-width: 600px) {
    .memorial-stats {
      gap: 1.5rem;
    }

    .decade-members {
      grid-template-columns: 1fr;
    }

    .memorial-header h2 {
      font-size: 1.6rem;
    }
  }
</style>

