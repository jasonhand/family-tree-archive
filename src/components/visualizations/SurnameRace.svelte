<script>
  import { createEventDispatcher } from 'svelte';
  import { familyData, searchQuery } from '../../stores/familyStore.js';
  
  const dispatch = createEventDispatcher();
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  function getSurname(name) {
    if (!name) return 'Unknown';
    const parts = name.split(' ');
    return parts[parts.length - 1] || 'Unknown';
  }
  
  // Color palette for surnames - distinct, vibrant colors
  const colorPalette = [
    '#d4a853', // gold
    '#7a9e7e', // sage
    '#9b6b8a', // purple
    '#4a7c9b', // blue
    '#c47a5a', // copper
    '#8b7e9b', // lavender
    '#6b8cce', // light blue
    '#d49a6a', // peach
    '#7ba8a8', // teal
    '#a87ba8', // mauve
    '#8ba87b', // olive
    '#a87b7b', // rose
    '#7b8ba8', // periwinkle
    '#a8a87b', // khaki
    '#8b7b7b', // taupe
    '#7ba87b', // mint
    '#a87b8b', // dusty rose
    '#8b8b7b', // sage gray
    '#7b7ba8', // indigo
    '#a8a87b'  // yellow-green
  ];
  
  // Generate a consistent color for a surname
  function getSurnameColor(surname) {
    // Use a simple hash to consistently assign colors
    let hash = 0;
    for (let i = 0; i < surname.length; i++) {
      hash = surname.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colorPalette.length;
    return colorPalette[index];
  }
  
  // Create color mapping for all surnames
  $: surnameColorMap = (() => {
    const map = new Map();
    surnameData.forEach(surname => {
      map.set(surname.surname, getSurnameColor(surname.surname));
    });
    return map;
  })();
  
  let isPlaying = false;
  let currentYear = 1700;
  let speed = 2;
  let animationInterval;
  let topCount = 10; // Show top N surnames
  
  $: surnameData = (() => {
    const surnameCounts = new Map(); // surname -> { count: 0, firstYear: null, lastYear: null }
    const minYear = 1700;
    const maxYear = new Date().getFullYear();
    
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      if (!birthYear || birthYear < minYear || birthYear > maxYear) return;
      
      const surname = getSurname(person.name);
      if (!surnameCounts.has(surname)) {
        surnameCounts.set(surname, { count: 0, firstYear: birthYear, lastYear: birthYear });
      }
      const data = surnameCounts.get(surname);
      data.count++;
      if (birthYear < data.firstYear) data.firstYear = birthYear;
      if (birthYear > data.lastYear) data.lastYear = birthYear;
    });
    
    return Array.from(surnameCounts.entries())
      .map(([surname, data]) => ({
        surname,
        ...data
      }))
      .sort((a, b) => b.count - a.count);
  })();
  
  $: minYear = surnameData.length > 0 ? Math.min(...surnameData.map(d => d.firstYear)) : 1700;
  $: maxYear = new Date().getFullYear();
  $: maxCount = surnameData.length > 0 ? Math.max(...surnameData.map(d => d.count)) : 1;
  
  // Calculate counts up to current year
  $: currentYearData = (() => {
    const counts = new Map();
    surnameData.forEach(surname => {
      counts.set(surname.surname, 0);
    });
    
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      if (!birthYear || birthYear > currentYear) return;
      
      const surname = getSurname(person.name);
      counts.set(surname, (counts.get(surname) || 0) + 1);
    });
    
    return Array.from(counts.entries())
      .map(([surname, count]) => ({
        surname,
        count,
        totalCount: surnameData.find(s => s.surname === surname)?.count || 0,
        color: surnameColorMap.get(surname) || colorPalette[0]
      }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, topCount);
  })();
  
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
  
  function handleSurnameClick(surname) {
    // Set search query to filter by surname
    searchQuery.set(surname);
    // Dispatch event to switch to gallery view
    dispatch('filterBySurname', surname);
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

<div class="surname-race">
  <div class="chart-header">
    <h3>Surname Popularity Race</h3>
    <p class="chart-description">
      Watch surnames compete for popularity over time. This animated bar chart shows how different surnames grow in your family tree as people are born.
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
      <select bind:value={topCount} class="count-select">
        <option value={5}>Top 5</option>
        <option value={10}>Top 10</option>
        <option value={15}>Top 15</option>
        <option value={20}>Top 20</option>
      </select>
    </div>
  </div>
  
  {#if surnameData.length === 0}
    <div class="no-data">
      <p>No surname data available.</p>
      <p>People need names to appear in this visualization.</p>
    </div>
  {:else}
    <div class="race-chart">
      {#each currentYearData as item, index}
        {@const width = (item.count / maxCount) * 100}
        {@const rank = index + 1}
        <div 
          class="race-bar" 
          style="width: {width}%; background: linear-gradient(90deg, {item.color} 0%, {item.color}dd 100%);"
        >
          <div class="bar-content">
            <span class="bar-rank">#{rank}</span>
            <span class="bar-label">{item.surname}</span>
            <span class="bar-count">{item.count}</span>
          </div>
        </div>
      {/each}
    </div>
    
    <div class="surname-stats">
      <h4>All Surnames (Total Count)</h4>
      <div class="surnames-grid">
        {#each surnameData.slice(0, 20) as surname}
          {@const color = surnameColorMap.get(surname.surname) || colorPalette[0]}
          <button 
            class="surname-card" 
            on:click={() => handleSurnameClick(surname.surname)}
            title="Click to filter gallery by {surname.surname}"
          >
            <div class="surname-color-indicator" style="background: {color};"></div>
            <div class="surname-info">
              <span class="surname-name">{surname.surname}</span>
              <span class="surname-count">{surname.count}</span>
              <span class="surname-years">{surname.firstYear} - {surname.lastYear}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .surname-race {
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
  
  .speed-select,
  .count-select {
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
  
  .race-chart {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    margin-bottom: 2rem;
    min-height: 400px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  
  .race-bar {
    border-radius: var(--radius-sm);
    transition: width 0.3s ease, background 0.3s ease;
    min-height: 40px;
    display: flex;
    align-items: center;
    padding: 0 1rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  .bar-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }
  
  .bar-rank {
    font-weight: 700;
    color: var(--bg-deep);
    font-size: 1.1rem;
    min-width: 30px;
  }
  
  .bar-label {
    flex: 1;
    font-weight: 600;
    color: var(--bg-deep);
    font-size: 1rem;
  }
  
  .bar-count {
    font-weight: 700;
    color: var(--bg-deep);
    font-size: 1.2rem;
    font-family: var(--font-display);
  }
  
  .surname-stats {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .surname-stats h4 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .surnames-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
  }
  
  .surname-card {
    background: var(--bg-card);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.2s ease;
    cursor: pointer;
    width: 100%;
    text-align: left;
    font-family: inherit;
  }
  
  .surname-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-soft);
    border-color: var(--accent-gold);
    background: var(--bg-elevated);
  }
  
  .surname-card:active {
    transform: translateY(0);
  }
  
  .surname-color-indicator {
    width: 4px;
    height: 100%;
    min-height: 40px;
    border-radius: 2px;
    flex-shrink: 0;
  }
  
  .surname-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }
  
  .surname-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.95rem;
  }
  
  .surname-count {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--accent-gold);
    font-family: var(--font-display);
  }
  
  .surname-years {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>

