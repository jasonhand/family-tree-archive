<script>
  import { onMount, onDestroy } from 'svelte';
  import { familyData, selectedPerson } from '../stores/familyStore.js';

  let mapContainer;
  let map;
  let L;
  let isLoading = true;
  let animationFrame;
  let flowLines = [];
  let markers = [];

  // Timeline control
  let timelineYear = 1800;
  let isPlaying = false;
  let playInterval;
  let playSpeed = 100; // ms per year

  // Filter options
  let showBirthToResidence = true;
  let showResidenceToDeath = true;
  let showDirectMigrations = true;

  // Stats
  let migrationStats = {
    totalMigrations: 0,
    avgDistance: 0,
    topOrigins: [],
    topDestinations: []
  };

  // Location coordinates database (same as MapView)
  const stateCoords = {
    'alabama': [32.806671, -86.791130], 'alaska': [61.370716, -152.404419],
    'arizona': [33.729759, -111.431221], 'arkansas': [34.969704, -92.373123],
    'california': [36.116203, -119.681564], 'colorado': [39.059811, -105.311104],
    'connecticut': [41.597782, -72.755371], 'delaware': [39.318523, -75.507141],
    'florida': [27.766279, -81.686783], 'georgia': [33.040619, -83.643074],
    'hawaii': [21.094318, -157.498337], 'idaho': [44.240459, -114.478828],
    'illinois': [40.349457, -88.986137], 'indiana': [39.849426, -86.258278],
    'iowa': [42.011539, -93.210526], 'kansas': [38.526600, -96.726486],
    'kentucky': [37.668140, -84.670067], 'louisiana': [31.169546, -91.867805],
    'maine': [44.693947, -69.381927], 'maryland': [39.063946, -76.802101],
    'massachusetts': [42.230171, -71.530106], 'michigan': [43.326618, -84.536095],
    'minnesota': [45.694454, -93.900192], 'mississippi': [32.741646, -89.678696],
    'missouri': [38.456085, -92.288368], 'montana': [46.921925, -110.454353],
    'nebraska': [41.125370, -98.268082], 'nevada': [38.313515, -117.055374],
    'new hampshire': [43.452492, -71.563896], 'new jersey': [40.298904, -74.521011],
    'new mexico': [34.840515, -106.248482], 'new york': [42.165726, -74.948051],
    'north carolina': [35.630066, -79.806419], 'north dakota': [47.528912, -99.784012],
    'ohio': [40.388783, -82.764915], 'oklahoma': [35.565342, -96.928917],
    'oregon': [44.572021, -122.070938], 'pennsylvania': [40.590752, -77.209755],
    'rhode island': [41.680893, -71.511780], 'south carolina': [33.856892, -80.945007],
    'south dakota': [44.299782, -99.438828], 'tennessee': [35.747845, -86.692345],
    'texas': [31.054487, -97.563461], 'utah': [40.150032, -111.862434],
    'vermont': [44.045876, -72.710686], 'virginia': [37.769337, -78.169968],
    'washington': [47.400902, -121.490494], 'west virginia': [38.491226, -80.954453],
    'wisconsin': [44.268543, -89.616508], 'wyoming': [42.755966, -107.302490],
    'district of columbia': [38.9072, -77.0369]
  };

  const cityCoords = {
    'indianapolis': [39.7684, -86.1581], 'bloomington': [39.1653, -86.5264],
    'fort wayne': [41.0793, -85.1394], 'chicago': [41.8781, -87.6298],
    'new york': [40.7128, -74.0060], 'los angeles': [34.0522, -118.2437],
    'philadelphia': [39.9526, -75.1652], 'boston': [42.3601, -71.0589],
    'denver': [39.7392, -104.9903], 'seattle': [47.6062, -122.3321],
    'miami': [25.7617, -80.1918], 'atlanta': [33.7490, -84.3880],
    'detroit': [42.3314, -83.0458], 'minneapolis': [44.9778, -93.2650],
    'london': [51.5074, -0.1278], 'paris': [48.8566, 2.3522],
    'berlin': [52.5200, 13.4050], 'dublin': [53.3498, -6.2603]
  };

  const countryCoords = {
    'usa': [39.8283, -98.5795], 'united states': [39.8283, -98.5795],
    'england': [52.3555, -1.1743], 'uk': [54.7024, -3.2765],
    'united kingdom': [54.7024, -3.2765], 'germany': [51.1657, 10.4515],
    'ireland': [53.1424, -7.6921], 'france': [46.2276, 2.2137],
    'italy': [41.8719, 12.5674], 'scotland': [56.4907, -4.2026],
    'wales': [52.1307, -3.7837], 'netherlands': [52.1326, 5.2913],
    'canada': [56.1304, -106.3468], 'mexico': [23.6345, -102.5528]
  };

  function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }

  function getCoords(city, state, country, fallbackPlace) {
    const cityLower = city?.toLowerCase();
    const stateLower = state?.toLowerCase();
    const countryLower = country?.toLowerCase();

    if (cityLower && cityCoords[cityLower]) return cityCoords[cityLower];
    if (stateLower && stateCoords[stateLower]) return stateCoords[stateLower];
    if (countryLower && countryCoords[countryLower]) return countryCoords[countryLower];

    // Try parsing fallback
    if (fallbackPlace) {
      const parts = fallbackPlace.toLowerCase().split(',').map(p => p.trim());
      for (const part of parts) {
        if (cityCoords[part]) return cityCoords[part];
        if (stateCoords[part]) return stateCoords[part];
        if (countryCoords[part]) return countryCoords[part];
      }
    }

    return null;
  }

  // Build migration paths for each person
  function getMigrationData() {
    const migrations = [];
    
    $familyData.forEach(person => {
      const birthCoords = getCoords(
        person.birth_city, person.birth_state, person.birth_country, person.birth_place
      );
      const deathCoords = getCoords(
        person.death_city, person.death_state, person.death_country, person.death_place
      );
      
      const birthYear = extractYear(person.birth_date);
      const deathYear = extractYear(person.death_date);
      
      const path = [];
      
      // Birth location
      if (birthCoords && birthYear) {
        path.push({
          coords: birthCoords,
          year: birthYear,
          type: 'birth',
          place: [person.birth_city, person.birth_state, person.birth_country].filter(Boolean).join(', ') || person.birth_place
        });
      }

      // Residences (if any)
      if (person.residences?.length > 0) {
        person.residences.forEach(res => {
          const resCoords = getCoords(res.city, res.state, res.country, res.place);
          const resYear = extractYear(res.date);
          
          if (resCoords) {
            path.push({
              coords: resCoords,
              year: resYear || (birthYear ? birthYear + 20 : null), // Estimate if no date
              type: 'residence',
              place: [res.city, res.state, res.country].filter(Boolean).join(', ') || res.place
            });
          }
        });
      }

      // Death location
      if (deathCoords && deathYear) {
        path.push({
          coords: deathCoords,
          year: deathYear,
          type: 'death',
          place: [person.death_city, person.death_state, person.death_country].filter(Boolean).join(', ') || person.death_place
        });
      }

      // Sort path by year
      path.sort((a, b) => (a.year || 0) - (b.year || 0));

      // Create migration segments
      for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];
        
        // Skip if same location
        if (from.coords[0] === to.coords[0] && from.coords[1] === to.coords[1]) continue;

        migrations.push({
          person,
          from,
          to,
          year: to.year || from.year,
          distance: calculateDistance(from.coords, to.coords)
        });
      }
    });

    return migrations;
  }

  function calculateDistance(coord1, coord2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
  }

  let allMigrations = [];

  onMount(async () => {
    L = await import('leaflet');
    
    // Import CSS
    const linkLeaflet = document.createElement('link');
    linkLeaflet.rel = 'stylesheet';
    linkLeaflet.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(linkLeaflet);

    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Initialize map
    map = L.default.map(mapContainer).setView([39.8283, -98.5795], 4);
    
    L.default.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Get migration data
    allMigrations = getMigrationData();
    
    // Calculate stats
    if (allMigrations.length > 0) {
      migrationStats.totalMigrations = allMigrations.length;
      migrationStats.avgDistance = Math.round(
        allMigrations.reduce((sum, m) => sum + m.distance, 0) / allMigrations.length
      );

      // Top origins
      const origins = {};
      allMigrations.forEach(m => {
        const key = m.from.place || 'Unknown';
        origins[key] = (origins[key] || 0) + 1;
      });
      migrationStats.topOrigins = Object.entries(origins)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      // Top destinations
      const destinations = {};
      allMigrations.forEach(m => {
        const key = m.to.place || 'Unknown';
        destinations[key] = (destinations[key] || 0) + 1;
      });
      migrationStats.topDestinations = Object.entries(destinations)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    }

    // Set timeline range
    const years = allMigrations.map(m => m.year).filter(Boolean);
    if (years.length > 0) {
      timelineYear = Math.min(...years);
    }

    renderMigrations();
    isLoading = false;
  });

  function renderMigrations() {
    if (!map || !L) return;

    // Clear existing
    flowLines.forEach(line => map.removeLayer(line));
    markers.forEach(marker => map.removeLayer(marker));
    flowLines = [];
    markers = [];

    // Filter migrations by year and type
    const visibleMigrations = allMigrations.filter(m => {
      if (m.year && m.year > timelineYear) return false;
      
      const fromType = m.from.type;
      const toType = m.to.type;
      
      if (fromType === 'birth' && toType === 'residence' && !showBirthToResidence) return false;
      if (fromType === 'residence' && toType === 'death' && !showResidenceToDeath) return false;
      if (fromType === 'birth' && toType === 'death' && !showDirectMigrations) return false;
      
      return true;
    });

    // Draw flow lines
    visibleMigrations.forEach(migration => {
      const isRecent = migration.year && (timelineYear - migration.year) < 20;
      const opacity = isRecent ? 0.8 : 0.3;
      
      // Create curved line
      const midLat = (migration.from.coords[0] + migration.to.coords[0]) / 2;
      const midLng = (migration.from.coords[1] + migration.to.coords[1]) / 2;
      
      // Add curve offset based on direction
      const latDiff = migration.to.coords[0] - migration.from.coords[0];
      const lngDiff = migration.to.coords[1] - migration.from.coords[1];
      const curveOffset = Math.min(Math.abs(latDiff), Math.abs(lngDiff)) * 0.3;
      
      const curvedMid = [
        midLat + (lngDiff > 0 ? curveOffset : -curveOffset),
        midLng
      ];

      // Get color based on migration type
      let color = '#d4a853';
      if (migration.to.type === 'death') color = '#8b7e6f';
      else if (migration.to.type === 'residence') color = '#4a7c9b';

      const line = L.default.polyline(
        [migration.from.coords, curvedMid, migration.to.coords],
        {
          color: color,
          weight: isRecent ? 3 : 2,
          opacity: opacity,
          smoothFactor: 1,
          dashArray: migration.to.type === 'death' ? '5, 5' : null
        }
      );

      line.bindPopup(`
        <div class="migration-popup">
          <strong>${migration.person.name}</strong>
          <div class="migration-route">
            <span class="from">${migration.from.place || 'Unknown'}</span>
            <span class="arrow">→</span>
            <span class="to">${migration.to.place || 'Unknown'}</span>
          </div>
          ${migration.year ? `<div class="migration-year">~${migration.year}</div>` : ''}
          <div class="migration-distance">${migration.distance} miles</div>
        </div>
      `);

      line.on('click', () => {
        selectedPerson.set(migration.person);
      });

      line.addTo(map);
      flowLines.push(line);

      // Add animated arrow if recent
      if (isRecent) {
        addAnimatedArrow(migration.from.coords, migration.to.coords, color);
      }
    });

    // Add destination markers
    const destinationCounts = {};
    visibleMigrations.forEach(m => {
      const key = `${m.to.coords[0]},${m.to.coords[1]}`;
      if (!destinationCounts[key]) {
        destinationCounts[key] = {
          coords: m.to.coords,
          place: m.to.place,
          count: 0,
          type: m.to.type
        };
      }
      destinationCounts[key].count++;
    });

    Object.values(destinationCounts).forEach(dest => {
      const size = Math.min(30, 10 + dest.count * 3);
      let color = '#d4a853';
      if (dest.type === 'death') color = '#8b7e6f';
      else if (dest.type === 'residence') color = '#4a7c9b';

      const marker = L.default.circleMarker(dest.coords, {
        radius: size / 2,
        fillColor: color,
        fillOpacity: 0.7,
        color: 'white',
        weight: 2
      });

      marker.bindPopup(`
        <strong>${dest.place || 'Unknown'}</strong><br>
        ${dest.count} migration${dest.count > 1 ? 's' : ''} here
      `);

      marker.addTo(map);
      markers.push(marker);
    });
  }

  function addAnimatedArrow(from, to, color) {
    // Create a small animated marker that moves along the path
    const icon = L.default.divIcon({
      html: `<div class="flow-arrow" style="border-left-color: ${color}"></div>`,
      className: 'flow-arrow-container',
      iconSize: [10, 10]
    });

    // Calculate angle
    const angle = Math.atan2(to[0] - from[0], to[1] - from[1]) * 180 / Math.PI;

    const arrowMarker = L.default.marker(to, { icon });
    arrowMarker.addTo(map);
    markers.push(arrowMarker);
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    
    if (isPlaying) {
      const maxYear = Math.max(...allMigrations.map(m => m.year).filter(Boolean), new Date().getFullYear());
      
      playInterval = setInterval(() => {
        timelineYear++;
        renderMigrations();
        
        if (timelineYear >= maxYear) {
          isPlaying = false;
          clearInterval(playInterval);
        }
      }, playSpeed);
    } else {
      clearInterval(playInterval);
    }
  }

  function handleTimelineChange() {
    renderMigrations();
  }

  // Get timeline range
  $: timelineRange = (() => {
    const years = allMigrations.map(m => m.year).filter(Boolean);
    if (years.length === 0) return { min: 1800, max: 2025 };
    return {
      min: Math.min(...years),
      max: Math.max(...years, new Date().getFullYear())
    };
  })();

  onDestroy(() => {
    if (playInterval) clearInterval(playInterval);
    if (map) map.remove();
  });
