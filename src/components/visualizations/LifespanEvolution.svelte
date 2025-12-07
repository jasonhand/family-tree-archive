<script>
  import { familyData, selectedPerson } from '../../stores/familyStore.js';
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  function calculateLifespan(person) {
    const birthYear = extractYear(person.birth_date);
    const deathYear = extractYear(person.death_date);
    
    if (!birthYear) return null;
    if (!deathYear) return null; // Only count deceased people
    
    return deathYear - birthYear;
  }
  
  $: lifespanData = (() => {
    const byDecade = {};
    const byCentury = {};
    
    $familyData.forEach(person => {
      const lifespan = calculateLifespan(person);
      if (lifespan === null) return;
      
      const birthYear = extractYear(person.birth_date);
      if (!birthYear) return;
      
      const decade = Math.floor(birthYear / 10) * 10;
      const century = Math.floor(birthYear / 100) * 100;
      const gender = person.sex === 'M' ? 'M' : person.sex === 'F' ? 'F' : 'U';
      
      if (!byDecade[decade]) {
        byDecade[decade] = { all: [], M: [], F: [], U: [] };
      }
      byDecade[decade].all.push(lifespan);
      byDecade[decade][gender].push(lifespan);
      
      if (!byCentury[century]) {
        byCentury[century] = { all: [], M: [], F: [], U: [] };
      }
      byCentury[century].all.push(lifespan);
      byCentury[century][gender].push(lifespan);
    });
    
    function calculateStats(lifespans) {
      if (lifespans.length === 0) return null;
      return {
        average: lifespans.reduce((a, b) => a + b, 0) / lifespans.length,
        count: lifespans.length,
        min: Math.min(...lifespans),
        max: Math.max(...lifespans),
        median: lifespans.length > 0 ? [...lifespans].sort((a, b) => a - b)[Math.floor(lifespans.length / 2)] : null
      };
    }
    
    // Calculate averages with gender breakdown
    const decadeAverages = Object.entries(byDecade).map(([decade, data]) => ({
      decade: parseInt(decade),
      all: calculateStats(data.all),
      M: calculateStats(data.M),
      F: calculateStats(data.F),
      U: calculateStats(data.U)
    })).sort((a, b) => a.decade - b.decade);
    
    const centuryAverages = Object.entries(byCentury).map(([century, data]) => ({
      century: parseInt(century),
      all: calculateStats(data.all),
      M: calculateStats(data.M),
      F: calculateStats(data.F),
      U: calculateStats(data.U)
    })).sort((a, b) => a.century - b.century);
    
    return { byDecade: decadeAverages, byCentury: centuryAverages };
  })();
  
  let viewMode = 'decade'; // 'decade' or 'century'
  let showIndividual = true;
  let hoveredPoint = null;
  
  $: displayData = viewMode === 'decade' ? lifespanData.byDecade : lifespanData.byCentury;
  $: maxLifespan = displayData.length > 0 ? Math.max(...displayData.map(d => d.all?.max || 0), 100) : 100;
  $: minLifespan = displayData.length > 0 ? Math.min(...displayData.map(d => d.all?.min || 100), 0) : 0;
  
  // Get all individual lifespans for scatter plot
  $: individualData = (() => {
    if (!showIndividual) return [];
    
    return $familyData
      .map(person => {
        const lifespan = calculateLifespan(person);
        const birthYear = extractYear(person.birth_date);
        if (lifespan === null || !birthYear) return null;
        
        return {
          birthYear,
          lifespan,
          name: person.name,
          sex: person.sex,
          person: person
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.birthYear - b.birthYear);
  })();
  
  function handlePointClick(person) {
    selectedPerson.set(person);
  }
</script>

<div class="lifespan-evolution">
  <div class="chart-header">
    <h3>Lifespan Evolution Over Time</h3>
    <p class="chart-description">
      Explore how lifespans have changed across generations. See trends in average lifespan, longest-lived individuals, and how medical advances may have impacted your family.
    </p>
    <div class="controls">
      <div class="view-toggle">
        <button 
          class="toggle-btn" 
          class:active={viewMode === 'decade'}
          on:click={() => viewMode = 'decade'}
        >
          By Decade
        </button>
        <button 
          class="toggle-btn" 
          class:active={viewMode === 'century'}
          on:click={() => viewMode = 'century'}
        >
          By Century
        </button>
      </div>
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={showIndividual} />
        <span>Show Individual Lifespans</span>
      </label>
    </div>
  </div>
  
  {#if displayData.length === 0}
    <div class="no-data">
      <p>No lifespan data available.</p>
      <p>People need both birth and death dates to appear in this visualization.</p>
    </div>
  {:else}
    <div class="chart-container">
      <div class="stats-summary">
      <div class="summary-box">
        <span class="summary-label">Overall Average</span>
        <span class="summary-value">
          {displayData.length > 0 && displayData.some(d => d.all)
            ? (displayData.reduce((sum, d) => sum + (d.all?.average || 0) * (d.all?.count || 0), 0) / displayData.reduce((sum, d) => sum + (d.all?.count || 0), 0)).toFixed(1)
            : 'N/A'} years
        </span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Longest Lifespan</span>
        <span class="summary-value">{maxLifespan} years</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Data Points</span>
        <span class="summary-value">{displayData.reduce((sum, d) => sum + (d.all?.count || 0), 0)} people</span>
      </div>
    </div>
    
    <div class="chart-area">
      <div class="chart-svg-container">
        <svg class="lifespan-chart" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
          <!-- Grid lines -->
          {#each Array(11) as _, i}
            {@const y = (i * 10)}
            <line 
              x1="50" 
              y1="{50 + (y * 4)}" 
              x2="950" 
              y2="{50 + (y * 4)}" 
              stroke="var(--border-subtle)" 
              stroke-width="1"
              stroke-dasharray="2,2"
            />
            <text x="30" y="{55 + (y * 4)}" fill="var(--text-muted)" font-size="12" text-anchor="end">
              {100 - (i * 10)}
            </text>
          {/each}
          
          <!-- Individual data points (scatter) -->
          {#if showIndividual && individualData.length > 0 && displayData.length > 0}
            {#each individualData as point}
              {@const startYear = viewMode === 'decade' ? displayData[0].decade : displayData[0].century}
              {@const endYear = viewMode === 'decade' ? displayData[displayData.length - 1].decade : displayData[displayData.length - 1].century}
              {@const x = 50 + ((point.birthYear - startYear) / Math.max(endYear - startYear, 1)) * 900}
              {@const y = 450 - ((point.lifespan / maxLifespan) * 400)}
              {@const baseColor = point.sex === 'M' ? '94, 122, 148' : point.sex === 'F' ? '155, 107, 138' : '122, 122, 122'}
              {@const isHovered = hoveredPoint === point.person.id}
              {@const fillColor = isHovered ? `rgba(${baseColor}, 0.6)` : `rgba(${baseColor}, 0.3)`}
              <circle 
                cx={x} 
                cy={y} 
                r={isHovered ? 5 : 3}
                fill={fillColor}
                class="data-point"
                class:hovered={isHovered}
                on:click={() => handlePointClick(point.person)}
                on:mouseenter={() => hoveredPoint = point.person.id}
                on:mouseleave={() => hoveredPoint = null}
                style="cursor: pointer;"
                title="Click to view {point.name}'s details ({point.lifespan} years, born {point.birthYear})"
              />
            {/each}
          {/if}
          
          {#if displayData.length > 0}
            <!-- Average line -->
            <polyline
              points={displayData.map((d, i) => {
                const x = 50 + ((i / Math.max(displayData.length - 1, 1)) * 900);
                const y = 450 - ((d.average / maxLifespan) * 400);
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="var(--accent-gold)"
              stroke-width="3"
              class="average-line"
            />
            
            <!-- Min/Max range -->
            <path
              d={displayData.map((d, i) => {
                const x = 50 + ((i / Math.max(displayData.length - 1, 1)) * 900);
                const yMin = 450 - ((d.min / maxLifespan) * 400);
                const yMax = 450 - ((d.max / maxLifespan) * 400);
                return i === 0 ? `M ${x} ${yMin} L ${x} ${yMax}` : `L ${x} ${yMax} L ${x} ${yMin}`;
              }).join(' ') + ' Z'}
              fill="rgba(212, 168, 83, 0.1)"
              stroke="rgba(212, 168, 83, 0.3)"
              stroke-width="1"
              class="range-area"
            />
            
            <!-- Data point markers -->
            {#each displayData as d, i}
              {@const x = 50 + ((i / Math.max(displayData.length - 1, 1)) * 900)}
              {@const y = 450 - ((d.average / maxLifespan) * 400)}
              <circle 
                cx={x} 
                cy={y} 
                r="6" 
                fill="var(--accent-gold)"
                class="average-point"
              />
              <title>{viewMode === 'decade' ? `${d.decade}s` : `${d.century}s`}: Avg {d.average.toFixed(1)} years (Range: {d.min}-{d.max}, {d.count} people)</title>
            {/each}
          {/if}
          
          <!-- X-axis labels -->
          {#if displayData.length > 0}
            {#each displayData.filter((_, i) => i % Math.ceil(displayData.length / 8) === 0 || i === displayData.length - 1) as d, i}
              {@const x = 50 + ((displayData.indexOf(d) / Math.max(displayData.length - 1, 1)) * 900)}
              <text 
                x={x} 
                y="480" 
                fill="var(--text-muted)" 
                font-size="11" 
                text-anchor="middle"
              >
                {viewMode === 'decade' ? `${d.decade}s` : `${d.century}s`}
              </text>
            {/each}
          {/if}
        </svg>
      </div>
      
      <div class="chart-legend">
        <div class="legend-item">
          <span class="legend-color average"></span>
          <span>Average Lifespan</span>
        </div>
        <div class="legend-item">
          <span class="legend-color range"></span>
          <span>Min-Max Range</span>
        </div>
        {#if showIndividual}
          <div class="legend-item">
            <span class="legend-color male"></span>
            <span>Male Individuals</span>
          </div>
          <div class="legend-item">
            <span class="legend-color female"></span>
            <span>Female Individuals</span>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Detailed table -->
    <div class="data-table">
      <h4>Detailed Statistics by {viewMode === 'decade' ? 'Decade' : 'Century'}</h4>
      <table>
        <thead>
          <tr>
            <th rowspan="2" class="period-header">{viewMode === 'decade' ? 'Decade' : 'Century'}</th>
            <th colspan="6" class="gender-header">All</th>
            <th colspan="6" class="gender-header male-header">Male</th>
            <th colspan="6" class="gender-header female-header">Female</th>
          </tr>
          <tr>
            <th class="sub-header">Count</th>
            <th class="sub-header">Avg</th>
            <th class="sub-header">Med</th>
            <th class="sub-header">Min</th>
            <th class="sub-header">Max</th>
            <th class="sub-header spacer"></th>
            <th class="sub-header">Count</th>
            <th class="sub-header">Avg</th>
            <th class="sub-header">Med</th>
            <th class="sub-header">Min</th>
            <th class="sub-header">Max</th>
            <th class="sub-header spacer"></th>
            <th class="sub-header">Count</th>
            <th class="sub-header">Avg</th>
            <th class="sub-header">Med</th>
            <th class="sub-header">Min</th>
            <th class="sub-header">Max</th>
          </tr>
        </thead>
        <tbody>
          {#each displayData as d}
            <tr>
              <td class="period-cell">{viewMode === 'decade' ? `${d.decade}s` : `${d.century}s`}</td>
              <!-- All -->
              {#if d.all}
                <td>{d.all.count}</td>
                <td class="avg-cell">{d.all.average.toFixed(1)}</td>
                <td>{d.all.median || 'N/A'}</td>
                <td class="min-cell">{d.all.min}</td>
                <td class="max-cell">{d.all.max}</td>
              {:else}
                <td colspan="5">-</td>
              {/if}
              <td class="spacer"></td>
              <!-- Male -->
              {#if d.M}
                <td>{d.M.count}</td>
                <td class="avg-cell male">{d.M.average.toFixed(1)}</td>
                <td>{d.M.median || 'N/A'}</td>
                <td class="min-cell">{d.M.min}</td>
                <td class="max-cell">{d.M.max}</td>
              {:else}
                <td colspan="5">-</td>
              {/if}
              <td class="spacer"></td>
              <!-- Female -->
              {#if d.F}
                <td>{d.F.count}</td>
                <td class="avg-cell female">{d.F.average.toFixed(1)}</td>
                <td>{d.F.median || 'N/A'}</td>
                <td class="min-cell">{d.F.min}</td>
                <td class="max-cell">{d.F.max}</td>
              {:else}
                <td colspan="5">-</td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  {/if}
</div>

<style>
  .lifespan-evolution {
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
    gap: 1.5rem;
    flex-wrap: wrap;
  }
  
  .view-toggle {
    display: flex;
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--border-subtle);
  }
  
  .toggle-btn {
    padding: 0.6rem 1.2rem;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .toggle-btn:hover {
    color: var(--text-primary);
  }
  
  .toggle-btn.active {
    background: var(--accent-gold);
    color: var(--bg-deep);
    font-weight: 600;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
    cursor: pointer;
  }
  
  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
  
  .chart-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .stats-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .summary-box {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    text-align: center;
    border: 1px solid var(--border-subtle);
  }
  
  .summary-label {
    display: block;
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .summary-value {
    display: block;
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--accent-gold);
    font-family: var(--font-display);
  }
  
  .chart-area {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .chart-svg-container {
    width: 100%;
    height: 500px;
    margin-bottom: 1.5rem;
  }
  
  .lifespan-chart {
    width: 100%;
    height: 100%;
  }
  
  .average-line {
    filter: drop-shadow(0 2px 4px rgba(212, 168, 83, 0.3));
  }
  
  .average-point {
    cursor: pointer;
    transition: r 0.2s ease;
  }
  
  .average-point:hover {
    r: 8;
  }
  
  .data-point {
    cursor: pointer;
    transition: r 0.2s ease;
  }
  
  .data-point:hover,
  .data-point.hovered {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }
  
  .chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    justify-content: center;
    padding-top: 1rem;
    border-top: 1px solid var(--border-subtle);
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .legend-color {
    width: 16px;
    height: 16px;
    border-radius: 3px;
  }
  
  .legend-color.average {
    background: var(--accent-gold);
  }
  
  .legend-color.range {
    background: rgba(212, 168, 83, 0.2);
    border: 1px solid rgba(212, 168, 83, 0.3);
  }
  
  .legend-color.male {
    background: rgba(94, 122, 148, 0.3);
  }
  
  .legend-color.female {
    background: rgba(155, 107, 138, 0.3);
  }
  
  .data-table {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    overflow-x: auto;
  }
  
  .data-table h4 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .data-table table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .data-table th {
    text-align: left;
    padding: 0.75rem;
    background: var(--bg-main);
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid var(--border-subtle);
  }
  
  .data-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    text-align: center;
  }
  
  .data-table td.spacer {
    background: transparent;
    border: none;
    padding: 0;
    width: 1rem;
  }
  
  .data-table tr:hover {
    background: rgba(212, 168, 83, 0.05);
  }
  
  .period-cell {
    font-weight: 600;
    color: var(--text-primary);
    text-align: left;
  }

  .avg-cell {
    color: var(--accent-gold);
    font-weight: 600;
  }
  
  .avg-cell.male {
    color: var(--accent-blue);
  }
  
  .avg-cell.female {
    color: var(--accent-purple);
  }
  
  .min-cell {
    color: var(--accent-copper);
  }
  
  .max-cell {
    color: var(--accent-sage);
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

