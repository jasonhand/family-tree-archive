<script>
  import { createEventDispatcher } from 'svelte';
  import { selectedPerson, favorites, familyRelationships, flaggedRecords } from '../stores/familyStore.js';
  
  export let person;
  export let selectionMode = false;
  export let isSelected = false;

  const dispatch = createEventDispatcher();

  $: isFavorited = $favorites.has(person.id);
  $: flagInfo = $flaggedRecords.get(person.id);
  $: isFlagged = !!flagInfo;
  $: hasNotes = !!(person.notes && person.notes.trim().length > 0);
  $: relationships = $familyRelationships[person.id];
  
  // Family counts
  $: spouseCount = relationships?.spouses?.length || 0;
  $: childCount = relationships?.children?.length || 0;
  $: brotherCount = relationships?.siblings?.filter(s => s.sex === 'M').length || 0;
  $: sisterCount = relationships?.siblings?.filter(s => s.sex === 'F').length || 0;
  $: hasAnyFamilyStats = spouseCount || childCount || brotherCount || sisterCount;

  function formatDate(dateStr) {
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

  function getGenderIcon(sex) {
    if (sex === 'M') return '♂';
    if (sex === 'F') return '♀';
    return '◇';
  }

  function getGenderClass(sex) {
    if (sex === 'M') return 'male';
    if (sex === 'F') return 'female';
    return 'unknown';
  }

  // Prefer normalized year fields, fallback to parsing date strings
  $: birthYear = person.birth_year !== null && person.birth_year !== undefined 
    ? String(person.birth_year)
    : person.birth_date?.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/)?.[1];
  $: deathYear = person.death_year !== null && person.death_year !== undefined
    ? String(person.death_year)
    : person.death_date?.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/)?.[1];
  
  // Check if person is deceased (has any death_date value, even without a parseable year)
  $: isDeceased = !!person.death_date;
  
  // Check if death date is unknown (has death_date but no parseable year)
  $: hasUnknownDeathDate = isDeceased && !deathYear;
  
  // Format lifespan display
  $: lifespan = (() => {
    if (!birthYear) return '';
    if (deathYear) return `${birthYear} – ${deathYear}`;
    if (isDeceased) return `${birthYear} – ?`; // Deceased but unknown death year
    return `b. ${birthYear}`;
  })();
  
  // Calculate current age for living people only
  $: currentAge = (() => {
    if (!birthYear || isDeceased) return null;
    const currentYear = new Date().getFullYear();
    return currentYear - parseInt(birthYear);
  })();
  
  // Calculate age at death for deceased with known death year
  $: ageAtDeath = birthYear && deathYear ? parseInt(deathYear) - parseInt(birthYear) : null;
</script>

<article 
  class="person-card {getGenderClass(person.sex)}"
  class:favorited={isFavorited}
  class:flagged={isFlagged}
  class:selected={isSelected}
  class:selection-mode={selectionMode}
  on:click={() => selectionMode ? dispatch('toggleSelect', person) : selectedPerson.set(person)}
  on:keypress={(e) => e.key === 'Enter' && (selectionMode ? dispatch('toggleSelect', person) : selectedPerson.set(person))}
  role="button"
  tabindex="0"
