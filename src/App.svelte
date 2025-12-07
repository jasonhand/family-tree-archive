<script>
  import {
    familyData,
    selectedPerson,
    filteredData,
    statistics,
    loadFavorites,
    favorites,
    loadFamilyData,
    flaggedRecords,
    loadFlaggedRecords,
    searchQuery
  } from './stores/familyStore.js';
  import { onMount } from 'svelte';
  import SearchFilter from './components/SearchFilter.svelte';
  import PersonCard from './components/PersonCard.svelte';
  import PersonDetail from './components/PersonDetail.svelte';
  import TreeView from './components/TreeView.svelte';
  import Statistics from './components/Statistics.svelte';
  import FavoritesView from './components/FavoritesView.svelte';
  import MapView from './components/MapView.svelte';
  import MemorialTimeline from './components/MemorialTimeline.svelte';
  import RelationshipFinder from './components/RelationshipFinder.svelte';
  import SunburstChart from './components/SunburstChart.svelte';
  import LifeOverlapTimeline from './components/LifeOverlapTimeline.svelte';
  import MigrationFlowMap from './components/MigrationFlowMap.svelte';
  import Visualizations from './components/Visualizations.svelte';
  import NavigationMenu from './components/NavigationMenu.svelte';
  import UpcomingBirthdays from './components/UpcomingBirthdays.svelte';

  let showOnlyFavorites = false;
  let showOnlyFlagged = false;
  let viewMode = 'grid'; // 'grid', 'tree', 'relate', 'map', 'memorial', 'stats', 'visualizations'
  let isLoading = true;

  // Write operations disabled in read-only public interface
  let selectionMode = false;
  let selectedRecords = new Set();
  let showBulkDeleteConfirm = false;

  onMount(async () => {
    // Load all family data from JSON file
    await loadFamilyData();
    isLoading = false;
  });

  // Apply favorites/flagged filter on top of filteredData
  $: displayData = (() => {
    if (showOnlyFavorites) {
      return $filteredData.filter(person => $favorites.has(person.id));
    }
    if (showOnlyFlagged) {
      return $filteredData.filter(person => $flaggedRecords.has(person.id));
    }
    return $filteredData;
  })();

  $: hasData = $familyData.length > 0;

  function handleFilterByName(event) {
    const name = event.detail;
    searchQuery.set(name);
    viewMode = 'grid';
  }

  function handleFilterByLocation(event) {
    // The filterOptions store is already updated in Statistics.svelte
    // Just switch to grid view
    viewMode = 'grid';
  }
</script>

