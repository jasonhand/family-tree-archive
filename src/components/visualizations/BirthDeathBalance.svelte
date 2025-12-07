<script>
  import { familyData } from '../../stores/familyStore.js';
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  $: balanceData = (() => {
    const byDecade = {};
    const minYear = 1700;
    const maxYear = new Date().getFullYear();
    
    // Initialize all decades
    for (let year = minYear; year <= maxYear; year += 10) {
      const decade = Math.floor(year / 10) * 10;
      byDecade[decade] = { 
        births: 0, 
        deaths: 0, 
        birthsMale: 0,
        birthsFemale: 0,
        deathsMale: 0,
        deathsFemale: 0,
        decade 
      };
    }
    
    // Count births and deaths by decade and gender
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      const deathYear = extractYear(person.death_date);
      const sex = person.sex;
      
      if (birthYear && birthYear >= minYear && birthYear <= maxYear) {
        const decade = Math.floor(birthYear / 10) * 10;
        if (byDecade[decade]) {
          byDecade[decade].births++;
          if (sex === 'M') {
            byDecade[decade].birthsMale++;
          } else if (sex === 'F') {
            byDecade[decade].birthsFemale++;
          }
        }
      }
      
      if (deathYear && deathYear >= minYear && deathYear <= maxYear) {
        const decade = Math.floor(deathYear / 10) * 10;
        if (byDecade[decade]) {
          byDecade[decade].deaths++;
          if (sex === 'M') {
            byDecade[decade].deathsMale++;
          } else if (sex === 'F') {
            byDecade[decade].deathsFemale++;
          }
        }
      }
    });
    
    return Object.values(byDecade)
      .filter(d => d.births > 0 || d.deaths > 0)
      .sort((a, b) => a.decade - b.decade)
      .map(d => ({
        ...d,
        net: d.births - d.deaths,
        growth: d.births > d.deaths
      }));
  })();
  
  $: maxValue = Math.max(...balanceData.map(d => Math.max(d.births, d.deaths)), 1);
  $: totalBirths = balanceData.reduce((sum, d) => sum + d.births, 0);
  $: totalDeaths = balanceData.reduce((sum, d) => sum + d.deaths, 0);
  $: netGrowth = totalBirths - totalDeaths;
</script>

