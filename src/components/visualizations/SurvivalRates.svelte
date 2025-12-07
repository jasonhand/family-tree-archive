<script>
  import { familyData } from '../../stores/familyStore.js';
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  function calculateLifespan(person) {
    const birthYear = extractYear(person.birth_date);
    const deathYear = extractYear(person.death_date);
    
    if (!birthYear || !deathYear) return null;
    return deathYear - birthYear;
  }
  
  $: survivalData = (() => {
    const byCentury = {};
    
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      if (!birthYear) return;
      
      const century = Math.floor(birthYear / 100) * 100;
      if (!byCentury[century]) {
        byCentury[century] = [];
      }
      
      const lifespan = calculateLifespan(person);
      if (lifespan !== null) {
        byCentury[century].push(lifespan);
      }
    });
    
    // Calculate survival rates for each century
    return Object.entries(byCentury)
      .map(([century, lifespans]) => {
        const sorted = [...lifespans].sort((a, b) => a - b);
        const total = sorted.length;
        
        return {
          century: parseInt(century),
          total,
          to20: sorted.filter(a => a >= 20).length,
          to40: sorted.filter(a => a >= 40).length,
          to60: sorted.filter(a => a >= 60).length,
          to80: sorted.filter(a => a >= 80).length,
          to100: sorted.filter(a => a >= 100).length,
          avg: sorted.reduce((a, b) => a + b, 0) / total
        };
      })
      .sort((a, b) => a.century - b.century);
  })();
  
  let selectedCentury = null;
</script>

<div class="survival-rates">
  <div class="chart-header">
    <h3>Survival Rates by Century</h3>
    <p class="chart-description">
      See what percentage of people survived to different ages in each century. This reveals how life expectancy and infant mortality changed over time in your family tree.
    </p>
  </div>
  
  {#if survivalData.length === 0}
    <div class="no-data">
      <p>No survival data available.</p>
      <p>People need both birth and death dates to appear in this visualization.</p>
    </div>
  {:else}
    <div class="survival-chart">
      <svg class="chart-svg" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
        <!-- Grid lines -->
        {#each Array(11) as _, i}
          {@const y = 50 + (i * 40)}
          <line 
            x1="50" 
            y1={y} 
            x2="950" 
            y2={y} 
            stroke="var(--border-subtle)" 
            stroke-width="1"
            stroke-dasharray="2,2"
          />
          <text x="30" y={y + 5} fill="var(--text-muted)" font-size="12" text-anchor="end">
            {100 - (i * 10)}%
          </text>
        {/each}
        
        <!-- Survival rate lines -->
        {#each [
          { age: 20, color: '#7a9e7e', label: 'To 20' },
          { age: 40, color: '#d4a853', label: 'To 40' },
          { age: 60, color: '#9b6b8a', label: 'To 60' },
          { age: 80, color: '#4a7c9b', label: 'To 80' },
          { age: 100, color: '#c47a5a', label: 'To 100' }
        ] as threshold}
          <polyline
            points={survivalData.map((d, i) => {
              const x = 50 + ((i / (survivalData.length - 1)) * 900);
              const rate = threshold.age === 20 ? (d.to20 / d.total) * 100 :
                          threshold.age === 40 ? (d.to40 / d.total) * 100 :
                          threshold.age === 60 ? (d.to60 / d.total) * 100 :
                          threshold.age === 80 ? (d.to80 / d.total) * 100 :
                          (d.to100 / d.total) * 100;
              const y = 450 - (rate * 4);
              return `${x},${y}`;
            }).join(' ')}
            fill="none"
            stroke={threshold.color}
            stroke-width="3"
            class="survival-line"
          />
        {/each}
        
        <!-- Century labels -->
        {#each survivalData.filter((_, i) => i % Math.ceil(survivalData.length / 8) === 0 || i === survivalData.length - 1) as d, i}
          {@const x = 50 + ((survivalData.indexOf(d) / (survivalData.length - 1)) * 900)}
          <text 
            x={x} 
            y="480" 
            fill="var(--text-muted)" 
            font-size="11" 
            text-anchor="middle"
          >
            {d.century}s
          </text>
        {/each}
      </svg>
      
      <div class="chart-legend">
        {#each [
          { age: 20, color: '#7a9e7e', label: 'To 20' },
          { age: 40, color: '#d4a853', label: 'To 40' },
          { age: 60, color: '#9b6b8a', label: 'To 60' },
          { age: 80, color: '#4a7c9b', label: 'To 80' },
          { age: 100, color: '#c47a5a', label: 'To 100' }
        ] as threshold}
          <div class="legend-item">
            <span class="legend-color" style="background: {threshold.color};"></span>
            <span>{threshold.label}</span>
          </div>
        {/each}
      </div>
    </div>
    
    <div class="survival-table">
      <h4>Survival Rates by Century</h4>
      <table>
        <thead>
          <tr>
            <th>Century</th>
            <th>Total</th>
            <th>To 20</th>
            <th>To 40</th>
            <th>To 60</th>
            <th>To 80</th>
            <th>To 100</th>
            <th>Avg Age</th>
          </tr>
        </thead>
        <tbody>
          {#each survivalData as d}
            <tr on:click={() => selectedCentury = selectedCentury === d.century ? null : d.century} class:selected={selectedCentury === d.century}>
              <td class="century-cell">{d.century}s</td>
              <td>{d.total}</td>
              <td class="rate-cell">{(d.to20 / d.total * 100).toFixed(1)}%</td>
              <td class="rate-cell">{(d.to40 / d.total * 100).toFixed(1)}%</td>
              <td class="rate-cell">{(d.to60 / d.total * 100).toFixed(1)}%</td>
              <td class="rate-cell">{(d.to80 / d.total * 100).toFixed(1)}%</td>
              <td class="rate-cell">{(d.to100 / d.total * 100).toFixed(1)}%</td>
              <td class="avg-cell">{d.avg.toFixed(1)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .survival-rates {
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
  
  .no-data {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }
  
  .no-data p {
    margin: 0.5rem 0;
  }
  
  .survival-chart {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    margin-bottom: 2rem;
  }
  
  .chart-svg {
    width: 100%;
    height: 500px;
    margin-bottom: 1.5rem;
  }
  
  .survival-line {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }
  
  .chart-legend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 1.5rem;
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
    width: 20px;
    height: 4px;
    border-radius: 2px;
  }
  
  .survival-table {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    overflow-x: auto;
  }
  
  .survival-table h4 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th {
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
  
  td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-secondary);
  }
  
  tr {
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  tr:hover {
    background: rgba(212, 168, 83, 0.05);
  }
  
  tr.selected {
    background: rgba(212, 168, 83, 0.15);
    border-left: 3px solid var(--accent-gold);
  }
  
  .century-cell {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .rate-cell {
    font-weight: 600;
    color: var(--accent-gold);
  }
  
  .avg-cell {
    font-weight: 600;
    color: var(--accent-sage);
  }
</style>

