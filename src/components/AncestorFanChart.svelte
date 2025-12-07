<script>
  import { familyRelationships, selectedPerson } from '../stores/familyStore.js';
  import { createEventDispatcher } from 'svelte';

  export let person;
  export let maxGenerations = 4;
  export let size = 400;

  const dispatch = createEventDispatcher();

  // Extract year from date string
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }

  // Build ancestor tree structure for fan chart
  function buildAncestorTree(p, generation = 0, position = 0) {
    if (!p || generation > maxGenerations) return null;
    
    const rels = $familyRelationships[p.id];
    const parents = rels?.parents || [];
    
    // Get father (male) and mother (female), maintaining order
    const father = parents.find(parent => parent.sex === 'M');
    const mother = parents.find(parent => parent.sex === 'F');
    
    return {
      person: p,
      generation,
      position,
      father: father ? buildAncestorTree(father, generation + 1, position * 2) : null,
      mother: mother ? buildAncestorTree(mother, generation + 1, position * 2 + 1) : null
    };
  }

  $: ancestorTree = person ? buildAncestorTree(person) : null;

  // Flatten tree for rendering
  function flattenTree(node, result = []) {
    if (!node) return result;
    result.push(node);
    if (node.father) flattenTree(node.father, result);
    if (node.mother) flattenTree(node.mother, result);
    return result;
  }

  $: flatNodes = ancestorTree ? flattenTree(ancestorTree) : [];

  // Chart dimensions
  $: centerRadius = size * 0.12;
  $: ringWidth = (size / 2 - centerRadius - 10) / maxGenerations;
  $: startAngle = Math.PI; // 180 degrees (left)
  $: endAngle = 2 * Math.PI; // 360 degrees (right) - semicircle facing up

  // Calculate positions for fan chart segments
  function getSegmentPath(generation, position, innerRadius, outerRadius) {
    const totalPositions = Math.pow(2, generation);
    const segmentAngle = (endAngle - startAngle) / totalPositions;
    const segStart = startAngle + (position * segmentAngle);
    const segEnd = segStart + segmentAngle;
    
    // Add small gap between segments
    const gap = 0.8 * (Math.PI / 180);
    const adjustedStart = segStart + gap;
    const adjustedEnd = segEnd - gap;
    
    const x1 = Math.cos(adjustedStart) * innerRadius;
    const y1 = Math.sin(adjustedStart) * innerRadius;
    const x2 = Math.cos(adjustedStart) * outerRadius;
    const y2 = Math.sin(adjustedStart) * outerRadius;
    const x3 = Math.cos(adjustedEnd) * outerRadius;
    const y3 = Math.sin(adjustedEnd) * outerRadius;
    const x4 = Math.cos(adjustedEnd) * innerRadius;
    const y4 = Math.sin(adjustedEnd) * innerRadius;
    
    const largeArc = (adjustedEnd - adjustedStart) > Math.PI ? 1 : 0;
    
    return `M ${x1} ${y1} 
            L ${x2} ${y2} 
            A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3}
            L ${x4} ${y4}
            A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1}
            Z`;
  }

  function getTextPosition(generation, position, radius) {
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

  function handleSegmentClick(node) {
    dispatch('selectPerson', node.person);
  }

  function handleCenterClick() {
    if (person) {
      dispatch('selectPerson', person);
    }
  }

  $: totalAncestors = flatNodes.filter(n => n.generation > 0).length;

  // Generation labels
  const genLabels = ['', 'Parents', 'Grandparents', 'Gt-Grandparents', '2x Gt-Grand', '3x Gt-Grand', '4x Gt-Grand'];
</script>

<div class="fan-chart-mini">
  <div class="chart-header">
    <h3>
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Ancestry Fan Chart
      <span class="ancestor-count">{totalAncestors} ancestors</span>
    </h3>
    <div class="gen-controls">
      <button on:click={() => maxGenerations = Math.max(2, maxGenerations - 1)} title="Fewer generations">−</button>
      <span>{maxGenerations} gen</span>
      <button on:click={() => maxGenerations = Math.min(6, maxGenerations + 1)} title="More generations">+</button>
    </div>
  </div>

  <div class="chart-wrapper">
    <svg 
      width={size} 
      height={size / 2 + 50}
      viewBox="{-size/2} {-size/2} {size} {size/2 + 50}"
    >
      <!-- Ancestor segments -->
      {#each flatNodes.filter(n => n.generation > 0) as node}
        {@const innerR = centerRadius + (node.generation - 1) * ringWidth}
        {@const outerR = centerRadius + node.generation * ringWidth}
        {@const colors = getGenderColor(node.person.sex)}
        {@const textPos = getTextPosition(node.generation, node.position, innerR + ringWidth/2)}
        
        <g class="segment" on:click={() => handleSegmentClick(node)}>
          <path 
            d={getSegmentPath(node.generation, node.position, innerR, outerR)}
            fill={colors.fill}
            stroke={colors.stroke}
            stroke-width="1"
            class="segment-path"
          />
          
          {#if ringWidth > 20}
            <text 
              x={textPos.x}
              y={textPos.y}
              text-anchor="middle"
              dominant-baseline="middle"
              class="segment-text"
              transform="rotate({textPos.angle + 90}, {textPos.x}, {textPos.y})"
              font-size={ringWidth > 35 ? 10 : 8}
            >
              {ringWidth > 35 ? getFirstName(node.person.name) : getInitials(node.person.name)}
            </text>
          {/if}
        </g>
      {/each}

      <!-- Empty slots -->
      {#each Array(maxGenerations) as _, gen}
        {#each Array(Math.pow(2, gen + 1)) as _, pos}
          {@const hasNode = flatNodes.some(n => n.generation === gen + 1 && n.position === pos)}
          {#if !hasNode}
            {@const innerR = centerRadius + gen * ringWidth}
            {@const outerR = centerRadius + (gen + 1) * ringWidth}
            <path 
              d={getSegmentPath(gen + 1, pos, innerR, outerR)}
              fill="var(--bg-elevated)"
              stroke="var(--border-subtle)"
              stroke-width="1"
              opacity="0.3"
            />
          {/if}
        {/each}
      {/each}

      <!-- Center person circle -->
      {#if person}
        <g class="center-person" on:click={handleCenterClick}>
          <circle 
            cx="0" 
            cy="0" 
            r={centerRadius}
            fill="var(--accent-gold)"
            stroke="var(--bg-deep)"
            stroke-width="2"
          />
          <text 
            x="0" 
            y="-5"
            text-anchor="middle"
            class="center-name"
            font-size="11"
          >
            {getFirstName(person.name)}
          </text>
          {#if extractYear(person.birth_date)}
            <text 
              x="0" 
              y="10"
              text-anchor="middle"
              class="center-year"
              font-size="9"
            >
              {extractYear(person.birth_date)}
            </text>
          {/if}
        </g>
      {/if}

      <!-- Legend -->
      <g transform="translate({size/2 - 70}, 20)">
        <circle cx="0" cy="0" r="6" fill="#3d5a7b"/>
        <text x="12" y="4" class="legend-text" font-size="9">Male</text>
        <circle cx="0" cy="18" r="6" fill="#7b4a6a"/>
        <text x="12" y="22" class="legend-text" font-size="9">Female</text>
      </g>
    </svg>
  </div>

  <p class="chart-hint">Click any segment to view that person</p>
</div>

<style>
  .fan-chart-mini {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1rem;
    border: 1px solid var(--border-subtle);
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .chart-header h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .chart-header h3 svg {
    color: var(--accent-gold);
  }

  .ancestor-count {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--text-muted);
    background: var(--bg-elevated);
    padding: 0.2rem 0.5rem;
    border-radius: 10px;
  }

  .gen-controls {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .gen-controls button {
    width: 24px;
    height: 24px;
    border: 1px solid var(--border-subtle);
    background: var(--bg-elevated);
    color: var(--text-primary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .gen-controls button:hover {
    background: var(--accent-gold);
    color: var(--bg-deep);
    border-color: var(--accent-gold);
  }

  .gen-controls span {
    font-size: 0.8rem;
    color: var(--text-secondary);
    min-width: 40px;
    text-align: center;
  }

  .chart-wrapper {
    display: flex;
    justify-content: center;
    background: radial-gradient(circle at center bottom, var(--bg-elevated) 0%, transparent 70%);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  svg {
    overflow: visible;
  }

  .segment {
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .segment:hover .segment-path {
    filter: brightness(1.25);
    stroke-width: 2;
  }

  .segment-text {
    fill: white;
    font-family: var(--font-body);
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
    font-weight: 600;
  }

  .center-year {
    fill: var(--bg-deep);
    font-family: var(--font-body);
    opacity: 0.7;
  }

  .legend-text {
    fill: var(--text-muted);
    font-family: var(--font-body);
  }

  .chart-hint {
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.5rem;
    margin-bottom: 0;
  }
</style>

