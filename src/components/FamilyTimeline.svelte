<script>
  import { familyRelationships, familyData } from '../stores/familyStore.js';
  import { createEventDispatcher } from 'svelte';

  export let person;
  
  const dispatch = createEventDispatcher();

  let viewMode = 'descendants'; // 'descendants' or 'ancestors'

  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }

  function extractFullDate(dateStr) {
    if (!dateStr) return null;
    return dateStr;
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

  function selectPerson(p) {
    dispatch('selectPerson', p);
  }

  $: relationships = person ? $familyRelationships[person.id] : null;

  // Get timeline data for descendants view
  $: descendantsData = (() => {
    if (!person) return { people: [], events: [], minYear: 1900, maxYear: 2000 };
    
    const people = [];
    const events = [];
    let minYear = Infinity;
    let maxYear = -Infinity;

    // Add main person (ALWAYS include, regardless of dates)
    const personBirth = extractYear(person.birth_date);
    const personDeath = extractYear(person.death_date);
    if (personBirth) {
      minYear = Math.min(minYear, personBirth);
      maxYear = Math.max(maxYear, personDeath || new Date().getFullYear());
      people.push({
        ...person,
        birthYear: personBirth,
        deathYear: personDeath || new Date().getFullYear(),
        isLiving: !person.death_date,
        type: 'self'
      });
    } else {
      // ALWAYS include person even without birth date
      people.push({
        ...person,
        birthYear: null,
        deathYear: null,
        isLiving: !person.death_date,
        type: 'self',
        noDates: true
      });
    }

    // Add spouses (ALWAYS include all spouses, regardless of dates)
    if (relationships?.spouses) {
      relationships.spouses.forEach(spouse => {
        const birth = extractYear(spouse.birth_date);
        const death = extractYear(spouse.death_date);
        
        // If spouse has no birth date, estimate based on main person's birth year
        let estimatedBirth = birth;
        if (!estimatedBirth && personBirth) {
          // Assume spouse is roughly same age as main person (±5 years)
          estimatedBirth = personBirth;
        }
        
        if (estimatedBirth) {
          minYear = Math.min(minYear, estimatedBirth);
          maxYear = Math.max(maxYear, death || new Date().getFullYear());
          people.push({
            ...spouse,
            birthYear: estimatedBirth,
            deathYear: death || new Date().getFullYear(),
            isLiving: !spouse.death_date,
            type: 'spouse',
            isEstimated: !birth // Flag if the birth year was estimated
          });
        } else {
          // ALWAYS add spouse even without dates
          people.push({
            ...spouse,
            birthYear: null,
            deathYear: null,
            isLiving: !spouse.death_date,
            type: 'spouse',
            noDates: true
          });
        }
      });
    }

    // Add children (ALWAYS include all children, regardless of dates)
    if (relationships?.children) {
      relationships.children.forEach(child => {
        const birth = extractYear(child.birth_date);
        const death = extractYear(child.death_date);
        
        if (birth) {
          minYear = Math.min(minYear, birth);
          maxYear = Math.max(maxYear, death || new Date().getFullYear());
          people.push({
            ...child,
            birthYear: birth,
            deathYear: death || new Date().getFullYear(),
            isLiving: !child.death_date,
            type: 'child'
          });
        } else {
          // ALWAYS include children without dates
          people.push({
            ...child,
            birthYear: null,
            deathYear: null,
            isLiving: !child.death_date,
            type: 'child',
            noDates: true
          });
        }
      });
    }

    // Sort: self first, then spouses, then children by birth year
    // People without dates go to the end of their group
    people.sort((a, b) => {
      const typeOrder = { self: 0, spouse: 1, child: 2 };
      if (typeOrder[a.type] !== typeOrder[b.type]) {
        return typeOrder[a.type] - typeOrder[b.type];
      }
      // Within same type, sort by birth year (nulls at end)
      if (a.birthYear === null && b.birthYear === null) return 0;
      if (a.birthYear === null) return 1;
      if (b.birthYear === null) return -1;
      return a.birthYear - b.birthYear;
    });

    // Round to nearest decade for timeline
    if (minYear !== Infinity) {
      minYear = Math.floor(minYear / 10) * 10;
      maxYear = Math.ceil(maxYear / 10) * 10;
    } else {
      minYear = 1900;
      maxYear = 2000;
    }

    return { people, events, minYear, maxYear };
  })();

  // Get timeline data for ancestors view
  $: ancestorsData = (() => {
    if (!person) return { people: [], events: [], minYear: 1900, maxYear: 2000 };
    
    const people = [];
    const events = [];
    let minYear = Infinity;
    let maxYear = -Infinity;

    // Add main person (always include, even without birth date)
    const personBirth = extractYear(person.birth_date);
    const personDeath = extractYear(person.death_date);
    if (personBirth) {
      minYear = Math.min(minYear, personBirth);
      maxYear = Math.max(maxYear, personDeath || new Date().getFullYear());
      people.push({
        ...person,
        birthYear: personBirth,
        deathYear: personDeath || new Date().getFullYear(),
        isLiving: !person.death_date,
        type: 'self'
      });
    } else {
      // Include person even without birth date
      people.push({
        ...person,
        birthYear: null,
        deathYear: null,
        isLiving: !person.death_date,
        type: 'self',
        noDates: true
      });
    }

    // Add parents (ALWAYS include all parents, regardless of dates)
    if (relationships?.parents) {
      relationships.parents.forEach(parent => {
        const birth = extractYear(parent.birth_date);
        const death = extractYear(parent.death_date);
        
        if (birth) {
          minYear = Math.min(minYear, birth);
          maxYear = Math.max(maxYear, death || new Date().getFullYear());
          people.push({
            ...parent,
            birthYear: birth,
            deathYear: death || new Date().getFullYear(),
            isLiving: !parent.death_date,
            type: 'parent'
          });
        } else {
          // ALWAYS include parents without dates
          people.push({
            ...parent,
            birthYear: null,
            deathYear: null,
            isLiving: !parent.death_date,
            type: 'parent',
            noDates: true
          });
        }
      });
    }

    // Add siblings (ALWAYS include all siblings, regardless of dates)
    if (relationships?.siblings) {
      relationships.siblings.forEach(sibling => {
        const birth = extractYear(sibling.birth_date);
        const death = extractYear(sibling.death_date);
        
        if (birth) {
          minYear = Math.min(minYear, birth);
          maxYear = Math.max(maxYear, death || new Date().getFullYear());
          people.push({
            ...sibling,
            birthYear: birth,
            deathYear: death || new Date().getFullYear(),
            isLiving: !sibling.death_date,
            type: 'sibling'
          });
        } else {
          // ALWAYS include siblings without dates
          people.push({
            ...sibling,
            birthYear: null,
            deathYear: null,
            isLiving: !sibling.death_date,
            type: 'sibling',
            noDates: true
          });
        }
      });
    }

    // Sort: parents first, then self, then siblings by birth year
    // People without dates go to the end of their group
    people.sort((a, b) => {
      const typeOrder = { parent: 0, self: 1, sibling: 2 };
      if (typeOrder[a.type] !== typeOrder[b.type]) {
        return typeOrder[a.type] - typeOrder[b.type];
      }
      // Within same type, sort by birth year (nulls at end)
      if (a.birthYear === null && b.birthYear === null) return 0;
      if (a.birthYear === null) return 1;
      if (b.birthYear === null) return -1;
      return a.birthYear - b.birthYear;
    });

    // Round to nearest decade for timeline
    // If no one has dates, use a default range but still show everyone
    if (minYear !== Infinity) {
      minYear = Math.floor(minYear / 10) * 10;
      maxYear = Math.ceil(maxYear / 10) * 10;
    } else {
      // Default range when no dates available - this allows people without dates to still be displayed
      minYear = 1900;
      maxYear = 2000;
    }

    return { people, events, minYear, maxYear };
  })();

  $: currentData = viewMode === 'descendants' ? descendantsData : ancestorsData;

  // Generate year markers
  $: yearMarkers = (() => {
    const markers = [];
    const step = currentData.maxYear - currentData.minYear > 100 ? 20 : 10;
    for (let year = currentData.minYear; year <= currentData.maxYear; year += step) {
      markers.push(year);
    }
    return markers;
  })();

  // Calculate position percentage
  function getPosition(year) {
    const range = currentData.maxYear - currentData.minYear;
    return ((year - currentData.minYear) / range) * 100;
  }

  // Calculate bar width percentage
  function getWidth(startYear, endYear) {
    const range = currentData.maxYear - currentData.minYear;
    return ((endYear - startYear) / range) * 100;
  }

  function getGenderClass(sex) {
    if (sex === 'M') return 'male';
    if (sex === 'F') return 'female';
    return 'unknown';
  }

  function getTypeLabel(type) {
    switch(type) {
      case 'self': return '';
      case 'spouse': return 'Spouse';
      case 'child': return 'Child';
      case 'parent': return 'Parent';
      case 'sibling': return 'Sibling';
      default: return '';
    }
  }
</script>

<div class="timeline-container">
  <div class="timeline-header">
    <h3>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>
        <circle cx="6" cy="12" r="2" fill="currentColor"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
        <circle cx="18" cy="12" r="2" fill="currentColor"/>
      </svg>
      Family Timeline
    </h3>
    <div class="view-toggle">
      <button 
        class:active={viewMode === 'descendants'} 
        on:click={() => viewMode = 'descendants'}
      >
        Spouse & Children
      </button>
      <button 
        class:active={viewMode === 'ancestors'} 
        on:click={() => viewMode = 'ancestors'}
      >
        Parents & Siblings
      </button>
    </div>
  </div>

  {#if currentData.people.length === 0}
    <div class="no-data">
      <p>No timeline data available for this view</p>
    </div>
  {:else}
    <!-- Year axis -->
    <div class="timeline-axis">
      {#each yearMarkers as year}
        <div class="year-marker" style="left: {getPosition(year)}%">
          <span class="year-label">{year}</span>
          <div class="year-line"></div>
        </div>
      {/each}
    </div>

    <!-- Timeline rows -->
    <div class="timeline-rows">
      {#each currentData.people as p, i}
        <div class="timeline-row" class:self={p.type === 'self'}>
          <div class="row-info">
            <button class="avatar {getGenderClass(p.sex)}" on:click={() => selectPerson(p)}>
              {getInitials(p.name)}
            </button>
            <div class="person-info">
              <button class="person-name" on:click={() => selectPerson(p)}>
                {p.name}
              </button>
              {#if p.noDates}
                <span class="person-years no-dates">No dates available</span>
              {:else}
                <span class="person-years">
                  {p.isEstimated ? '~' : ''}{p.birthYear}–{p.isLiving ? '' : (p.deathYear || '?')}
                </span>
              {/if}
              {#if p.type !== 'self'}
                <span class="person-type">{getTypeLabel(p.type)}</span>
              {/if}
            </div>
          </div>
          <div class="row-bar">
            {#if p.noDates}
              <div class="no-dates-bar">
                <span class="bar-label">Dates unknown</span>
              </div>
            {:else}
              <div 
                class="lifespan-bar {getGenderClass(p.sex)}" 
                class:living={p.isLiving}
                class:estimated={p.isEstimated}
                class:deceased-unknown={!p.isLiving && !p.deathYear}
                style="left: {getPosition(p.birthYear)}%; width: {getWidth(p.birthYear, p.deathYear)}%"
              >
                <span class="bar-years">
                  {p.isEstimated ? '~' : ''}{p.birthYear}–{p.isLiving ? 'present' : (p.deathYear || '?')}
                </span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Legend -->
    <div class="timeline-legend">
      <div class="legend-item">
        <span class="legend-color male"></span>
        <span>Male</span>
      </div>
      <div class="legend-item">
        <span class="legend-color female"></span>
        <span>Female</span>
      </div>
      <div class="legend-item">
        <span class="legend-color living"></span>
        <span>Living</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .timeline-container {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    border: 1px solid var(--border-subtle);
  }

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .timeline-header h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--accent-gold);
    margin: 0;
  }

  .view-toggle {
    display: flex;
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    padding: 0.25rem;
    gap: 0.25rem;
  }

  .view-toggle button {
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .view-toggle button:hover {
    color: var(--text-primary);
  }

  .view-toggle button.active {
    background: var(--accent-gold);
    color: var(--bg-deep);
    font-weight: 500;
  }

  .no-data {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .timeline-axis {
    position: relative;
    height: 30px;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .year-marker {
    position: absolute;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .year-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .year-line {
    width: 1px;
    height: 8px;
    background: var(--border-subtle);
    margin-top: 2px;
  }

  .timeline-rows {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .timeline-row {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 1rem;
    align-items: center;
    padding: 0.5rem 0;
  }

  .timeline-row.self {
    background: rgba(212, 168, 83, 0.05);
    margin: 0 -1rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-sm);
  }

  .row-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
    border: none;
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .avatar:hover {
    transform: scale(1.1);
  }

  .avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .avatar.unknown {
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .person-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .person-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-body);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .person-name:hover {
    color: var(--accent-gold);
  }

  .person-years {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .person-type {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }

  .row-bar {
    position: relative;
    height: 28px;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
  }

  .lifespan-bar {
    position: absolute;
    height: 100%;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    padding: 0 0.5rem;
    min-width: 60px;
    transition: opacity 0.2s ease;
  }

  .lifespan-bar:hover {
    opacity: 0.9;
  }

  .lifespan-bar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #4a6377 100%);
  }

  .lifespan-bar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #855a76 100%);
  }

  .lifespan-bar.unknown {
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .lifespan-bar.living {
    background: linear-gradient(135deg, #4c8c5c 0%, #346844 100%);
    border-right: 3px solid #7dd39a;
  }

  .lifespan-bar.living.male {
    background: linear-gradient(135deg, #4a7a8c 0%, #3a6070 100%);
    border-right: 3px solid #7dc3d3;
  }

  .lifespan-bar.living.female {
    background: linear-gradient(135deg, #8c5a7a 0%, #704a62 100%);
    border-right: 3px solid #d37dba;
  }

  .lifespan-bar.deceased-unknown {
    border-right: 3px dashed var(--text-muted);
    opacity: 0.7;
  }

  .bar-years {
    font-size: 0.7rem;
    color: white;
    font-weight: 500;
    white-space: nowrap;
    opacity: 0.9;
  }

  .lifespan-bar.estimated {
    opacity: 0.7;
    border-style: dashed;
    border-width: 1px;
    border-color: rgba(255, 255, 255, 0.4);
  }

  .no-dates-bar {
    position: absolute;
    left: 0;
    right: 0;
    height: 100%;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    background: repeating-linear-gradient(
      45deg,
      var(--bg-elevated),
      var(--bg-elevated) 10px,
      rgba(90, 77, 63, 0.3) 10px,
      rgba(90, 77, 63, 0.3) 20px
    );
    border: 1px dashed var(--border-subtle);
  }

  .bar-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .person-years.no-dates {
    font-style: italic;
    opacity: 0.7;
  }

  .timeline-legend {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-subtle);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .legend-color {
    width: 16px;
    height: 10px;
    border-radius: 2px;
  }

  .legend-color.male {
    background: linear-gradient(135deg, #5e7a94 0%, #4a6377 100%);
  }

  .legend-color.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #855a76 100%);
  }

  .legend-color.living {
    background: linear-gradient(135deg, #4c8c5c 0%, #346844 100%);
    border-right: 2px solid #7dd39a;
  }

  @media (max-width: 700px) {
    .timeline-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .row-bar {
      margin-left: 40px;
    }

    .timeline-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>

