<script>
  import { familyData, favorites, selectedPerson } from '../stores/familyStore.js';

  // Get all favorited people
  $: favoritedPeople = $familyData.filter(person => $favorites.has(person.id));

  // Extract year from date string
  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }

  // Get decade from year
  function getDecade(year) {
    if (!year) return null;
    return Math.floor(year / 10) * 10;
  }

  // Group by decades
  $: groupedByDecade = (() => {
    const groups = {};
    const noDate = [];

    favoritedPeople.forEach(person => {
      const birthYear = extractYear(person.birth_date);
      if (birthYear) {
        const decade = getDecade(birthYear);
        if (!groups[decade]) {
          groups[decade] = [];
        }
        groups[decade].push({
          ...person,
          birthYear
        });
      } else {
        noDate.push(person);
      }
    });

    // Sort people within each decade by birth year
    Object.values(groups).forEach(group => {
      group.sort((a, b) => a.birthYear - b.birthYear);
    });

    // Sort decades in descending order (most recent first)
    const sortedDecades = Object.entries(groups)
      .sort(([a], [b]) => parseInt(b) - parseInt(a));

    return { decades: sortedDecades, noDate };
  })();

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

  function getGenderClass(sex) {
    if (sex === 'M') return 'male';
    if (sex === 'F') return 'female';
    return 'unknown';
  }

  function getDecadeLabel(decade) {
    return `${decade}s`;
  }

  function selectPerson(person) {
    selectedPerson.set(person);
  }

  // Check if person is deceased (has any death_date, even without a year)
  function isDeceased(person) {
    return !!person.death_date;
  }

  // Check if person is living
  function isLiving(person) {
    return !person.death_date;
  }

  // Calculate age - returns null if deceased without a death year
  function getAge(person) {
    const birthYear = extractYear(person.birth_date);
    if (!birthYear) return null;
    
    // If deceased, only show age if we have a death year
    if (isDeceased(person)) {
      const deathYear = extractYear(person.death_date);
      return deathYear ? deathYear - birthYear : null;
    }
    
    // Living person - show current age
    return new Date().getFullYear() - birthYear;
  }
</script>

