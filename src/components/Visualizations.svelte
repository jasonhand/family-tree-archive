<script>
  import { familyData, familyRelationships } from '../stores/familyStore.js';
  import PopulationRaceChart from './visualizations/PopulationRaceChart.svelte';
  import LifespanEvolution from './visualizations/LifespanEvolution.svelte';
  import GenerationHeatmap from './visualizations/GenerationHeatmap.svelte';
  import MarriageTimeline from './visualizations/MarriageTimeline.svelte';
  import GeographicExpansion from './visualizations/GeographicExpansion.svelte';
  import SurnameRace from './visualizations/SurnameRace.svelte';
  import BirthDeathBalance from './visualizations/BirthDeathBalance.svelte';
  import ImmigrationTimeline from './visualizations/ImmigrationTimeline.svelte';
  import MarriageAgeTrends from './visualizations/MarriageAgeTrends.svelte';
  import LongevityChampions from './visualizations/LongevityChampions.svelte';
  import SurvivalRates from './visualizations/SurvivalRates.svelte';
  import FamilySizeEvolution from './visualizations/FamilySizeEvolution.svelte';
  import WidowhoodTimeline from './visualizations/WidowhoodTimeline.svelte';
  
  let activeViz = 'population-race'; // Default visualization
  
  const visualizations = [
    { id: 'population-race', name: 'Population Growth', icon: '📈' },
    { id: 'lifespan-evolution', name: 'Lifespan Evolution', icon: '⏳' },
    { id: 'generation-heatmap', name: 'Generation Waves', icon: '🌊' },
    { id: 'marriage-timeline', name: 'Marriage Timeline', icon: '💍' },
    { id: 'geographic-expansion', name: 'Geographic Expansion', icon: '🗺️' },
    { id: 'surname-race', name: 'Surname Popularity', icon: '📊' },
    { id: 'immigration-timeline', name: 'Immigration Events', icon: '✈️' },
    { id: 'family-size', name: 'Family Size Evolution', icon: '👨‍👩‍👧‍👦' },
    { id: 'survival-rates', name: 'Survival Rates', icon: '📉' },
    { id: 'marriage-age', name: 'Marriage Age Trends', icon: '💑' },
    { id: 'widowhood-timeline', name: 'Widowhood Timeline', icon: '🕯️' },
    { id: 'longevity-race', name: 'Longevity Champions', icon: '🏆' },
    { id: 'birth-death-balance', name: 'Birth/Death Balance', icon: '⚖️' }
  ];
</script>

<div class="visualizations-container">
  <div class="visualizations-header">
    <h2>
      <svg viewBox="0 0 24 24" width="28" height="28">
        <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
      Data Visualizations
    </h2>
    <p>Explore your family history through interactive charts and timelines</p>
  </div>

  <div class="viz-tabs">
    {#each visualizations as viz}
      <button 
        class="viz-tab" 
        class:active={activeViz === viz.id}
        on:click={() => activeViz = viz.id}
      >
        <span class="viz-icon">{viz.icon}</span>
        <span class="viz-name">{viz.name}</span>
      </button>
    {/each}
  </div>

  <div class="viz-content">
    {#if activeViz === 'population-race'}
      <PopulationRaceChart />
    {:else if activeViz === 'lifespan-evolution'}
      <LifespanEvolution />
    {:else if activeViz === 'generation-heatmap'}
      <GenerationHeatmap />
    {:else if activeViz === 'marriage-timeline'}
      <MarriageTimeline />
    {:else if activeViz === 'geographic-expansion'}
      <GeographicExpansion />
    {:else if activeViz === 'surname-race'}
      <SurnameRace on:filterBySurname={(e) => dispatch('filterBySurname', e.detail)} />
    {:else if activeViz === 'birth-death-balance'}
      <BirthDeathBalance />
    {:else if activeViz === 'immigration-timeline'}
      <ImmigrationTimeline />
    {:else if activeViz === 'marriage-age'}
      <MarriageAgeTrends />
    {:else if activeViz === 'longevity-race'}
      <LongevityChampions />
    {:else if activeViz === 'survival-rates'}
      <SurvivalRates />
    {:else if activeViz === 'family-size'}
      <FamilySizeEvolution />
    {:else if activeViz === 'widowhood-timeline'}
      <WidowhoodTimeline />
    {:else}
      <div class="coming-soon">
        <p>🚧 This visualization is coming soon!</p>
        <p>We're working on implementing all visualizations. Check back soon!</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .visualizations-container {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .visualizations-header {
    padding: 2rem;
    background: linear-gradient(135deg, rgba(74, 124, 155, 0.1) 0%, rgba(212, 168, 83, 0.05) 100%);
    border-bottom: 1px solid var(--border-subtle);
  }

  .visualizations-header h2 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .visualizations-header h2 svg {
    color: var(--accent-gold);
  }

  .visualizations-header p {
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  .viz-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-subtle);
    overflow-x: auto;
  }

  .viz-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .viz-tab:hover {
    background: var(--bg-elevated);
    border-color: var(--accent-gold);
    color: var(--text-primary);
  }

  .viz-tab.active {
    background: var(--accent-gold);
    border-color: var(--accent-gold);
    color: var(--bg-deep);
    font-weight: 600;
  }

  .viz-icon {
    font-size: 1.1rem;
  }

  .viz-content {
    padding: 2rem;
    min-height: 500px;
  }

  .coming-soon {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }

  .coming-soon p:first-child {
    font-size: 2rem;
    margin-bottom: 1rem;
  }
</style>

