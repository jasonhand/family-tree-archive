<script>
  import { onMount, onDestroy } from 'svelte';
  import { familyData, familyRelationships, selectedPerson } from '../stores/familyStore.js';

  let container;
  let svg;
  let width = 700;
  let height = 700;
  let radius;
  
  // Selected root person for the chart
  let rootPersonId = null;
  let rootPerson = null;
  let hierarchyData = null;
  let maxGenerations = 5;
  
  // Color schemes for paternal/maternal lines
  const colors = {
    paternal: ['#7a9e7e', '#5d8a61', '#4a7550', '#3a6040', '#2a4b30'],
    maternal: ['#c47a5a', '#b56a4a', '#a55a3a', '#954a2a', '#853a1a'],
    root: '#d4a853',
    unknown: '#4a4540'
  };

  // Search functionality
  let searchQuery = '';
  $: searchResults = searchQuery.length > 1 
    ? $familyData.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 10)
    : [];

  function selectRootPerson(person) {
    rootPersonId = person.id;
    rootPerson = person;
    searchQuery = '';
    buildHierarchy();
  }

  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  // Build ancestor hierarchy from selected person
  function buildHierarchy() {
    if (!rootPerson) return;

    function getAncestors(personId, generation, side, index) {
      if (generation > maxGenerations) return null;
      
      const person = $familyData.find(p => p.id === personId);
      if (!person) return null;

      const relationships = $familyRelationships[personId];
      const parents = relationships?.parents || [];
      
      // Try to identify father/mother
      const father = parents.find(p => p.sex === 'M');
      const mother = parents.find(p => p.sex === 'F');
      
      const node = {
        id: person.id,
        name: person.name || 'Unknown',
        sex: person.sex,
        birthYear: extractYear(person.birth_date),
        deathYear: extractYear(person.death_date),
        generation,
        side: generation === 0 ? 'root' : side,
        index,
        children: []
      };

      // Add parents as children in the hierarchy (going backwards in time)
      if (generation < maxGenerations) {
        if (father) {
          const fatherNode = getAncestors(father.id, generation + 1, side === 'root' ? 'paternal' : side, index * 2);
          if (fatherNode) node.children.push(fatherNode);
        } else if (generation < maxGenerations - 1) {
          // Add placeholder for unknown father
          node.children.push({
            id: `unknown-f-${generation}-${index}`,
            name: 'Unknown Father',
            sex: 'M',
            generation: generation + 1,
            side: side === 'root' ? 'paternal' : side,
            index: index * 2,
            unknown: true,
            children: []
          });
        }

        if (mother) {
          const motherNode = getAncestors(mother.id, generation + 1, side === 'root' ? 'maternal' : side, index * 2 + 1);
          if (motherNode) node.children.push(motherNode);
        } else if (generation < maxGenerations - 1) {
          // Add placeholder for unknown mother
          node.children.push({
            id: `unknown-m-${generation}-${index}`,
            name: 'Unknown Mother',
            sex: 'F',
            generation: generation + 1,
            side: side === 'root' ? 'maternal' : side,
            index: index * 2 + 1,
            unknown: true,
            children: []
          });
        }
      }

      return node;
    }

    hierarchyData = getAncestors(rootPersonId, 0, 'root', 0);
    renderChart();
  }

  function renderChart() {
    if (!container || !hierarchyData) return;

    // Clear previous
    container.innerHTML = '';

    const rect = container.getBoundingClientRect();
    width = Math.min(rect.width, 800);
    height = width;
    radius = width / 2;

    // Create SVG
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `${-width/2} ${-height/2} ${width} ${height}`);
    container.appendChild(svg);

    // Add center glow
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <radialGradient id="centerGlow">
        <stop offset="0%" stop-color="${colors.root}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${colors.root}" stop-opacity="0"/>
      </radialGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    `;
    svg.appendChild(defs);

    // Background glow
    const bgGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgGlow.setAttribute('r', radius * 0.15);
    bgGlow.setAttribute('fill', 'url(#centerGlow)');
    svg.appendChild(bgGlow);

    // Draw arcs for each generation
    drawGeneration(hierarchyData, 0, 0, Math.PI * 2);
  }

  function drawGeneration(node, generation, startAngle, endAngle) {
    const innerRadius = generation === 0 ? 0 : radius * (0.12 + generation * 0.15);
    const outerRadius = radius * (0.12 + (generation + 1) * 0.15);
    const midAngle = (startAngle + endAngle) / 2;

    // Get color based on side and generation
    let fillColor;
    if (generation === 0) {
      fillColor = colors.root;
    } else if (node.unknown) {
      fillColor = colors.unknown;
    } else if (node.side === 'paternal') {
      fillColor = colors.paternal[Math.min(generation - 1, colors.paternal.length - 1)];
    } else {
      fillColor = colors.maternal[Math.min(generation - 1, colors.maternal.length - 1)];
    }

    // Create arc path
    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    if (generation === 0) {
      // Center circle for root person
      arc.setAttribute('d', describeArc(0, 0, 0, outerRadius, 0, Math.PI * 2 - 0.001));
    } else {
      arc.setAttribute('d', describeArc(0, 0, innerRadius, outerRadius, startAngle, endAngle - 0.005));
    }
    
    arc.setAttribute('fill', fillColor);
    arc.setAttribute('stroke', 'var(--bg-deep)');
    arc.setAttribute('stroke-width', '2');
    arc.setAttribute('class', 'sunburst-arc');
    arc.style.cursor = node.unknown ? 'default' : 'pointer';
    arc.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    
    if (!node.unknown) {
      arc.addEventListener('mouseenter', () => {
        arc.style.opacity = '0.8';
        arc.setAttribute('filter', 'url(#glow)');
        showTooltip(node, midAngle, (innerRadius + outerRadius) / 2);
      });
      arc.addEventListener('mouseleave', () => {
        arc.style.opacity = '1';
        arc.removeAttribute('filter');
        hideTooltip();
      });
      arc.addEventListener('click', () => {
        if (!node.unknown) {
          const person = $familyData.find(p => p.id === node.id);
          if (person) selectedPerson.set(person);
        }
      });
    }
    
    svg.appendChild(arc);

    // Add text label
    if (generation <= 3 || (endAngle - startAngle) > 0.15) {
      const textRadius = (innerRadius + outerRadius) / 2;
      const textX = Math.cos(midAngle - Math.PI/2) * textRadius;
      const textY = Math.sin(midAngle - Math.PI/2) * textRadius;
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', textX);
      text.setAttribute('y', textY);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', 'white');
      text.setAttribute('font-size', generation === 0 ? '14' : generation <= 2 ? '11' : '9');
      text.setAttribute('font-family', 'var(--font-body)');
      text.setAttribute('pointer-events', 'none');
      
      // Truncate name if needed
      const displayName = generation === 0 
        ? (node.name.length > 20 ? node.name.substring(0, 18) + '...' : node.name)
        : (node.name.length > 12 ? getInitials(node.name) : node.name.split(' ')[0]);
      
      text.textContent = node.unknown ? '?' : displayName;
      svg.appendChild(text);
    }

    // Recursively draw children
    if (node.children && node.children.length > 0) {
      const anglePerChild = (endAngle - startAngle) / node.children.length;
      node.children.forEach((child, i) => {
        const childStart = startAngle + i * anglePerChild;
        const childEnd = childStart + anglePerChild;
        drawGeneration(child, generation + 1, childStart, childEnd);
      });
    }
  }

  function describeArc(cx, cy, innerRadius, outerRadius, startAngle, endAngle) {
    const startOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
    const endOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
    const startInner = polarToCartesian(cx, cy, innerRadius, startAngle);
    const endInner = polarToCartesian(cx, cy, innerRadius, endAngle);
    
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    
    if (innerRadius === 0) {
      // Full circle or pie slice
      return `M ${startOuter.x} ${startOuter.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y} L ${cx} ${cy} Z`;
    }
    
    return `M ${startOuter.x} ${startOuter.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y} L ${endInner.x} ${endInner.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x} ${startInner.y} Z`;
  }

  function polarToCartesian(cx, cy, r, angle) {
    const a = angle - Math.PI / 2;
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a)
    };
  }

  let tooltipEl;
  let tooltipVisible = false;
  let tooltipContent = {};

  function showTooltip(node, angle, radius) {
    tooltipContent = node;
    tooltipVisible = true;
  }

  function hideTooltip() {
    tooltipVisible = false;
  }

  // Count ancestors found
  $: ancestorCount = (() => {
    if (!hierarchyData) return { total: 0, found: 0 };
    let total = 0;
    let found = 0;
    
    function count(node, gen) {
      if (gen > 0) {
        total++;
        if (!node.unknown) found++;
      }
      node.children?.forEach(c => count(c, gen + 1));
    }
    count(hierarchyData, 0);
    return { total, found };
  })();

  onMount(() => {
    // Default to first person or a random one
    if ($familyData.length > 0) {
      // Try to find someone with known parents
      const personWithParents = $familyData.find(p => {
        const rels = $familyRelationships[p.id];
        return rels?.parents?.length > 0;
      });
      selectRootPerson(personWithParents || $familyData[0]);
    }
  });

  // Rerender on window resize
  function handleResize() {
    if (rootPerson) renderChart();
  }
</script>

<svelte:window on:resize={handleResize} />

<div class="sunburst-container">
  <div class="sunburst-header">
    <h2>
      <svg viewBox="0 0 24 24" width="24" height="24">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
      </svg>
      Ancestor Sunburst
    </h2>
    <p>Explore ancestry radiating outward through generations</p>
  </div>

  <div class="sunburst-controls">
    <div class="search-box">
      <input 
        type="text" 
        placeholder="Search for a person to center the chart..." 
        bind:value={searchQuery}
      />
      {#if searchResults.length > 0}
        <div class="search-results">
          {#each searchResults as person}
            <button class="search-result" on:click={() => selectRootPerson(person)}>
              <span class="result-name">{person.name}</span>
              {#if person.birth_date}
                <span class="result-date">b. {extractYear(person.birth_date)}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="generation-control">
      <label>Generations:</label>
      <input 
        type="range" 
        min="2" 
        max="7" 
        bind:value={maxGenerations}
        on:change={buildHierarchy}
      />
      <span>{maxGenerations}</span>
    </div>
  </div>

  {#if rootPerson}
    <div class="chart-info">
      <div class="info-item root-person">
        <span class="info-label">Centered on:</span>
        <span class="info-value">{rootPerson.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Ancestors found:</span>
        <span class="info-value">{ancestorCount.found} / {ancestorCount.total} possible</span>
      </div>
    </div>
  {/if}

  <div class="chart-wrapper">
    <div class="chart-area" bind:this={container}></div>
    
    <div class="legend">
      <div class="legend-item">
        <span class="legend-color" style="background: {colors.root}"></span>
        <span>Selected Person</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: {colors.paternal[0]}"></span>
        <span>Paternal Line (Father's side)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: {colors.maternal[0]}"></span>
        <span>Maternal Line (Mother's side)</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: {colors.unknown}"></span>
        <span>Unknown Ancestor</span>
      </div>
    </div>
  </div>

  {#if tooltipVisible}
    <div class="tooltip" bind:this={tooltipEl}>
      <strong>{tooltipContent.name}</strong>
      {#if tooltipContent.birthYear}
        <span class="tooltip-dates">
          {tooltipContent.birthYear}{tooltipContent.deathYear ? ` - ${tooltipContent.deathYear}` : ''}
        </span>
      {/if}
      <span class="tooltip-hint">Click to view details</span>
    </div>
  {/if}
</div>

<style>
  .sunburst-container {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .sunburst-header {
    padding: 1.5rem;
    background: linear-gradient(135deg, rgba(212, 168, 83, 0.1) 0%, rgba(122, 158, 126, 0.05) 100%);
    border-bottom: 1px solid var(--border-subtle);
  }

  .sunburst-header h2 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .sunburst-header h2 svg {
    color: var(--accent-gold);
  }

  .sunburst-header p {
    color: var(--text-muted);
    font-size: 0.95rem;
    margin-left: 2.75rem;
  }

  .sunburst-controls {
    display: flex;
    gap: 1.5rem;
    padding: 1rem 1.5rem;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid var(--border-subtle);
    flex-wrap: wrap;
  }

  .search-box {
    flex: 1;
    min-width: 250px;
    position: relative;
  }

  .search-box input {
    width: 100%;
    padding: 0.6rem 1rem;
    background: var(--bg-deep);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--accent-gold);
  }

  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    margin-top: 0.25rem;
    max-height: 250px;
    overflow-y: auto;
    z-index: 100;
  }

  .search-result {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.6rem 1rem;
    background: none;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-body);
    cursor: pointer;
    text-align: left;
  }

  .search-result:hover {
    background: rgba(212, 168, 83, 0.1);
  }

  .result-date {
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .generation-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .generation-control input[type="range"] {
    width: 100px;
    accent-color: var(--accent-gold);
  }

  .chart-info {
    display: flex;
    gap: 2rem;
    padding: 0.75rem 1.5rem;
    background: rgba(212, 168, 83, 0.05);
    border-bottom: 1px solid var(--border-subtle);
  }

  .info-item {
    display: flex;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .info-label {
    color: var(--text-muted);
  }

  .info-value {
    color: var(--text-primary);
    font-weight: 500;
  }

  .root-person .info-value {
    color: var(--accent-gold);
  }

  .chart-wrapper {
    display: grid;
    grid-template-columns: 1fr 200px;
    padding: 1.5rem;
    gap: 1.5rem;
  }

  .chart-area {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 500px;
  }

  .legend {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-sm);
    height: fit-content;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .legend-color {
    width: 16px;
    height: 16px;
    border-radius: 3px;
  }

  .tooltip {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--bg-card);
    border: 1px solid var(--accent-gold);
    border-radius: var(--radius-sm);
    padding: 0.75rem 1rem;
    z-index: 1000;
    text-align: center;
    pointer-events: none;
  }

  .tooltip strong {
    display: block;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .tooltip-dates {
    display: block;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .tooltip-hint {
    display: block;
    color: var(--accent-gold);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }

  @media (max-width: 768px) {
    .chart-wrapper {
      grid-template-columns: 1fr;
    }

    .legend {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }

    .sunburst-controls {
      flex-direction: column;
    }
  }
</style>

