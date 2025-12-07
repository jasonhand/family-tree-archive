<script>
  import { familyData, selectedPerson } from '../../stores/familyStore.js';
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  let isPlaying = false;
  let currentYear = 1700;
  let speed = 2;
  let animationInterval;
  
  $: expansionData = (() => {
    const locations = new Map(); // location -> { firstYear, count, people }
    const minYear = 1700;
    const maxYear = new Date().getFullYear();
    
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      if (!birthYear || birthYear < minYear || birthYear > maxYear) return;
      
      // Check birth location
      const location = person.birth_state || person.birth_country || 'Unknown';
      if (!locations.has(location)) {
        locations.set(location, { firstYear: birthYear, count: 0, people: [] });
      }
      const locData = locations.get(location);
      if (birthYear < locData.firstYear) {
        locData.firstYear = birthYear;
      }
      locData.count++;
      locData.people.push({ person: person, name: person.name, year: birthYear });
    });
    
    // Sort by first appearance year
    return Array.from(locations.entries())
      .map(([location, data]) => ({
        location,
        firstYear: data.firstYear,
        count: data.count,
        people: data.people.sort((a, b) => a.year - b.year)
      }))
      .sort((a, b) => a.firstYear - b.firstYear);
  })();
  
  $: minYear = expansionData.length > 0 ? Math.min(...expansionData.map(d => d.firstYear)) : 1700;
  $: maxYear = new Date().getFullYear();
  $: visibleLocations = expansionData.filter(d => d.firstYear <= currentYear);
  $: totalLocations = expansionData.length;
  
  function togglePlay() {
    isPlaying = !isPlaying;
  }
  
  function reset() {
    currentYear = minYear;
    isPlaying = false;
  }
  
  function handleYearChange() {
    if (currentYear < minYear) currentYear = minYear;
    if (currentYear > maxYear) currentYear = maxYear;
  }
  
  function handlePersonClick(person) {
    selectedPerson.set(person);
  }
  
  $: if (isPlaying && currentYear < maxYear) {
    if (animationInterval) clearInterval(animationInterval);
    animationInterval = setInterval(() => {
      if (isPlaying && currentYear < maxYear) {
        currentYear += speed;
        if (currentYear >= maxYear) {
          currentYear = maxYear;
          isPlaying = false;
          clearInterval(animationInterval);
        }
      } else {
        clearInterval(animationInterval);
      }
    }, 50);
  } else {
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = null;
    }
  }
</script>

