<script>
  import { familyData, selectedPerson } from '../../stores/familyStore.js';
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  $: immigrationData = (() => {
    const immigrants = [];
    
    $familyData.forEach(person => {
      if (!person.is_immigrant) return;
      
      // Try to find immigration year from notes or other fields
      let immigrationYear = null;
      const notes = person.immigrant_notes || person.notes || '';
      
      // Look for year patterns in notes
      const yearMatch = notes.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
      if (yearMatch) {
        immigrationYear = parseInt(yearMatch[1]);
      }
      
      // If no year found, use birth year as approximation
      if (!immigrationYear) {
        immigrationYear = extractYear(person.birth_date);
      }
      
      if (immigrationYear) {
        immigrants.push({
          name: person.name,
          year: immigrationYear,
          from: person.birth_country || person.birth_state || 'Unknown',
          to: person.death_country || person.death_state || person.birth_state || 'Unknown',
          notes: person.immigrant_notes || person.notes || '',
          person: person
        });
      }
    });
    
    return immigrants.sort((a, b) => a.year - b.year);
  })();
  
  $: byDecade = (() => {
    const decades = {};
    immigrationData.forEach(imm => {
      const decade = Math.floor(imm.year / 10) * 10;
      if (!decades[decade]) {
        decades[decade] = [];
      }
      decades[decade].push(imm);
    });
    
    return Object.entries(decades)
      .map(([decade, immigrants]) => ({
        decade: parseInt(decade),
        count: immigrants.length,
        immigrants: immigrants.sort((a, b) => a.year - b.year)
      }))
      .sort((a, b) => a.decade - b.decade);
  })();
  
  let selectedDecade = null;
  
  function handlePersonClick(person) {
    selectedPerson.set(person);
  }
</script>

<div class="immigration-timeline">
  <div class="chart-header">
    <h3>Immigration Events Timeline</h3>
    <p class="chart-description">
      Track immigration events in your family history. See when family members immigrated, where they came from, and where they settled.
    </p>
  </div>
  
  {#if immigrationData.length === 0}
    <div class="no-data">
      <p>No immigration data available.</p>
      <p>People need to be marked as immigrants to appear in this visualization.</p>
    </div>
  {:else}
    <div class="stats-summary">
      <div class="summary-box">
        <span class="summary-label">Total Immigrants</span>
        <span class="summary-value">{immigrationData.length}</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Decades with Immigration</span>
        <span class="summary-value">{byDecade.length}</span>
      </div>
      <div class="summary-box">
        <span class="summary-label">Earliest Immigration</span>
        <span class="summary-value">{immigrationData[0]?.year || 'N/A'}</span>
      </div>
    </div>
    
    <div class="timeline-visualization">
      <div class="timeline-track">
        {#each byDecade as decade}
          {@const position = ((decade.decade - byDecade[0].decade) / (byDecade[byDecade.length - 1].decade - byDecade[0].decade)) * 100}
          <div 
            class="decade-marker" 
            style="left: {position}%"
            on:click={() => selectedDecade = selectedDecade === decade.decade ? null : decade.decade}
            title="{decade.decade}s: {decade.count} {decade.count === 1 ? 'immigrant' : 'immigrants'}"
          >
            <div class="marker-dot" style="width: {Math.min(decade.count * 3, 30)}px; height: {Math.min(decade.count * 3, 30)}px;"></div>
            <div class="marker-label">{decade.decade}s</div>
            <div class="marker-count">{decade.count}</div>
          </div>
        {/each}
      </div>
    </div>
    
    <div class="immigrants-list">
      <h4>Immigration Events by Decade</h4>
      {#each byDecade as decade}
        <div class="decade-section">
          <button 
            class="decade-header"
            class:expanded={selectedDecade === decade.decade}
            on:click={() => selectedDecade = selectedDecade === decade.decade ? null : decade.decade}
          >
            <span class="decade-title">{decade.decade}s</span>
            <span class="decade-count">{decade.count} {decade.count === 1 ? 'immigrant' : 'immigrants'}</span>
            <svg viewBox="0 0 24 24" width="16" height="16" class="chevron">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg>
          </button>
          
          {#if selectedDecade === decade.decade}
            <div class="immigrants-grid">
              {#each decade.immigrants as imm}
                <div class="immigrant-card">
                  <div class="immigrant-header">
                    <button 
                      class="immigrant-name" 
                      on:click={() => handlePersonClick(imm.person)}
                      title="Click to view {imm.name}'s details"
                    >
                      {imm.name}
                    </button>
                    <span class="immigrant-year">{imm.year}</span>
                  </div>
                  <div class="immigrant-route">
                    <span class="route-from">{imm.from}</span>
                    <svg viewBox="0 0 24 24" width="16" height="16" class="arrow">
                      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
                    </svg>
                    <span class="route-to">{imm.to}</span>
                  </div>
                  {#if imm.notes}
                    <div class="immigrant-notes">{imm.notes}</div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .immigration-timeline {
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
  
  .timeline-visualization {
    background: var(--bg-elevated);
    padding: 2rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    margin-bottom: 2rem;
  }
  
  .timeline-track {
    position: relative;
    height: 120px;
    border-bottom: 2px solid var(--border-subtle);
  }
  
  .decade-marker {
    position: absolute;
    bottom: 0;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .decade-marker:hover {
    transform: translateX(-50%) translateY(-5px);
  }
  
  .marker-dot {
    background: var(--accent-gold);
    border-radius: 50%;
    margin-bottom: 0.5rem;
    box-shadow: 0 2px 8px rgba(212, 168, 83, 0.4);
    transition: all 0.2s ease;
  }
  
  .decade-marker:hover .marker-dot {
    box-shadow: 0 4px 12px rgba(212, 168, 83, 0.6);
  }
  
  .marker-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  .marker-count {
    font-size: 0.7rem;
    color: var(--accent-gold);
    font-weight: 700;
  }
  
  .immigrants-list {
    background: var(--bg-elevated);
    padding: 1.5rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .immigrants-list h4 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .decade-section {
    margin-bottom: 0.5rem;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  
  .decade-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background: var(--bg-card);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }
  
  .decade-header:hover {
    background: var(--bg-elevated);
  }
  
  .decade-header.expanded {
    background: rgba(212, 168, 83, 0.1);
    border-bottom: 1px solid var(--border-subtle);
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
  
  .chevron {
    transition: transform 0.2s ease;
    color: var(--text-muted);
  }
  
  .decade-header.expanded .chevron {
    transform: rotate(180deg);
  }
  
  .immigrants-grid {
    padding: 1rem;
    background: var(--bg-elevated);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
  
  .immigrant-card {
    background: var(--bg-card);
    padding: 1rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
  }
  
  .immigrant-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .immigrant-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.95rem;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: all 0.2s ease;
    text-decoration: underline;
    text-decoration-color: transparent;
  }
  
  .immigrant-name:hover {
    color: var(--accent-gold);
    text-decoration-color: var(--accent-gold);
  }
  
  .immigrant-year {
    font-size: 0.85rem;
    color: var(--accent-gold);
    font-weight: 600;
    background: rgba(212, 168, 83, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
  }
  
  .immigrant-route {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
  }
  
  .route-from {
    color: var(--accent-copper);
    font-weight: 500;
  }
  
  .arrow {
    color: var(--text-muted);
    flex-shrink: 0;
  }
  
  .route-to {
    color: var(--accent-sage);
    font-weight: 500;
  }
  
  .immigrant-notes {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-subtle);
  }
</style>

