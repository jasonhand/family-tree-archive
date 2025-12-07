<script>
  import { familyData, familyRelationships } from '../../stores/familyStore.js';
  
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }
  
  // Calculate generation depth for each person
  function calculateGeneration(person, relationships, visited = new Set(), depth = 0) {
    if (visited.has(person.id)) return depth;
    visited.add(person.id);
    
    // If person has parents, they're in a later generation
    if (relationships?.parents && relationships.parents.length > 0) {
      // Find the deepest parent generation
      let maxParentDepth = depth;
      for (const parent of relationships.parents) {
        const parentRels = $familyRelationships[parent.id];
        if (parentRels) {
          const parentDepth = calculateGeneration(parent, parentRels, visited, depth + 1);
          maxParentDepth = Math.max(maxParentDepth, parentDepth);
        }
      }
      return maxParentDepth;
    }
    
    return depth;
  }
  
  $: heatmapData = (() => {
    const data = {};
    const minYear = 1600;
    const maxYear = new Date().getFullYear();
    
    // First pass: calculate generations
    const personGenerations = new Map();
    const rootPeople = $familyData.filter(p => {
      const rels = $familyRelationships[p.id];
      return !rels?.parents || rels.parents.length === 0;
    });
    
    // Assign generation 0 to root people, then calculate for others
    rootPeople.forEach(p => personGenerations.set(p.id, 0));
    
    function assignGeneration(personId, visited = new Set()) {
      if (personGenerations.has(personId)) return personGenerations.get(personId);
      if (visited.has(personId)) {
        // Circular reference detected, assign generation 0
        personGenerations.set(personId, 0);
        return 0;
      }
      visited.add(personId);
      
      const rels = $familyRelationships[personId];
      if (rels?.parents && rels.parents.length > 0) {
        let maxParentGen = -1;
        for (const parent of rels.parents) {
          const parentGen = assignGeneration(parent.id, new Set(visited));
          maxParentGen = Math.max(maxParentGen, parentGen);
        }
        const gen = maxParentGen + 1;
        personGenerations.set(personId, gen);
        return gen;
      }
      
      const gen = 0;
      personGenerations.set(personId, gen);
      return gen;
    }
    
    $familyData.forEach(p => {
      if (!personGenerations.has(p.id)) {
        assignGeneration(p.id);
      }
    });
    
    // Group by generation and birth year
    $familyData.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      if (!birthYear || birthYear < minYear || birthYear > maxYear) return;
      
      const generation = personGenerations.get(person.id) ?? 0;
      const decade = Math.floor(birthYear / 10) * 10;
      
      if (!data[generation]) {
        data[generation] = {};
      }
      if (!data[generation][decade]) {
        data[generation][decade] = 0;
      }
      data[generation][decade]++;
    });
    
    // Convert to array format
    const generations = Object.keys(data).map(Number).sort((a, b) => a - b);
    const decades = [];
    for (let year = minYear; year <= maxYear; year += 10) {
      decades.push(year);
    }
    
    return {
      generations,
      decades,
      data,
      maxCount: Math.max(...Object.values(data).flatMap(gen => Object.values(gen)), 1)
    };
  })();
  
  let hoveredCell = null;
</script>