<div class="geographic-expansion">
  <div class="chart-header">
    <h3>Geographic Expansion</h3>
    <p class="chart-description">
      Watch your family tree expand across different locations over time. This animated visualization shows when each state or country first appears in your family history.
    </p>
    <div class="controls">
      <button class="control-btn" on:click={togglePlay}>
        {#if isPlaying}
          <span>⏸️</span> Pause
        {:else}
          <span>▶️</span> Play
        {/if}
      </button>
      <button class="control-btn" on:click={reset}>⏮️ Reset</button>
      <div class="slider-container">
        <input 
          type="range" 
          min={minYear} 
          max={maxYear} 
          bind:value={currentYear}
          on:input={handleYearChange}
          class="year-slider" 
        />
        <span class="year-display">{currentYear}</span>
      </div>
      <select bind:value={speed} class="speed-select">
        <option value={1}>1x Speed</option>
        <option value={2}>2x Speed</option>
        <option value={5}>5x Speed</option>
        <option value={10}>10x Speed</option>
      </select>
    </div>
  </div>
  
  {#if expansionData.length === 0}
    <div class="no-data">
      <p>No geographic data available.</p>
      <p>People need birth locations to appear in this visualization.</p>
    </div>
  {:else}
    <div class="stats-display">
      <div class="stat-box">
        <span class="stat-label">Total Locations</span>
        <span class="stat-value">{totalLocations}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Locations by {currentYear}</span>
        <span class="stat-value">{visibleLocations.length}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">New This Year</span>
        <span class="stat-value">{expansionData.filter(d => d.firstYear === currentYear).length}</span>
      </div>
    </div>
    
    <div class="expansion-timeline">
      <div class="timeline-bar">
        {#each expansionData as location}
          {@const position = ((location.firstYear - minYear) / (maxYear - minYear)) * 100}
          {@const isVisible = location.firstYear <= currentYear}
          <div 
            class="location-marker" 
            class:visible={isVisible}
            style="left: {position}%"
            title="{location.location}: First appeared in {location.firstYear} ({location.count} people)"
          >
            <div class="marker-dot"></div>
            <div class="marker-label">{location.location}</div>
          </div>
        {/each}
      </div>
      <div class="timeline-labels">
        <span>{minYear}</span>
        <span>{Math.floor((minYear + maxYear) / 2)}</span>
        <span>{maxYear}</span>
      </div>
    </div>
    
    <div class="locations-list">
      <h4>Locations by First Appearance</h4>
      <div class="locations-grid">
        {#each visibleLocations as location}
          <div class="location-card">
            <div class="location-header">
              <span class="location-name">{location.location}</span>
              <span class="location-year">{location.firstYear}</span>
            </div>
            <div class="location-count">{location.count} {location.count === 1 ? 'person' : 'people'}</div>
            <div class="location-people">
              {#each location.people.slice(0, 3) as personData}
                <button 
                  class="person-tag" 
                  on:click={() => handlePersonClick(personData.person)}
                  title="Click to view {personData.name}'s details"
                >
                  {personData.name}
                </button>
              {/each}
              {#if location.people.length > 3}
                <span class="more-tag">+{location.people.length - 3} more</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .geographic-expansion {
    padding: 1.5rem;
  }
  
  .chart-header {
    margin-bottom: 2rem;
  }
  
  .chart-header h3 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
  
  .chart-description {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }
  
  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .control-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.2rem;
    background: var(--accent-gold);
    color: var(--bg-deep);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-weight: 600;
    font-family: var(--font-body);
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }
  
  .control-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .slider-container {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-width: 300px;
  }
  
  .year-slider {
    flex: 1;
    height: 6px;
    background: var(--bg-elevated);
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
  }
  
  .year-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--accent-gold);
    border-radius: 50%;
    cursor: pointer;
  }
  
  .year-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--accent-gold);
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
  
  .year-display {
    font-weight: 600;
    color: var(--accent-gold);
    min-width: 60px;
    font-size: 1.1rem;
  }
  
  .speed-select {
    padding: 0.6rem 1rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-family: var(--font-body);
    cursor: pointer;
  }
  
  .no-data {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }
  
  .no-data p {
    margin: 0.5rem 0;
  }
  
  .stats-display {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .stat-box {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    text-align: center;
    border: 1px solid var(--border-subtle);
  }
  
  .stat-label {
    display: block;
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .stat-value {
    display: block;
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--accent-gold);
    font-family: var(--font-display);
  }
  
  .expansion-timeline {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    margin-bottom: 2rem;
  }
  
  .timeline-bar {
    position: relative;
    height: 200px;
    margin-bottom: 1rem;
    border-left: 2px solid var(--border-subtle);
    border-right: 2px solid var(--border-subtle);
  }
  
  .location-marker {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .location-marker.visible {
    opacity: 1;
  }
  
  .marker-dot {
    width: 12px;
    height: 12px;
    background: var(--accent-gold);
    border-radius: 50%;
    margin: 0 auto 0.5rem;
    box-shadow: 0 0 10px rgba(212, 168, 83, 0.5);
  }
  
  .marker-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    white-space: nowrap;
    background: var(--bg-card);
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    transform: rotate(-45deg);
    transform-origin: top left;
    position: absolute;
    left: 50%;
    top: 20px;
  }
  
  .timeline-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-muted);
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-subtle);
  }
  
  .locations-list {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .locations-list h4 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .locations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
  }
  
  .location-card {
    background: var(--bg-card);
    padding: 1rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    transition: all 0.2s ease;
  }
  
  .location-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-soft);
  }
  
  .location-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .location-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 1rem;
  }
  
  .location-year {
    font-size: 0.85rem;
    color: var(--accent-gold);
    font-weight: 600;
    background: rgba(212, 168, 83, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
  }
  
  .location-count {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }
  
  .location-people {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .person-tag {
    font-size: 0.75rem;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: var(--font-body);
  }
  
  .person-tag:hover {
    background: var(--accent-gold);
    color: var(--bg-deep);
    border-color: var(--accent-gold);
    transform: translateY(-1px);
  }
  
  .more-tag {
    font-size: 0.75rem;
    color: var(--accent-gold);
    font-weight: 600;
  }
</style>

