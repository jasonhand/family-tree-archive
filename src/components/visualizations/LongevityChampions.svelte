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
  
  $: longevityData = (() => {
    const people = [];
    
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      const deathYear = extractYear(person.death_date);
      
      if (!birthYear || !deathYear) return;
      
      const age = deathYear - birthYear;
      if (age > 0 && age <= 120) {
        people.push({
          name: person.name,
          birthYear,
          deathYear,
          age,
          sex: person.sex,
          person: person
        });
      }
    });
    
    return people.sort((a, b) => b.age - a.age);
  })();
  
  $: minYear = longevityData.length > 0 ? Math.min(...longevityData.map(p => p.birthYear)) : 1700;
  $: maxYear = new Date().getFullYear();
  
  // Track oldest living person over time
  $: oldestByYear = (() => {
    const oldest = [];
    let currentOldest = null;
    let currentOldestAge = 0;
    
    for (let year = minYear; year <= currentYear; year++) {
      // Find oldest person alive at this year
      const alive = longevityData.filter(p => p.birthYear <= year && (p.deathYear >= year || !p.deathYear));
      const oldestAlive = alive.reduce((oldest, person) => {
        const age = year - person.birthYear;
        return age > oldest.age ? { person, age } : oldest;
      }, { person: null, age: 0 });
      
      if (oldestAlive.person && oldestAlive.age > currentOldestAge) {
        currentOldest = oldestAlive.person;
        currentOldestAge = oldestAlive.age;
        oldest.push({
          year,
          person: currentOldest,
          age: currentOldestAge
        });
      } else if (currentOldest && oldestAlive.person?.id === currentOldest.id) {
        oldest.push({
          year,
          person: currentOldest,
          age: year - currentOldest.birthYear
        });
      }
    }
    
    return oldest;
  })();
  
  $: currentChampion = oldestByYear.length > 0 ? oldestByYear[oldestByYear.length - 1] : null;
  $: topLongevity = longevityData.slice(0, 20);
  
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

<div class="longevity-champions">
  <div class="chart-header">
    <h3>Longevity Champions</h3>
    <p class="chart-description">
      Track the longest-lived individuals in your family tree over time. Watch as new champions emerge and see who held the title of oldest family member throughout history.
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
  
  {#if longevityData.length === 0}
    <div class="no-data">
      <p>No longevity data available.</p>
      <p>People need both birth and death dates to appear in this visualization.</p>
    </div>
  {:else}
    <div class="champion-display">
      {#if currentChampion}
        <div class="champion-card">
          <div class="champion-crown">👑</div>
          <div class="champion-info">
            <h4 class="champion-name">{currentChampion.person.name}</h4>
            <div class="champion-stats">
              <div class="stat-item">
                <span class="stat-label">Age in {currentYear}</span>
                <span class="stat-value">{currentChampion.age} years</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Born</span>
                <span class="stat-value">{currentChampion.person.birthYear}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Died</span>
                <span class="stat-value">{currentChampion.person.deathYear}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Total Lifespan</span>
                <span class="stat-value">{currentChampion.person.age} years</span>
              </div>
            </div>
          </div>
        </div>
      {:else}
        <div class="no-champion">
          <p>No champion yet in {currentYear}</p>
        </div>
      {/if}
    </div>
    
    <div class="top-longevity">
      <h4>Top 20 Longest-Lived Individuals</h4>
      <div class="longevity-list">
        {#each topLongevity as person, index}
          {@const isChampion = currentChampion && currentChampion.person.id === person.person.id}
          <button 
            class="longevity-item" 
            class:champion={isChampion}
            on:click={() => handlePersonClick(person.person)}
            title="Click to view {person.name}'s details"
          >
            <span class="rank">#{index + 1}</span>
            <span class="name">{person.name}</span>
            <span class="age">{person.age} years</span>
            <span class="years">{person.birthYear} - {person.deathYear}</span>
            {#if isChampion}
              <span class="champion-badge">👑 Current Champion</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .longevity-champions {
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
  
  .champion-display {
    margin-bottom: 2rem;
  }
  
  .champion-card {
    background: linear-gradient(135deg, rgba(212, 168, 83, 0.15) 0%, rgba(212, 168, 83, 0.05) 100%);
    border: 2px solid var(--accent-gold);
    border-radius: var(--radius-lg);
    padding: 2rem;
    text-align: center;
    position: relative;
    box-shadow: 0 4px 20px rgba(212, 168, 83, 0.2);
  }
  
  .champion-crown {
    font-size: 3rem;
    margin-bottom: 1rem;
    animation: pulse 2s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
  
  .champion-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .champion-name {
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }
  
  .champion-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .stat-label {
    font-size: 0.85rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent-gold);
    font-family: var(--font-display);
  }
  
  .no-champion {
    text-align: center;
    padding: 3rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
  }
  
  .top-longevity {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .top-longevity h4 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .longevity-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .longevity-item {
    display: grid;
    grid-template-columns: 50px 1fr 100px 150px auto;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--bg-card);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    transition: all 0.2s ease;
    cursor: pointer;
    width: 100%;
    text-align: left;
    font-family: inherit;
  }
  
  .longevity-item:hover {
    transform: translateX(5px);
    box-shadow: var(--shadow-soft);
    border-color: var(--accent-gold);
    background: var(--bg-elevated);
  }
  
  .longevity-item.champion {
    background: rgba(212, 168, 83, 0.1);
    border-color: var(--accent-gold);
  }
  
  .rank {
    font-weight: 700;
    color: var(--accent-gold);
    font-size: 1.1rem;
  }
  
  .name {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .age {
    font-weight: 700;
    color: var(--accent-gold);
    font-family: var(--font-display);
    font-size: 1.1rem;
  }
  
  .years {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  
  .champion-badge {
    font-size: 0.75rem;
    color: var(--accent-gold);
    font-weight: 600;
    background: rgba(212, 168, 83, 0.2);
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
  }
</style>