<main>
  <header>
    <div class="logo">
      <svg viewBox="0 0 40 40" class="tree-icon">
        <path d="M20 2 L8 18 L14 18 L6 32 L34 32 L26 18 L32 18 Z" fill="currentColor" opacity="0.8"/>
        <rect x="17" y="32" width="6" height="8" fill="currentColor"/>
      </svg>
      <h1>Lineage</h1>
    </div>
    <p class="tagline">The Hand & Sanders Family History</p>
  </header>

  {#if isLoading}
    <section class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading family tree...</p>
    </section>
  {:else if !hasData}
    <section class="welcome">
      <div class="welcome-content">
        <h2>No Data Available</h2>
        <p>Unable to load family tree data from the database.</p>
      </div>
      <div class="decorative-tree">
        <svg viewBox="0 0 200 200" class="bg-tree">
          <circle cx="100" cy="60" r="50" fill="var(--accent-soft)" opacity="0.3"/>
          <circle cx="60" cy="90" r="35" fill="var(--accent-soft)" opacity="0.25"/>
          <circle cx="140" cy="90" r="35" fill="var(--accent-soft)" opacity="0.25"/>
          <circle cx="40" cy="120" r="25" fill="var(--accent-soft)" opacity="0.2"/>
          <circle cx="160" cy="120" r="25" fill="var(--accent-soft)" opacity="0.2"/>
          <rect x="90" y="130" width="20" height="60" fill="var(--accent-muted)" opacity="0.4"/>
        </svg>
      </div>
    </section>
  {:else}
    <nav class="view-nav">
      <NavigationMenu currentView={viewMode} on:viewChange={(e) => viewMode = e.detail} />
    </nav>

    {#if viewMode === 'grid'}
      <UpcomingBirthdays />
      <SearchFilter bind:showOnlyFavorites bind:showOnlyFlagged />
    {/if}

    <div class="content-area">
      {#if viewMode === 'grid'}
        <section class="person-grid">
          {#each displayData as person (person.id)}
            <PersonCard {person} />
          {/each}
          {#if displayData.length === 0}
            <div class="no-results">
              {#if showOnlyFavorites}
                <p>No favorites match your search criteria</p>
              {:else if showOnlyFlagged}
                <p>No flagged records match your search criteria</p>
              {:else}
                <p>No family members match your search criteria</p>
              {/if}
            </div>
          {/if}
        </section>
      {:else if viewMode === 'tree'}
        <TreeView />
      {:else if viewMode === 'relate'}
        <RelationshipFinder />
      {:else if viewMode === 'map'}
        <MapView />
      {:else if viewMode === 'memorial'}
        <MemorialTimeline />
      {:else if viewMode === 'stats'}
        <Statistics on:filterByName={handleFilterByName} on:filterByLocation={handleFilterByLocation} />
      {:else if viewMode === 'visualizations'}
        <Visualizations on:filterBySurname={(e) => { searchQuery.set(e.detail); viewMode = 'grid'; }} />
      {:else if viewMode === 'favorites'}
        <FavoritesView />
      {:else if viewMode === 'sunburst'}
        <SunburstChart />
      {:else if viewMode === 'overlap'}
        <LifeOverlapTimeline />
      {:else if viewMode === 'migration'}
        <MigrationFlowMap />
      {/if}
    </div>

    {#if $selectedPerson}
      <PersonDetail readOnly={true} />
    {/if}

    <!-- Footer -->
    <footer class="app-footer">
      <div class="footer-content">
        <div class="data-info">
          <span class="data-count">{$familyData.length.toLocaleString()} family members</span>
        </div>
      </div>
    </footer>
  {/if}
</main>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(:root) {
    --bg-deep: #1a1612;
    --bg-main: #241f1a;
    --bg-card: #2e2822;
    --bg-elevated: #3a332b;
    --text-primary: #f5ebe0;
    --text-secondary: #c4b8a8;
    --text-muted: #8b7e6f;
    --accent-gold: #d4a853;
    --accent-copper: #c47a5a;
    --accent-sage: #7a9e7e;
    --accent-soft: #b8997a;
    --accent-muted: #5a4d3f;
    --border-subtle: rgba(212, 168, 83, 0.15);
    --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.3);
    --shadow-glow: 0 0 30px rgba(212, 168, 83, 0.1);
    --font-display: 'Cormorant Garamond', Georgia, serif;
    --font-body: 'Outfit', system-ui, sans-serif;
    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: 20px;
  }

  :global(body) {
    font-family: var(--font-body);
    background: var(--bg-deep);
    color: var(--text-primary);
    min-height: 100vh;
    line-height: 1.6;
  }

  main {
    min-height: 100vh;
    padding: 0 1.5rem 3rem;
    max-width: 1600px;
    margin: 0 auto;
  }

  header {
    text-align: center;
    padding: 2.5rem 0 1.5rem;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 2rem;
  }

  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .tree-icon {
    width: 42px;
    height: 42px;
    color: var(--accent-gold);
  }

  h1 {
    font-family: var(--font-display);
    font-size: 2.8rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    background: linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-copper) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .tagline {
    font-size: 1rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
    font-weight: 300;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .welcome {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3rem;
    align-items: center;
    min-height: 60vh;
    padding: 3rem 2rem;
  }

  .welcome-content {
    max-width: 500px;
  }

  .welcome h2 {
    font-family: var(--font-display);
    font-size: 2.4rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }

  .welcome p {
    color: var(--text-secondary);
    font-size: 1.1rem;
    line-height: 1.7;
    margin-bottom: 2rem;
  }

  .format-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .hint-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
  }

  .decorative-tree {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .bg-tree {
    width: 100%;
    max-width: 300px;
    height: auto;
  }

  .view-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    margin-bottom: 1.5rem;
    border: 1px solid var(--border-subtle);
  }
  
  .nav-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .view-nav button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.2rem;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 400;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-nav button:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .view-nav button.active {
    background: var(--accent-gold);
    color: var(--bg-deep);
    font-weight: 500;
  }

  .nav-spacer {
    flex: 1;
  }

  .nav-divider {
    width: 1px;
    height: 24px;
    background: var(--border-subtle);
    margin: 0 0.25rem;
    opacity: 0.5;
  }

  .save-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    height: 40px;
    padding: 0 0.75rem;
    border: none;
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    gap: 0.4rem;
  }

  .save-btn:hover {
    background: var(--accent-gold);
    color: var(--bg-deep);
  }

  .save-message {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .changes-dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    background: var(--accent-gold);
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Loading state */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1.5rem;
    color: var(--text-muted);
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--bg-elevated);
    border-top-color: var(--accent-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Footer */
  .app-footer {
    margin-top: 4rem;
    padding: 2rem;
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
  }

  .footer-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1.5rem;
  }

  .data-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .data-source {
    font-family: var(--font-display);
    font-size: 1.2rem;
    color: var(--text-primary);
  }

  .data-count {
    font-size: 0.9rem;
    color: var(--text-muted);
    padding: 0.25rem 0.75rem;
    background: var(--bg-elevated);
    border-radius: 20px;
  }

  .content-area {
    margin-top: 1.5rem;
  }

  .gallery-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1rem;
  }

  .add-person-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--accent-gold);
    color: var(--bg-deep);
    border: none;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
  }

  .add-person-btn:hover {
    background: var(--accent-gold-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .person-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.25rem;
  }

  .no-results {
    grid-column: 1 / -1;
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }

  /* Selection Toolbar */
  .selection-toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--bg-card);
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
    border: 1px solid var(--border-subtle);
    flex-wrap: wrap;
  }

  .selection-toolbar.active {
    background: var(--bg-elevated);
    border-color: var(--accent-gold);
  }

  .select-mode-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .select-mode-btn:hover {
    border-color: var(--accent-gold);
    color: var(--text-primary);
  }

  .select-mode-btn.active {
    background: var(--accent-gold);
    border-color: var(--accent-gold);
    color: var(--bg-deep);
  }

  .selection-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .selection-count {
    font-weight: 600;
    color: var(--accent-gold);
    padding: 0.4rem 0.75rem;
    background: rgba(212, 168, 83, 0.15);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    background: transparent;
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.85rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--bg-elevated);
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.delete {
    border-color: var(--accent-copper);
    color: var(--accent-copper);
  }

  .action-btn.delete:hover:not(:disabled) {
    background: var(--accent-copper);
    color: white;
  }

  /* Bulk Delete Dialog */
  .bulk-delete-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .bulk-delete-dialog {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 2rem;
    max-width: 480px;
    width: 90%;
    text-align: center;
    border: 1px solid var(--border-subtle);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  }

  .bulk-delete-dialog .delete-icon {
    color: var(--accent-copper);
    margin-bottom: 1rem;
  }

  .bulk-delete-dialog h3 {
    font-family: var(--font-display);
    font-size: 1.4rem;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }

  .bulk-delete-dialog p {
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
  }

  .bulk-delete-dialog .warning {
    padding: 0.75rem;
    background: rgba(196, 122, 90, 0.15);
    border: 1px solid var(--accent-copper);
    border-radius: var(--radius-sm);
    color: var(--accent-copper);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .dialog-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }

  .dialog-actions .cancel-btn {
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .dialog-actions .cancel-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .dialog-actions .confirm-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--accent-copper);
    border: none;
    border-radius: var(--radius-sm);
    color: white;
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .dialog-actions .confirm-btn:hover {
    filter: brightness(1.1);
  }

  @media (max-width: 768px) {
    .welcome {
      grid-template-columns: 1fr;
      text-align: center;
    }

    .welcome-content {
      max-width: 100%;
    }

    .decorative-tree {
      display: none;
    }

    .view-nav {
      flex-wrap: wrap;
    }

    .nav-spacer {
      display: none;
    }

    h1 {
      font-size: 2.2rem;
    }

    .selection-toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .select-mode-btn {
      justify-content: center;
    }

    .selection-actions {
      justify-content: center;
    }

    .dialog-actions {
      flex-direction: column;
    }

    .dialog-actions .cancel-btn,
    .dialog-actions .confirm-btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>

