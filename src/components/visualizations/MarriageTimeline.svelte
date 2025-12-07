<script>
  import { familyData, familyRelationships } from '../../stores/familyStore.js';
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  $: marriageData = (() => {
    const marriages = [];
    const processedMarriages = new Set(); // Track processed marriages to avoid duplicates
    const minYear = 1700;
    const maxYear = new Date().getFullYear();
    
    $familyData.forEach(person => {
      const rels = $familyRelationships[person.id];
      if (!rels?.spouses) return;
      
      rels.spouses.forEach(spouse => {
        // Create unique key for this marriage pair (smaller ID first)
        const marriageKey = person.id < spouse.id 
          ? `${person.id}-${spouse.id}`
          : `${spouse.id}-${person.id}`;
        
        // Skip if we've already processed this marriage
        if (processedMarriages.has(marriageKey)) return;
        processedMarriages.add(marriageKey);
        // Get marriage details from spouse_families if available
        const spouseFamilies = person.spouse_families || [];
        const personFamilyIds = person.spouse_family_ids || [];
        const spouseFamilyIds = spouse.spouse_family_ids || [];
        const sharedFamilyId = personFamilyIds.find(id => 
          spouseFamilyIds.includes(id)
        );
        
        const marriageInfo = sharedFamilyId && spouseFamilies.length > 0
          ? spouseFamilies.find(sf => sf.family_id === sharedFamilyId)
          : null;
        
        const marriageYear = marriageInfo?.marriage_date 
          ? extractYear(marriageInfo.marriage_date)
          : null;
        
        const divorceYear = marriageInfo?.divorce_date
          ? extractYear(marriageInfo.divorce_date)
          : null;
        
        const marriageOrder = marriageInfo?.marriage_order || 1;
        const endReason = marriageInfo?.end_reason;
        
        if (marriageYear && marriageYear >= minYear && marriageYear <= maxYear) {
          marriages.push({
            year: marriageYear,
            person1: person.name,
            person2: spouse.name,
            person1Sex: person.sex,
            person2Sex: spouse.sex,
            marriageOrder,
            divorceYear,
            endReason,
            isDivorced: endReason === 'divorce' || !!divorceYear,
            isWidowed: endReason === 'death',
            isAnnulled: endReason === 'annulment'
          });
        }
      });
    });
    
    // Group by decade
    const byDecade = {};
    const byOrder = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    
    marriages.forEach(marriage => {
      const decade = Math.floor(marriage.year / 10) * 10;
      if (!byDecade[decade]) {
        byDecade[decade] = [];
      }
      byDecade[decade].push(marriage);
      
      if (marriage.marriageOrder <= 5) {
        byOrder[marriage.marriageOrder].push(marriage);
      }
    });
    
    // Calculate statistics
    const decades = Object.keys(byDecade).map(Number).sort((a, b) => a - b);
    const decadeStats = decades.map(decade => ({
      decade,
      count: byDecade[decade].length,
      firstMarriages: byDecade[decade].filter(m => m.marriageOrder === 1).length,
      secondMarriages: byDecade[decade].filter(m => m.marriageOrder === 2).length,
      thirdPlusMarriages: byDecade[decade].filter(m => m.marriageOrder >= 3).length,
      divorces: byDecade[decade].filter(m => m.isDivorced).length,
      widowed: byDecade[decade].filter(m => m.isWidowed).length
    }));
    
    return {
      marriages: marriages.sort((a, b) => a.year - b.year),
      byDecade,
      decadeStats,
      byOrder,
      total: marriages.length,
      firstMarriages: byOrder[1].length,
      secondMarriages: byOrder[2].length,
      thirdPlusMarriages: byOrder[3].length + byOrder[4].length + byOrder[5].length,
      divorces: marriages.filter(m => m.isDivorced).length,
      widowed: marriages.filter(m => m.isWidowed).length
    };
  })();
  
  let viewMode = 'timeline'; // 'timeline', 'stream', 'order'
  let selectedDecade = null;
