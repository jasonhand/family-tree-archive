<script>
  import { createEventDispatcher } from 'svelte';
  import { getEventTypeIcon, getOutcomeClass } from '../stores/historyStore.js';

  export let events = [];
  export let personName = '';
  export let startYear = null;
  export let endYear = null;

  const dispatch = createEventDispatcher();

  let searchQuery = '';
  let selectedType = 'all';
  let selectedDecade = 'all';

  // Get unique event types
  $: eventTypes = [...new Set(events.map(e => e['Type of Event']).filter(Boolean))].sort();

  // Get unique decades
  $: decades = [...new Set(events.map(e => Math.floor(e.parsedYear / 10) * 10))].sort((a, b) => a - b);

  // Filter events
  $: filteredEvents = events.filter(event => {
    const matchesSearch = !searchQuery || 
      event['Name of Incident']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.Country?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event['Place Name']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.Impact?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'all' || event['Type of Event'] === selectedType;
    
    const eventDecade = Math.floor(event.parsedYear / 10) * 10;
    const matchesDecade = selectedDecade === 'all' || eventDecade === parseInt(selectedDecade);
    
    return matchesSearch && matchesType && matchesDecade;
  });

  // Group by decade for display
  $: groupedEvents = (() => {
    const groups = {};
    filteredEvents.forEach(event => {
      const decade = `${Math.floor(event.parsedYear / 10) * 10}s`;
      if (!groups[decade]) groups[decade] = [];
      groups[decade].push(event);
    });
    return Object.entries(groups).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  })();

  function close() {
    dispatch('close');
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function clearFilters() {
    searchQuery = '';
    selectedType = 'all';
    selectedDecade = 'all';
  }

  $: hasActiveFilters = searchQuery || selectedType !== 'all' || selectedDecade !== 'all';
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="modal-overlay" on:click={close} role="button" tabindex="0" on:keypress={(e) => e.key === 'Enter' && close()}>
  <div class="modal-container" on:click|stopPropagation role="dialog" aria-modal="true">
    <header class="modal-header">
      <div class="header-content">
        <h2>Historical Context</h2>
        <p class="subtitle">
          Events during {personName}'s lifetime
          <span class="year-range">({startYear} – {endYear || 'Present'})</span>
        </p>
      </div>
      <button class="close-btn" on:click={close}>
        <svg viewBox="0 0 24 24" width="24" height="24">
          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
    </header>

    <div class="filters-bar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2"/>
        </svg>
        <input 
          type="text" 
          placeholder="Search events..."
          bind:value={searchQuery}
        />
      </div>

      <select bind:value={selectedType}>
        <option value="all">All Types</option>
        {#each eventTypes as type}
          <option value={type}>{getEventTypeIcon(type)} {type}</option>
        {/each}
      </select>

      <select bind:value={selectedDecade}>
        <option value="all">All Decades</option>
        {#each decades as decade}
          <option value={decade}>{decade}s</option>
        {/each}
      </select>

      {#if hasActiveFilters}
        <button class="clear-filters" on:click={clearFilters}>
          Clear Filters
        </button>
      {/if}

      <div class="results-count">
        <strong>{filteredEvents.length}</strong> of {events.length} events
      </div>
    </div>

    <div class="events-container">
      {#if filteredEvents.length === 0}
        <div class="no-results">
          <span class="no-results-icon">🔍</span>
          <p>No events match your filters</p>
          <button on:click={clearFilters}>Clear Filters</button>
        </div>
      {:else}
        {#each groupedEvents as [decade, decadeEvents]}
          <div class="decade-group">
            <h3 class="decade-header">
              <span class="decade-label">{decade}</span>
              <span class="decade-count">{decadeEvents.length} events</span>
            </h3>
            <div class="events-grid">
              {#each decadeEvents as event}
                <div class="event-card {getOutcomeClass(event.Outcome)}">
                  <div class="event-header">
                    <span class="event-icon">{getEventTypeIcon(event['Type of Event'])}</span>
                    <span class="event-year">{event.parsedYear}</span>
                    <span class="event-type-badge">{event['Type of Event']}</span>
                  </div>
                  <h4 class="event-title">{event['Name of Incident']}</h4>
                  <div class="event-location">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" stroke-width="2"/>
                      <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    {event.Country}{event['Place Name'] && event['Place Name'] !== event.Country ? `, ${event['Place Name']}` : ''}
                  </div>
                  {#if event.Impact}
                    <p class="event-impact">{event.Impact}</p>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 10050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-container {
    background: var(--bg-main);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 1000px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.3s ease;
    overflow: hidden;
  }

  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem 2rem;
    background: linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-card) 100%);
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-content h2 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .subtitle {
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .year-range {
    color: var(--accent-gold);
    font-weight: 500;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--bg-card);
    color: var(--text-primary);
  }

  .filters-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-subtle);
    align-items: center;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.75rem;
    flex: 1;
    min-width: 200px;
  }

  .search-box svg {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .search-box input {
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    width: 100%;
  }

  .search-box input::placeholder {
    color: var(--text-muted);
  }

  .search-box input:focus {
    outline: none;
  }

  .filters-bar select {
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.85rem;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b7e6f' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
  }

  .filters-bar select:hover {
    border-color: var(--accent-gold);
  }

  .clear-filters {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--accent-copper);
    color: var(--accent-copper);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .clear-filters:hover {
    background: var(--accent-copper);
    color: white;
  }

  .results-count {
    margin-left: auto;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .results-count strong {
    color: var(--accent-gold);
  }

  .events-container {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 2rem;
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  .no-results-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .no-results button {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background: var(--accent-gold);
    color: var(--bg-deep);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-weight: 500;
  }

  .decade-group {
    margin-bottom: 2rem;
  }

  .decade-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--border-subtle);
  }

  .decade-label {
    font-family: var(--font-display);
    font-size: 1.3rem;
    color: var(--accent-gold);
  }

  .decade-count {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-weight: normal;
  }

  .events-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .event-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1rem;
    border-left: 4px solid var(--text-muted);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .event-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }

  .event-card.positive { border-left-color: var(--accent-sage); }
  .event-card.negative { border-left-color: var(--accent-copper); }
  .event-card.neutral { border-left-color: var(--text-muted); }

  .event-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .event-icon {
    font-size: 1.25rem;
  }

  .event-year {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--accent-gold);
  }

  .event-type-badge {
    margin-left: auto;
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    background: var(--bg-elevated);
    border-radius: 20px;
    color: var(--text-muted);
  }

  .event-title {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    line-height: 1.3;
  }

  .event-location {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .event-location svg {
    flex-shrink: 0;
    opacity: 0.7;
  }

  .event-impact {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.4;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-subtle);
  }

  /* Scrollbar styling */
  .events-container::-webkit-scrollbar {
    width: 8px;
  }

  .events-container::-webkit-scrollbar-track {
    background: var(--bg-card);
  }

  .events-container::-webkit-scrollbar-thumb {
    background: var(--border-subtle);
    border-radius: 4px;
  }

  .events-container::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }

  @media (max-width: 768px) {
    .modal-overlay {
      padding: 0;
    }

    .modal-container {
      max-height: 100vh;
      border-radius: 0;
    }

    .filters-bar {
      padding: 1rem;
    }

    .events-container {
      padding: 1rem;
    }

    .events-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

