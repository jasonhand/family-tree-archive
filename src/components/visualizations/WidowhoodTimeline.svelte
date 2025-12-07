<script>
  import { familyData, familyRelationships } from '../../stores/familyStore.js';
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  $: widowhoodData = (() => {
    const events = [];
    
    $familyData.forEach(person => {
      const rels = $familyRelationships[person.id];
      if (!rels?.spouses) return;
      
      const personDeathYear = extractYear(person.death_date);
      
      rels.spouses.forEach(spouse => {
        const spouseDeathYear = extractYear(spouse.death_date);
        
        // Person was widowed if spouse died before them
        if (spouseDeathYear) {
          if (!personDeathYear || personDeathYear > spouseDeathYear) {
            const ageAtWidowhood = spouseDeathYear - extractYear(person.birth_date);
            if (ageAtWidowhood && ageAtWidowhood > 0) {
              events.push({
                person: person.name,
                personSex: person.sex,
                spouseName: spouse.name,
                year: spouseDeathYear,
                age: ageAtWidowhood,
                personObj: person
              });
            }
          }
        }
      });
    });
    
    return events.sort((a, b) => a.year - b.year);
  })();
  
  $: byDecade = (() => {
    const decades = {};
    
    widowhoodData.forEach(event => {
      const decade = Math.floor(event.year / 10) * 10;
      if (!decades[decade]) {
        decades[decade] = { male: [], female: [] };
      }
      if (event.personSex === 'M') {
        decades[decade].male.push(event);
      } else if (event.personSex === 'F') {
        decades[decade].female.push(event);
      }
    });
    
    return Object.entries(decades)
      .map(([decade, events]) => ({
        decade: parseInt(decade),
        male: events.male,
        female: events.female,
        total: events.male.length + events.female.length,
        maleAvgAge: events.male.length > 0 
          ? events.male.reduce((sum, e) => sum + e.age, 0) / events.male.length 
          : null,
        femaleAvgAge: events.female.length > 0
          ? events.female.reduce((sum, e) => sum + e.age, 0) / events.female.length
          : null
      }))
      .sort((a, b) => a.decade - b.decade);
  })();
  
  $: totalWidowed = widowhoodData.length;
  $: maleWidowed = widowhoodData.filter(e => e.personSex === 'M').length;
  $: femaleWidowed = widowhoodData.filter(e => e.personSex === 'F').length;
</script>