>
  {#if selectionMode}
    <div class="select-checkbox" class:checked={isSelected}>
      {#if isSelected}
        <svg viewBox="0 0 24 24" width="18" height="18">
          <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" stroke-width="3"/>
        </svg>
      {/if}
    </div>
  {/if}
  {#if isFlagged}
    <div class="flag-indicator" title={flagInfo.reason}>
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/>
        <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" stroke-width="2"/>
      </svg>
    </div>
  {/if}
  {#if isFavorited}
    <div class="favorite-star">
      <svg viewBox="0 0 24 24" width="18" height="18">
        <polygon 
          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" 
          fill="currentColor"
        />
      </svg>
    </div>
  {/if}
  {#if hasNotes}
    <div class="notes-indicator" class:with-favorite={isFavorited} title="Has notes/biography">
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2"/>
        <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="2"/>
        <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="8" y1="17" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
  {/if}
  <div class="card-header">
    <div class="avatar">
      <span class="initials">{getInitials(person.name)}</span>
      <span class="gender-badge">{getGenderIcon(person.sex)}</span>
    </div>
    
    {#if currentAge !== null}
      <div class="age-display living">
        <span class="age-number">{currentAge}</span>
        <span class="age-label">years old</span>
      </div>
    {:else if ageAtDeath !== null}
      <div class="age-display deceased">
        <span class="age-number">{ageAtDeath}</span>
        <span class="age-label">years lived</span>
      </div>
    {:else if hasUnknownDeathDate}
      <span class="status-badge deceased unknown-date">Deceased</span>
    {:else if isDeceased}
      <span class="status-badge deceased">Deceased</span>
    {:else}
      <span class="status-badge living">Living</span>
    {/if}
  </div>

  <div class="card-body">
    <h3 class="name">{person.name || 'Unknown'}</h3>
    {#if lifespan}
      <p class="lifespan">{lifespan}</p>
    {/if}
    
    {#if hasAnyFamilyStats}
      <div class="family-stats">
        {#if spouseCount}
          <span class="stat" title="{spouseCount} {spouseCount === 1 ? 'Spouse' : 'Spouses'}">💍 {spouseCount}</span>
        {/if}
        {#if childCount}
          <span class="stat" title="{childCount} {childCount === 1 ? 'Child' : 'Children'}">👶 {childCount}</span>
        {/if}
        {#if brotherCount}
          <span class="stat" title="{brotherCount} {brotherCount === 1 ? 'Brother' : 'Brothers'}">👦 {brotherCount}</span>
        {/if}
        {#if sisterCount}
          <span class="stat" title="{sisterCount} {sisterCount === 1 ? 'Sister' : 'Sisters'}">👧 {sisterCount}</span>
        {/if}
      </div>
    {/if}
    
    {#if isFlagged && flagInfo.reason}
      <div class="flag-reason-display">
        <svg viewBox="0 0 24 24" width="12" height="12">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/>
          <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>{flagInfo.reason}</span>
      </div>
    {/if}
  </div>

  <div class="card-footer">
    {#if person.birth_place}
      <div class="place-info">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="currentColor" stroke-width="2"/>
          <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>{person.birth_place.split(',').slice(0, 2).join(',')}</span>
      </div>
    {/if}
  </div>

  <div class="hover-hint">
    <span>View Details</span>
    <svg viewBox="0 0 24 24" width="16" height="16">
      <polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>
  </div>
</article>

<style>
  .person-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.25s ease;
    border: 1px solid var(--border-subtle);
    position: relative;
    overflow: hidden;
  }

  .person-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--accent-gold);
    transform: scaleX(0);
    transition: transform 0.3s ease;
  }

  .person-card.favorited::before {
    transform: scaleX(1);
  }

  .person-card:hover::before {
    transform: scaleX(1);
  }

  .favorite-star {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    color: var(--accent-gold);
    filter: drop-shadow(0 2px 4px rgba(212, 168, 83, 0.4));
    z-index: 2;
  }

  .notes-indicator {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    color: #6b8cce;
    filter: drop-shadow(0 2px 4px rgba(107, 140, 206, 0.4));
    z-index: 2;
    cursor: help;
  }

  .notes-indicator.with-favorite {
    top: 3rem;
  }

  .flag-indicator {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    color: var(--accent-copper);
    filter: drop-shadow(0 2px 4px rgba(196, 122, 90, 0.4));
    z-index: 2;
    cursor: help;
  }

  .flag-reason-display {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.5rem;
    padding: 0.35rem 0.6rem;
    background: rgba(196, 122, 90, 0.12);
    border-radius: var(--radius-sm);
    color: var(--accent-copper);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .flag-reason-display svg {
    flex-shrink: 0;
  }

  .flag-reason-display span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Selection Mode Styles */
  .select-checkbox {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 2px solid var(--text-muted);
    background: var(--bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3;
    transition: all 0.15s ease;
  }

  .select-checkbox.checked {
    background: var(--accent-gold);
    border-color: var(--accent-gold);
    color: var(--bg-deep);
  }

  .person-card.selection-mode {
    padding-left: 3rem;
  }

  .person-card.selection-mode .flag-indicator {
    left: 3rem;
  }

  .person-card.selected {
    border-color: var(--accent-gold);
    box-shadow: 0 0 0 2px rgba(212, 168, 83, 0.3);
  }

  .person-card.selection-mode:hover {
    transform: translateY(-2px);
  }

  .person-card.flagged {
    border-color: rgba(196, 122, 90, 0.4);
  }

  .person-card.flagged::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--accent-copper);
  }

  .person-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-soft);
    border-color: rgba(212, 168, 83, 0.3);
  }

  .person-card.male .avatar {
    background: linear-gradient(135deg, #4a7c9b 0%, #2d5a7b 100%);
  }

  .person-card.female .avatar {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .person-card.unknown .avatar {
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .avatar {
    position: relative;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .initials {
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 600;
    color: white;
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }

  .gender-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 20px;
    height: 20px;
    background: var(--bg-card);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    border: 2px solid var(--bg-card);
  }

  .status-badge {
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-weight: 500;
  }

  .status-badge.living {
    background: rgba(122, 158, 126, 0.2);
    color: var(--accent-sage);
  }

  .status-badge.deceased {
    background: rgba(139, 126, 111, 0.2);
    color: var(--text-muted);
  }

  .status-badge.deceased.unknown-date {
    background: rgba(139, 126, 111, 0.15);
    border: 1px dashed rgba(139, 126, 111, 0.4);
  }

  .age-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.4rem 0.75rem;
    border-radius: var(--radius-sm);
    min-width: 60px;
  }

  .age-display.living {
    background: linear-gradient(135deg, rgba(122, 158, 126, 0.25) 0%, rgba(122, 158, 126, 0.15) 100%);
    border: 1px solid rgba(122, 158, 126, 0.3);
  }

  .age-display.deceased {
    background: rgba(139, 126, 111, 0.15);
    border: 1px solid rgba(139, 126, 111, 0.2);
  }

  .age-number {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1;
  }

  .age-display.living .age-number {
    color: var(--accent-sage);
  }

  .age-display.deceased .age-number {
    color: var(--text-muted);
  }

  .age-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.15rem;
  }

  .age-display.living .age-label {
    color: var(--accent-sage);
    opacity: 0.8;
  }

  .age-display.deceased .age-label {
    color: var(--text-muted);
    opacity: 0.7;
  }

  .card-body {
    margin-bottom: 0.75rem;
  }

  .name {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
    line-height: 1.3;
  }

  .lifespan {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .family-stats {
    display: flex;
    gap: 0.6rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
  }

  .stat {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    background: var(--bg-elevated);
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
  }

  .card-footer {
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-subtle);
  }

  .place-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .place-info svg {
    flex-shrink: 0;
    opacity: 0.7;
  }

  .place-info span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hover-hint {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.5rem 1rem;
    background: linear-gradient(transparent, var(--bg-elevated));
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--accent-gold);
    opacity: 0;
    transform: translateY(100%);
    transition: all 0.25s ease;
  }

  .person-card:hover .hover-hint {
    opacity: 1;
    transform: translateY(0);
  }
</style>