<div class="generation-heatmap">
  <div class="chart-header">
    <h3>Generation Birth Waves</h3>
    <p class="chart-description">
      A heatmap showing when each generation was born. Each row represents a generation, and the color intensity shows how many people were born in that decade. This reveals generational patterns and birth waves in your family tree.
    </p>
  </div>
  
  {#if heatmapData.generations.length === 0}
    <div class="no-data">
      <p>No birth date data available for generation heatmap.</p>
      <p>People need birth dates to appear in this visualization.</p>
    </div>
  {:else}
    <div class="heatmap-container">
      <div class="heatmap-wrapper">
        <div class="generation-labels">
          {#each heatmapData.generations as gen}
            <div class="gen-label">Gen {gen}</div>
          {/each}
        </div>
        
        <div class="heatmap-grid">
          <div class="decade-header">
            {#each heatmapData.decades as decade}
              <div class="decade-label">{decade}s</div>
            {/each}
          </div>
          
          {#each heatmapData.generations as gen}
            <div class="generation-row">
              {#each heatmapData.decades as decade}
                {@const count = heatmapData.data[gen]?.[decade] || 0}
                {@const intensity = count / heatmapData.maxCount}
                {@const isHovered = hoveredCell?.gen === gen && hoveredCell?.decade === decade}
                <div 
                  class="heatmap-cell" 
                  class:hovered={isHovered}
                  style="background: {count > 0 ? `rgba(212, 168, 83, ${0.3 + intensity * 0.7})` : 'var(--bg-elevated)'};"
                  on:mouseenter={() => hoveredCell = { gen, decade, count }}
                  on:mouseleave={() => hoveredCell = null}
                  title="Generation {gen}, {decade}s: {count} {count === 1 ? 'person' : 'people'}"
                >
                  {#if count > 0}
                    <span class="cell-count">{count}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
      
      <div class="heatmap-legend">
        <div class="legend-label">Births per Decade</div>
        <div class="legend-scale">
          <div class="legend-item">
            <div class="legend-color" style="background: var(--bg-elevated);"></div>
            <span>0</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: rgba(212, 168, 83, 0.3);"></div>
            <span>Few</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: rgba(212, 168, 83, 0.65);"></div>
            <span>Some</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: rgba(212, 168, 83, 1);"></div>
            <span>Many ({heatmapData.maxCount})</span>
          </div>
        </div>
      </div>
      
      {#if hoveredCell}
        <div class="tooltip">
          <strong>Generation {hoveredCell.gen}</strong><br/>
          <span>{hoveredCell.decade}s: {hoveredCell.count} {hoveredCell.count === 1 ? 'birth' : 'births'}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .generation-heatmap {
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
  
  .heatmap-container {
    position: relative;
  }
  
  .heatmap-wrapper {
    display: flex;
    gap: 1rem;
    overflow-x: auto;
    padding: 1rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .generation-labels {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-width: 80px;
    padding-top: 2.5rem;
  }
  
  .gen-label {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 0.85rem;
    border-right: 2px solid var(--border-subtle);
    margin-bottom: 2px;
  }
  
  .heatmap-grid {
    flex: 1;
    min-width: 600px;
  }
  
  .decade-header {
    display: flex;
    gap: 2px;
    margin-bottom: 2px;
  }
  
  .decade-label {
    flex: 1;
    min-width: 60px;
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.5rem 0;
    font-weight: 500;
  }
  
  .generation-row {
    display: flex;
    gap: 2px;
    margin-bottom: 2px;
  }
  
  .heatmap-cell {
    flex: 1;
    min-width: 60px;
    height: 40px;
    border: 1px solid var(--border-subtle);
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    cursor: pointer;
    position: relative;
  }
  
  .heatmap-cell:hover,
  .heatmap-cell.hovered {
    transform: scale(1.1);
    z-index: 10;
    box-shadow: 0 4px 12px rgba(212, 168, 83, 0.4);
    border-color: var(--accent-gold);
  }
  
  .cell-count {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--bg-deep);
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
  }
  
  .heatmap-legend {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  
  .legend-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .legend-scale {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  
  .legend-color {
    width: 30px;
    height: 20px;
    border-radius: 3px;
    border: 1px solid var(--border-subtle);
  }
  
  .tooltip {
    position: absolute;
    top: -60px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-deep);
    color: var(--text-primary);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-soft);
    font-size: 0.85rem;
    white-space: nowrap;
    z-index: 100;
    pointer-events: none;
  }
  
  .tooltip::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid var(--bg-deep);
  }
</style>

