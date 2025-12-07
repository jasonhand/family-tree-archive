<script>
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  
  export let currentView = 'grid';
  
  const dispatch = createEventDispatcher();
  
  let openDropdown = null;
  
  const navTabs = [
    {
      id: 'browse',
      label: 'Browse',
      icon: 'grid',
      items: [
        { id: 'grid', label: 'Gallery', icon: 'grid', view: 'grid' },
        { id: 'tree', label: 'Family Tree', icon: 'tree', view: 'tree' },
        { id: 'favorites', label: 'Favorites', icon: 'star', view: 'favorites' }
      ]
    },
    {
      id: 'analyze',
      label: 'Analyze',
      icon: 'stats',
      items: [
        { id: 'stats', label: 'Statistics', icon: 'stats', view: 'stats' },
        { id: 'visualizations', label: 'Visualizations', icon: 'charts', view: 'visualizations' },
        { id: 'relate', label: 'Relationship Finder', icon: 'relate', view: 'relate' }
      ]
    },
    {
      id: 'geography',
      label: 'Geography',
      icon: 'map',
      items: [
        { id: 'map', label: 'Map View', icon: 'map', view: 'map' },
        { id: 'migration', label: 'Migration Flow', icon: 'migration', view: 'migration' }
      ]
    },
    {
      id: 'timelines',
      label: 'Timelines',
      icon: 'overlap',
      items: [
        { id: 'memorial', label: 'Memorial Timeline', icon: 'memorial', view: 'memorial' },
        { id: 'overlap', label: 'Life Overlap', icon: 'overlap', view: 'overlap' }
      ]
    },
    {
      id: 'charts',
      label: 'Charts',
      icon: 'sunburst',
      items: [
        { id: 'sunburst', label: 'Sunburst Chart', icon: 'sunburst', view: 'sunburst' }
      ]
    }
  ];
  
  function handleViewSelect(view) {
    dispatch('viewChange', view);
    openDropdown = null;
  }
  
  function toggleDropdown(tabId) {
    openDropdown = openDropdown === tabId ? null : tabId;
  }
  
  function closeDropdown() {
    openDropdown = null;
  }
  
  function getIconSvg(iconType) {
    const icons = {
      grid: `<rect x="3" y="3" width="7" height="7" fill="currentColor"/><rect x="14" y="3" width="7" height="7" fill="currentColor"/><rect x="3" y="14" width="7" height="7" fill="currentColor"/><rect x="14" y="14" width="7" height="7" fill="currentColor"/>`,
      tree: `<circle cx="12" cy="5" r="3" fill="currentColor"/><circle cx="5" cy="19" r="3" fill="currentColor"/><circle cx="19" cy="19" r="3" fill="currentColor"/><line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2"/><line x1="5" y1="12" x2="5" y2="16" stroke="currentColor" stroke-width="2"/><line x1="19" y1="12" x2="19" y2="16" stroke="currentColor" stroke-width="2"/>`,
      star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>`,
      stats: `<rect x="4" y="14" width="4" height="8" fill="currentColor"/><rect x="10" y="8" width="4" height="14" fill="currentColor"/><rect x="16" y="4" width="4" height="18" fill="currentColor"/>`,
      charts: `<path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" fill="none" stroke="currentColor" stroke-width="2"/>`,
      relate: `<circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 10L14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
      map: `<circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="none" stroke="currentColor" stroke-width="2"/>`,
      migration: `<path d="M12 2L2 7l10 5 10-5-10-5z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" stroke-width="2"/>`,
      memorial: `<path d="M12 2C8.13 2 5 5.13 5 9c0 3.54 2.56 6.47 5.93 7.47L12 22l1.07-5.53C16.44 15.47 19 12.54 19 9c0-3.87-3.13-7-7-7z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9" r="2" fill="currentColor"/>`,
      overlap: `<line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2"/><line x1="3" y1="12" x2="18" y2="12" stroke="currentColor" stroke-width="2"/><line x1="6" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="2"/>`,
      sunburst: `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/>`
    };
    return icons[iconType] || '';
  }
  
  function getCurrentTab() {
    for (const tab of navTabs) {
      const item = tab.items.find(i => i.view === currentView);
      if (item) return tab.id;
    }
    return null;
  }
  
  $: currentTab = getCurrentTab();
