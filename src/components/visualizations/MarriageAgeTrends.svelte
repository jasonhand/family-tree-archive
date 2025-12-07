<script>
  import { familyData, familyRelationships } from '../../stores/familyStore.js';
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  $: marriageAgeData = (() => {
    const marriages = [];
    
    $familyData.forEach(person => {
      const rels = $familyRelationships[person.id];
      if (!rels?.spouses) return;
      
      const personBirthYear = extractYear(person.birth_date);
      if (!personBirthYear) return;
      
      rels.spouses.forEach(spouse => {
        const spouseFamilies = person.spouse_families || [];
        const sharedFamilyId = (person.spouse_family_ids || []).find(id => 
          (spouse.spouse_family_ids || []).includes(id)
        );
        
        const marriageInfo = sharedFamilyId && spouseFamilies.length > 0
          ? spouseFamilies.find(sf => sf.family_id === sharedFamilyId)
          : null;
        
        const marriageYear = marriageInfo?.marriage_date 
          ? extractYear(marriageInfo.marriage_date)
          : null;
        
        if (marriageYear) {
          const ageAtMarriage = marriageYear - personBirthYear;
          if (ageAtMarriage >= 0 && ageAtMarriage <= 100) {
            marriages.push({
              year: marriageYear,
              age: ageAtMarriage,
              sex: person.sex,
              name: person.name,
              spouseName: spouse.name,
              marriageOrder: marriageInfo?.marriage_order || 1
            });
          }
        }
      });
    });
    
    return marriages;
  })();
  
  $: byDecade = (() => {
    const decades = {};
    marriageAgeData.forEach(marriage => {
      const decade = Math.floor(marriage.year / 10) * 10;
      if (!decades[decade]) {
        decades[decade] = { male: [], female: [] };
      }
      if (marriage.sex === 'M') {
        decades[decade].male.push(marriage.age);
      } else if (marriage.sex === 'F') {
        decades[decade].female.push(marriage.age);
      }
    });
    
    return Object.entries(decades)
      .map(([decade, ages]) => ({
        decade: parseInt(decade),
        male: ages.male.length > 0 ? {
          avg: ages.male.reduce((a, b) => a + b, 0) / ages.male.length,
          min: Math.min(...ages.male),
          max: Math.max(...ages.male),
          count: ages.male.length
        } : null,
        female: ages.female.length > 0 ? {
          avg: ages.female.reduce((a, b) => a + b, 0) / ages.female.length,
          min: Math.min(...ages.female),
          max: Math.max(...ages.female),
          count: ages.female.length
        } : null
      }))
      .filter(d => d.male || d.female)
      .sort((a, b) => a.decade - b.decade);
  })();
  
  $: overallStats = (() => {
    const maleAges = marriageAgeData.filter(m => m.sex === 'M').map(m => m.age);
    const femaleAges = marriageAgeData.filter(m => m.sex === 'F').map(m => m.age);
    
    return {
      male: maleAges.length > 0 ? {
        avg: maleAges.reduce((a, b) => a + b, 0) / maleAges.length,
        min: Math.min(...maleAges),
        max: Math.max(...maleAges),
        count: maleAges.length
      } : null,
      female: femaleAges.length > 0 ? {
        avg: femaleAges.reduce((a, b) => a + b, 0) / femaleAges.length,
        min: Math.min(...femaleAges),
        max: Math.max(...femaleAges),
        count: femaleAges.length
      } : null
    };
  })();
  
  let showIndividual = true;
</script>

