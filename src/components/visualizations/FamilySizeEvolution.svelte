<script>
  import { familyData, familyRelationships } from '../../stores/familyStore.js';
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  $: familySizeData = (() => {
    const families = [];
    
    $familyData.forEach(person => {
      const rels = $familyRelationships[person.id];
      if (!rels?.children || rels.children.length === 0) return;
      
      // Use the parent's birth year as the family formation year
      const familyYear = extractYear(person.birth_date);
      if (!familyYear) return;
      
      families.push({
        parentName: person.name,
        parentSex: person.sex,
        year: familyYear,
        childCount: rels.children.length,
        children: rels.children.map(c => c.name)
      });
    });
    
    return families;
  })();
  
  $: byDecade = (() => {
    const decades = {};
    
    familySizeData.forEach(family => {
      const decade = Math.floor(family.year / 10) * 10;
      if (!decades[decade]) {
        decades[decade] = [];
      }
      decades[decade].push(family.childCount);
    });
    
    return Object.entries(decades)
      .map(([decade, sizes]) => {
        const sorted = [...sizes].sort((a, b) => a - b);
        return {
          decade: parseInt(decade),
          count: sorted.length,
          avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
          median: sorted[Math.floor(sorted.length / 2)],
          min: Math.min(...sorted),
          max: Math.max(...sorted),
          q1: sorted[Math.floor(sorted.length * 0.25)],
          q3: sorted[Math.floor(sorted.length * 0.75)]
        };
      })
      .sort((a, b) => a.decade - b.decade);
  })();
  
  $: overallAvg = familySizeData.length > 0 
    ? familySizeData.reduce((sum, f) => sum + f.childCount, 0) / familySizeData.length 
    : 0;
</script>

