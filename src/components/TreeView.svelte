<script>
  import { familyData, familyRelationships, selectedPerson } from '../stores/familyStore.js';
  import { onMount } from 'svelte';

  let centerPerson = null;
  let maxGenerations = 5;
  let chartSize = 600;
  let svgElement;

  // Extract year from date string
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }

  // Format display for dropdown
  function formatPersonOption(person) {
    const year = extractYear(person.birth_date);
    if (year) {
      return `${person.name} (b. ${year})`;
    }
    return person.name;
  }

  // All people sorted by name for the dropdown
  $: allPeopleSorted = [...$familyData].sort((a, b) => {
    return (a.name || '').localeCompare(b.name || '');
  });

  // Default to first person if none selected
  $: if (!centerPerson && allPeopleSorted.length) {
    // Try to find someone with ancestors
    const withAncestors = allPeopleSorted.find(p => {
      const rels = $familyRelationships[p.id];
      return rels?.parents?.length > 0;
    });
    centerPerson = withAncestors || allPeopleSorted[0];
  }

  // Build ancestor tree structure for fan chart
  function buildAncestorTree(person, generation = 0, position = 0) {
    if (!person || generation > maxGenerations) return null;
    
    const rels = $familyRelationships[person.id];
    const parents = rels?.parents || [];
    
    // Get father (male) and mother (female), maintaining order
    const father = parents.find(p => p.sex === 'M');
    const mother = parents.find(p => p.sex === 'F');
    
    return {
      person,
      generation,
      position,
      father: father ? buildAncestorTree(father, generation + 1, position * 2) : null,
      mother: mother ? buildAncestorTree(mother, generation + 1, position * 2 + 1) : null
    };
  }

  $: ancestorTree = centerPerson ? buildAncestorTree(centerPerson) : null;

  // Flatten tree for rendering
  function flattenTree(node, result = []) {
    if (!node) return result;
    result.push(node);
    if (node.father) flattenTree(node.father, result);
    if (node.mother) flattenTree(node.mother, result);
    return result;
  }

  $: flatNodes = ancestorTree ? flattenTree(ancestorTree) : [];

  // Calculate positions for fan chart segments
  function getSegmentPath(generation, position, innerRadius, outerRadius, startAngle, endAngle) {
    // Calculate the angle span for this segment
    const totalPositions = Math.pow(2, generation);
    const segmentAngle = (endAngle - startAngle) / totalPositions;
    const segStart = startAngle + (position * segmentAngle);
    const segEnd = segStart + segmentAngle;
    
    // Add small gap between segments
    const gap = 0.5 * (Math.PI / 180); // 0.5 degree gap
    const adjustedStart = segStart + gap;
    const adjustedEnd = segEnd - gap;
    
    // Convert to cartesian coordinates
    const x1 = Math.cos(adjustedStart) * innerRadius;
    const y1 = Math.sin(adjustedStart) * innerRadius;
    const x2 = Math.cos(adjustedStart) * outerRadius;
    const y2 = Math.sin(adjustedStart) * outerRadius;
    const x3 = Math.cos(adjustedEnd) * outerRadius;
    const y3 = Math.sin(adjustedEnd) * outerRadius;
    const x4 = Math.cos(adjustedEnd) * innerRadius;
    const y4 = Math.sin(adjustedEnd) * innerRadius;
    
    // Large arc flag
    const largeArc = (adjustedEnd - adjustedStart) > Math.PI ? 1 : 0;
    
    return `M ${x1} ${y1} 
            L ${x2} ${y2} 
            A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3}
            L ${x4} ${y4}
            A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1}
            Z`;
  }

  // Get text position for a segment
  function getTextPosition(generation, position, radius, startAngle, endAngle) {
    const totalPositions = Math.pow(2, generation);
    const segmentAngle = (endAngle - startAngle) / totalPositions;
    const midAngle = startAngle + (position * segmentAngle) + (segmentAngle / 2);
    
    return {
      x: Math.cos(midAngle) * radius,
      y: Math.sin(midAngle) * radius,
      angle: midAngle * (180 / Math.PI)
    };
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
      .filter(part => !part.startsWith('/') && !part.endsWith('/'))
      .map(part => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function getFirstName(name) {
    if (!name) return '?';
    const cleaned = name.replace(/\//g, '').trim();
    const parts = cleaned.split(' ');
    return parts[0] || '?';
  }

  function getGenderColor(sex) {
    if (sex === 'M') return { fill: '#3d5a7b', stroke: '#5e8ab8' };
    if (sex === 'F') return { fill: '#7b4a6a', stroke: '#b87a9a' };
    return { fill: '#5a5a5a', stroke: '#7a7a7a' };
  }

  // Ring colors by generation
  const generationColors = [
    { bg: 'var(--accent-gold)', text: 'var(--bg-deep)' },
    { bg: '#4a7c9b', text: 'white' },
    { bg: '#7a9e7e', text: 'white' },
    { bg: '#c47a5a', text: 'white' },
    { bg: '#9b6b8a', text: 'white' },
    { bg: '#6b8a9b', text: 'white' }
  ];

  // Chart dimensions
  $: centerRadius = 60;
  $: ringWidth = (chartSize / 2 - centerRadius - 20) / maxGenerations;
  $: startAngle = Math.PI; // 180 degrees (left)
  $: endAngle = 2 * Math.PI; // 360 degrees (right) - semicircle facing up

  function handleSegmentClick(node) {
    selectedPerson.set(node.person);
  }

  function handleCenterClick() {
    if (centerPerson) {
      selectedPerson.set(centerPerson);
    }
  }

  // Count ancestors per generation
  $: ancestorCounts = (() => {
    const counts = [];
    for (let g = 1; g <= maxGenerations; g++) {
      const nodesAtGen = flatNodes.filter(n => n.generation === g);
      const possible = Math.pow(2, g);
      counts.push({ generation: g, found: nodesAtGen.length, possible });
    }
    return counts;
  })();

  $: totalAncestors = flatNodes.filter(n => n.generation > 0).length;

  // ============== DESCENDANT TREE ==============
  
  let showDescendants = true;
  let descendantGenerations = 3;

  // Build descendant tree structure
  function buildDescendantTree(person, generation = 0, visited = new Set()) {
    if (!person || generation > descendantGenerations || visited.has(person.id)) return null;
    visited.add(person.id);
    
    const rels = $familyRelationships[person.id];
    const children = rels?.children || [];
    const spouses = rels?.spouses || [];
    
    return {
      person,
      generation,
      spouses,
      children: children
        .map(child => buildDescendantTree(child, generation + 1, visited))
        .filter(Boolean)
        .sort((a, b) => {
          const yearA = extractYear(a.person.birth_date) || 9999;
          const yearB = extractYear(b.person.birth_date) || 9999;
          return yearA - yearB;
        })
    };
  }

  $: descendantTree = centerPerson ? buildDescendantTree(centerPerson) : null;

  // Count total descendants
  function countDescendants(node) {
    if (!node) return 0;
    return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
  }

  $: totalDescendants = descendantTree ? countDescendants(descendantTree) : 0;
</script>

<div class="fan-chart-container">
  <div class="chart-controls">
    <div class="control-group">
      <label>Center Person</label>
      <select bind:value={centerPerson}>
        {#each allPeopleSorted as person}
          <option value={person}>{formatPersonOption(person)}</option>
        {/each}
      </select>
    </div>

    <div class="control-group">
      <label>Generations</label>
      <div class="gen-control">
        <button class="gen-btn" on:click={() => maxGenerations = Math.max(2, maxGenerations - 1)}>−</button>
        <span class="gen-count">{maxGenerations}</span>
        <button class="gen-btn" on:click={() => maxGenerations = Math.min(7, maxGenerations + 1)}>+</button>
      </div>
    </div>

    <div class="control-group">
      <label>Size</label>
      <div class="size-control">
        <button class:active={chartSize === 500} on:click={() => chartSize = 500}>S</button>
        <button class:active={chartSize === 600} on:click={() => chartSize = 600}>M</button>
        <button class:active={chartSize === 750} on:click={() => chartSize = 750}>L</button>
        <button class:active={chartSize === 900} on:click={() => chartSize = 900}>XL</button>
      </div>
    </div>

    <div class="stats-summary">
      <span class="stat">{totalAncestors} ancestors found</span>
    </div>
  </div>

  <div class="chart-viewport">
    <svg 
      bind:this={svgElement}
      width={chartSize} 
      height={chartSize / 2 + 80}
      viewBox="{-chartSize/2} {-chartSize/2} {chartSize} {chartSize/2 + 80}"
    >
      <!-- Generation labels on the left -->
      {#each ancestorCounts as { generation, found, possible }}
        <text 
          x={-chartSize/2 + 10}
          y={-centerRadius - (generation - 0.5) * ringWidth}
          class="gen-label"
          text-anchor="start"
        >
          Gen {generation}: {found}/{possible}
        </text>
      {/each}

      <!-- Ancestor segments -->
      {#each flatNodes.filter(n => n.generation > 0) as node}
        {@const innerR = centerRadius + (node.generation - 1) * ringWidth}
        {@const outerR = centerRadius + node.generation * ringWidth}
        {@const colors = getGenderColor(node.person.sex)}
        {@const textPos = getTextPosition(node.generation, node.position, innerR + ringWidth/2, startAngle, endAngle)}
        
        <g class="segment" on:click={() => handleSegmentClick(node)}>
          <path 
            d={getSegmentPath(node.generation, node.position, innerR, outerR, startAngle, endAngle)}
            fill={colors.fill}
            stroke={colors.stroke}
            stroke-width="1"
            class="segment-path"
          />
          
          <!-- Text in segment -->
          {#if ringWidth > 25}
            <text 
              x={textPos.x}
              y={textPos.y}
              text-anchor="middle"
              dominant-baseline="middle"
              class="segment-text"
              transform="rotate({textPos.angle + 90}, {textPos.x}, {textPos.y})"
            >
              {#if ringWidth > 50}
                {getFirstName(node.person.name)}
              {:else}
                {getInitials(node.person.name)}
              {/if}
            </text>
          {/if}
        </g>
      {/each}

      <!-- Empty slots (no ancestor found) -->
      {#each Array(maxGenerations) as _, gen}
        {#each Array(Math.pow(2, gen + 1)) as _, pos}
          {@const hasNode = flatNodes.some(n => n.generation === gen + 1 && n.position === pos)}
          {#if !hasNode}
            {@const innerR = centerRadius + gen * ringWidth}
            {@const outerR = centerRadius + (gen + 1) * ringWidth}
            <path 
              d={getSegmentPath(gen + 1, pos, innerR, outerR, startAngle, endAngle)}
              fill="var(--bg-elevated)"
              stroke="var(--border-subtle)"
              stroke-width="1"
              opacity="0.4"
            />
          {/if}
        {/each}
      {/each}

      <!-- Center person circle -->
      {#if centerPerson}
        <g class="center-person" on:click={handleCenterClick}>
          <circle 
            cx="0" 
            cy="0" 
            r={centerRadius}
            fill="var(--accent-gold)"
            stroke="var(--bg-deep)"
            stroke-width="3"
          />
          <text 
            x="0" 
            y="-10"
            text-anchor="middle"
            class="center-name"
          >
            {getFirstName(centerPerson.name)}
          </text>
          <text 
            x="0" 
            y="10"
            text-anchor="middle"
            class="center-surname"
          >
            {centerPerson.name?.split(' ').pop()?.replace(/\//g, '') || ''}
          </text>
          {#if extractYear(centerPerson.birth_date)}
            <text 
              x="0" 
              y="28"
              text-anchor="middle"
              class="center-year"
            >
              b. {extractYear(centerPerson.birth_date)}
            </text>
          {/if}
        </g>
      {/if}

      <!-- Legend -->
      <g transform="translate({chartSize/2 - 100}, 30)">
        <rect x="-10" y="-10" width="100" height="50" fill="var(--bg-card)" rx="6" opacity="0.9"/>
        <circle cx="10" cy="5" r="8" fill="#3d5a7b"/>
        <text x="25" y="9" class="legend-text">Male</text>
        <circle cx="10" cy="28" r="8" fill="#7b4a6a"/>
        <text x="25" y="32" class="legend-text">Female</text>
      </g>
    </svg>
  </div>

  <!-- Generation legend -->
  <div class="generation-legend">
    <div class="legend-item">
      <span class="legend-label">Parents</span>
      <span class="legend-ring" style="background: #4a7c9b"></span>
    </div>
    <div class="legend-item">
      <span class="legend-label">Grandparents</span>
      <span class="legend-ring" style="background: #4a7c9b"></span>
    </div>
    <div class="legend-item">
      <span class="legend-label">Great-Grand</span>
      <span class="legend-ring" style="background: #4a7c9b"></span>
    </div>
    <span class="legend-hint">Click any segment to view details</span>
  </div>

  <!-- Descendant Tree Section -->
  <div class="descendant-section">
    <div class="section-header">
      <h3>
        <svg viewBox="0 0 24 24" width="22" height="22">
          <circle cx="12" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M12 8v4M8 12h8M8 12v4M16 12v4" stroke="currentColor" stroke-width="2" fill="none"/>
          <circle cx="8" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
          <circle cx="16" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        Descendants
      </h3>
      <div class="section-controls">
        <span class="descendant-count">{totalDescendants} descendants found</span>
        <div class="gen-control">
          <label>Depth:</label>
          <button class="gen-btn" on:click={() => descendantGenerations = Math.max(1, descendantGenerations - 1)}>−</button>
          <span class="gen-count">{descendantGenerations}</span>
          <button class="gen-btn" on:click={() => descendantGenerations = Math.min(6, descendantGenerations + 1)}>+</button>
        </div>
        <button class="toggle-btn" on:click={() => showDescendants = !showDescendants}>
          {showDescendants ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>

    {#if showDescendants && descendantTree}
      <div class="descendant-tree">
        {#if descendantTree.children.length > 0 || descendantTree.spouses.length > 0}
          <!-- Root person and spouse(s) -->
          <div class="tree-level root-level">
            <div class="family-unit">
              <button class="tree-card {descendantTree.person.sex === 'M' ? 'male' : descendantTree.person.sex === 'F' ? 'female' : ''}" on:click={() => selectedPerson.set(descendantTree.person)}>
                <span class="card-name">{getFirstName(descendantTree.person.name)}</span>
                <span class="card-surname">{descendantTree.person.name?.split(' ').pop()?.replace(/\//g, '') || ''}</span>
                {#if extractYear(descendantTree.person.birth_date)}
                  <span class="card-year">b. {extractYear(descendantTree.person.birth_date)}</span>
                {/if}
              </button>
              {#if descendantTree.spouses.length > 0}
                {#each descendantTree.spouses as spouse}
                  <div class="spouse-link">═</div>
                  <button class="tree-card spouse {spouse.sex === 'M' ? 'male' : spouse.sex === 'F' ? 'female' : ''}" on:click={() => selectedPerson.set(spouse)}>
                    <span class="card-name">{getFirstName(spouse.name)}</span>
                    <span class="card-surname">{spouse.name?.split(' ').pop()?.replace(/\//g, '') || ''}</span>
                    {#if extractYear(spouse.birth_date)}
                      <span class="card-year">b. {extractYear(spouse.birth_date)}</span>
                    {/if}
                  </button>
                {/each}
              {/if}
            </div>
          </div>

          <!-- Children (Gen 1) -->
          {#if descendantTree.children.length > 0}
            <div class="connector-line"></div>
            <div class="tree-level">
              <div class="horizontal-line" style="width: {Math.max(1, descendantTree.children.length - 1) * 180}px"></div>
              <div class="children-row">
                {#each descendantTree.children as child1}
                  <div class="tree-branch">
                    <div class="vertical-line"></div>
                    <div class="family-unit">
                      <button class="tree-card {child1.person.sex === 'M' ? 'male' : child1.person.sex === 'F' ? 'female' : ''}" on:click={() => selectedPerson.set(child1.person)}>
                        <span class="card-name">{getFirstName(child1.person.name)}</span>
                        <span class="card-surname">{child1.person.name?.split(' ').pop()?.replace(/\//g, '') || ''}</span>
                        {#if extractYear(child1.person.birth_date)}
                          <span class="card-year">b. {extractYear(child1.person.birth_date)}</span>
                        {/if}
                        {#if child1.children.length > 0}
                          <span class="has-children">▼ {child1.children.length}</span>
                        {/if}
                      </button>
                    </div>

                    <!-- Grandchildren (Gen 2) -->
                    {#if child1.children.length > 0 && descendantGenerations >= 2}
                      <div class="connector-line small"></div>
                      <div class="grandchildren-row">
                        {#each child1.children as child2}
                          <div class="tree-branch small">
                            <button class="tree-card small {child2.person.sex === 'M' ? 'male' : child2.person.sex === 'F' ? 'female' : ''}" on:click={() => selectedPerson.set(child2.person)}>
                              <span class="card-name">{getFirstName(child2.person.name)}</span>
                              {#if extractYear(child2.person.birth_date)}
                                <span class="card-year">b. {extractYear(child2.person.birth_date)}</span>
                              {/if}
                              {#if child2.children.length > 0}
                                <span class="has-children">▼ {child2.children.length}</span>
                              {/if}
                            </button>

                            <!-- Great-grandchildren (Gen 3) -->
                            {#if child2.children.length > 0 && descendantGenerations >= 3}
                              <div class="great-grandchildren-row">
                                {#each child2.children as child3}
                                  <button class="tree-card tiny {child3.person.sex === 'M' ? 'male' : child3.person.sex === 'F' ? 'female' : ''}" on:click={() => selectedPerson.set(child3.person)}>
                                    <span class="card-name">{getInitials(child3.person.name)}</span>
                                  </button>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {:else}
          <div class="no-descendants">
            <p>No children or spouse recorded for {centerPerson?.name}</p>
          </div>
        {/if}
      </div>
    {:else if showDescendants}
      <div class="no-descendants">
        <p>Select a person to view their descendants</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .fan-chart-container {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .chart-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    padding: 1.25rem;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-subtle);
    align-items: flex-end;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .control-group label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    font-weight: 500;
  }

  .control-group select {
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    min-width: 280px;
  }

  .control-group select:focus {
    outline: none;
    border-color: var(--accent-gold);
  }

  .gen-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .gen-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-card);
    color: var(--text-primary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .gen-btn:hover {
    background: var(--accent-gold);
    color: var(--bg-deep);
    border-color: var(--accent-gold);
  }

  .gen-count {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--accent-gold);
    min-width: 24px;
    text-align: center;
  }

  .size-control {
    display: flex;
    gap: 0;
  }

  .size-control button {
    padding: 0.5rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .size-control button:first-child {
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  }

  .size-control button:last-child {
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }

  .size-control button:not(:first-child) {
    border-left: none;
  }

  .size-control button:hover {
    background: var(--bg-elevated);
  }

  .size-control button.active {
    background: var(--accent-gold);
    color: var(--bg-deep);
    border-color: var(--accent-gold);
  }

  .stats-summary {
    margin-left: auto;
    display: flex;
    gap: 1rem;
  }

  .stats-summary .stat {
    font-size: 0.9rem;
    color: var(--text-secondary);
    padding: 0.5rem 1rem;
    background: var(--bg-card);
    border-radius: var(--radius-sm);
  }

  .chart-viewport {
    display: flex;
    justify-content: center;
    padding: 2rem;
    overflow-x: auto;
    background: radial-gradient(circle at center bottom, var(--bg-elevated) 0%, var(--bg-card) 70%);
  }

  svg {
    overflow: visible;
  }

  .segment {
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .segment:hover .segment-path {
    filter: brightness(1.2);
    stroke-width: 2;
  }

  .segment-text {
    fill: white;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .center-person {
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .center-person:hover circle {
    filter: brightness(1.1);
  }

  .center-name {
    fill: var(--bg-deep);
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
  }

  .center-surname {
    fill: var(--bg-deep);
    font-family: var(--font-body);
    font-size: 11px;
    opacity: 0.8;
  }

  .center-year {
    fill: var(--bg-deep);
    font-family: var(--font-body);
    font-size: 10px;
    opacity: 0.7;
  }

  .gen-label {
    fill: var(--text-muted);
    font-family: var(--font-body);
    font-size: 10px;
  }

  .legend-text {
    fill: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 11px;
  }

  .generation-legend {
    display: flex;
    justify-content: center;
    gap: 2rem;
    padding: 1rem;
    background: var(--bg-elevated);
    border-top: 1px solid var(--border-subtle);
    flex-wrap: wrap;
    align-items: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .legend-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .legend-ring {
    width: 16px;
    height: 16px;
    border-radius: 3px;
  }

  .legend-hint {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-style: italic;
  }

  /* Descendant Tree Section */
  .descendant-section {
    border-top: 1px solid var(--border-subtle);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background: var(--bg-elevated);
    flex-wrap: wrap;
    gap: 1rem;
  }

  .section-header h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .section-header h3 svg {
    color: var(--accent-sage);
  }

  .section-controls {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .section-controls label {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-right: 0.25rem;
  }

  .descendant-count {
    font-size: 0.85rem;
    color: var(--text-secondary);
    padding: 0.35rem 0.75rem;
    background: var(--bg-card);
    border-radius: var(--radius-sm);
  }

  .toggle-btn {
    padding: 0.4rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn:hover {
    background: var(--accent-gold);
    color: var(--bg-deep);
    border-color: var(--accent-gold);
  }

  .descendant-tree {
    padding: 2rem;
    overflow-x: auto;
    background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-elevated) 100%);
    min-height: 200px;
  }

  .tree-level {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .root-level {
    margin-bottom: 0;
  }

  .family-unit {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .spouse-link {
    color: var(--accent-gold);
    font-size: 1.2rem;
    font-weight: bold;
    padding: 0 0.25rem;
  }

  .tree-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--bg-card);
    border: 2px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 100px;
    font-family: var(--font-body);
  }

  .tree-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .tree-card.male {
    border-color: #4a7c9b;
    background: linear-gradient(135deg, rgba(74, 124, 155, 0.15) 0%, var(--bg-card) 100%);
  }

  .tree-card.male:hover {
    border-color: #5e8ab8;
  }

  .tree-card.female {
    border-color: #9b6b8a;
    background: linear-gradient(135deg, rgba(155, 107, 138, 0.15) 0%, var(--bg-card) 100%);
  }

  .tree-card.female:hover {
    border-color: #b87a9a;
  }

  .tree-card.spouse {
    background: var(--bg-elevated);
  }

  .tree-card.small {
    padding: 0.5rem 0.75rem;
    min-width: 80px;
  }

  .tree-card.tiny {
    padding: 0.35rem 0.5rem;
    min-width: 40px;
    font-size: 0.75rem;
  }

  .card-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .tree-card.small .card-name {
    font-size: 0.8rem;
  }

  .tree-card.tiny .card-name {
    font-size: 0.7rem;
  }

  .card-surname {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.1rem;
  }

  .card-year {
    font-size: 0.7rem;
    color: var(--accent-gold);
    margin-top: 0.2rem;
  }

  .has-children {
    font-size: 0.65rem;
    color: var(--accent-sage);
    margin-top: 0.25rem;
  }

  .connector-line {
    width: 2px;
    height: 30px;
    background: var(--border-subtle);
    margin: 0 auto;
  }

  .connector-line.small {
    height: 20px;
  }

  .horizontal-line {
    height: 2px;
    background: var(--border-subtle);
    margin-bottom: -1px;
  }

  .children-row {
    display: flex;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .tree-branch {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .tree-branch.small {
    margin: 0.25rem;
  }

  .vertical-line {
    width: 2px;
    height: 15px;
    background: var(--border-subtle);
  }

  .grandchildren-row {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  .great-grandchildren-row {
    display: flex;
    justify-content: center;
    gap: 0.25rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  .no-descendants {
    text-align: center;
    padding: 3rem 2rem;
    color: var(--text-muted);
  }

  .no-descendants p {
    margin: 0;
  }

  @media (max-width: 768px) {
    .chart-controls {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .control-group select {
      min-width: 100%;
    }

    .stats-summary {
      margin-left: 0;
    }

    .generation-legend {
      gap: 1rem;
    }

    .section-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .section-controls {
      width: 100%;
      justify-content: space-between;
    }

    .descendant-tree {
      padding: 1rem;
    }

    .children-row {
      gap: 0.5rem;
    }
  }
</style>