<div class="widowhood-timeline">
  <div class="chart-header">
    <h3>Widowhood Timeline</h3>
    <p class="chart-description">
      Track when people became widowed throughout your family history. See trends in widowhood by gender and age, revealing patterns in spousal loss over time.
    </p>
  </div>
  
  {#if widowhoodData.length === 0}
    <div class="no-data">
      <p>No widowhood data available.</p>
      <p>People need both birth and death dates, plus spouse information to appear in this visualization.</p>
    </div>
  {:else}
    <div class="stats-summary">
      <div class="summary-box">
        <span class="summary-label">Total Widowed</span>
        <span class="summary-value">{totalWidowed}</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Men Widowed</span>
        <span class="summary-value male">{maleWidowed}</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Women Widowed</span>
        <span class="summary-value female">{femaleWidowed}</span>
      </div>
    </div>
    
    <div class="timeline-chart">
      <svg class="chart-svg" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid meet">
        <!-- Grid lines -->
        {#each Array(6) as _, i}
          {@const y = 50 + (i * 60)}
          <line 
            x1="50" 
            y1={y} 
            x2="950" 
            y2={y} 
            stroke="var(--border-subtle)" 
            stroke-width="1"
            stroke-dasharray="2,2"
          />
        {/each}
        
        <!-- Male events -->
        {#each byDecade as d}
          {@const x = 50 + ((d.decade - byDecade[0].decade) / (byDecade[byDecade.length - 1].decade - byDecade[0].decade)) * 900}
          {@const maleHeight = (d.male.length / Math.max(...byDecade.map(dd => dd.total))) * 300}
          {#if d.male.length > 0}
            <rect
              x={x - 20}
              y={350 - maleHeight}
              width="40"
              height={maleHeight}
              fill="#5e7a94"
              opacity="0.7"
              class="decade-bar male"
            />
          {/if}
        {/each}
        
        <!-- Female events -->
        {#each byDecade as d}
          {@const x = 50 + ((d.decade - byDecade[0].decade) / (byDecade[byDecade.length - 1].decade - byDecade[0].decade)) * 900}
          {@const femaleHeight = (d.female.length / Math.max(...byDecade.map(dd => dd.total))) * 300}
          {#if d.female.length > 0}
            <rect
              x={x + 20}
              y={350 - femaleHeight}
              width="40"
              height={femaleHeight}
              fill="#9b6b8a"
              opacity="0.7"
              class="decade-bar female"
            />
          {/if}
        {/each}
        
        <!-- Decade labels -->
        {#each byDecade.filter((_, i) => i % Math.ceil(byDecade.length / 8) === 0 || i === byDecade.length - 1) as d, i}
          {@const x = 50 + ((d.decade - byDecade[0].decade) / (byDecade[byDecade.length - 1].decade - byDecade[0].decade)) * 900}
          <text 
            x={x} 
            y="390" 
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
          <span>Men Widowed</span>
        </div>
        <div class="legend-item">
          <span class="legend-color female"></span>
          <span>Women Widowed</span>
        </div>
      </div>
    </div>
    
    <div class="decade-details">
      <h4>Widowhood Events by Decade</h4>
      {#each byDecade as d}
        <div class="decade-section">
          <div class="decade-header">
            <span class="decade-title">{d.decade}s</span>
            <span class="decade-count">{d.total} {d.total === 1 ? 'event' : 'events'}</span>
          </div>
          <div class="decade-stats">
            {#if d.male.length > 0}
              <div class="gender-stats male">
                <span class="gender-label">Men: {d.male.length}</span>
                <span class="avg-age">Avg age: {d.maleAvgAge.toFixed(1)}</span>
              </div>
            {/if}
            {#if d.female.length > 0}
              <div class="gender-stats female">
                <span class="gender-label">Women: {d.female.length}</span>
                <span class="avg-age">Avg age: {d.femaleAvgAge.toFixed(1)}</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .widowhood-timeline {
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
  
  .summary-value.male {
    color: #5e7a94;
  }
  
  .summary-value.female {
    color: #9b6b8a;
  }
  
  .timeline-chart {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    margin-bottom: 2rem;
  }
  
  .chart-svg {
    width: 100%;
    height: 400px;
    margin-bottom: 1.5rem;
  }
  
  .decade-bar {
    transition: all 0.2s ease;
  }
  
  .decade-bar:hover {
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
  
  .legend-color.male {
    background: #5e7a94;
  }
  
  .legend-color.female {
    background: #9b6b8a;
  }
  
  .decade-details {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .decade-details h4 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .decade-section {
    margin-bottom: 1rem;
    padding: 1rem;
    background: var(--bg-card);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
  }
  
  .decade-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .decade-title {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 1rem;
  }
  
  .decade-count {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .decade-stats {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }
  
  .gender-stats {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-sm);
    flex: 1;
    min-width: 150px;
  }
  
  .gender-stats.male {
    background: rgba(94, 122, 148, 0.1);
    border-left: 3px solid #5e7a94;
  }
  
  .gender-stats.female {
    background: rgba(155, 107, 138, 0.1);
    border-left: 3px solid #9b6b8a;
  }
  
  .gender-label {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.95rem;
  }
  
  .gender-stats.male .gender-label {
    color: #5e7a94;
  }
  
  .gender-stats.female .gender-label {
    color: #9b6b8a;
  }
  
  .avg-age {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
</style>