</script>

<div class="nav-tabs-container">
  <div class="nav-tabs">
    {#each navTabs as tab}
      {@const isActive = openDropdown === tab.id}
      {@const hasActiveView = tab.items.some(item => item.view === currentView)}
      <div class="nav-tab-wrapper">
        <button
          class="nav-tab"
          class:active={isActive}
          class:has-active-view={hasActiveView}
          on:click={() => toggleDropdown(tab.id)}
          on:mouseenter={() => {
            // Optional: open on hover for better UX
            // if (openDropdown === null) openDropdown = tab.id;
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" class="tab-icon">
            {@html getIconSvg(tab.icon)}
          </svg>
          <span class="tab-label">{tab.label}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" class="tab-chevron">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
          </svg>
        </button>
        
        {#if isActive}
          <div class="tab-dropdown" transition:fade>
            {#each tab.items as item}
              <button
                class="dropdown-item"
                class:active={currentView === item.view}
                on:click={() => handleViewSelect(item.view)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" class="item-icon">
                  {@html getIconSvg(item.icon)}
                </svg>
                <span class="item-label">{item.label}</span>
                {#if currentView === item.view}
                  <svg viewBox="0 0 24 24" width="16" height="16" class="check-icon">
                    <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" stroke-width="2"/>
                  </svg>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

{#if openDropdown}
  <div class="dropdown-overlay" on:click={closeDropdown} transition:fade></div>
{/if}

<style>
  .nav-tabs-container {
    position: relative;
    z-index: 100;
  }
  
  .nav-tabs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .nav-tab-wrapper {
    position: relative;
  }
  
  .nav-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  
  .nav-tab:hover {
    background: var(--bg-card);
    border-color: var(--accent-gold);
    color: var(--text-primary);
  }
  
  .nav-tab.active {
    background: var(--accent-gold);
    color: var(--bg-deep);
    border-color: var(--accent-gold);
  }
  
  .nav-tab.has-active-view:not(.active) {
    border-color: rgba(212, 168, 83, 0.4);
    background: rgba(212, 168, 83, 0.1);
  }
  
  .tab-icon {
    flex-shrink: 0;
    opacity: 0.8;
  }
  
  .nav-tab.active .tab-icon {
    opacity: 1;
  }
  
  .tab-label {
    flex-shrink: 0;
  }
  
  .tab-chevron {
    flex-shrink: 0;
    opacity: 0.6;
    transition: transform 0.2s ease;
  }
  
  .nav-tab.active .tab-chevron {
    transform: rotate(180deg);
  }
  
  .tab-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    min-width: 220px;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-soft);
    overflow: hidden;
    z-index: 101;
    padding: 0.5rem 0;
  }
  
  .dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }
  
  .dropdown-item:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }
  
  .dropdown-item.active {
    background: rgba(212, 168, 83, 0.15);
    color: var(--accent-gold);
    font-weight: 600;
  }
  
  .item-icon {
    flex-shrink: 0;
    opacity: 0.8;
  }
  
  .dropdown-item.active .item-icon {
    opacity: 1;
    color: var(--accent-gold);
  }
  
  .item-label {
    flex: 1;
  }
  
  .check-icon {
    flex-shrink: 0;
    color: var(--accent-gold);
  }
  
  .dropdown-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.2);
    z-index: 99;
    backdrop-filter: blur(2px);
  }
  
  @media (max-width: 768px) {
    .nav-tabs {
      gap: 0.25rem;
    }
    
    .nav-tab {
      padding: 0.6rem 1rem;
      font-size: 0.85rem;
    }
    
    .tab-label {
      display: none;
    }
    
    .tab-dropdown {
      min-width: 200px;
    }
  }
</style>