</script>

<div class="marriage-timeline">
  <div class="chart-header">
    <h3>Marriage Timeline</h3>
    <p class="chart-description">
      Explore marriage patterns across your family tree. See when marriages occurred, track multiple marriages, and observe divorce and widowhood trends over time.
    </p>
    <div class="controls">
      <div class="view-toggle">
        <button 
          class="toggle-btn" 
          class:active={viewMode === 'timeline'}
          on:click={() => viewMode = 'timeline'}
        >
          Timeline
        </button>
        <button 
          class="toggle-btn" 
          class:active={viewMode === 'stream'}
          on:click={() => viewMode = 'stream'}
        >
          Stream Graph
        </button>
        <button 
          class="toggle-btn" 
          class:active={viewMode === 'order'}
          on:click={() => viewMode = 'order'}
        >
          By Order
        </button>
      </div>
    </div>
  </div>
  
  {#if marriageData.total === 0}
    <div class="no-data">
      <p>No marriage data available.</p>
      <p>Marriages need dates to appear in this visualization.</p>
    </div>
  {:else}
    <div class="stats-summary">
      <div class="summary-box">
        <span class="summary-label">Total Marriages</span>
        <span class="summary-value">{marriageData.total}</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">First Marriages</span>
        <span class="summary-value">{marriageData.firstMarriages}</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Second Marriages</span>
        <span class="summary-value">{marriageData.secondMarriages}</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Divorces</span>
        <span class="summary-value divorces">{marriageData.divorces}</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Widowed</span>
        <span class="summary-value widowed">{marriageData.widowed}</span>
      </div>
    </div>
    
    {#if viewMode === 'timeline'}
      <div class="timeline-view">
        <div class="timeline-chart">
          {#each marriageData.decadeStats as stat}
            {@const maxCount = Math.max(...marriageData.decadeStats.map(s => s.count), 1)}
            {@const height = (stat.count / maxCount) * 100}
            <div class="decade-bar" style="height: {height}%">
              <div class="bar-segment first" style="height: {(stat.firstMarriages / stat.count) * 100}%"></div>
              <div class="bar-segment second" style="height: {(stat.secondMarriages / stat.count) * 100}%"></div>
              <div class="bar-segment third" style="height: {(stat.thirdPlusMarriages / stat.count) * 100}%"></div>
              <div class="bar-label">{stat.count}</div>
              <div class="bar-tooltip">
                <strong>{stat.decade}s</strong><br/>
                Total: {stat.count}<br/>
                1st: {stat.firstMarriages} | 2nd: {stat.secondMarriages} | 3+: {stat.thirdPlusMarriages}<br/>
                Divorces: {stat.divorces} | Widowed: {stat.widowed}
              </div>
            </div>
          {/each}
        </div>
        <div class="timeline-labels">
          {#each marriageData.decadeStats as stat}
            <div class="decade-label">{stat.decade}s</div>
          {/each}
        </div>
      </div>
    {:else if viewMode === 'stream'}
      <div class="stream-view">
        <svg class="stream-chart" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid meet">
          <!-- Stream areas for each marriage order -->
          {#each [1, 2, 3] as order}
            {@const data = order === 1 ? marriageData.decadeStats.map(s => ({ decade: s.decade, value: s.firstMarriages })) :
                        order === 2 ? marriageData.decadeStats.map(s => ({ decade: s.decade, value: s.secondMarriages })) :
                        marriageData.decadeStats.map(s => ({ decade: s.decade, value: s.thirdPlusMarriages }))}
            {@const maxValue = Math.max(...data.map(d => d.value), 1)}
            {@const color = order === 1 ? '#7a9e7e' : order === 2 ? '#d4a853' : '#9b6b8a'}
            
            <path
              d={data.map((d, i) => {
                const x = 50 + (i / (data.length - 1)) * 900;
                const y = 350 - ((d.value / maxValue) * 300);
                return i === 0 ? `M ${x} 350 L ${x} ${y}` : `L ${x} ${y}`;
              }).join(' ') + ' L ' + (50 + ((data.length - 1) / (data.length - 1)) * 900) + ' 350 Z'}
              fill={color}
              opacity="0.6"
              class="stream-area"
            />
          {/each}
          
          <!-- Labels -->
          {#each marriageData.decadeStats.filter((_, i) => i % Math.ceil(marriageData.decadeStats.length / 8) === 0 || i === marriageData.decadeStats.length - 1) as stat, i}
            {@const x = 50 + ((marriageData.decadeStats.indexOf(stat) / (marriageData.decadeStats.length - 1)) * 900)}
            <text x={x} y="390" fill="var(--text-muted)" font-size="12" text-anchor="middle">
              {stat.decade}s
            </text>
          {/each}
        </svg>
        <div class="stream-legend">
          <div class="legend-item">
            <span class="legend-color" style="background: #7a9e7e;"></span>
            <span>First Marriages</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #d4a853;"></span>
            <span>Second Marriages</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #9b6b8a;"></span>
            <span>Third+ Marriages</span>
          </div>
        </div>
      </div>
    {:else if viewMode === 'order'}
      <div class="order-view">
        <div class="order-stats">
          {#each [1, 2, 3, 4, 5] as order}
            {@const marriages = marriageData.byOrder[order] || []}
            {#if marriages.length > 0}
              <div class="order-card">
                <div class="order-header">
                  <span class="order-number">
                    {order === 1 ? '1st' : order === 2 ? '2nd' : order === 3 ? '3rd' : `${order}th`} Marriage
                  </span>
                  <span class="order-count">{marriages.length}</span>
                </div>
                <div class="order-details">
                  <div class="detail-item">
                    <span class="detail-label">Divorced:</span>
                    <span class="detail-value">{marriages.filter(m => m.isDivorced).length}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Widowed:</span>
                    <span class="detail-value">{marriages.filter(m => m.isWidowed).length}</span>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .marriage-timeline {
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
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
  
  .summary-value.divorces {
    color: var(--accent-copper);
  }
  
  .summary-value.widowed {
    color: var(--text-muted);
  }
  
  .timeline-view {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .timeline-chart {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    height: 300px;
    margin-bottom: 1rem;
  }
  
  .decade-bar {
    flex: 1;
    min-width: 40px;
    display: flex;
    flex-direction: column;
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .decade-bar:hover {
    transform: translateY(-5px);
  }
  
  .bar-segment {
    width: 100%;
    transition: all 0.2s ease;
  }
  
  .bar-segment.first {
    background: var(--accent-sage);
  }
  
  .bar-segment.second {
    background: var(--accent-gold);
  }
  
  .bar-segment.third {
    background: #9b6b8a;
  }
  
  .bar-label {
    position: absolute;
    top: -25px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
  }
  
  .bar-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-deep);
    color: var(--text-primary);
    padding: 0.75rem;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    margin-bottom: 0.5rem;
    z-index: 10;
  }
  
  .decade-bar:hover .bar-tooltip {
    opacity: 1;
  }
  
  .timeline-labels {
    display: flex;
    gap: 0.5rem;
  }
  
  .decade-label {
    flex: 1;
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
    min-width: 40px;
  }
  
  .stream-view {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .stream-chart {
    width: 100%;
    height: 400px;
    margin-bottom: 1rem;
  }
  
  .stream-legend {
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
  
  .order-view {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .order-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .order-card {
    background: var(--bg-card);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .order-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
  }
  
  .order-number {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 1rem;
  }
  
  .order-count {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent-gold);
    font-family: var(--font-display);
  }
  
  .order-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .detail-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
  }
  
  .detail-label {
    color: var(--text-muted);
  }
  
  .detail-value {
    color: var(--text-primary);
    font-weight: 600;
  }
</style>