<div class="favorites-view">
  <header class="view-header">
    <div class="header-content">
      <h2>
        <svg viewBox="0 0 24 24" width="28" height="28">
          <polygon 
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" 
            fill="currentColor" 
            stroke="currentColor" 
            stroke-width="2"
          />
        </svg>
        Favorites
      </h2>
      <p class="subtitle">Your bookmarked family members, organized by birth decade</p>
    </div>
    <div class="header-stats">
      <div class="stat">
        <span class="stat-value">{favoritedPeople.length}</span>
        <span class="stat-label">Total Favorites</span>
      </div>
      <div class="stat">
        <span class="stat-value">{groupedByDecade.decades.length}</span>
        <span class="stat-label">Decades Represented</span>
      </div>
    </div>
  </header>

  {#if favoritedPeople.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" width="64" height="64">
          <polygon 
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="1.5"
          />
        </svg>
      </div>
      <h3>No Favorites Yet</h3>
      <p>Star your favorite family members to see them collected here.</p>
      <p class="hint">Click the ★ icon on any person's detail view to add them to favorites.</p>
    </div>
  {:else}
    <div class="decades-container">
      {#each groupedByDecade.decades as [decade, people]}
        <section class="decade-group">
          <header class="decade-header">
            <h3>{getDecadeLabel(decade)}</h3>
            <span class="decade-count">{people.length} {people.length === 1 ? 'person' : 'people'}</span>
          </header>
          <div class="people-grid">
            {#each people as person}
              <button class="person-card {getGenderClass(person.sex)}" on:click={() => selectPerson(person)}>
                <div class="card-left">
                  <div class="avatar {getGenderClass(person.sex)}">
                    {getInitials(person.name)}
                  </div>
                </div>
                <div class="card-center">
                  <span class="person-name">{person.name}</span>
                  <span class="person-dates">
                    {person.birthYear}
                    {#if person.death_date}
                      – {extractYear(person.death_date)}
                    {:else}
                      – present
                    {/if}
                  </span>
                  {#if person.birth_city || person.birth_state}
                    <span class="person-place">{person.birth_city || ''}{person.birth_city && person.birth_state ? ', ' : ''}{person.birth_state || ''}</span>
                  {:else if person.birth_place}
                    <span class="person-place">{person.birth_place.split(',').slice(0, 2).join(',')}</span>
                  {/if}
                </div>
                <div class="card-right">
                  {#if getAge(person) !== null}
                    <div class="age-badge" class:living={isLiving(person)}>
                      <span class="age-value">{getAge(person)}</span>
                      <span class="age-label">{isLiving(person) ? 'years' : 'lived'}</span>
                    </div>
                  {:else if isDeceased(person)}
                    <div class="age-badge deceased-unknown">
                      <span class="age-icon">✝</span>
                      <span class="age-label">Deceased</span>
                    </div>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        </section>
      {/each}

      {#if groupedByDecade.noDate.length > 0}
        <section class="decade-group no-date-group">
          <header class="decade-header">
            <h3>Unknown Birth Date</h3>
            <span class="decade-count">{groupedByDecade.noDate.length} {groupedByDecade.noDate.length === 1 ? 'person' : 'people'}</span>
          </header>
          <div class="people-grid">
            {#each groupedByDecade.noDate as person}
              <button class="person-card {getGenderClass(person.sex)}" on:click={() => selectPerson(person)}>
                <div class="card-left">
                  <div class="avatar {getGenderClass(person.sex)}">
                    {getInitials(person.name)}
                  </div>
                </div>
                <div class="card-center">
                  <span class="person-name">{person.name}</span>
                  <span class="person-dates no-dates">No dates available</span>
                </div>
                <div class="card-right"></div>
              </button>
            {/each}
          </div>
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .favorites-view {
    min-height: 400px;
  }

  .view-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    padding: 1.5rem 2rem;
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .header-content h2 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--accent-gold);
    margin: 0 0 0.5rem 0;
  }

  .header-content h2 svg {
    color: var(--accent-gold);
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 0.95rem;
    margin: 0;
  }

  .header-stats {
    display: flex;
    gap: 2rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 1.5rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--accent-gold);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    text-align: center;
  }

  .empty-icon {
    color: var(--accent-muted);
    margin-bottom: 1.5rem;
    opacity: 0.5;
  }

  .empty-state h3 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    color: var(--text-muted);
    margin: 0;
  }

  .empty-state .hint {
    margin-top: 1rem;
    font-size: 0.9rem;
    opacity: 0.8;
  }

  .decades-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .decade-group {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .decade-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-subtle);
  }

  .decade-header h3 {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .decade-count {
    font-size: 0.85rem;
    color: var(--text-muted);
    background: var(--bg-card);
    padding: 0.3rem 0.75rem;
    border-radius: 20px;
  }

  .no-date-group .decade-header {
    background: rgba(90, 77, 63, 0.3);
  }

  .people-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 0.75rem;
    padding: 1rem;
  }

  .person-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .person-card:hover {
    border-color: var(--accent-gold);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .person-card.male {
    border-left: 3px solid #5e7a94;
  }

  .person-card.female {
    border-left: 3px solid #9b6b8a;
  }

  .card-left {
    flex-shrink: 0;
  }

  .avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 600;
    color: white;
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

  .card-center {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .person-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .person-dates {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .person-dates.no-dates {
    font-style: italic;
    color: var(--text-muted);
  }

  .person-place {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-right {
    flex-shrink: 0;
  }

  .age-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.35rem 0.6rem;
    background: var(--bg-card);
    border-radius: var(--radius-sm);
    min-width: 45px;
  }

  .age-badge.living {
    background: rgba(122, 158, 126, 0.2);
    border: 1px solid var(--accent-sage);
  }

  .age-value {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
  }

  .age-badge.living .age-value {
    color: var(--accent-sage);
  }

  .age-label {
    font-size: 0.6rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .age-badge.deceased-unknown {
    background: rgba(139, 126, 111, 0.15);
    border: 1px dashed rgba(139, 126, 111, 0.4);
  }

  .age-badge.deceased-unknown .age-icon {
    font-size: 1rem;
    color: var(--text-muted);
  }

  .age-badge.deceased-unknown .age-label {
    margin-top: 0.1rem;
  }

  @media (max-width: 768px) {
    .view-header {
      flex-direction: column;
      gap: 1rem;
    }

    .header-stats {
      width: 100%;
      justify-content: space-around;
    }

    .people-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

