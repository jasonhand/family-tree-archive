<script>
  import { familyData } from '../../stores/familyStore.js';
  import { onMount, onDestroy } from 'svelte';
  
  let container;
  let isPlaying = false;
  let currentYear = 1700;
  let speed = 2; // years per frame
  let animationFrame;
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  $: timelineData = (() => {
    const data = {};
    const minYear = 1700;
    const maxYear = new Date().getFullYear();
    
    // Initialize all years
    for (let year = minYear; year <= maxYear; year++) {
      data[year] = { births: 0, deaths: 0, total: 0 };
    }
    
    // Count births and deaths by year
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      const deathYear = extractYear(person.death_date);
      
      if (birthYear && birthYear >= minYear && birthYear <= maxYear) {
        data[birthYear].births++;
      }
      if (deathYear && deathYear >= minYear && deathYear <= maxYear) {
        data[deathYear].deaths++;
      }
    });
    
    // Calculate running total
    let total = 0;
    const result = [];
    for (let year = minYear; year <= maxYear; year++) {
      total += data[year].births;
      total -= data[year].deaths;
      data[year].total = Math.max(0, total); // Ensure non-negative
      result.push({ year, ...data[year] });
    }
    
    return result;
  })();
  
  $: maxPopulation = Math.max(...timelineData.map(d => d.total), 1);
  $: currentData = timelineData.find(d => d.year === currentYear) || timelineData[0];
  $: minYear = timelineData[0]?.year || 1700;
  $: maxYear = timelineData[timelineData.length - 1]?.year || new Date().getFullYear();
  
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
  
  let animationInterval;
  
  onMount(() => {
    return () => {
      if (animationInterval) {
        clearInterval(animationInterval);
      }
    };
  });
  
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

<div class="population-race-chart">
  <div class="chart-header">
    <h3>Family Population Growth Over Time</h3>
    <p class="chart-description">
      Watch your family tree grow and evolve over the centuries. Each bar represents the total number of family members alive in that year.
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
  
  {#if timelineData.length === 0}
    <div class="no-data">
      <p>No date data available for population chart.</p>
      <p>People need birth dates to appear in this visualization.</p>
    </div>
  {:else}
    <div class="chart-container" bind:this={container}>
      <div class="stats-display">
      <div class="stat-box">
        <span class="stat-label">Total Family Members</span>
        <span class="stat-value total">{currentData?.total || 0}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Births This Year</span>
        <span class="stat-value births">{currentData?.births || 0}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Deaths This Year</span>
        <span class="stat-value deaths">{currentData?.deaths || 0}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Net Change</span>
        <span class="stat-value" class:positive={currentData && currentData.births > currentData.deaths} class:negative={currentData && currentData.deaths > currentData.births}>
          {currentData ? (currentData.births - currentData.deaths) : 0}
        </span>
      </div>
    </div>
    
    <div class="timeline-bar-container">
      <div class="timeline-bar">
        {#each timelineData as data}
          <div 
            class="year-bar" 
            class:active={data.year === currentYear}
            class:past={data.year < currentYear}
            style="height: {((data.total / maxPopulation) * 100)}%"
            title="{data.year}: {data.total} people (Births: {data.births}, Deaths: {data.deaths})"
          ></div>
        {/each}
      </div>
      <div class="timeline-labels">
        <span>{minYear}</span>
        <span>{Math.floor((minYear + maxYear) / 2)}</span>
        <span>{maxYear}</span>
      </div>
    </div>
  </div>
  {/if}
</div>

<style>
  .population-race-chart {
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
  
  .chart-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .stats-display {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .stat-box {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    text-align: center;
    border: 1px solid var(--border-subtle);
    transition: all 0.2s ease;
  }
  
  .stat-box:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-soft);
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
    color: var(--text-primary);
    font-family: var(--font-display);
  }
  
  .stat-value.total {
    color: var(--accent-gold);
  }
  
  .stat-value.births {
    color: var(--accent-sage);
  }
  
  .stat-value.deaths {
    color: var(--accent-copper);
  }
  
  .stat-value.positive {
    color: var(--accent-sage);
  }
  
  .stat-value.negative {
    color: var(--accent-copper);
  }
  
  .timeline-bar-container {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .timeline-bar {
    display: flex;
    align-items: flex-end;
    gap: 1px;
    height: 400px;
    margin-bottom: 0.5rem;
    position: relative;
  }
  
  .year-bar {
    flex: 1;
    min-width: 1px;
    background: rgba(212, 168, 83, 0.4);
    transition: all 0.2s ease;
    border-radius: 2px 2px 0 0;
    cursor: pointer;
  }
  
  .year-bar.past {
    background: var(--accent-gold);
  }
  
  .year-bar.active {
    background: var(--accent-sage);
    box-shadow: 0 0 15px rgba(122, 158, 126, 0.6);
    z-index: 10;
    min-width: 3px;
  }
  
  .year-bar:hover {
    opacity: 0.8;
  }
  
  .timeline-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-muted);
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-subtle);
  }
  
  .no-data {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }
  
  .no-data p {
    margin: 0.5rem 0;
  }
</style>