<div class="marriage-age-trends">
  <div class="chart-header">
    <h3>Marriage Age Trends</h3>
    <p class="chart-description">
      Explore how the age at marriage has changed over time. See trends for men and women separately, and observe how social norms may have influenced marriage timing.
    </p>
    <div class="controls">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={showIndividual} />
        <span>Show Individual Data Points</span>
      </label>
    </div>
  </div>
  
  {#if marriageAgeData.length === 0}
    <div class="no-data">
      <p>No marriage age data available.</p>
      <p>People need both birth dates and marriage dates to appear in this visualization.</p>
    </div>
  {:else}
    <div class="stats-summary">
      <div class="summary-box">
        <span class="summary-label">Total Marriages</span>
        <span class="summary-value">{marriageAgeData.length}</span>
      </div>
      {#if overallStats.male}
        <div class="summary-box">
          <span class="summary-label">Male Avg Age</span>
          <span class="summary-value male">{overallStats.male.avg.toFixed(1)}</span>
        </div>
      {/if}
      {#if overallStats.female}
        <div class="summary-box">
          <span class="summary-label">Female Avg Age</span>
          <span class="summary-value female">{overallStats.female.avg.toFixed(1)}</span>
        </div>
      {/if}
    </div>
    
    <div class="chart-container">
      <svg class="age-chart" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
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
            {50 - (i * 5)}
          </text>
        {/each}
        
        <!-- Individual data points -->
        {#if showIndividual}
          {#each marriageAgeData as marriage}
            {@const x = 50 + ((marriage.year - byDecade[0].decade) / (byDecade[byDecade.length - 1].decade - byDecade[0].decade)) * 900}
            {@const y = 450 - ((marriage.age / 50) * 400)}
            <circle 
              cx={x} 
              cy={y} 
              r="3" 
              fill={marriage.sex === 'M' ? 'rgba(94, 122, 148, 0.3)' : 'rgba(155, 107, 138, 0.3)'}
              class="data-point"
            />
          {/each}
        {/if}
        
        <!-- Male average line -->
        {#if byDecade.some(d => d.male)}
          <polyline
            points={byDecade.filter(d => d.male).map((d, i) => {
              const x = 50 + ((d.decade - byDecade[0].decade) / (byDecade[byDecade.length - 1].decade - byDecade[0].decade)) * 900;
              const y = 450 - ((d.male.avg / 50) * 400);
              return `${x},${y}`;
            }).join(' ')}
            fill="none"
            stroke="#5e7a94"
            stroke-width="3"
            class="average-line male"
          />
        {/if}
        
        <!-- Female average line -->
        {#if byDecade.some(d => d.female)}
          <polyline
            points={byDecade.filter(d => d.female).map((d, i) => {
              const x = 50 + ((d.decade - byDecade[0].decade) / (byDecade[byDecade.length - 1].decade - byDecade[0].decade)) * 900;
              const y = 450 - ((d.female.avg / 50) * 400);
              return `${x},${y}`;
            }).join(' ')}
            fill="none"
            stroke="#9b6b8a"
            stroke-width="3"
            class="average-line female"
          />
        {/if}
        
        <!-- X-axis labels -->
        {#each byDecade.filter((_, i) => i % Math.ceil(byDecade.length / 8) === 0 || i === byDecade.length - 1) as d, i}
          {@const x = 50 + ((d.decade - byDecade[0].decade) / (byDecade[byDecade.length - 1].decade - byDecade[0].decade)) * 900}
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
          <span class="legend-color male"></span>
          <span>Male Average</span>
        </div>
        <div class="legend-item">
          <span class="legend-color female"></span>
          <span>Female Average</span>
        </div>
        {#if showIndividual}
          <div class="legend-item">
            <span class="legend-color male-dot"></span>
            <span>Male Individuals</span>
          </div>
          <div class="legend-item">
            <span class="legend-color female-dot"></span>
            <span>Female Individuals</span>
          </div>
        {/if}
      </div>
    </div>
    
    <div class="decade-details">
      <h4>Average Marriage Age by Decade</h4>
      <table>
        <thead>
          <tr>
            <th>Decade</th>
            <th>Male Avg</th>
            <th>Male Range</th>
            <th>Female Avg</th>
            <th>Female Range</th>
          </tr>
        </thead>
        <tbody>
          {#each byDecade as d}
            <tr>
              <td class="decade-cell">{d.decade}s</td>
              {#if d.male}
                <td class="male-cell">{d.male.avg.toFixed(1)}</td>
                <td class="range-cell">{d.male.min} - {d.male.max}</td>
              {:else}
                <td>-</td>
                <td>-</td>
              {/if}
              {#if d.female}
                <td class="female-cell">{d.female.avg.toFixed(1)}</td>
                <td class="range-cell">{d.female.min} - {d.female.max}</td>
              {:else}
                <td>-</td>
                <td>-</td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .marriage-age-trends {
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
  
  .summary-value.male {
    color: #5e7a94;
  }
  
  .summary-value.female {
    color: #9b6b8a;
  }
  
  .chart-container {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    margin-bottom: 2rem;
  }
  
  .age-chart {
    width: 100%;
    height: 500px;
    margin-bottom: 1.5rem;
  }
  
  .average-line {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
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
  
  .legend-color.male {
    background: #5e7a94;
  }
  
  .legend-color.female {
    background: #9b6b8a;
  }
  
  .legend-color.male-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(94, 122, 148, 0.3);
  }
  
  .legend-color.female-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(155, 107, 138, 0.3);
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
  
  .male-cell {
    color: #5e7a94;
    font-weight: 600;
  }
  
  .female-cell {
    color: #9b6b8a;
    font-weight: 600;
  }
  
  .range-cell {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
</style>

