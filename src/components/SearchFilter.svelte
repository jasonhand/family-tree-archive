<script>
  import { searchQuery, filterOptions, filteredData, familyData, sortOrder, favorites, flaggedRecords } from '../stores/familyStore.js';

  let showFilters = false;
  let showOnlyFavorites = false;
  let showOnlyFlagged = false;

  const sortOptions = [
    { value: 'name', label: 'Name (A-Z)' },
    { value: 'age-young', label: 'Age (Youngest First)' },
    { value: 'age-old', label: 'Age (Oldest First)' },
    { value: 'birth-new', label: 'Birth Date (Newest)' },
    { value: 'birth-old', label: 'Birth Date (Oldest)' },
    { value: 'death-new', label: 'Death Date (Most Recent)' },
    { value: 'death-old', label: 'Death Date (Oldest)' }
  ];

  function clearFilters() {
    searchQuery.set('');
    filterOptions.set({
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
    sortOrder.set('name');
    showOnlyFavorites = false;
    showOnlyFlagged = false;
  }

  function clearLocationFilter(type) {
    filterOptions.update(opts => ({ ...opts, [type]: null }));
  }

  // Check if any location filters are active
  $: hasLocationFilters = $filterOptions.birthState || $filterOptions.birthCity || 
    $filterOptions.birthCountry || $filterOptions.deathState || $filterOptions.deathCity ||
    $filterOptions.residenceState || $filterOptions.residenceCity;

  // Get list of active location filters for display
  $: activeLocationFilters = [
    $filterOptions.birthState && { type: 'birthState', label: `Born in ${$filterOptions.birthState}`, icon: '★' },
    $filterOptions.birthCity && { type: 'birthCity', label: `Born in ${$filterOptions.birthCity}`, icon: '★' },
    $filterOptions.birthCountry && { type: 'birthCountry', label: `Born in ${$filterOptions.birthCountry}`, icon: '★' },
    $filterOptions.deathState && { type: 'deathState', label: `Died in ${$filterOptions.deathState}`, icon: '✝' },
    $filterOptions.deathCity && { type: 'deathCity', label: `Died in ${$filterOptions.deathCity}`, icon: '✝' },
    $filterOptions.residenceState && { type: 'residenceState', label: `Lived in ${$filterOptions.residenceState}`, icon: '🏠' },
    $filterOptions.residenceCity && { type: 'residenceCity', label: `Lived in ${$filterOptions.residenceCity}`, icon: '🏠' },
  ].filter(Boolean);

  $: favoritesCount = $favorites.size;
  $: flaggedCount = $flaggedRecords.size;

  // Export the filters for parent component
  export { showOnlyFavorites, showOnlyFlagged };

  // Get unique centuries from data
  $: centuries = [...new Set(
    $familyData
      .map(p => p.birth_date)
      .filter(Boolean)
      .map(d => {
        const match = d.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
        return match ? Math.ceil(parseInt(match[1]) / 100) : null;
      })
      .filter(Boolean)
  )].sort((a, b) => b - a);
  
  // Calculate age range from data
  function getAge(person) {
    const birthYear = person.birth_date?.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/)?.[1];
    if (!birthYear) return null;
    
    if (person.death_date) {
      const deathYear = person.death_date?.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/)?.[1];
      return deathYear ? parseInt(deathYear) - parseInt(birthYear) : null;
    }
    
    return new Date().getFullYear() - parseInt(birthYear);
  }
  
  $: ages = $familyData
    .map(getAge)
    .filter(age => age !== null);
  
  $: minAge = ages.length > 0 ? Math.min(...ages) : 0;
  $: maxAge = ages.length > 0 ? Math.max(...ages) : 120;
  
  // Initialize age range if not set
  $: if ($filterOptions.ageMin === null && $filterOptions.ageMax === null) {
    // Don't auto-set, let user set it
  }
  
  let ageMinValue = $filterOptions.ageMin ?? minAge;
  let ageMaxValue = $filterOptions.ageMax ?? maxAge;
  
  // Update local values when filterOptions change externally (but not when user is typing)
  let isUserInputting = false;
  
  $: if (!isUserInputting) {
    if ($filterOptions.ageMin !== null) {
      ageMinValue = $filterOptions.ageMin;
    } else if (ageMinValue !== minAge) {
      ageMinValue = minAge;
    }
    
    if ($filterOptions.ageMax !== null) {
      ageMaxValue = $filterOptions.ageMax;
    } else if (ageMaxValue !== maxAge) {
      ageMaxValue = maxAge;
    }
  }
  
  function updateAgeFilter() {
    isUserInputting = false;
    
    // Clamp values to valid range first
    if (ageMinValue < minAge) ageMinValue = minAge;
    if (ageMinValue > maxAge) ageMinValue = maxAge;
    if (ageMaxValue < minAge) ageMaxValue = minAge;
    if (ageMaxValue > maxAge) ageMaxValue = maxAge;
    
    // Ensure min doesn't exceed max and vice versa
    if (ageMinValue > ageMaxValue) {
      ageMinValue = ageMaxValue;
    }
    if (ageMaxValue < ageMinValue) {
      ageMaxValue = ageMinValue;
    }
    
    filterOptions.update(opts => ({
      ...opts,
      ageMin: ageMinValue === minAge ? null : ageMinValue,
      ageMax: ageMaxValue === maxAge ? null : ageMaxValue
    }));
  }
  
  function handleAgeInput() {
    isUserInputting = true;
  }
  
  function clearAgeFilter() {
    ageMinValue = minAge;
    ageMaxValue = maxAge;
    filterOptions.update(opts => ({
      ...opts,
      ageMin: null,
      ageMax: null
    }));
  }
  
  $: hasAgeFilter = $filterOptions.ageMin !== null || $filterOptions.ageMax !== null;
