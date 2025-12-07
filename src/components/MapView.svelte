<script>
  import { onMount, onDestroy } from 'svelte';
  import { familyData, selectedPerson } from '../stores/familyStore.js';

  let mapContainer;
  let map;
  let markerClusterGroup;
  let L;
  let isLoading = true;
  let geocodeCache = {};
  let locationStats = {};
  let totalLocated = 0;
  let totalFailed = 0;

  // Location type toggles
  let showBirthLocations = true;
  let showDeathLocations = false;
  let showResidenceLocations = false;

  // Marker colors by type
  const markerColors = {
    birth: '#7a9e7e',      // Sage green
    death: '#8b7e6f',      // Muted brown/gray
    residence: '#4a7c9b'   // Steel blue
  };

  // Common US states with approximate center coordinates
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
    'district of columbia': [38.897438, -77.026817], 'dc': [38.897438, -77.026817]
  };

  // Common countries
  const countryCoords = {
    'usa': [39.8283, -98.5795], 'united states': [39.8283, -98.5795], 
    'united states of america': [39.8283, -98.5795],
    'canada': [56.1304, -106.3468], 'mexico': [23.6345, -102.5528],
    'england': [52.3555, -1.1743], 'uk': [55.3781, -3.4360], 
    'united kingdom': [55.3781, -3.4360], 'great britain': [54.7024, -3.2766],
    'ireland': [53.4129, -8.2439], 'scotland': [56.4907, -4.2026],
    'wales': [52.1307, -3.7837], 'germany': [51.1657, 10.4515],
    'france': [46.2276, 2.2137], 'italy': [41.8719, 12.5674],
    'spain': [40.4637, -3.7492], 'poland': [51.9194, 19.1451],
    'netherlands': [52.1326, 5.2913], 'belgium': [50.5039, 4.4699],
    'switzerland': [46.8182, 8.2275], 'austria': [47.5162, 14.5501],
    'sweden': [60.1282, 18.6435], 'norway': [60.4720, 8.4689],
    'denmark': [56.2639, 9.5018], 'finland': [61.9241, 25.7482],
    'russia': [61.5240, 105.3188], 'china': [35.8617, 104.1954],
    'japan': [36.2048, 138.2529], 'india': [20.5937, 78.9629],
    'australia': [-25.2744, 133.7751], 'new zealand': [-40.9006, 174.8860],
    'south africa': [-30.5595, 22.9375], 'brazil': [-14.2350, -51.9253],
    'argentina': [-38.4161, -63.6167]
  };

  // Cities database - expanded for better coverage
  const cityCoords = {
    // Indiana cities
    'indianapolis': [39.7684, -86.1581], 'bloomington': [39.1653, -86.5264],
    'avon': [39.7628, -86.3997], 'plainfield': [39.7042, -86.3994],
    'greencastle': [39.6445, -86.8647], 'terre haute': [39.4667, -87.4139],
    'fort wayne': [41.0793, -85.1394], 'evansville': [37.9716, -87.5711],
    'south bend': [41.6764, -86.2520], 'gary': [41.5934, -87.3464],
    'muncie': [40.1934, -85.3864], 'anderson': [40.1053, -85.6803],
    'lafayette': [40.4167, -86.8753], 'kokomo': [40.4864, -86.1336],
    'richmond': [39.8289, -84.8902], 'new albany': [38.2856, -85.8241],
    'carmel': [39.9784, -86.1180], 'fishers': [39.9568, -86.0139],
    'noblesville': [40.0456, -86.0086], 'greenwood': [39.6137, -86.1066],
    'lawrence': [39.8387, -86.0253], 'jeffersonville': [38.2773, -85.7372],
    'columbus': [39.2014, -85.9214], 'hammond': [41.5834, -87.5001],
    'witt': [39.2528, -89.3437], 'danville': [39.7606, -86.5264],
    'clermont': [39.8106, -86.3222], 'defuniak springs': [30.7213, -86.1152],
    'norfolk': [36.8508, -76.2859],
    
    // Colorado cities
    'denver': [39.7392, -104.9903], 'boulder': [40.0150, -105.2705],
    'erie': [40.0509, -105.0505], 'superior': [39.9528, -105.1686],
    'golden': [39.7555, -105.2211], 'aurora': [39.7294, -104.8319],
    'colorado springs': [38.8339, -104.8214], 'fort collins': [40.5853, -105.0844],
    'lakewood': [39.7047, -105.0814], 'thornton': [39.8680, -104.9719],
    'arvada': [39.8028, -105.0875], 'westminster': [39.8367, -105.0372],
    'pueblo': [38.2544, -104.6091], 'centennial': [39.5807, -104.8772],
    'broomfield': [39.9205, -105.0867], 'longmont': [40.1672, -105.1019],
    
    // Major US cities
    'new york': [40.7128, -74.0060], 'los angeles': [34.0522, -118.2437],
    'chicago': [41.8781, -87.6298], 'houston': [29.7604, -95.3698],
    'phoenix': [33.4484, -112.0740], 'philadelphia': [39.9526, -75.1652],
    'san antonio': [29.4241, -98.4936], 'san diego': [32.7157, -117.1611],
    'dallas': [32.7767, -96.7970], 'san jose': [37.3382, -121.8863],
    'austin': [30.2672, -97.7431], 'jacksonville': [30.3322, -81.6557],
    'fort worth': [32.7555, -97.3308], 'san francisco': [37.7749, -122.4194],
    'boston': [42.3601, -71.0589], 'seattle': [47.6062, -122.3321],
    'miami': [25.7617, -80.1918], 'atlanta': [33.7490, -84.3880],
    'detroit': [42.3314, -83.0458], 'minneapolis': [44.9778, -93.2650],
    'portland': [45.5051, -122.6750], 'las vegas': [36.1699, -115.1398],
    'baltimore': [39.2904, -76.6122], 'milwaukee': [43.0389, -87.9065],
    'albuquerque': [35.0844, -106.6504], 'tucson': [32.2226, -110.9747],
    'nashville': [36.1627, -86.7816], 'memphis': [35.1495, -90.0490],
    'louisville': [38.2527, -85.7585], 'oklahoma city': [35.4676, -97.5164],
    'charlotte': [35.2271, -80.8431], 'pittsburgh': [40.4406, -79.9959],
    'cincinnati': [39.1031, -84.5120], 'cleveland': [41.4993, -81.6944],
    'st louis': [38.6270, -90.1994], 'kansas city': [39.0997, -94.5786],
    'new orleans': [29.9511, -90.0715], 'tampa': [27.9506, -82.4572],
    'orlando': [28.5383, -81.3792], 'sacramento': [38.5816, -121.4944],
    'salt lake city': [40.7608, -111.8910], 'raleigh': [35.7796, -78.6382],
    
    // Florida cities
    'fort myers': [26.6406, -81.8723], 'fort myers beach': [26.4520, -81.9495],
    'jacksonville': [30.3322, -81.6557], 'tallahassee': [30.4383, -84.2807],
    'pensacola': [30.4213, -87.2169], 'gainesville': [29.6516, -82.3248],
    'sarasota': [27.3364, -82.5307], 'naples': [26.1420, -81.7948],
    
    // European cities
    'london': [51.5074, -0.1278], 'paris': [48.8566, 2.3522],
    'berlin': [52.5200, 13.4050], 'rome': [41.9028, 12.4964],
    'dublin': [53.3498, -6.2603], 'edinburgh': [55.9533, -3.1883],
    'manchester': [53.4808, -2.2426], 'liverpool': [53.4084, -2.9916],
    'glasgow': [55.8642, -4.2518], 'belfast': [54.5973, -5.9301],
    'amsterdam': [52.3676, 4.9041], 'brussels': [50.8503, 4.3517],
    'vienna': [48.2082, 16.3738], 'munich': [48.1351, 11.5820],
    'frankfurt': [50.1109, 8.6821], 'hamburg': [53.5511, 9.9937],
    'madrid': [40.4168, -3.7038], 'barcelona': [41.3851, 2.1734],
    'stockholm': [59.3293, 18.0686], 'oslo': [59.9139, 10.7522],
    'copenhagen': [55.6761, 12.5683], 'helsinki': [60.1699, 24.9384]
  };

  // State abbreviations for lookups
  const stateAbbrev = {
    'in': 'indiana', 'il': 'illinois', 'oh': 'ohio', 'ky': 'kentucky',
    'mi': 'michigan', 'wi': 'wisconsin', 'mn': 'minnesota', 'ia': 'iowa',
    'mo': 'missouri', 'tx': 'texas', 'ca': 'california', 'ny': 'new york',
    'pa': 'pennsylvania', 'fl': 'florida', 'ga': 'georgia', 'nc': 'north carolina',
    'va': 'virginia', 'wa': 'washington', 'co': 'colorado', 'az': 'arizona',
    'nv': 'nevada', 'or': 'oregon', 'ut': 'utah', 'nm': 'new mexico',
    'ok': 'oklahoma', 'ks': 'kansas', 'ne': 'nebraska', 'sd': 'south dakota',
    'nd': 'north dakota', 'mt': 'montana', 'wy': 'wyoming', 'id': 'idaho',
    'tn': 'tennessee', 'al': 'alabama', 'ms': 'mississippi', 'la': 'louisiana',
    'ar': 'arkansas', 'sc': 'south carolina', 'wv': 'west virginia', 'md': 'maryland',
    'nj': 'new jersey', 'ct': 'connecticut', 'ma': 'massachusetts', 'nh': 'new hampshire',
    'vt': 'vermont', 'me': 'maine', 'ri': 'rhode island', 'de': 'delaware', 'dc': 'district of columbia'
  };

  // Generic function to get coordinates from city/state/country
  function getCoordsFromPlace(city, state, country, fallbackPlace) {
    const cityLower = city?.toLowerCase();
    const stateLower = state?.toLowerCase();
    const countryLower = country?.toLowerCase();
    
    // Build the display name
    const placeParts = [city, state, country].filter(Boolean);
    const placeName = placeParts.join(', ') || fallbackPlace || 'Unknown';
    
    // Priority: City > State > Country
    if (cityLower && cityCoords[cityLower]) {
      return { coords: cityCoords[cityLower], name: placeName, precision: 'city' };
    }
    
    // Try city with cleanup
    if (cityLower) {
      const cityKey = cityLower.replace(/[^a-z\s]/g, '').trim();
      if (cityCoords[cityKey]) {
        return { coords: cityCoords[cityKey], name: placeName, precision: 'city' };
      }
    }
    
    // Try state
    if (stateLower) {
      const stateKey = stateLower.replace(/[^a-z\s]/g, '').trim();
      if (stateCoords[stateKey]) {
        return { coords: stateCoords[stateKey], name: placeName, precision: 'state' };
      }
      // Try state abbreviations
      if (stateAbbrev[stateKey] && stateCoords[stateAbbrev[stateKey]]) {
        return { coords: stateCoords[stateAbbrev[stateKey]], name: placeName, precision: 'state' };
      }
    }
    
    // Try country
    if (countryLower) {
      const countryKey = countryLower.replace(/[^a-z\s]/g, '').trim();
      if (countryCoords[countryKey]) {
        return { coords: countryCoords[countryKey], name: placeName, precision: 'country' };
      }
    }
    
    // Fallback: try parsing the old place string
    if (fallbackPlace) {
      return parseLocation(fallbackPlace);
    }
    
    return null;
  }

  // Get birth coordinates for a person
  function getBirthCoords(person) {
    return getCoordsFromPlace(
      person.birth_city,
      person.birth_state,
      person.birth_country,
      person.birth_place
    );
  }

  // Get death coordinates for a person
  function getDeathCoords(person) {
    return getCoordsFromPlace(
      person.death_city,
      person.death_state,
      person.death_country,
      person.death_place
    );
  }

  // Get residence coordinates for a person (returns array of locations)
  function getResidenceCoords(person) {
    if (!person.residences || person.residences.length === 0) return [];
    
    return person.residences.map(res => {
      return getCoordsFromPlace(
        res.city,
        res.state,
        res.country,
        res.place
      );
    }).filter(Boolean);
  }

  // Legacy parser for birth_place strings (fallback)
  function parseLocation(placeStr) {
    if (!placeStr) return null;
    
    const parts = placeStr.toLowerCase().split(',').map(p => p.trim().replace(/[^a-z\s]/g, ''));
    
    // Try to find coordinates from our known locations
    for (const part of parts) {
      if (cityCoords[part]) {
        return { coords: cityCoords[part], name: placeStr, type: 'city' };
      }
    }
    
    for (const part of parts) {
      if (stateCoords[part]) {
        return { coords: stateCoords[part], name: placeStr, type: 'state' };
      }
    }
    
    for (const part of parts) {
      if (countryCoords[part]) {
        return { coords: countryCoords[part], name: placeStr, type: 'country' };
      }
    }
    
    return null;
  }

  function getLocationData() {
    const locations = [];
    const stats = { birth: {}, death: {}, residence: {} };
    const jitter = () => (Math.random() - 0.5) * 0.08;
    
    $familyData.forEach(person => {
      // Birth locations
      if (showBirthLocations) {
        const birthLoc = getBirthCoords(person);
        if (birthLoc) {
          locations.push({
            coords: [birthLoc.coords[0] + jitter(), birthLoc.coords[1] + jitter()],
            person,
            place: birthLoc.name,
            precision: birthLoc.precision,
            locationType: 'birth'
          });
          
          const regionKey = person.birth_state || person.birth_country || 'Unknown';
          stats.birth[regionKey] = (stats.birth[regionKey] || 0) + 1;
        }
      }
      
      // Death locations
      if (showDeathLocations) {
        const deathLoc = getDeathCoords(person);
        if (deathLoc) {
          locations.push({
            coords: [deathLoc.coords[0] + jitter(), deathLoc.coords[1] + jitter()],
            person,
            place: deathLoc.name,
            precision: deathLoc.precision,
            locationType: 'death'
          });
          
          const regionKey = person.death_state || person.death_country || 'Unknown';
          stats.death[regionKey] = (stats.death[regionKey] || 0) + 1;
        }
      }
      
      // Residence locations
      if (showResidenceLocations) {
        const residenceLocs = getResidenceCoords(person);
        residenceLocs.forEach(resLoc => {
          locations.push({
            coords: [resLoc.coords[0] + jitter(), resLoc.coords[1] + jitter()],
            person,
            place: resLoc.name,
            precision: resLoc.precision,
            locationType: 'residence'
          });
          
          // Try to get state from the residence
          const res = person.residences?.find(r => {
            const loc = getCoordsFromPlace(r.city, r.state, r.country, r.place);
            return loc && loc.name === resLoc.name;
          });
          const regionKey = res?.state || res?.country || 'Unknown';
          stats.residence[regionKey] = (stats.residence[regionKey] || 0) + 1;
        });
      }
    });
    
    return { locations, stats };
  }

  onMount(async () => {
    // Dynamically import Leaflet
    L = await import('leaflet');
    const MarkerCluster = await import('leaflet.markercluster');
    
    // Import CSS
    const linkLeaflet = document.createElement('link');
    linkLeaflet.rel = 'stylesheet';
    linkLeaflet.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(linkLeaflet);
    
    const linkCluster = document.createElement('link');
    linkCluster.rel = 'stylesheet';
    linkCluster.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
    document.head.appendChild(linkCluster);
    
    const linkClusterDefault = document.createElement('link');
    linkClusterDefault.rel = 'stylesheet';
    linkClusterDefault.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
    document.head.appendChild(linkClusterDefault);

    // Wait for CSS to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Initialize map
    map = L.default.map(mapContainer).setView([39.8283, -98.5795], 4);
    
    // Add dark tile layer
    L.default.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);
    
    // Create marker cluster group with custom styling
    markerClusterGroup = L.default.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        const markers = cluster.getAllChildMarkers();
        
        // Determine dominant color based on location types in cluster
        let birthCount = 0, deathCount = 0, residenceCount = 0;
        markers.forEach(m => {
          if (m.options.locationType === 'birth') birthCount++;
          else if (m.options.locationType === 'death') deathCount++;
          else if (m.options.locationType === 'residence') residenceCount++;
        });
        
        let dominantColor = markerColors.birth;
        let dominantType = 'birth';
        if (deathCount > birthCount && deathCount > residenceCount) {
          dominantColor = markerColors.death;
          dominantType = 'death';
        } else if (residenceCount > birthCount && residenceCount > deathCount) {
          dominantColor = markerColors.residence;
          dominantType = 'residence';
        }
        
        let size = 'small';
        let radius = 30;
        
        if (count > 100) {
          size = 'large';
          radius = 50;
        } else if (count > 30) {
          size = 'medium';
          radius = 40;
        }
        
        return L.default.divIcon({
          html: `<div class="cluster-marker ${size} ${dominantType}" style="background: ${dominantColor}"><span>${count}</span></div>`,
          className: 'custom-cluster',
          iconSize: L.default.point(radius, radius)
        });
      }
    });
    
    // Initial render
    updateMarkers();
    
    isLoading = false;
  });

  // Create custom icon based on location type
  function createIcon(locationType, precision) {
    const color = markerColors[locationType] || markerColors.birth;
    const size = precision === 'city' ? 14 : precision === 'state' ? 12 : 10;
    
    return L.divIcon({
      html: `<div class="map-marker ${locationType}" style="background: ${color}; width: ${size}px; height: ${size}px;"></div>`,
      className: 'custom-marker',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  }

  // Update markers when toggles change
  function updateMarkers() {
    if (!map || !markerClusterGroup || !L) return;
    
    // Clear existing markers
    markerClusterGroup.clearLayers();
    
    // Get location data with current filters
    const { locations, stats } = getLocationData();
    locationStats = stats;
    
    // Calculate totals
    let located = 0;
    let withData = 0;
    
    if (showBirthLocations) {
      const birthLocated = Object.values(stats.birth).reduce((a, b) => a + b, 0);
      located += birthLocated;
      withData += $familyData.filter(p => p.birth_place || p.birth_city || p.birth_state || p.birth_country).length;
    }
    if (showDeathLocations) {
      const deathLocated = Object.values(stats.death).reduce((a, b) => a + b, 0);
      located += deathLocated;
      withData += $familyData.filter(p => p.death_place || p.death_city || p.death_state || p.death_country).length;
    }
    if (showResidenceLocations) {
      const resLocated = Object.values(stats.residence).reduce((a, b) => a + b, 0);
      located += resLocated;
      withData += $familyData.filter(p => p.residences?.length > 0).length;
    }
    
    totalLocated = located;
    totalFailed = Math.max(0, withData - located);
    
    // Add markers
    locations.forEach(loc => {
      const marker = L.marker(loc.coords, {
        icon: createIcon(loc.locationType, loc.precision),
        locationType: loc.locationType
      });
      
      const birthYear = loc.person.birth_date?.match(/\d{4}/)?.[0] || '';
      const deathYear = loc.person.death_date?.match(/\d{4}/)?.[0] || '';
      
      let popupContent = `<div class="map-popup ${loc.locationType}">`;
      popupContent += `<span class="popup-type-badge ${loc.locationType}">${loc.locationType}</span>`;
      popupContent += `<strong>${loc.person.name}</strong>`;
      
      if (loc.locationType === 'birth' && birthYear) {
        popupContent += `<br><span class="popup-year">Born: ${birthYear}</span>`;
      } else if (loc.locationType === 'death' && deathYear) {
        popupContent += `<br><span class="popup-year">Died: ${deathYear}</span>`;
      } else if (loc.locationType === 'residence') {
        popupContent += `<br><span class="popup-year">Resided</span>`;
      }
      
      popupContent += `<br><span class="popup-place">${loc.place}</span>`;
      popupContent += `</div>`;
      
      marker.bindPopup(popupContent);
      
      marker.on('click', () => {
        selectedPerson.set(loc.person);
      });
      
      markerClusterGroup.addLayer(marker);
    });
    
    map.addLayer(markerClusterGroup);
    
    // Fit bounds if we have markers
    if (locations.length > 0) {
      const bounds = markerClusterGroup.getBounds();
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  // React to toggle changes
  $: if (map && L) {
    showBirthLocations, showDeathLocations, showResidenceLocations;
    updateMarkers();
  }

  onDestroy(() => {
    if (map) {
      map.remove();
    }
  });

  // Combine stats from all active location types
  $: combinedStats = (() => {
    const combined = {};
    if (showBirthLocations && locationStats.birth) {
      Object.entries(locationStats.birth).forEach(([region, count]) => {
        combined[region] = (combined[region] || 0) + count;
      });
    }
    if (showDeathLocations && locationStats.death) {
      Object.entries(locationStats.death).forEach(([region, count]) => {
        combined[region] = (combined[region] || 0) + count;
      });
    }
    if (showResidenceLocations && locationStats.residence) {
      Object.entries(locationStats.residence).forEach(([region, count]) => {
        combined[region] = (combined[region] || 0) + count;
      });
    }
    return combined;
  })();

  $: topRegions = Object.entries(combinedStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);
</script>

<div class="map-container">
  <div class="map-header">
    <h2>
      <svg viewBox="0 0 24 24" width="24" height="24">
        <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
      Geographic Map
    </h2>
    <p>Explore family locations across generations</p>
    
    <div class="location-toggles">
      <button 
        class="toggle-btn birth" 
        class:active={showBirthLocations}
        on:click={() => { showBirthLocations = !showBirthLocations; }}
      >
        <span class="toggle-indicator" style="background: {markerColors.birth}"></span>
        Births
      </button>
      <button 
        class="toggle-btn death" 
        class:active={showDeathLocations}
        on:click={() => { showDeathLocations = !showDeathLocations; }}
      >
        <span class="toggle-indicator" style="background: {markerColors.death}"></span>
        Deaths
      </button>
      <button 
        class="toggle-btn residence" 
        class:active={showResidenceLocations}
        on:click={() => { showResidenceLocations = !showResidenceLocations; }}
      >
        <span class="toggle-indicator" style="background: {markerColors.residence}"></span>
        Residences
      </button>
    </div>
  </div>

  <div class="map-content">
    <div class="map-wrapper" bind:this={mapContainer}>
      {#if isLoading}
        <div class="map-loading">
          <div class="loading-spinner"></div>
          <p>Loading map...</p>
        </div>
      {/if}
    </div>
    
    <div class="map-sidebar">
      <div class="sidebar-section">
        <h3>Coverage</h3>
        <div class="coverage-stats">
          <div class="coverage-stat">
            <span class="stat-value">{totalLocated}</span>
            <span class="stat-label">Located</span>
          </div>
          <div class="coverage-stat">
            <span class="stat-value">{totalFailed}</span>
            <span class="stat-label">Unknown</span>
          </div>
        </div>
      </div>
      
      <div class="sidebar-section">
        <h3>Top Regions</h3>
        <div class="region-list">
          {#each topRegions as [region, count]}
            <div class="region-item">
              <span class="region-name">{region}</span>
              <span class="region-count">{count}</span>
            </div>
          {/each}
        </div>
      </div>
      
      <div class="sidebar-section legend">
        <h3>Legend</h3>
        <div class="legend-items">
          {#if showBirthLocations}
            <div class="legend-item">
              <span class="legend-dot birth" style="background: {markerColors.birth}"></span>
              <span>Birth Location</span>
            </div>
          {/if}
          {#if showDeathLocations}
            <div class="legend-item">
              <span class="legend-dot death" style="background: {markerColors.death}"></span>
              <span>Death Location</span>
            </div>
          {/if}
          {#if showResidenceLocations}
            <div class="legend-item">
              <span class="legend-dot residence" style="background: {markerColors.residence}"></span>
              <span>Residence</span>
            </div>
          {/if}
        </div>
        <div class="legend-note">
          <small>Marker size indicates location precision (city, state, or country)</small>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .map-container {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .map-header {
    padding: 1.5rem;
    background: linear-gradient(135deg, rgba(122, 158, 126, 0.1) 0%, rgba(212, 168, 83, 0.05) 100%);
    border-bottom: 1px solid var(--border-subtle);
  }

  .map-header h2 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .map-header h2 svg {
    color: var(--accent-sage);
  }

  .map-header p {
    color: var(--text-muted);
    font-size: 0.95rem;
    margin-left: 2.75rem;
  }

  .location-toggles {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    margin-left: 2.75rem;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.85rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--text-muted);
  }

  .toggle-btn.active {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--text-secondary);
    color: var(--text-primary);
  }

  .toggle-btn.active.birth {
    border-color: #7a9e7e;
    box-shadow: 0 0 8px rgba(122, 158, 126, 0.3);
  }

  .toggle-btn.active.death {
    border-color: #8b7e6f;
    box-shadow: 0 0 8px rgba(139, 126, 111, 0.3);
  }

  .toggle-btn.active.residence {
    border-color: #4a7c9b;
    box-shadow: 0 0 8px rgba(74, 124, 155, 0.3);
  }

  .toggle-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    opacity: 0.5;
    transition: opacity 0.2s ease;
  }

  .toggle-btn.active .toggle-indicator {
    opacity: 1;
  }

  .map-content {
    display: grid;
    grid-template-columns: 1fr 280px;
    min-height: 500px;
  }

  .map-wrapper {
    position: relative;
    min-height: 500px;
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
    background: var(--bg-elevated);
    padding: 1.25rem;
    border-left: 1px solid var(--border-subtle);
    overflow-y: auto;
  }

  .sidebar-section {
    margin-bottom: 1.5rem;
  }

  .sidebar-section h3 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .coverage-stats {
    display: flex;
    gap: 1rem;
  }

  .coverage-stat {
    flex: 1;
    background: var(--bg-card);
    padding: 0.75rem;
    border-radius: var(--radius-sm);
    text-align: center;
  }

  .coverage-stat .stat-value {
    display: block;
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent-gold);
  }

  .coverage-stat .stat-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .region-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .region-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.4rem 0.6rem;
    background: var(--bg-card);
    border-radius: var(--radius-sm);
  }

  .region-name {
    font-size: 0.85rem;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .region-count {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--accent-soft);
    flex-shrink: 0;
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .legend-dot.birth {
    background: #7a9e7e;
  }

  .legend-dot.death {
    background: #8b7e6f;
  }

  .legend-dot.residence {
    background: #4a7c9b;
  }

  .legend-note {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-subtle);
  }

  .legend-note small {
    color: var(--text-muted);
    font-size: 0.75rem;
    font-style: italic;
  }

  /* Leaflet custom styles */
  :global(.custom-marker) {
    background: transparent !important;
    border: none !important;
  }

  :global(.map-marker) {
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    transition: transform 0.2s ease;
  }

  :global(.map-marker:hover) {
    transform: scale(1.3);
    z-index: 1000 !important;
  }

  :global(.map-marker.birth) {
    border-color: rgba(255, 255, 255, 0.9);
  }

  :global(.map-marker.death) {
    border-color: rgba(255, 255, 255, 0.7);
  }

  :global(.map-marker.residence) {
    border-color: rgba(255, 255, 255, 0.8);
  }

  :global(.custom-cluster) {
    background: transparent !important;
  }

  :global(.cluster-marker) {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: white;
    font-weight: 600;
    font-family: var(--font-body);
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.4);
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  :global(.cluster-marker.small) {
    width: 30px;
    height: 30px;
    font-size: 0.75rem;
  }

  :global(.cluster-marker.medium) {
    width: 40px;
    height: 40px;
    font-size: 0.85rem;
  }

  :global(.cluster-marker.large) {
    width: 50px;
    height: 50px;
    font-size: 1rem;
  }

  :global(.cluster-marker.birth) {
    background: #7a9e7e;
  }

  :global(.cluster-marker.death) {
    background: #8b7e6f;
  }

  :global(.cluster-marker.residence) {
    background: #4a7c9b;
  }

  :global(.map-popup) {
    font-family: var(--font-body);
    font-size: 0.9rem;
    line-height: 1.4;
    position: relative;
  }

  :global(.popup-type-badge) {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.4rem;
    color: white;
  }

  :global(.popup-type-badge.birth) {
    background: #7a9e7e;
  }

  :global(.popup-type-badge.death) {
    background: #8b7e6f;
  }

  :global(.popup-type-badge.residence) {
    background: #4a7c9b;
  }

  :global(.map-popup strong) {
    color: #1a1612;
    display: block;
    margin-top: 0.25rem;
  }

  :global(.popup-year) {
    color: #666;
    font-size: 0.8rem;
  }

  :global(.popup-place) {
    color: #888;
    font-size: 0.8rem;
  }

  :global(.leaflet-popup-content-wrapper) {
    border-radius: 8px;
  }

  @media (max-width: 900px) {
    .map-content {
      grid-template-columns: 1fr;
    }

    .map-sidebar {
      border-left: none;
      border-top: 1px solid var(--border-subtle);
    }

    .map-wrapper {
      min-height: 400px;
    }
  }
</style>