<div class="family-size-evolution">
  <div class="chart-header">
    <h3>Family Size Evolution</h3>
    <p class="chart-description">
      Track how family sizes (number of children) have changed over time. See average, median, and distribution of children per family across different decades.
    </p>
  </div>
  
  {#if familySizeData.length === 0}
    <div class="no-data">
      <p>No family size data available.</p>
      <p>Families need to have children recorded to appear in this visualization.</p>
    </div>
  {:else}
    <div class="stats-summary">
      <div class="summary-box">
        <span class="summary-label">Total Families</span>
        <span class="summary-value">{familySizeData.length}</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Overall Average</span>
        <span class="summary-value">{overallAvg.toFixed(1)} children</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Largest Family</span>
        <span class="summary-value">{Math.max(...familySizeData.map(f => f.childCount))} children</span>
      </div>
    </div>
    
    <div class="chart-container">
      <svg class="size-chart" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
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
            {10 - i}
          </text>
        {/each}
        
        <!-- Average line -->
        <polyline
          points={byDecade.map((d, i) => {
            const x = 50 + ((i / (byDecade.length - 1)) * 900);
            const y = 450 - ((d.avg / 10) * 400);
            return `${x},${y}`;
          }).join(' ')}
          fill="none"
          stroke="var(--accent-gold)"
          stroke-width="3"
          class="average-line"
        />
        
        <!-- Median line -->
        <polyline
          points={byDecade.map((d, i) => {
            const x = 50 + ((i / (byDecade.length - 1)) * 900);
            const y = 450 - ((d.median / 10) * 400);
            return `${x},${y}`;
          }).join(' ')}
          fill="none"
          stroke="var(--accent-sage)"
          stroke-width="2"
          stroke-dasharray="4,4"
          class="median-line"
        />
        
        <!-- Box plots for each decade -->
        {#each byDecade as d, i}
          {@const x = 50 + ((i / (byDecade.length - 1)) * 900)}
          {@const boxHeight = ((d.q3 - d.q1) / 10) * 400}
          {@const boxTop = 450 - ((d.q3 / 10) * 400)}
          {@const medianY = 450 - ((d.median / 10) * 400)}
          {@const minY = 450 - ((d.min / 10) * 400)}
          {@const maxY = 450 - ((d.max / 10) * 400)}
          
          <!-- Box -->
          <rect
            x={x - 15}
            y={boxTop}
            width="30"
            height={boxHeight}
            fill="rgba(212, 168, 83, 0.2)"
            stroke="var(--accent-gold)"
            stroke-width="2"
            class="box-plot"
          />
          
          <!-- Median line in box -->
          <line
            x1={x - 15}
            y1={medianY}
            x2={x + 15}
            y2={medianY}
            stroke="var(--accent-sage)"
            stroke-width="2"
          />
          
          <!-- Whiskers -->
          <line x1={x} y1={minY} x2={x} y2={boxTop} stroke="var(--accent-gold)" stroke-width="2"/>
          <line x1={x - 5} y1={minY} x2={x + 5} y2={minY} stroke="var(--accent-gold)" stroke-width="2"/>
          <line x1={x} y1={boxTop + boxHeight} x2={x} y2={maxY} stroke="var(--accent-gold)" stroke-width="2"/>
          <line x1={x - 5} y1={maxY} x2={x + 5} y2={maxY} stroke="var(--accent-gold)" stroke-width="2"/>
        {/each}
        
        <!-- X-axis labels -->
        {#each byDecade.filter((_, i) => i % Math.ceil(byDecade.length / 8) === 0 || i === byDecade.length - 1) as d, i}
          {@const x = 50 + ((byDecade.indexOf(d) / (byDecade.length - 1)) * 900)}
          <text 
            x={x} 
            y="480" 
            fill="var(--text-muted)" 
            font-size="11" 
            text-anchor="middle"
          >
            {d.decade}s
          </text>
        {/each}
      </svg>
      
      <div class="chart-legend">
        <div class="legend-item">
          <span class="legend-color average"></span>
          <span>Average</span>
        </div>
        <div class="legend-item">
          <span class="legend-color median"></span>
          <span>Median</span>
        </div>
        <div class="legend-item">
          <span class="legend-color box"></span>
          <span>Quartiles (Q1-Q3)</span>
        </div>
      </div>
    </div>
    
    <div class="decade-details">
      <h4>Family Size Statistics by Decade</h4>
      <table>
        <thead>
          <tr>
            <th>Decade</th>
            <th>Families</th>
            <th>Average</th>
            <th>Median</th>
            <th>Min</th>
            <th>Max</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody>
          {#each byDecade as d}
            <tr>
              <td class="decade-cell">{d.decade}s</td>
              <td>{d.count}</td>
              <td class="avg-cell">{d.avg.toFixed(1)}</td>
              <td class="median-cell">{d.median}</td>
              <td class="min-cell">{d.min}</td>
              <td class="max-cell">{d.max}</td>
              <td class="range-cell">{d.max - d.min}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .family-size-evolution {
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
  
  .chart-container {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    margin-bottom: 2rem;
  }
  
  .size-chart {
    width: 100%;
    height: 500px;
    margin-bottom: 1.5rem;
  }
  
  .average-line {
    filter: drop-shadow(0 2px 4px rgba(212, 168, 83, 0.3));
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
    height: 4px;
    border-radius: 2px;
  }
  
  .legend-color.average {
    background: var(--accent-gold);
  }
  
  .legend-color.median {
    background: var(--accent-sage);
    border-top: 2px dashed var(--accent-sage);
    border-bottom: 2px dashed var(--accent-sage);
  }
  
  .legend-color.box {
    background: rgba(212, 168, 83, 0.2);
    border: 1px solid var(--accent-gold);
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
  
  tr:hover {
    background: rgba(212, 168, 83, 0.05);
  }
  
  .decade-cell {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .avg-cell {
    color: var(--accent-gold);
    font-weight: 600;
  }
  
  .median-cell {
    color: var(--accent-sage);
    font-weight: 600;
  }
  
  .min-cell {
    color: var(--text-muted);
  }
  
  .max-cell {
    color: var(--accent-copper);
    font-weight: 600;
  }
  
  .range-cell {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
</style>