</script>

<div class="migration-container">
  <div class="migration-header">
    <h2>
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
      Migration Flow Map
    </h2>
    <p>Watch your family's movements across generations</p>
  </div>

  <div class="migration-controls">
    <div class="filter-toggles">
      <label>
        <input type="checkbox" bind:checked={showBirthToResidence} on:change={renderMigrations} />
        <span class="toggle-label birth-res">Birth → Residence</span>
      </label>
      <label>
        <input type="checkbox" bind:checked={showResidenceToDeath} on:change={renderMigrations} />
        <span class="toggle-label res-death">Residence → Death</span>
      </label>
      <label>
        <input type="checkbox" bind:checked={showDirectMigrations} on:change={renderMigrations} />
        <span class="toggle-label direct">Direct Migrations</span>
      </label>
    </div>

    <div class="timeline-control">
      <button class="play-btn" on:click={togglePlay}>
        {#if isPlaying}
          <svg viewBox="0 0 24 24" width="20" height="20">
            <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
            <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" width="20" height="20">
            <polygon points="5,3 19,12 5,21" fill="currentColor"/>
          </svg>
        {/if}
      </button>
      
      <input 
        type="range" 
        min={timelineRange.min} 
        max={timelineRange.max} 
        bind:value={timelineYear}
        on:input={handleTimelineChange}
        class="timeline-slider"
      />
      
      <span class="year-display">{timelineYear}</span>
    </div>
  </div>

  <div class="map-content">
    <div class="map-wrapper" bind:this={mapContainer}>
      {#if isLoading}
        <div class="map-loading">
          <div class="loading-spinner"></div>
          <p>Loading migration data...</p>
        </div>
      {/if}
    </div>

    <div class="map-sidebar">
      <div class="sidebar-section">
        <h3>Migration Statistics</h3>
        <div class="stat-grid">
          <div class="stat-item">
            <span class="stat-value">{migrationStats.totalMigrations}</span>
            <span class="stat-label">Total Migrations</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{migrationStats.avgDistance}</span>
            <span class="stat-label">Avg. Miles</span>
          </div>
        </div>
      </div>

      <div class="sidebar-section">
        <h3>Top Origins</h3>
        <div class="place-list">
          {#each migrationStats.topOrigins as [place, count]}
            <div class="place-item">
              <span class="place-name">{place}</span>
              <span class="place-count">{count}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="sidebar-section">
        <h3>Top Destinations</h3>
        <div class="place-list">
          {#each migrationStats.topDestinations as [place, count]}
            <div class="place-item">
              <span class="place-name">{place}</span>
              <span class="place-count">{count}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="sidebar-section legend">
        <h3>Legend</h3>
        <div class="legend-items">
          <div class="legend-item">
            <span class="legend-line gold"></span>
            <span>To Residence</span>
          </div>
          <div class="legend-item">
            <span class="legend-line blue"></span>
            <span>Between Residences</span>
          </div>
          <div class="legend-item">
            <span class="legend-line brown dashed"></span>
            <span>To Death Location</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .migration-container {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .migration-header {
    padding: 1.5rem;
    background: linear-gradient(135deg, rgba(196, 122, 90, 0.1) 0%, rgba(212, 168, 83, 0.05) 100%);
    border-bottom: 1px solid var(--border-subtle);
  }

  .migration-header h2 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .migration-header h2 svg {
    color: var(--accent-terracotta);
  }

  .migration-header p {
    color: var(--text-muted);
    font-size: 0.95rem;
    margin-left: 2.75rem;
  }

  .migration-controls {
    display: flex;
    gap: 2rem;
    padding: 1rem 1.5rem;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid var(--border-subtle);
    flex-wrap: wrap;
    align-items: center;
  }

  .filter-toggles {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .filter-toggles label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .filter-toggles input[type="checkbox"] {
    accent-color: var(--accent-gold);
  }

  .toggle-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .toggle-label.birth-res { color: #d4a853; }
  .toggle-label.res-death { color: #8b7e6f; }
  .toggle-label.direct { color: #4a7c9b; }

  .timeline-control {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-width: 300px;
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--accent-gold);
    border: none;
    border-radius: 50%;
    color: var(--bg-deep);
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .play-btn:hover {
    transform: scale(1.1);
  }

  .timeline-slider {
    flex: 1;
    accent-color: var(--accent-gold);
  }

  .year-display {
    font-family: var(--font-display);
    font-size: 1.2rem;
    color: var(--accent-gold);
    min-width: 60px;
    text-align: right;
  }

  .map-content {
    display: grid;
    grid-template-columns: 1fr 280px;
    min-height: 550px;
  }

  .map-wrapper {
    position: relative;
    min-height: 550px;
    background: var(--bg-deep);
  }

  .map-loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg-deep);
    color: var(--text-muted);
    gap: 1rem;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-subtle);
    border-top-color: var(--accent-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .map-sidebar {
    background: rgba(0, 0, 0, 0.3);
    border-left: 1px solid var(--border-subtle);
    padding: 1rem;
    overflow-y: auto;
  }

  .sidebar-section {
    margin-bottom: 1.5rem;
  }

  .sidebar-section h3 {
    font-family: var(--font-display);
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .stat-item {
    text-align: center;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-sm);
  }

  .stat-value {
    display: block;
    font-family: var(--font-display);
    font-size: 1.4rem;
    color: var(--accent-gold);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .place-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .place-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.4rem 0.6rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
  }

  .place-name {
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
  }

  .place-count {
    color: var(--accent-gold);
    font-weight: 600;
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .legend-line {
    width: 24px;
    height: 3px;
    border-radius: 2px;
  }

  .legend-line.gold { background: #d4a853; }
  .legend-line.blue { background: #4a7c9b; }
  .legend-line.brown { background: #8b7e6f; }
  .legend-line.dashed { 
    background: repeating-linear-gradient(90deg, #8b7e6f 0, #8b7e6f 4px, transparent 4px, transparent 8px);
  }

  /* Leaflet popup styles */
  :global(.migration-popup) {
    font-family: var(--font-body);
  }

  :global(.migration-popup strong) {
    display: block;
    color: #1a1612;
    margin-bottom: 0.25rem;
  }

  :global(.migration-route) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #666;
  }

  :global(.migration-route .arrow) {
    color: #d4a853;
  }

  :global(.migration-year) {
    font-size: 0.8rem;
    color: #888;
    margin-top: 0.25rem;
  }

  :global(.migration-distance) {
    font-size: 0.75rem;
    color: #999;
  }

  :global(.flow-arrow-container) {
    background: transparent !important;
    border: none !important;
  }

  :global(.flow-arrow) {
    width: 0;
    height: 0;
    border-left: 8px solid;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
  }

  @media (max-width: 900px) {
    .map-content {
      grid-template-columns: 1fr;
    }

    .map-sidebar {
      border-left: none;
      border-top: 1px solid var(--border-subtle);
    }

    .timeline-control {
      min-width: 200px;
    }
  }
</style>