</script>

<div class="search-filter-bar">
  <div class="search-box">
    <svg class="search-icon" viewBox="0 0 24 24" width="20" height="20">
      <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2"/>
    </svg>
    <input 
      type="text" 
      placeholder="Search by name or place..."
      bind:value={$searchQuery}
    />
    {#if $searchQuery}
      <button class="clear-search" on:click={() => searchQuery.set('')}>×</button>
    {/if}
  </div>

  <div class="sort-control">
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path d="M3 6h18M6 12h12M9 18h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>
    <select bind:value={$sortOrder}>
      {#each sortOptions as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>

  {#if favoritesCount > 0}
    <button 
      class="favorites-toggle" 
      class:active={showOnlyFavorites} 
      on:click={() => { showOnlyFavorites = !showOnlyFavorites; if (showOnlyFavorites) showOnlyFlagged = false; }}
      title="Show only favorites"
    >
      <svg viewBox="0 0 24 24" width="18" height="18">
        <polygon 
          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" 
          fill={showOnlyFavorites ? 'currentColor' : 'none'} 
          stroke="currentColor" 
          stroke-width="2"
        />
      </svg>
      <span class="fav-count">{favoritesCount}</span>
    </button>
  {/if}

  {#if flaggedCount > 0}
    <button 
      class="flagged-toggle" 
      class:active={showOnlyFlagged} 
      on:click={() => { showOnlyFlagged = !showOnlyFlagged; if (showOnlyFlagged) showOnlyFavorites = false; }}
      title="Show flagged records"
    >
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path 
          d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" 
          fill={showOnlyFlagged ? 'currentColor' : 'none'} 
          stroke="currentColor" 
          stroke-width="2"
        />
        <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" stroke-width="2"/>
      </svg>
      <span class="flag-count">{flaggedCount}</span>
    </button>
  {/if}

  <button class="filter-toggle" class:active={showFilters} on:click={() => showFilters = !showFilters}>
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>
    Filters
  </button>

  <div class="results-count">
    <span class="count">{$filteredData.length}</span>
    <span class="label">of {$familyData.length}</span>
  </div>
</div>

{#if showFilters}
  <div class="filter-panel">
    <div class="filter-group">
      <label>Gender</label>
      <div class="filter-options">
        <button 
          class:active={$filterOptions.sex === 'all'} 
          on:click={() => $filterOptions.sex = 'all'}
        >All</button>
        <button 
          class:active={$filterOptions.sex === 'M'} 
          on:click={() => $filterOptions.sex = 'M'}
        >Male</button>
        <button 
          class:active={$filterOptions.sex === 'F'} 
          on:click={() => $filterOptions.sex = 'F'}
        >Female</button>
      </div>
    </div>

    <div class="filter-group">
      <label>Status</label>
      <div class="filter-options">
        <button 
          class:active={$filterOptions.hasDeathDate === 'all'} 
          on:click={() => $filterOptions.hasDeathDate = 'all'}
        >All</button>
        <button 
          class:active={$filterOptions.hasDeathDate === 'living'} 
          on:click={() => $filterOptions.hasDeathDate = 'living'}
        >Living</button>
        <button 
          class:active={$filterOptions.hasDeathDate === 'deceased'} 
          on:click={() => $filterOptions.hasDeathDate = 'deceased'}
        >Deceased</button>
      </div>
    </div>

    <div class="filter-group">
      <label>Notes</label>
      <div class="filter-options">
        <button 
          class:active={$filterOptions.hasNotes === 'all'} 
          on:click={() => $filterOptions.hasNotes = 'all'}
        >All</button>
        <button 
          class:active={$filterOptions.hasNotes === 'yes'} 
          on:click={() => $filterOptions.hasNotes = 'yes'}
        >With Notes</button>
        <button 
          class:active={$filterOptions.hasNotes === 'no'} 
          on:click={() => $filterOptions.hasNotes = 'no'}
        >No Notes</button>
      </div>
    </div>

    <div class="filter-group">
      <label>Birth Century</label>
      <div class="filter-options">
        <button 
          class:active={$filterOptions.birthCentury === 'all'} 
          on:click={() => $filterOptions.birthCentury = 'all'}
        >All</button>
        {#each centuries as century}
          <button 
            class:active={$filterOptions.birthCentury === century.toString()} 
            on:click={() => $filterOptions.birthCentury = century.toString()}
          >{century}00s</button>
        {/each}
      </div>
    </div>

    <div class="filter-group age-filter-group">
      <label>Age Range</label>
      <div class="age-slider-container">
        <div class="age-inputs">
          <input 
            type="number" 
            bind:value={ageMinValue}
            on:input={handleAgeInput}
            on:change={updateAgeFilter}
            on:blur={updateAgeFilter}
            min={minAge}
            max={maxAge}
            step="1"
            class="age-input"
            placeholder="Min"
          />
          <span class="age-separator">-</span>
          <input 
            type="number" 
            bind:value={ageMaxValue}
            on:input={handleAgeInput}
            on:change={updateAgeFilter}
            on:blur={updateAgeFilter}
            min={minAge}
            max={maxAge}
            step="1"
            class="age-input"
            placeholder="Max"
          />
          {#if hasAgeFilter}
            <button class="clear-age-filter" on:click={clearAgeFilter} title="Clear age filter">×</button>
          {/if}
        </div>
        <div class="age-slider-wrapper">
          <div class="age-slider-track">
            <div 
              class="age-slider-range" 
              style="left: {((ageMinValue - minAge) / (maxAge - minAge)) * 100}%; width: {((ageMaxValue - ageMinValue) / (maxAge - minAge)) * 100}%;"
            ></div>
          </div>
          <input 
            type="range" 
            bind:value={ageMinValue}
            on:input={updateAgeFilter}
            min={minAge}
            max={maxAge}
            step="1"
            class="age-slider age-slider-min"
          />
          <input 
            type="range" 
            bind:value={ageMaxValue}
            on:input={updateAgeFilter}
            min={minAge}
            max={maxAge}
            step="1"
            class="age-slider age-slider-max"
          />
        </div>
        <div class="age-range-display">
          <span class="age-range-label">Range: {ageMinValue} - {ageMaxValue} years</span>
        </div>
      </div>
    </div>

    <button class="clear-all" on:click={clearFilters}>Clear All Filters</button>
  </div>
{/if}

{#if hasLocationFilters}
  <div class="location-filters-bar">
    <span class="location-filters-label">Location filters:</span>
    {#each activeLocationFilters as filter}
      <span class="location-filter-tag">
        <span class="filter-icon">{filter.icon}</span>
        {filter.label}
        <button class="remove-filter" on:click={() => clearLocationFilter(filter.type)}>×</button>
      </span>
    {/each}
    <button class="clear-location-filters" on:click={() => {
      filterOptions.update(opts => ({
        ...opts,
        birthState: null,
        birthCity: null,
        birthCountry: null,
        deathState: null,
        deathCity: null,
        residenceState: null,
        residenceCity: null
      }));
    }}>Clear all location filters</button>
  </div>
{/if}

<style>
  .search-filter-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1;
    min-width: 280px;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-box input {
    width: 100%;
    padding: 0.85rem 2.5rem 0.85rem 3rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 1rem;
    transition: all 0.2s ease;
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--accent-gold);
    box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.1);
  }

  .search-box input::placeholder {
    color: var(--text-muted);
  }

  .clear-search {
    position: absolute;
    right: 0.75rem;
    background: var(--bg-elevated);
    border: none;
    color: var(--text-muted);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-search:hover {
    background: var(--accent-copper);
    color: white;
  }

  .sort-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
  }

  .sort-control svg {
    flex-shrink: 0;
  }

  .sort-control select {
    padding: 0.7rem 2rem 0.7rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b7e6f' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    transition: all 0.2s ease;
  }

  .sort-control select:hover {
    border-color: var(--accent-gold);
  }

  .sort-control select:focus {
    outline: none;
    border-color: var(--accent-gold);
    box-shadow: 0 0 0 2px rgba(212, 168, 83, 0.1);
  }

  .favorites-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.7rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 0.9rem;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .favorites-toggle:hover {
    border-color: var(--accent-gold);
    color: var(--accent-gold);
  }

  .favorites-toggle.active {
    background: var(--accent-gold);
    border-color: var(--accent-gold);
    color: var(--bg-deep);
  }

  .fav-count {
    font-weight: 600;
    font-size: 0.85rem;
  }

  .flagged-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.7rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 0.9rem;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .flagged-toggle:hover {
    border-color: var(--accent-copper);
    color: var(--accent-copper);
  }

  .flagged-toggle.active {
    background: var(--accent-copper);
    border-color: var(--accent-copper);
    color: white;
  }

  .flag-count {
    font-weight: 600;
    font-size: 0.85rem;
  }

  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.85rem 1.25rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.95rem;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-toggle:hover {
    border-color: var(--accent-gold);
    color: var(--text-primary);
  }

  .filter-toggle.active {
    background: var(--accent-gold);
    color: var(--bg-deep);
    border-color: var(--accent-gold);
  }

  .results-count {
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .results-count .count {
    font-weight: 600;
    color: var(--accent-gold);
  }

  .filter-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    padding: 1.25rem;
    background: var(--bg-card);
    border-radius: var(--radius-md);
    margin-top: 1rem;
    border: 1px solid var(--border-subtle);
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-group label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    font-weight: 500;
  }

  .filter-options {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .filter-options button {
    padding: 0.5rem 0.9rem;
    background: var(--bg-elevated);
    border: 1px solid transparent;
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.85rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-options button:hover {
    background: var(--accent-muted);
    color: var(--text-primary);
  }

  .filter-options button.active {
    background: var(--accent-sage);
    color: white;
    font-weight: 500;
  }

  .clear-all {
    margin-left: auto;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--accent-copper);
    color: var(--accent-copper);
    font-family: var(--font-body);
    font-size: 0.85rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .clear-all:hover {
    background: var(--accent-copper);
    color: white;
  }

  /* Location Filters Bar */
  .location-filters-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, rgba(212, 168, 83, 0.1) 0%, rgba(139, 126, 111, 0.1) 100%);
    border-radius: var(--radius-md);
    margin-top: 0.75rem;
    border: 1px solid rgba(212, 168, 83, 0.2);
  }

  .location-filters-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .location-filter-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.6rem;
    background: var(--accent-gold);
    color: var(--bg-deep);
    font-size: 0.8rem;
    font-weight: 500;
    border-radius: 20px;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }

  .filter-icon {
    font-size: 0.9rem;
  }

  .remove-filter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: rgba(0, 0, 0, 0.2);
    border: none;
    border-radius: 50%;
    color: var(--bg-deep);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-left: 0.2rem;
  }

  .remove-filter:hover {
    background: rgba(0, 0, 0, 0.4);
  }

  .clear-location-filters {
    margin-left: auto;
    padding: 0.35rem 0.75rem;
    background: transparent;
    border: 1px solid var(--text-muted);
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 0.75rem;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .clear-location-filters:hover {
    border-color: var(--accent-copper);
    color: var(--accent-copper);
  }

  /* Age Filter Styles */
  .age-filter-group {
    min-width: 300px;
  }

  .age-slider-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .age-inputs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .age-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    width: 80px;
    text-align: center;
  }

  .age-input:focus {
    outline: none;
    border-color: var(--accent-gold);
    box-shadow: 0 0 0 2px rgba(212, 168, 83, 0.1);
  }

  .age-separator {
    color: var(--text-muted);
    font-weight: 600;
  }

  .clear-age-filter {
    width: 24px;
    height: 24px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 50%;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .clear-age-filter:hover {
    background: var(--accent-copper);
    color: white;
    border-color: var(--accent-copper);
  }

  .age-slider-wrapper {
    position: relative;
    height: 50px;
    display: flex;
    align-items: center;
    padding: 0 9px;
  }

  .age-slider-track {
    position: absolute;
    left: 9px;
    right: 9px;
    height: 6px;
    background: var(--bg-elevated);
    border-radius: 3px;
    z-index: 0;
    top: 50%;
    transform: translateY(-50%);
  }

  .age-slider-range {
    position: absolute;
    height: 6px;
    background: var(--accent-gold);
    border-radius: 3px;
    z-index: 1;
    pointer-events: none;
    top: 50%;
    transform: translateY(-50%);
  }

  .age-slider {
    position: absolute;
    width: calc(100% - 18px);
    left: 9px;
    height: 20px;
    background: transparent;
    outline: none;
    -webkit-appearance: none;
    z-index: 2;
    top: 50%;
    transform: translateY(-50%);
    margin: 0;
    cursor: pointer;
    pointer-events: all;
  }
  
  .age-slider-min {
    z-index: 3;
  }
  
  .age-slider-max {
    z-index: 2;
  }

  .age-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--accent-gold);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(212, 168, 83, 0.3);
    transition: all 0.2s ease;
    position: relative;
    z-index: 3;
  }

  .age-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 3px 6px rgba(212, 168, 83, 0.4);
  }

  .age-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--accent-gold);
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(212, 168, 83, 0.3);
    transition: all 0.2s ease;
  }

  .age-slider::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 3px 6px rgba(212, 168, 83, 0.4);
  }

  .age-slider-min {
    z-index: 3;
  }

  .age-slider-max {
    z-index: 2;
  }

  .age-range-display {
    text-align: center;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .age-range-label {
    font-weight: 500;
  }
</style>