<div class="birth-death-balance">
  <div class="chart-header">
    <h3>Birth/Death Balance</h3>
    <p class="chart-description">
      Compare births and deaths across decades to see when your family tree was growing or declining. This dual-axis chart reveals population trends over time.
    </p>
  </div>
  
  {#if balanceData.length === 0}
    <div class="no-data">
      <p>No date data available for birth/death balance.</p>
      <p>People need birth and death dates to appear in this visualization.</p>
    </div>
  {:else}
    <div class="stats-summary">
      <div class="summary-box">
        <span class="summary-label">Total Births</span>
        <span class="summary-value births">{totalBirths}</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Total Deaths</span>
        <span class="summary-value deaths">{totalDeaths}</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Net Growth</span>
        <span class="summary-value" class:positive={netGrowth > 0} class:negative={netGrowth < 0}>
          {netGrowth > 0 ? '+' : ''}{netGrowth}
        </span>
      </div>
    </div>
    
    <div class="balance-chart">
      <svg class="chart-svg" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
        <!-- Grid lines -->
        {#each Array(6) as _, i}
          {@const y = 50 + (i * 80)}
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
            {Math.round(maxValue - (i * maxValue / 5))}
          </text>
        {/each}
        
        <!-- Birth bars -->
        {#each balanceData as d, i}
          {@const x = 50 + ((i / (balanceData.length - 1)) * 900)}
          {@const birthHeight = (d.births / maxValue) * 400}
          {@const deathHeight = (d.deaths / maxValue) * 400}
          {@const barWidth = 800 / balanceData.length}
          
          <!-- Birth bar -->
          <rect
            x={x - barWidth * 0.4}
            y={450 - birthHeight}
            width={barWidth * 0.4}
            height={birthHeight}
            fill="var(--accent-sage)"
            opacity="0.8"
            class="birth-bar"
          />
          
          <!-- Death bar -->
          <rect
            x={x}
            y={450 - deathHeight}
            width={barWidth * 0.4}
            height={deathHeight}
            fill="var(--accent-copper)"
            opacity="0.8"
            class="death-bar"
          />
          
          <!-- Net line -->
          <line
            x1={x - barWidth * 0.2}
            y1={450 - ((d.net / maxValue) * 400)}
            x2={x + barWidth * 0.2}
            y2={450 - ((d.net / maxValue) * 400)}
            stroke={d.growth ? 'var(--accent-sage)' : 'var(--accent-copper)'}
            stroke-width="3"
            class="net-line"
          />
          
          <!-- Decade label -->
          {#if i % Math.ceil(balanceData.length / 10) === 0 || i === balanceData.length - 1}
            <text 
              x={x} 
              y="480" 
              fill="var(--text-muted)" 
              font-size="11" 
              text-anchor="middle"
            >
              {d.decade}s
            </text>
          {/if}
        {/each}
        
        <!-- Zero line -->
        <line 
          x1="50" 
          y1="450" 
          x2="950" 
          y2="450" 
          stroke="var(--text-muted)" 
          stroke-width="2"
          stroke-dasharray="4,4"
        />
      </svg>
      
      <div class="chart-legend">
        <div class="legend-item">
          <span class="legend-color births"></span>
          <span>Births</span>
        </div>
        <div class="legend-item">
          <span class="legend-color deaths"></span>
          <span>Deaths</span>
        </div>
        <div class="legend-item">
          <span class="legend-color net"></span>
          <span>Net Change</span>
        </div>
      </div>
    </div>
    
    <div class="decade-details">
      <h4>Decade Breakdown</h4>
      <div class="details-table">
        <table>
          <thead>
            <tr>
              <th rowspan="2">Decade</th>
              <th colspan="3">Births</th>
              <th colspan="3">Deaths</th>
              <th rowspan="2">Net Change</th>
              <th rowspan="2">Growth Rate</th>
            </tr>
            <tr>
              <th>Total</th>
              <th>Male</th>
              <th>Female</th>
              <th>Total</th>
              <th>Male</th>
              <th>Female</th>
            </tr>
          </thead>
          <tbody>
            {#each balanceData as d}
              <tr class:growth={d.growth} class:decline={!d.growth}>
                <td class="decade-cell">{d.decade}s</td>
                <td class="births-cell">{d.births}</td>
                <td class="births-male-cell">{d.birthsMale}</td>
                <td class="births-female-cell">{d.birthsFemale}</td>
                <td class="deaths-cell">{d.deaths}</td>
                <td class="deaths-male-cell">{d.deathsMale}</td>
                <td class="deaths-female-cell">{d.deathsFemale}</td>
                <td class="net-cell" class:positive={d.net > 0} class:negative={d.net < 0}>
                  {d.net > 0 ? '+' : ''}{d.net}
                </td>
                <td class="rate-cell">
                  {d.births > 0 ? ((d.net / d.births) * 100).toFixed(1) : '0'}%
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .birth-death-balance {
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
  
  .stats-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
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
    font-size: 2rem;
    font-weight: 700;
    color: var(--accent-gold);
    font-family: var(--font-display);
  }
  
  .summary-value.births {
    color: var(--accent-sage);
  }
  
  .summary-value.deaths {
    color: var(--accent-copper);
  }
  
  .summary-value.positive {
    color: var(--accent-sage);
  }
  
  .summary-value.negative {
    color: var(--accent-copper);
  }
  
  .balance-chart {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    margin-bottom: 2rem;
  }
  
  .chart-svg {
    width: 100%;
    height: 500px;
    margin-bottom: 1rem;
  }
  
  .birth-bar:hover,
  .death-bar:hover {
    opacity: 1;
  }
  
  .chart-legend {
    display: flex;
    justify-content: center;
    gap: 2rem;
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
    height: 20px;
    border-radius: 3px;
  }
  
  .legend-color.births {
    background: var(--accent-sage);
  }
  
  .legend-color.deaths {
    background: var(--accent-copper);
  }
  
  .legend-color.net {
    background: linear-gradient(90deg, var(--accent-sage) 0%, var(--accent-copper) 100%);
  }
  
  .decade-details {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    overflow-x: auto;
  }
  
  .decade-details h4 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .details-table {
    overflow-x: auto;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th {
    text-align: center;
    padding: 0.75rem 0.5rem;
    background: var(--bg-main);
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid var(--border-subtle);
    vertical-align: bottom;
  }
  
  th[rowspan] {
    vertical-align: middle;
  }
  
  td {
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    text-align: center;
  }
  
  .decade-cell {
    text-align: left;
  }
  
  tr:hover {
    background: rgba(212, 168, 83, 0.05);
  }
  
  tr.growth {
    background: rgba(122, 158, 126, 0.03);
  }
  
  tr.decline {
    background: rgba(196, 122, 90, 0.03);
  }
  
  .decade-cell {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .births-cell {
    color: var(--accent-sage);
    font-weight: 600;
  }
  
  .births-male-cell {
    color: #5e7a94;
    font-weight: 500;
    font-size: 0.9rem;
  }
  
  .births-female-cell {
    color: #9b6b8a;
    font-weight: 500;
    font-size: 0.9rem;
  }
  
  .deaths-cell {
    color: var(--accent-copper);
    font-weight: 600;
  }
  
  .deaths-male-cell {
    color: #5e7a94;
    font-weight: 500;
    font-size: 0.9rem;
  }
  
  .deaths-female-cell {
    color: #9b6b8a;
    font-weight: 500;
    font-size: 0.9rem;
  }
  
  .net-cell.positive {
    color: var(--accent-sage);
    font-weight: 600;
  }
  
  .net-cell.negative {
    color: var(--accent-copper);
    font-weight: 600;
  }
  
  .rate-cell {
    font-size: 0.9rem;
  }
</style>

