<script>
  import { onMount } from 'svelte';
  import { selectedPerson, familyRelationships, familyData, favorites, flaggedRecords } from '../stores/familyStore.js';
  import { historyData, historyLoaded, loadHistoryData, getEventsForLifetime, getEventTypeIcon, getOutcomeClass } from '../stores/historyStore.js';
  import HistoryModal from './HistoryModal.svelte';
  import FamilyTimeline from './FamilyTimeline.svelte';
  import AncestorFanChart from './AncestorFanChart.svelte';

  // Read-only mode prop
  export let readOnly = false;

  let showAllEvents = false;
  let showHistoryModal = false;
  const MAX_EVENTS_PREVIEW = 5;

  // Relationship finder state
  let compareSearchQuery = '';
  let comparePerson = null;
  let relationshipPath = null;
  let relationshipDescription = '';

  // Edit mode state
  let isEditing = false;
  let editNotes = '';
  let lastPersonId = null;

  // Delete confirmation state
  let showDeleteConfirm = false;

  onMount(() => {
    if (!$historyLoaded) {
      loadHistoryData();
    }
  });

  // Sync editNotes only when switching to a DIFFERENT person
  $: if (person && person.id !== lastPersonId) {
    lastPersonId = person.id;
    editNotes = person.notes || '';
    isEditing = false;
    isEditingGender = false;
    isEditingProfile = false;
  }

  function close() {
    selectedPerson.set(null);
    showAllEvents = false;
    showHistoryModal = false;
    resetCompare();
    isEditing = false;
    isEditingGender = false;
    isEditingProfile = false;
    lastPersonId = null;
    showDeleteConfirm = false;
  }

  // Write operations disabled in read-only mode
  function confirmDelete() {
    if (readOnly) return;
    showDeleteConfirm = true;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
  }

  function executeDelete() {
    if (readOnly) return;
    // Disabled in read-only mode
  }

  function selectPerson(newPerson) {
    selectedPerson.set(newPerson);
    showAllEvents = false;
    resetCompare();
    // Note: isEditing and editNotes will be reset by the reactive statement
    // when the person ID changes
  }

  function resetCompare() {
    compareSearchQuery = '';
    comparePerson = null;
    relationshipPath = null;
    relationshipDescription = '';
  }

  function startEditing() {
    if (readOnly) return;
    editNotes = person.notes || '';
    isEditing = true;
  }

  function cancelEditing() {
    editNotes = person.notes || '';
    isEditing = false;
  }

  function saveNotes() {
    if (readOnly) return;
    // Disabled in read-only mode
    isEditing = false;
  }

  // Gender editing
  let isEditingGender = false;

  function setGender(newGender) {
    if (readOnly) return;
    // Disabled in read-only mode
    isEditingGender = false;
  }

  // Full profile editing
  let isEditingProfile = false;
  let editName = '';
  let editBirthDate = '';
  let editBirthCity = '';
  let editBirthCounty = '';
  let editBirthState = '';
  let editBirthCountry = '';
  let editDeathDate = '';
  let editDeathCity = '';
  let editDeathCounty = '';
  let editDeathState = '';
  let editDeathCountry = '';

  function startEditingProfile() {
    if (readOnly) return;
    editName = person.name || '';
    editBirthDate = person.birth_date || '';
    editBirthCity = person.birth_city || '';
    editBirthCounty = person.birth_county || '';
    editBirthState = person.birth_state || '';
    editBirthCountry = person.birth_country || '';
    editDeathDate = person.death_date || '';
    editDeathCity = person.death_city || '';
    editDeathCounty = person.death_county || '';
    editDeathState = person.death_state || '';
    editDeathCountry = person.death_country || '';
    isEditingProfile = true;
  }

  function cancelEditingProfile() {
    isEditingProfile = false;
  }

  function saveProfile() {
    if (readOnly) return;
    // Disabled in read-only mode
    isEditingProfile = false;
  }

  // Common US states for autocomplete
  const US_STATES = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 
    'Wisconsin', 'Wyoming'
  ];

  const COUNTRIES = ['USA', 'Canada', 'England', 'Ireland', 'Scotland', 'Germany', 'France', 'Italy', 'Mexico'];

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

  // Search results for compare person
  $: compareSearchResults = compareSearchQuery.length >= 2
    ? $familyData.filter(p => 
        p.name?.toLowerCase().includes(compareSearchQuery.toLowerCase()) && 
        p.id !== person?.id
      ).slice(0, 6)
    : [];

  function selectComparePerson(p) {
    comparePerson = p;
    compareSearchQuery = '';
    findRelationship();
  }

  // Find relationship path using BFS
  function findRelationship() {
    if (!person || !comparePerson) return;

    const visited = new Set();
    const queue = [[person, [{ person: person, relation: 'self' }]]];
    
    while (queue.length > 0) {
      const [current, path] = queue.shift();
      
      if (current.id === comparePerson.id) {
        relationshipPath = path;
        relationshipDescription = describeRelationship(path);
        return;
      }
      
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      
      const rels = $familyRelationships[current.id];
      if (!rels) continue;
      
      if (rels.parents) {
        for (const parent of rels.parents) {
          if (!visited.has(parent.id)) {
            queue.push([parent, [...path, { person: parent, relation: 'parent' }]]);
          }
        }
      }
      
      if (rels.children) {
        for (const child of rels.children) {
          if (!visited.has(child.id)) {
            queue.push([child, [...path, { person: child, relation: 'child' }]]);
          }
        }
      }
      
      if (rels.spouses) {
        for (const spouse of rels.spouses) {
          if (!visited.has(spouse.id)) {
            queue.push([spouse, [...path, { person: spouse, relation: 'spouse' }]]);
          }
        }
      }
      
      if (rels.siblings) {
        for (const sibling of rels.siblings) {
          if (!visited.has(sibling.id)) {
            queue.push([sibling, [...path, { person: sibling, relation: 'sibling' }]]);
          }
        }
      }
    }
    
    relationshipPath = null;
    relationshipDescription = 'No direct family connection found';
  }

  function describeRelationship(path) {
    if (path.length === 1) return 'Same person';
    if (path.length === 2) {
      const rel = path[1].relation;
      const p2 = comparePerson;
      if (rel === 'parent') return p2.sex === 'F' ? 'Mother' : p2.sex === 'M' ? 'Father' : 'Parent';
      if (rel === 'child') return p2.sex === 'F' ? 'Daughter' : p2.sex === 'M' ? 'Son' : 'Child';
      if (rel === 'spouse') return 'Spouse';
      if (rel === 'sibling') return p2.sex === 'F' ? 'Sister' : p2.sex === 'M' ? 'Brother' : 'Sibling';
    }

    const relations = path.slice(1).map(p => p.relation);
    let up = 0, down = 0, hasSibling = false, hasSpouse = false;
    
    relations.forEach(rel => {
      if (rel === 'parent') up++;
      else if (rel === 'child') down++;
      else if (rel === 'spouse') hasSpouse = true;
      else if (rel === 'sibling') hasSibling = true;
    });

    const p2 = comparePerson;

    if (!hasSibling && !hasSpouse && down === 0) {
      if (up === 2) return p2.sex === 'F' ? 'Grandmother' : p2.sex === 'M' ? 'Grandfather' : 'Grandparent';
      if (up === 3) return p2.sex === 'F' ? 'Great-Grandmother' : p2.sex === 'M' ? 'Great-Grandfather' : 'Great-Grandparent';
      if (up > 3) return `${up - 2}x Great-Grand${p2.sex === 'F' ? 'mother' : p2.sex === 'M' ? 'father' : 'parent'}`;
    }
    
    if (!hasSibling && !hasSpouse && up === 0) {
      if (down === 2) return p2.sex === 'F' ? 'Granddaughter' : p2.sex === 'M' ? 'Grandson' : 'Grandchild';
      if (down === 3) return p2.sex === 'F' ? 'Great-Granddaughter' : p2.sex === 'M' ? 'Great-Grandson' : 'Great-Grandchild';
      if (down > 3) return `${down - 2}x Great-Grand${p2.sex === 'F' ? 'daughter' : p2.sex === 'M' ? 'son' : 'child'}`;
    }

    if (hasSibling && up === 1 && down === 0) return p2.sex === 'F' ? 'Aunt' : p2.sex === 'M' ? 'Uncle' : 'Aunt/Uncle';
    if (hasSibling && up === 0 && down === 1) return p2.sex === 'F' ? 'Niece' : p2.sex === 'M' ? 'Nephew' : 'Niece/Nephew';
    if (hasSibling && up === 2 && down === 0) return p2.sex === 'F' ? 'Great-Aunt' : p2.sex === 'M' ? 'Great-Uncle' : 'Great-Aunt/Uncle';
    if (hasSibling && up === 0 && down === 2) return p2.sex === 'F' ? 'Grand-Niece' : p2.sex === 'M' ? 'Grand-Nephew' : 'Grand-Niece/Nephew';

    if (hasSibling && up > 0 && down > 0) {
      const cousinDegree = Math.min(up, down);
      const removed = Math.abs(up - down);
      let label = cousinDegree === 1 ? '1st Cousin' : cousinDegree === 2 ? '2nd Cousin' : cousinDegree === 3 ? '3rd Cousin' : `${cousinDegree}th Cousin`;
      if (removed > 0) label += ` ${removed}x Removed`;
      return label;
    }

    if (hasSpouse) {
      const spouseIdx = relations.indexOf('spouse');
      const before = relations.slice(0, spouseIdx);
      const after = relations.slice(spouseIdx + 1);
      
      if (before.length === 0 && after.length === 1 && after[0] === 'parent') {
        return p2.sex === 'F' ? 'Mother-in-Law' : p2.sex === 'M' ? 'Father-in-Law' : 'Parent-in-Law';
      }
      if (before.length === 0 && after.length === 1 && after[0] === 'sibling') {
        return p2.sex === 'F' ? 'Sister-in-Law' : p2.sex === 'M' ? 'Brother-in-Law' : 'Sibling-in-Law';
      }
      if (after.length === 0 && before.length === 1 && before[0] === 'child') {
        return p2.sex === 'F' ? 'Daughter-in-Law' : p2.sex === 'M' ? 'Son-in-Law' : 'Child-in-Law';
      }
      return 'Related by Marriage';
    }

    return `Related (${path.length - 1} steps)`;
  }

  function getRelationLabel(relation, p) {
    const sex = p.sex;
    switch (relation) {
      case 'parent': return sex === 'F' ? 'Mother' : sex === 'M' ? 'Father' : 'Parent';
      case 'child': return sex === 'F' ? 'Daughter' : sex === 'M' ? 'Son' : 'Child';
      case 'spouse': return 'Spouse';
      case 'sibling': return sex === 'F' ? 'Sister' : sex === 'M' ? 'Brother' : 'Sibling';
      default: return relation;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && !showHistoryModal) close();
  }

  $: person = $selectedPerson;
  $: relationships = person ? $familyRelationships[person.id] : null;
  // Prefer normalized year fields, fallback to parsing date strings
  $: birthYear = person?.birth_year !== null && person?.birth_year !== undefined
    ? String(person.birth_year)
    : person?.birth_date?.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/)?.[1];
  $: deathYear = person?.death_year !== null && person?.death_year !== undefined
    ? String(person.death_year)
    : person?.death_date?.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/)?.[1];
  $: age = birthYear && deathYear ? parseInt(deathYear) - parseInt(birthYear) : null;
  
  // Check if person is deceased (has any death_date value, even without a year)
  $: isDeceased = !!person?.death_date;
  
  // Check if death date is unknown (deceased but no parseable year)
  $: hasUnknownDeathDate = isDeceased && !deathYear;
  
  // Calculate display age - current age for living, age at death for deceased
  // Returns null if deceased but no death year (can't calculate)
  $: displayAge = (() => {
    if (!birthYear) return null;
    if (isDeceased) {
      // Only show age if we have a death year to calculate from
      return deathYear ? parseInt(deathYear) - parseInt(birthYear) : null;
    }
    // Living person - show current age
    return new Date().getFullYear() - parseInt(birthYear);
  })();
  
  $: isLiving = !isDeceased;

  // Check if person is favorited
  $: isFavorited = person ? $favorites.has(person.id) : false;

  function handleToggleFavorite() {
    if (readOnly || !person) return;
    // Disabled in read-only mode
  }

  // Check if person is flagged for review
  $: flagInfo = person ? $flaggedRecords.get(person.id) : null;
  $: isFlagged = !!flagInfo;

  let showFlagModal = false;
  let flagReason = '';

  function handleToggleFlag() {
    if (readOnly || !person) return;
    // Disabled in read-only mode
  }

  function submitFlag() {
    if (readOnly || !person) return;
    // Disabled in read-only mode
    showFlagModal = false;
    flagReason = '';
  }

  function cancelFlag() {
    showFlagModal = false;
    flagReason = '';
  }

  // ============== MARRIAGE MANAGEMENT ==============
  
  let editingMarriageSpouseId = null;
  let editMarriageData = {};
  
  // Get marriage details for a specific spouse
  function getMarriageDetails(spouse) {
    if (!person || !spouse?.spouse_family_ids) return null;
    
    // Find the shared family ID between this person and the spouse
    const personFamilyIds = person.spouse_family_ids || [];
    const spouseFamilyIds = spouse.spouse_family_ids || [];
    const sharedFamilyId = personFamilyIds.find(fid => spouseFamilyIds.includes(fid));
    
    if (!sharedFamilyId) return null;
    
    // Find the marriage details for this family
    // Check both spouse_families array and fallback to checking if we have the data
    const marriage = person.spouse_families?.find(sf => sf.family_id === sharedFamilyId);
    
    // If no detailed marriage record found, return a minimal record with just the family_id
    // This allows us to still show status if end_reason or divorce_date exists elsewhere
    if (!marriage) {
      // Try to find if there's any divorce info in the spouse's data
      const spouseMarriage = spouse.spouse_families?.find(sf => sf.family_id === sharedFamilyId);
      if (spouseMarriage) return { ...spouseMarriage, family_id: sharedFamilyId };
      return { family_id: sharedFamilyId };
    }
    
    return marriage;
  }
  
  // Get marriage status label
  function getMarriageStatus(marriage, spouse) {
    // If we have a marriage record, check its status
    if (marriage) {
      if (marriage.end_reason === 'divorce' || marriage.divorce_date) {
        return { label: 'Divorced', class: 'divorced' };
      }
      if (marriage.end_reason === 'annulment') {
        return { label: 'Annulled', class: 'annulled' };
      }
      if (marriage.end_reason === 'death' || spouse?.death_date) {
        return { label: 'Widowed', class: 'widowed' };
      }
      // If no end reason and no divorce date, assume current marriage
      return { label: 'Current', class: 'current' };
    }
    
    // If no marriage record but spouse is deceased, show widowed
    if (spouse?.death_date) {
      return { label: 'Widowed', class: 'widowed' };
    }
    
    // Default to current if we can't determine
    return { label: 'Current', class: 'current' };
  }
  
  // Get sorted spouses by marriage order
  $: sortedSpouses = (() => {
    if (!relationships?.spouses) return [];
    return [...relationships.spouses].sort((a, b) => {
      const marriageA = getMarriageDetails(a);
      const marriageB = getMarriageDetails(b);
      const orderA = marriageA?.marriage_order || 999;
      const orderB = marriageB?.marriage_order || 999;
      return orderA - orderB;
    });
  })();
  
  function startEditMarriage(spouse) {
    const marriage = getMarriageDetails(spouse);
    editingMarriageSpouseId = spouse.id;
    editMarriageData = {
      family_id: marriage?.family_id,
      marriage_date: marriage?.marriage_date || '',
      marriage_place: marriage?.marriage_place || '',
      divorce_date: marriage?.divorce_date || '',
      marriage_order: marriage?.marriage_order || 1,
      end_reason: marriage?.end_reason || ''
    };
  }
  
  function cancelEditMarriage() {
    editingMarriageSpouseId = null;
    editMarriageData = {};
  }
  
  async function saveMarriage() {
    if (!person || !editMarriageData.family_id) return;
    
    try {
      await updateMarriage(person.id, editMarriageData.family_id, {
        marriage_date: editMarriageData.marriage_date || null,
        marriage_place: editMarriageData.marriage_place || null,
        divorce_date: editMarriageData.divorce_date || null,
        marriage_order: editMarriageData.marriage_order || 1,
        end_reason: editMarriageData.end_reason || null
      });
      editingMarriageSpouseId = null;
      editMarriageData = {};
    } catch (err) {
      console.error('Failed to save marriage:', err);
    }
  }

  // Get historical events for this person's lifetime
  $: lifetimeEvents = birthYear 
    ? getEventsForLifetime($historyData, parseInt(birthYear), deathYear ? parseInt(deathYear) : null)
    : [];
  
  $: displayedEvents = showAllEvents ? lifetimeEvents : lifetimeEvents.slice(0, MAX_EVENTS_PREVIEW);
  $: hasMoreEvents = lifetimeEvents.length > MAX_EVENTS_PREVIEW;

  // Get grandparents (parents of parents)
  $: grandparents = (() => {
    if (!relationships?.parents?.length) return [];
    const gp = [];
    const seen = new Set();
    relationships.parents.forEach(parent => {
      const parentRels = $familyRelationships[parent.id];
      if (parentRels?.parents) {
        parentRels.parents.forEach(grandparent => {
          if (!seen.has(grandparent.id)) {
            seen.add(grandparent.id);
            gp.push(grandparent);
          }
        });
      }
    });
    return gp;
  })();

  // Get great-grandparents (parents of grandparents)
  $: greatGrandparents = (() => {
    if (!grandparents.length) return [];
    const ggp = [];
    const seen = new Set();
    grandparents.forEach(grandparent => {
      const gpRels = $familyRelationships[grandparent.id];
      if (gpRels?.parents) {
        gpRels.parents.forEach(greatGrandparent => {
          if (!seen.has(greatGrandparent.id)) {
            seen.add(greatGrandparent.id);
            ggp.push(greatGrandparent);
          }
        });
      }
    });
    return ggp;
  })();

  $: hasAnyFamily = relationships?.parents?.length || relationships?.siblings?.length || 
                    relationships?.spouses?.length || relationships?.children?.length || 
                    grandparents.length || greatGrandparents.length;
</script>

<svelte:window on:keydown={handleKeydown} />

{#if person}
  <div class="modal-overlay" on:click={close} role="button" tabindex="0">
    <div class="modal-container" on:click|stopPropagation role="dialog" aria-modal="true">
      <!-- Close Button -->
      <button class="close-btn" on:click={close} aria-label="Close">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>

      <!-- Delete Confirmation Dialog -->
      {#if showDeleteConfirm}
        <div class="delete-confirm-overlay" on:click={cancelDelete}>
          <div class="delete-confirm-dialog" on:click|stopPropagation>
            <div class="delete-icon">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="none" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            <h3>⚠️ Confirm Removal</h3>
            <p class="delete-warning-main">
              Are you absolutely sure you want to remove <strong>{person.name}</strong> from the family tree?
            </p>
            <p class="warning">
              <strong>⚠️ This action cannot be undone!</strong><br/>
              This will permanently delete this person and all their data from the database. 
              Make sure you have a backup if you need to restore this information later.
            </p>
            <div class="delete-actions">
              <button class="cancel-delete-btn" on:click={cancelDelete}>
                Cancel
              </button>
              <button class="confirm-delete-btn" on:click={executeDelete}>
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <polyline points="3 6 5 6 21 6" fill="none" stroke="currentColor" stroke-width="2"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
                Yes, Remove Permanently
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Flag Modal -->
      {#if showFlagModal}
        <div class="flag-modal-overlay" on:click={cancelFlag}>
          <div class="flag-modal-dialog" on:click|stopPropagation>
            <div class="flag-icon">
              <svg viewBox="0 0 24 24" width="40" height="40">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/>
                <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            <h3>Flag for Review</h3>
            <p>Flag <strong>{person.name}</strong> as needing attention or review.</p>
            
            <div class="reason-input">
              <label for="flag-reason">Reason (optional)</label>
              <input 
                id="flag-reason"
                type="text" 
                bind:value={flagReason}
                placeholder="e.g., Check death date, Possible duplicate..."
                on:keypress={(e) => e.key === 'Enter' && submitFlag()}
              />
            </div>
            
            <div class="quick-reasons">
              <button on:click={() => flagReason = 'Check death date'}>Check death date</button>
              <button on:click={() => flagReason = 'Check birth date'}>Check birth date</button>
              <button on:click={() => flagReason = 'Possible duplicate'}>Possible duplicate</button>
              <button on:click={() => flagReason = 'Missing information'}>Missing info</button>
              <button on:click={() => flagReason = 'Verify relationship'}>Verify relationship</button>
            </div>

            <div class="flag-actions">
              <button class="cancel-flag-btn" on:click={cancelFlag}>Cancel</button>
              <button class="confirm-flag-btn" on:click={submitFlag}>
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/>
                  <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" stroke-width="2"/>
                </svg>
                Flag Record
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Header Section -->
      <header class="modal-header {getGenderClass(person.sex)}">
        <div class="header-left">
          <div class="avatar-large {getGenderClass(person.sex)}">
            <span>{getInitials(person.name)}</span>
          </div>
        </div>
        
        <div class="header-center">
          <div class="name-row">
            <h1 class="person-name">{person.name || 'Unknown'}</h1>
            {#if !readOnly}
            <div class="action-buttons">
              <button
                class="favorite-btn"
                class:active={isFavorited}
                on:click={handleToggleFavorite}
                title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    fill={isFavorited ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    stroke-width="2"
                  />
                </svg>
              </button>
              <button
                class="flag-btn"
                class:active={isFlagged}
                on:click={handleToggleFlag}
                title={isFlagged ? 'Remove flag' : 'Flag for review'}
              >
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path
                    d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
                    fill={isFlagged ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            </div>
            {/if}
          </div>
          
          {#if isFlagged}
            <div class="flagged-banner">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/>
                <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" stroke-width="2"/>
              </svg>
              <span class="flag-reason">{flagInfo.reason}</span>
              {#if !readOnly}
              <button class="clear-flag" on:click={handleToggleFlag} title="Remove flag">×</button>
              {/if}
            </div>
          {/if}
          <div class="person-meta">
            {#if !readOnly && isEditingGender}
              <div class="gender-editor">
                <button class="gender-option male" class:selected={person.sex === 'M'} on:click={() => setGender('M')}>
                  ♂ Male
                </button>
                <button class="gender-option female" class:selected={person.sex === 'F'} on:click={() => setGender('F')}>
                  ♀ Female
                </button>
                <button class="gender-option unknown" class:selected={!person.sex || person.sex === 'U'} on:click={() => setGender(null)}>
                  ○ Unknown
                </button>
                <button class="gender-cancel" on:click={() => isEditingGender = false}>×</button>
              </div>
            {:else if !readOnly}
              <button class="meta-tag gender editable" on:click={() => isEditingGender = true} title="Click to change gender">
                {person.sex === 'M' ? '♂ Male' : person.sex === 'F' ? '♀ Female' : '○ Unknown'}
                <svg class="edit-icon" viewBox="0 0 24 24" width="12" height="12">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            {:else}
              <span class="meta-tag gender">
                {person.sex === 'M' ? '♂ Male' : person.sex === 'F' ? '♀ Female' : '○ Unknown'}
              </span>
            {/if}
            {#if birthYear}
              <span class="meta-tag dates" class:unknown-death={hasUnknownDeathDate}>
                {birthYear} — {deathYear || (isDeceased ? '?' : 'Present')}
              </span>
            {/if}
          </div>
          
          {#if relationships?.children?.length || relationships?.spouses?.length || relationships?.siblings?.length}
            <div class="family-stats">
              {#if relationships.spouses?.length}
                <div class="stat-item">
                  <span class="stat-icon">💍</span>
                  <span class="stat-value">{relationships.spouses.length}</span>
                  <span class="stat-label">{relationships.spouses.length === 1 ? 'Spouse' : 'Spouses'}</span>
                </div>
              {/if}
              {#if relationships.children?.length}
                <div class="stat-item">
                  <span class="stat-icon">👶</span>
                  <span class="stat-value">{relationships.children.length}</span>
                  <span class="stat-label">{relationships.children.length === 1 ? 'Child' : 'Children'}</span>
                </div>
              {/if}
              {#if relationships.siblings?.filter(s => s.sex === 'M').length}
                <div class="stat-item">
                  <span class="stat-icon">👦</span>
                  <span class="stat-value">{relationships.siblings.filter(s => s.sex === 'M').length}</span>
                  <span class="stat-label">{relationships.siblings.filter(s => s.sex === 'M').length === 1 ? 'Brother' : 'Brothers'}</span>
                </div>
              {/if}
              {#if relationships.siblings?.filter(s => s.sex === 'F').length}
                <div class="stat-item">
                  <span class="stat-icon">👧</span>
                  <span class="stat-value">{relationships.siblings.filter(s => s.sex === 'F').length}</span>
                  <span class="stat-label">{relationships.siblings.filter(s => s.sex === 'F').length === 1 ? 'Sister' : 'Sisters'}</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <div class="header-right">
          {#if displayAge !== null}
            <div class="age-badge" class:living={isLiving}>
              <span class="age-number">{displayAge}</span>
              <span class="age-label">{isLiving ? 'years old' : 'years lived'}</span>
            </div>
          {:else if hasUnknownDeathDate}
            <div class="age-badge deceased-unknown">
              <span class="age-icon">✝</span>
              <span class="age-label">Deceased</span>
            </div>
          {/if}
        </div>
      </header>

      <!-- Main Content Grid -->
      <div class="modal-body">
        <!-- Left Column -->
        <div class="column column-left">
          <!-- Relationship Finder -->
          <section class="card">
            <h2 class="card-title">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
                <circle cx="16" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M10 10L14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              Find Relationship
            </h2>
            
            <p class="card-subtitle">How is {person.name?.split(' ')[0]} related to someone else?</p>
            
            {#if !comparePerson}
              <div class="compare-search">
                <input 
                  type="text" 
                  placeholder="Type a name to search..."
                  bind:value={compareSearchQuery}
                />
                {#if compareSearchResults.length > 0}
                  <div class="search-results">
                    {#each compareSearchResults as p}
                      <button class="search-result" on:click={() => selectComparePerson(p)}>
                        <div class="result-avatar {getGenderClass(p.sex)}">
                          {getInitials(p.name)}
                        </div>
                        <span>{p.name}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else}
              <div class="compare-result">
                <div class="compare-person-row">
                  <button class="compare-person-btn" on:click={() => selectPerson(comparePerson)}>
                    <div class="result-avatar {getGenderClass(comparePerson.sex)}">
                      {getInitials(comparePerson.name)}
                    </div>
                    <span>{comparePerson.name}</span>
                  </button>
                  <button class="clear-btn" on:click={resetCompare}>×</button>
                </div>
                
                {#if relationshipDescription}
                  <div class="relation-result">
                    <div class="relation-badge">{relationshipDescription}</div>
                    {#if relationshipPath && relationshipPath.length > 2}
                      <div class="relation-path">
                        {#each relationshipPath as step, i}
                          {#if i > 0}
                            <span class="path-step">
                              → {step.person.name?.split(' ')[0]}
                              {#if i < relationshipPath.length - 1}
                                <span class="step-relation">({getRelationLabel(step.relation, step.person)})</span>
                              {/if}
                            </span>
                          {/if}
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}
          </section>

          <!-- Life Events / Edit Profile -->
          <section class="card">
            <h2 class="card-title">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"/>
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"/>
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/>
              </svg>
              {isEditingProfile ? 'Edit Profile' : 'Life Events'}
              {#if !readOnly && !isEditingProfile}
                <button class="edit-profile-btn" on:click={startEditingProfile} title="Edit profile">
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  Edit
                </button>
              {/if}
            </h2>
            
            {#if isEditingProfile}
              <!-- Edit Profile Form -->
              <div class="profile-edit-form">
                <!-- Name -->
                <div class="edit-section">
                  <h4>Name</h4>
                  <input 
                    type="text" 
                    class="edit-input full-width"
                    bind:value={editName}
                    placeholder="Full name"
                  />
                </div>

                <!-- Birth Information -->
                <div class="edit-section">
                  <h4>★ Birth</h4>
                  <div class="edit-row">
                    <div class="edit-field">
                      <label>Date</label>
                      <input 
                        type="text" 
                        class="edit-input"
                        bind:value={editBirthDate}
                        placeholder="e.g., 15 Jan 1900"
                      />
                    </div>
                  </div>
                  <div class="edit-row location-row">
                    <div class="edit-field">
                      <label>City/Town</label>
                      <input 
                        type="text" 
                        class="edit-input"
                        bind:value={editBirthCity}
                        placeholder="City"
                      />
                    </div>
                    <div class="edit-field">
                      <label>County</label>
                      <input 
                        type="text" 
                        class="edit-input"
                        bind:value={editBirthCounty}
                        placeholder="County"
                      />
                    </div>
                  </div>
                  <div class="edit-row location-row">
                    <div class="edit-field">
                      <label>State</label>
                      <input 
                        type="text" 
                        class="edit-input"
                        bind:value={editBirthState}
                        placeholder="State"
                        list="us-states-birth"
                      />
                      <datalist id="us-states-birth">
                        {#each US_STATES as state}
                          <option value={state}>{state}</option>
                        {/each}
                      </datalist>
                    </div>
                    <div class="edit-field">
                      <label>Country</label>
                      <input 
                        type="text" 
                        class="edit-input"
                        bind:value={editBirthCountry}
                        placeholder="Country"
                        list="countries-birth"
                      />
                      <datalist id="countries-birth">
                        {#each COUNTRIES as country}
                          <option value={country}>{country}</option>
                        {/each}
                      </datalist>
                    </div>
                  </div>
                </div>

                <!-- Death Information -->
                <div class="edit-section">
                  <h4>✝ Death</h4>
                  <div class="edit-row">
                    <div class="edit-field">
                      <label>Date</label>
                      <input 
                        type="text" 
                        class="edit-input"
                        bind:value={editDeathDate}
                        placeholder="e.g., 20 Mar 1980 or leave blank"
                      />
                    </div>
                  </div>
                  <div class="edit-row location-row">
                    <div class="edit-field">
                      <label>City/Town</label>
                      <input 
                        type="text" 
                        class="edit-input"
                        bind:value={editDeathCity}
                        placeholder="City"
                      />
                    </div>
                    <div class="edit-field">
                      <label>County</label>
                      <input 
                        type="text" 
                        class="edit-input"
                        bind:value={editDeathCounty}
                        placeholder="County"
                      />
                    </div>
                  </div>
                  <div class="edit-row location-row">
                    <div class="edit-field">
                      <label>State</label>
                      <input 
                        type="text" 
                        class="edit-input"
                        bind:value={editDeathState}
                        placeholder="State"
                        list="us-states-death"
                      />
                      <datalist id="us-states-death">
                        {#each US_STATES as state}
                          <option value={state}>{state}</option>
                        {/each}
                      </datalist>
                    </div>
                    <div class="edit-field">
                      <label>Country</label>
                      <input 
                        type="text" 
                        class="edit-input"
                        bind:value={editDeathCountry}
                        placeholder="Country"
                        list="countries-death"
                      />
                      <datalist id="countries-death">
                        {#each COUNTRIES as country}
                          <option value={country}>{country}</option>
                        {/each}
                      </datalist>
                    </div>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="edit-actions">
                  <button class="cancel-btn" on:click={cancelEditingProfile}>Cancel</button>
                  <button class="save-btn" on:click={saveProfile}>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Save Changes
                  </button>
                </div>
              </div>
            {:else}
              <!-- Display Mode -->
              <div class="life-events">
                {#if person.birth_date || person.birth_place}
                  <div class="life-event birth">
                    <div class="event-marker">★</div>
                    <div class="event-info">
                      <span class="event-label">Birth</span>
                      {#if person.birth_date}<p class="event-date">{person.birth_date}</p>{/if}
                      {#if person.birth_city || person.birth_state || person.birth_country}
                        <div class="event-location-details">
                          {#if person.birth_city}<span class="loc-city">{person.birth_city}</span>{/if}
                          {#if person.birth_county}<span class="loc-county">{person.birth_county} County</span>{/if}
                          {#if person.birth_state}<span class="loc-state">{person.birth_state}</span>{/if}
                          {#if person.birth_country}<span class="loc-country">{person.birth_country}</span>{/if}
                        </div>
                      {:else if person.birth_place}
                        <p class="event-place">{person.birth_place}</p>
                      {/if}
                    </div>
                  </div>
                {/if}

                {#if person.death_date || person.death_place}
                  <div class="life-event death" class:unknown-date={hasUnknownDeathDate}>
                    <div class="event-marker">✝</div>
                    <div class="event-info">
                      <span class="event-label">Death {age ? `(Age ${age})` : ''}</span>
                      {#if person.death_date}
                        {#if hasUnknownDeathDate}
                          <p class="event-date unknown">Date unknown</p>
                        {:else}
                          <p class="event-date">{person.death_date}</p>
                        {/if}
                      {/if}
                      {#if person.death_city || person.death_state || person.death_country}
                        <div class="event-location-details">
                          {#if person.death_city}<span class="loc-city">{person.death_city}</span>{/if}
                          {#if person.death_county}<span class="loc-county">{person.death_county} County</span>{/if}
                          {#if person.death_state}<span class="loc-state">{person.death_state}</span>{/if}
                          {#if person.death_country}<span class="loc-country">{person.death_country}</span>{/if}
                        </div>
                      {:else if person.death_place}
                        <p class="event-place">{person.death_place}</p>
                      {/if}
                    </div>
                  </div>
                {/if}

                {#if !person.birth_date && !person.birth_place && !person.death_date && !person.death_place}
                  <p class="no-data">No life events recorded. <button class="add-data-link" on:click={startEditingProfile}>Add birth/death information</button></p>
                {/if}
              </div>
            {/if}
          </section>

          <!-- Immigration Status -->
          <section class="card immigrant-card">
            <h2 class="card-title">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
              Immigration Status
            </h2>
            
            <div class="immigrant-toggle">
              {#if readOnly}
                <p class="immigrant-status-readonly">Immigrant: {person.is_immigrant ? 'Yes' : 'No'}</p>
              {:else}
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  checked={person.is_immigrant}
                  on:change={() => toggleImmigrant(person.id)}
                />
                <span class="toggle-slider"></span>
                <span class="toggle-label">Immigrant: {person.is_immigrant ? 'Yes' : 'No'}</span>
              </label>
              {/if}

              {#if person.is_immigrant && person.immigrant_notes}
                <p class="immigrant-notes">{person.immigrant_notes}</p>
              {/if}
            </div>
          </section>

          <!-- Notes / Biography -->
          <section class="card notes-card">
            <h2 class="card-title">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2"/>
                <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="2"/>
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2"/>
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2"/>
              </svg>
              Notes & Biography
              {#if !readOnly && !isEditing}
                <button class="edit-btn" on:click={startEditing} title="Edit notes">
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </button>
              {/if}
            </h2>
            
            {#if isEditing}
              <div class="notes-edit">
                <textarea 
                  bind:value={editNotes} 
                  placeholder="Add notes about this person... their story, memories, achievements, or any other information you'd like to preserve."
                  rows="6"
                ></textarea>
                <div class="edit-actions">
                  <button class="cancel-btn" on:click={cancelEditing}>Cancel</button>
                  <button class="save-btn" on:click={saveNotes}>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Save
                  </button>
                </div>
              </div>
            {:else}
              {#if person.notes}
                <div class="notes-content">
                  <p>{person.notes}</p>
                </div>
              {:else}
                <div class="notes-empty">
                  <p>No notes yet. Click the edit button to add information about {person.name?.split(' ')[0] || 'this person'}.</p>
                </div>
              {/if}
            {/if}
          </section>

          <!-- Residences -->
          {#if person.residences?.length}
            <section class="card">
              <h2 class="card-title">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="2"/>
                  <polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
                Residences
              </h2>
              <div class="residences-list">
                {#each person.residences as res}
                  {#if res.place || res.date || res.city}
                    <div class="residence-item">
                      {#if res.date}<span class="res-date">{res.date}</span>{/if}
                      {#if res.city || res.state || res.country}
                        <div class="res-location-details">
                          {#if res.city}<span class="loc-city">{res.city}</span>{/if}
                          {#if res.county}<span class="loc-county">{res.county} County</span>{/if}
                          {#if res.state}<span class="loc-state">{res.state}</span>{/if}
                          {#if res.country}<span class="loc-country">{res.country}</span>{/if}
                        </div>
                      {:else if res.place}
                        <span class="res-place">{res.place}</span>
                      {/if}
                    </div>
                  {/if}
                {/each}
              </div>
            </section>
          {/if}
        </div>

        <!-- Right Column -->
        <div class="column column-right">
          <!-- Ancestry Fan Chart -->
          <AncestorFanChart {person} on:selectPerson={(e) => selectPerson(e.detail)} />

          <!-- Family Timeline -->
          <FamilyTimeline {person} on:selectPerson={(e) => selectPerson(e.detail)} />

          <!-- Family -->
          {#if relationships}
            <section class="card family-card">
              <h2 class="card-title">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="2"/>
                  <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" fill="none" stroke="currentColor" stroke-width="2"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
                Family
              </h2>

              {#if hasAnyFamily}
                <div class="family-grid">
                  <!-- Descendants Column -->
                  {#if relationships.children?.length}
                    <div class="family-column descendants">
                      <h3>Descendants</h3>
                      <div class="family-group">
                        <h4>Children</h4>
                        <div class="family-chips">
                          {#each relationships.children as child}
                            <button class="family-chip {getGenderClass(child.sex)}" on:click={() => selectPerson(child)}>
                              <span class="chip-avatar">{getInitials(child.name)}</span>
                              <span class="chip-name">{child.name}</span>
                            </button>
                          {/each}
                        </div>
                      </div>
                    </div>
                  {/if}

                  <!-- Current Gen Column -->
                  {#if relationships.siblings?.length || relationships.spouses?.length}
                    <div class="family-column current">
                      <h3>Same Generation</h3>
                      
                      {#if relationships.spouses?.length}
                        <div class="family-group spouses-group">
                          <h4>Spouse{relationships.spouses.length > 1 ? 's' : ''}</h4>
                          <div class="spouse-cards">
                            {#each sortedSpouses as spouse}
                              {@const marriage = getMarriageDetails(spouse)}
                              {@const status = getMarriageStatus(marriage, spouse)}
                              {@const isDivorced = marriage?.end_reason === 'divorce' || marriage?.divorce_date || false}
                              <div class="spouse-card {status?.class || (isDivorced ? 'divorced' : '')}">
                                <div class="spouse-main">
                                  <button class="spouse-info" on:click={() => selectPerson(spouse)}>
                                    <span class="spouse-avatar {getGenderClass(spouse.sex)}">{getInitials(spouse.name)}</span>
                                    <div class="spouse-details">
                                      <span class="spouse-name">{spouse.name}</span>
                                      {#if status || marriage}
                                        <span class="marriage-status {status?.class || 'current'}">
                                          {status?.label || (marriage?.divorce_date || marriage?.end_reason === 'divorce' ? 'Divorced' : marriage?.end_reason === 'death' ? 'Widowed' : 'Current')}
                                        </span>
                                      {/if}
                                    </div>
                                  </button>
                                  <button class="edit-marriage-btn" on:click={() => startEditMarriage(spouse)} title="Edit marriage details">
                                    <svg viewBox="0 0 24 24" width="14" height="14">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2"/>
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" stroke-width="2"/>
                                    </svg>
                                  </button>
                                </div>
                                
                                {#if marriage?.marriage_date || marriage?.marriage_place || marriage?.marriage_order > 1 || marriage?.divorce_date || marriage?.end_reason}
                                  <div class="marriage-details">
                                    {#if marriage.marriage_order > 1}
                                      <span class="marriage-order">{marriage.marriage_order === 2 ? '2nd' : marriage.marriage_order === 3 ? '3rd' : `${marriage.marriage_order}th`} marriage</span>
                                    {/if}
                                    {#if marriage.marriage_date}
                                      <span class="marriage-date">Married: {marriage.marriage_date}</span>
                                    {/if}
                                    {#if marriage.marriage_place}
                                      <span class="marriage-place">{marriage.marriage_place}</span>
                                    {/if}
                                    {#if marriage.divorce_date || marriage.end_reason === 'divorce'}
                                      <span class="divorce-date">Divorced: {marriage.divorce_date || 'Yes'}</span>
                                    {/if}
                                  </div>
                                {/if}
                                
                                {#if editingMarriageSpouseId === spouse.id}
                                  <div class="marriage-edit-form">
                                    <div class="edit-row">
                                      <label>
                                        <span>Marriage Order</span>
                                        <select bind:value={editMarriageData.marriage_order}>
                                          <option value={1}>1st Marriage</option>
                                          <option value={2}>2nd Marriage</option>
                                          <option value={3}>3rd Marriage</option>
                                          <option value={4}>4th Marriage</option>
                                          <option value={5}>5th Marriage</option>
                                        </select>
                                      </label>
                                      <label>
                                        <span>Status</span>
                                        <select bind:value={editMarriageData.end_reason}>
                                          <option value="">Current/Ongoing</option>
                                          <option value="divorce">Divorced</option>
                                          <option value="death">Ended by Death</option>
                                          <option value="annulment">Annulled</option>
                                        </select>
                                      </label>
                                    </div>
                                    <div class="edit-row">
                                      <label>
                                        <span>Marriage Date</span>
                                        <input type="text" bind:value={editMarriageData.marriage_date} placeholder="e.g., 15 Jun 1920">
                                      </label>
                                      <label>
                                        <span>Marriage Place</span>
                                        <input type="text" bind:value={editMarriageData.marriage_place} placeholder="City, State">
                                      </label>
                                    </div>
                                    {#if editMarriageData.end_reason === 'divorce'}
                                      <div class="edit-row">
                                        <label>
                                          <span>Divorce Date</span>
                                          <input type="text" bind:value={editMarriageData.divorce_date} placeholder="e.g., 1925">
                                        </label>
                                      </div>
                                    {/if}
                                    <div class="edit-actions">
                                      <button class="save-btn" on:click={saveMarriage}>Save</button>
                                      <button class="cancel-btn" on:click={cancelEditMarriage}>Cancel</button>
                                    </div>
                                  </div>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      {#if relationships.siblings?.length}
                        <div class="family-group">
                          <h4>Siblings</h4>
                          <div class="family-chips">
                            {#each relationships.siblings as sibling}
                              <button class="family-chip {getGenderClass(sibling.sex)}" on:click={() => selectPerson(sibling)}>
                                <span class="chip-avatar">{getInitials(sibling.name)}</span>
                                <span class="chip-name">{sibling.name}</span>
                              </button>
                            {/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  <!-- Ancestors Column -->
                  {#if greatGrandparents.length || grandparents.length || relationships.parents?.length}
                    <div class="family-column ancestors">
                      <h3>Ancestors</h3>
                      
                      {#if relationships.parents?.length}
                        <div class="family-group">
                          <h4>Parents</h4>
                          <div class="family-chips">
                            {#each relationships.parents as parent}
                              <button class="family-chip {getGenderClass(parent.sex)}" on:click={() => selectPerson(parent)}>
                                <span class="chip-avatar">{getInitials(parent.name)}</span>
                                <span class="chip-name">{parent.name}</span>
                              </button>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      {#if grandparents.length}
                        <div class="family-group">
                          <h4>Grandparents</h4>
                          <div class="family-chips">
                            {#each grandparents as gp}
                              <button class="family-chip {getGenderClass(gp.sex)}" on:click={() => selectPerson(gp)}>
                                <span class="chip-avatar">{getInitials(gp.name)}</span>
                                <span class="chip-name">{gp.name}</span>
                              </button>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      {#if greatGrandparents.length}
                        <div class="family-group">
                          <h4>Great-Grandparents</h4>
                          <div class="family-chips">
                            {#each greatGrandparents as ggp}
                              <button class="family-chip {getGenderClass(ggp.sex)}" on:click={() => selectPerson(ggp)}>
                                <span class="chip-avatar">{getInitials(ggp.name)}</span>
                                <span class="chip-name">{ggp.name}</span>
                              </button>
                            {/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {:else}
                <p class="no-data">No family connections found in this dataset</p>
              {/if}
            </section>
          {/if}

          <!-- Historical Context -->
          {#if $historyLoaded && lifetimeEvents.length > 0}
            <section class="card history-card">
              <h2 class="card-title">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                  <path d="M12 6v6l4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Historical Context
                <span class="count-badge">{lifetimeEvents.length}</span>
              </h2>
              
              <p class="card-subtitle">
                World events during their lifetime ({birthYear}–{deathYear || (isDeceased ? '?' : 'present')})
              </p>

              <div class="history-preview">
                {#each displayedEvents as event}
                  <div class="history-item {getOutcomeClass(event.Outcome)}">
                    <span class="history-icon">{getEventTypeIcon(event['Type of Event'])}</span>
                    <span class="history-year">{event.parsedYear}</span>
                    <span class="history-name">{event['Name of Incident']}</span>
                  </div>
                {/each}
              </div>

              {#if hasMoreEvents}
                <button class="browse-all-btn" on:click={() => showHistoryModal = true}>
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
                    <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  Browse All {lifetimeEvents.length} Events
                </button>
              {/if}
            </section>
          {/if}
        </div>
      </div>

      <!-- Footer with Delete Action - Hidden in read-only mode -->
      {#if !readOnly}
      <footer class="modal-footer">
        <button class="delete-person-btn" on:click={confirmDelete}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <polyline points="3 6 5 6 21 6" fill="none" stroke="currentColor" stroke-width="2"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
          Remove from Tree
        </button>
      </footer>
      {/if}
    </div>
  </div>

  {#if showHistoryModal}
    <HistoryModal 
      events={lifetimeEvents}
      personName={person.name}
      startYear={parseInt(birthYear)}
      endYear={deathYear ? parseInt(deathYear) : new Date().getFullYear()}
      on:close={() => showHistoryModal = false}
    />
  {/if}
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-container {
    background: var(--bg-main);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 1100px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 100px rgba(0, 0, 0, 0.6);
    animation: modalIn 0.3s ease;
    overflow: hidden;
    position: relative;
  }

  @keyframes modalIn {
    from { 
      opacity: 0;
      transform: scale(0.95) translateY(20px);
    }
    to { 
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(0, 0, 0, 0.3);
    border: none;
    color: white;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: rotate(90deg);
  }

  /* Modal Footer */
  .modal-footer {
    display: flex;
    justify-content: center;
    padding: 1rem 2rem;
    background: var(--bg-card);
    border-top: 1px solid var(--border-subtle);
  }

  .delete-person-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.25rem;
    background: transparent;
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 0.85rem;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .delete-person-btn:hover {
    background: var(--accent-copper);
    border-color: var(--accent-copper);
    color: white;
  }

  /* Delete Confirmation Dialog */
  .delete-confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10100;
    animation: fadeIn 0.2s ease;
  }

  .delete-confirm-dialog {
    background: var(--bg-main);
    border-radius: var(--radius-lg);
    padding: 2rem;
    max-width: 450px;
    width: 90%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: modalIn 0.3s ease;
    border: 2px solid var(--accent-copper);
  }

  .delete-icon {
    color: var(--accent-copper);
    margin-bottom: 1rem;
  }

  .delete-confirm-dialog h3 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--accent-copper);
    margin-bottom: 1rem;
    font-weight: 600;
  }

  .delete-confirm-dialog p {
    font-size: 0.95rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
    line-height: 1.6;
  }

  .delete-warning-main {
    font-size: 1rem;
    color: var(--text-primary);
    font-weight: 500;
    margin-bottom: 1rem;
  }

  .delete-confirm-dialog p strong {
    color: var(--text-primary);
    font-weight: 600;
  }

  .delete-confirm-dialog .warning {
    font-size: 0.9rem;
    color: var(--accent-copper);
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(196, 122, 90, 0.15);
    border: 1px solid rgba(196, 122, 90, 0.3);
    border-radius: var(--radius-sm);
    line-height: 1.6;
  }

  .delete-confirm-dialog .warning strong {
    color: var(--accent-copper);
    font-weight: 600;
  }

  .delete-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 1.5rem;
  }

  .cancel-delete-btn {
    padding: 0.6rem 1.5rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-delete-btn:hover {
    background: var(--bg-card);
    color: var(--text-primary);
  }

  .confirm-delete-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.5rem;
    background: var(--accent-copper);
    border: none;
    color: white;
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 500;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .confirm-delete-btn:hover {
    background: #d4887a;
    transform: translateY(-1px);
  }

  /* Header */
  .modal-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 2rem 2.5rem;
    background: linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-card) 100%);
    border-bottom: 1px solid var(--border-subtle);
  }

  .modal-header.male {
    background: linear-gradient(135deg, rgba(94, 122, 148, 0.2) 0%, var(--bg-card) 100%);
  }

  .modal-header.female {
    background: linear-gradient(135deg, rgba(155, 107, 138, 0.2) 0%, var(--bg-card) 100%);
  }

  .header-left {
    flex-shrink: 0;
  }

  .avatar-large {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 600;
    color: white;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  }

  .avatar-large.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .avatar-large.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .avatar-large.unknown {
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .header-center {
    flex: 1;
    min-width: 0;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .person-name {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0;
    line-height: 1.2;
  }

  .favorite-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .favorite-btn:hover {
    color: var(--accent-gold);
    transform: scale(1.1);
  }

  .favorite-btn.active {
    color: var(--accent-gold);
    animation: starPop 0.3s ease;
  }

  @keyframes starPop {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  .action-buttons {
    display: flex;
    gap: 0.25rem;
  }

  .flag-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .flag-btn:hover {
    color: var(--accent-copper);
    transform: scale(1.1);
  }

  .flag-btn.active {
    color: var(--accent-copper);
    animation: flagPop 0.3s ease;
  }

  @keyframes flagPop {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  .flagged-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(196, 122, 90, 0.15);
    border: 1px solid var(--accent-copper);
    border-radius: var(--radius-sm);
    color: var(--accent-copper);
    font-size: 0.85rem;
    margin-top: 0.5rem;
  }

  .flagged-banner svg {
    flex-shrink: 0;
  }

  .flag-reason {
    flex: 1;
    font-weight: 500;
  }

  .clear-flag {
    background: transparent;
    border: none;
    color: var(--accent-copper);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }

  .clear-flag:hover {
    opacity: 1;
  }

  /* Flag Modal */
  .flag-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10100;
    animation: fadeIn 0.2s ease;
  }

  .flag-modal-dialog {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 2rem;
    max-width: 450px;
    width: 90%;
    text-align: center;
    border: 1px solid var(--border-subtle);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  }

  .flag-icon {
    color: var(--accent-copper);
    margin-bottom: 1rem;
  }

  .flag-modal-dialog h3 {
    font-family: var(--font-display);
    font-size: 1.4rem;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .flag-modal-dialog > p {
    color: var(--text-secondary);
    margin-bottom: 1.25rem;
    font-size: 0.95rem;
  }

  .reason-input {
    text-align: left;
    margin-bottom: 1rem;
  }

  .reason-input label {
    display: block;
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 0.4rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .reason-input input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.95rem;
  }

  .reason-input input:focus {
    outline: none;
    border-color: var(--accent-copper);
  }

  .quick-reasons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .quick-reasons button {
    padding: 0.4rem 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 20px;
    color: var(--text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .quick-reasons button:hover {
    background: var(--accent-copper);
    color: white;
    border-color: var(--accent-copper);
  }

  .flag-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }

  .cancel-flag-btn {
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

  .cancel-flag-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .confirm-flag-btn {
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

  .confirm-flag-btn:hover {
    filter: brightness(1.1);
  }

  .person-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .family-stats {
    display: flex;
    gap: 1.25rem;
    margin-top: 0.25rem;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .stat-icon {
    font-size: 1rem;
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--accent-gold);
  }

  .stat-label {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .meta-tag {
    font-size: 0.85rem;
    padding: 0.3rem 0.75rem;
    background: var(--bg-elevated);
    border-radius: 20px;
    color: var(--text-secondary);
  }

  .meta-tag.dates {
    color: var(--accent-gold);
    background: rgba(212, 168, 83, 0.1);
  }

  .meta-tag.dates.unknown-death {
    color: var(--text-muted);
    background: rgba(139, 126, 111, 0.15);
    border: 1px dashed rgba(139, 126, 111, 0.3);
  }

  .meta-tag.gender.editable {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  .meta-tag.gender.editable:hover {
    background: var(--accent-gold);
    color: var(--bg-deep);
    border-color: var(--accent-gold);
  }

  .meta-tag.gender.editable .edit-icon {
    opacity: 0.5;
  }

  .meta-tag.gender.editable:hover .edit-icon {
    opacity: 1;
  }

  .gender-editor {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: var(--bg-elevated);
    padding: 0.25rem;
    border-radius: 20px;
    border: 1px solid var(--accent-gold);
  }

  .gender-option {
    padding: 0.3rem 0.6rem;
    border: none;
    border-radius: 16px;
    font-family: var(--font-body);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
    background: transparent;
    color: var(--text-secondary);
  }

  .gender-option:hover {
    background: var(--bg-card);
  }

  .gender-option.male:hover,
  .gender-option.male.selected {
    background: rgba(74, 124, 155, 0.3);
    color: #4a7c9b;
  }

  .gender-option.female:hover,
  .gender-option.female.selected {
    background: rgba(155, 107, 138, 0.3);
    color: #9b6b8a;
  }

  .gender-option.unknown:hover,
  .gender-option.unknown.selected {
    background: rgba(139, 126, 111, 0.3);
    color: var(--text-secondary);
  }

  .gender-option.selected {
    font-weight: 600;
  }

  .gender-cancel {
    padding: 0.2rem 0.5rem;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-left: 0.25rem;
  }

  .gender-cancel:hover {
    background: var(--accent-copper);
    color: white;
  }

  .header-right {
    flex-shrink: 0;
  }

  .age-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 1.25rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .age-badge.living {
    background: linear-gradient(135deg, rgba(76, 140, 92, 0.3) 0%, rgba(52, 100, 68, 0.3) 100%);
  }

  .age-number {
    font-family: var(--font-display);
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1;
  }

  .age-badge.living .age-number {
    color: #7dd39a;
  }

  .age-badge:not(.living) .age-number {
    color: var(--text-muted);
  }

  .age-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
  }

  .age-badge.deceased-unknown {
    background: rgba(139, 126, 111, 0.2);
    border: 1px dashed rgba(139, 126, 111, 0.4);
  }

  .age-badge.deceased-unknown .age-icon {
    font-size: 1.8rem;
    color: var(--text-muted);
    line-height: 1;
  }

  .age-badge.deceased-unknown .age-label {
    color: var(--text-muted);
    margin-top: 0.15rem;
  }

  /* Body */
  .modal-body {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 1.5rem;
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Cards */
  .card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    border: 1px solid var(--border-subtle);
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--accent-gold);
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .card-title svg {
    opacity: 0.8;
  }

  .card-subtitle {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  /* Immigrant Card */
  .immigrant-card {
    border-left: 3px solid var(--accent-sage);
  }

  .immigrant-toggle {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .toggle-switch {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
  }

  .toggle-switch input {
    display: none;
  }

  .toggle-slider {
    position: relative;
    width: 48px;
    height: 26px;
    background: var(--bg-elevated);
    border-radius: 13px;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .toggle-switch input:checked + .toggle-slider {
    background: var(--accent-sage);
  }

  .toggle-switch input:checked + .toggle-slider::before {
    transform: translateX(22px);
  }

  .toggle-label {
    font-size: 0.95rem;
    color: var(--text-secondary);
  }

  .toggle-switch input:checked ~ .toggle-label {
    color: var(--accent-sage);
    font-weight: 500;
  }

  .immigrant-notes {
    font-size: 0.9rem;
    color: var(--text-muted);
    padding: 0.5rem 0.75rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    margin-top: 0.25rem;
  }

  /* Notes/Biography Card */
  .notes-card .card-title {
    position: relative;
  }

  .edit-btn {
    margin-left: auto;
    background: var(--bg-elevated);
    border: none;
    color: var(--text-muted);
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .edit-btn:hover {
    background: var(--accent-gold);
    color: var(--bg-deep);
  }

  .notes-edit textarea {
    width: 100%;
    padding: 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    line-height: 1.6;
    resize: vertical;
    min-height: 120px;
  }

  .notes-edit textarea::placeholder {
    color: var(--text-muted);
  }

  .notes-edit textarea:focus {
    outline: none;
    border-color: var(--accent-gold);
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .cancel-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-family: var(--font-body);
    font-size: 0.85rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-btn:hover {
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .save-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    background: var(--accent-gold);
    border: none;
    color: var(--bg-deep);
    font-family: var(--font-body);
    font-size: 0.85rem;
    font-weight: 500;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .save-btn:hover {
    background: #e5b95f;
    transform: translateY(-1px);
  }

  .notes-content {
    background: var(--bg-elevated);
    padding: 1rem;
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--accent-gold);
  }

  .notes-content p {
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .notes-empty {
    padding: 1rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    border: 1px dashed var(--border-subtle);
  }

  .notes-empty p {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
  }

  .count-badge {
    margin-left: auto;
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    background: var(--bg-elevated);
    border-radius: 20px;
    color: var(--text-muted);
  }

  .no-data {
    color: var(--text-muted);
    font-size: 0.9rem;
    font-style: italic;
  }

  /* Edit Profile Button */
  .edit-profile-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-left: auto;
    padding: 0.4rem 0.8rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .edit-profile-btn:hover {
    background: var(--accent-gold);
    border-color: var(--accent-gold);
    color: var(--bg-deep);
  }

  /* Profile Edit Form */
  .profile-edit-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .edit-section {
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    padding: 1rem;
  }

  .edit-section h4 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.75rem 0;
  }

  .edit-row {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .edit-row:last-child {
    margin-bottom: 0;
  }

  .edit-row.location-row {
    flex-wrap: wrap;
  }

  .edit-field {
    flex: 1;
    min-width: 120px;
  }

  .edit-field label {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 0.3rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .edit-input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.9rem;
    color: var(--text-primary);
    transition: all 0.2s ease;
  }

  .edit-input:focus {
    outline: none;
    border-color: var(--accent-gold);
    box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.1);
  }

  .edit-input::placeholder {
    color: var(--text-muted);
  }

  .edit-input.full-width {
    font-size: 1.1rem;
    padding: 0.75rem;
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-subtle);
  }

  .profile-edit-form .cancel-btn {
    padding: 0.6rem 1.25rem;
    background: transparent;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.9rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .profile-edit-form .cancel-btn:hover {
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .profile-edit-form .save-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 1.25rem;
    background: var(--accent-gold);
    border: none;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--bg-deep);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .profile-edit-form .save-btn:hover {
    background: #e8c464;
    transform: translateY(-1px);
  }

  .add-data-link {
    background: none;
    border: none;
    color: var(--accent-gold);
    font-family: var(--font-body);
    font-size: inherit;
    cursor: pointer;
    text-decoration: underline;
  }

  .add-data-link:hover {
    color: #e8c464;
  }

  /* Life Events */
  .life-events {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .life-event {
    display: flex;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    border-left: 3px solid;
  }

  .life-event.birth {
    border-color: var(--accent-sage);
  }

  .life-event.death {
    border-color: var(--accent-copper);
  }

  .life-event.death.unknown-date {
    border-color: var(--text-muted);
    border-style: dashed;
    background: rgba(139, 126, 111, 0.08);
  }

  .event-date.unknown {
    color: var(--text-muted);
    font-style: italic;
  }

  .event-marker {
    font-size: 1.25rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-card);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .event-info {
    flex: 1;
    min-width: 0;
  }

  .event-label {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .event-date {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 0.2rem;
  }

  .event-place {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 0.1rem;
  }

  .event-location-details,
  .res-location-details {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.6rem;
    margin-top: 0.3rem;
    font-size: 0.8rem;
  }

  .loc-city {
    color: var(--text-primary);
    font-weight: 500;
  }

  .loc-county {
    color: var(--text-secondary);
    font-style: italic;
  }

  .loc-state {
    color: var(--accent-sage);
    font-weight: 500;
  }

  .loc-country {
    color: var(--text-muted);
    padding: 0.1rem 0.4rem;
    background: var(--bg-elevated);
    border-radius: 4px;
    font-size: 0.75rem;
  }

  /* Residences */
  .residences-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .residence-item {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0.75rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
  }

  .res-date {
    font-size: 0.8rem;
    color: var(--accent-gold);
    font-weight: 500;
  }

  .res-place {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  /* Relationship Finder */
  .compare-search {
    position: relative;
  }

  .compare-search input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
  }

  .compare-search input::placeholder {
    color: var(--text-muted);
  }

  .compare-search input:focus {
    outline: none;
    border-color: var(--accent-gold);
  }

  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    margin-top: 0.25rem;
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  }

  .search-result,
  .compare-person-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-body);
    transition: background 0.15s ease;
  }

  .search-result:hover {
    background: var(--bg-card);
  }

  .result-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .result-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .result-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .result-avatar.unknown {
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .compare-person-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .compare-person-btn {
    flex: 1;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
  }

  .compare-person-btn:hover {
    background: var(--bg-main);
  }

  .clear-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-elevated);
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .clear-btn:hover {
    background: var(--accent-copper);
    color: white;
  }

  .relation-result {
    text-align: center;
    padding: 1rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
  }

  .relation-badge {
    display: inline-block;
    background: linear-gradient(135deg, var(--accent-gold) 0%, #c49a45 100%);
    color: var(--bg-deep);
    padding: 0.5rem 1.25rem;
    border-radius: 25px;
    font-size: 1rem;
    font-weight: 600;
  }

  .relation-path {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 0.75rem;
    line-height: 1.6;
  }

  .step-relation {
    opacity: 0.7;
  }

  /* Family Card */
  .family-card {
    flex: 1;
  }

  .family-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1.25rem;
  }

  .family-column h3 {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px dashed var(--border-subtle);
  }

  .family-group {
    margin-bottom: 1rem;
  }

  .family-group:last-child {
    margin-bottom: 0;
  }

  .family-group h4 {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .family-chips {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .family-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    background: var(--bg-elevated);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    font-family: var(--font-body);
    color: var(--text-primary);
  }

  .family-chip:hover {
    border-color: var(--accent-gold);
    background: var(--bg-main);
  }

  .chip-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .family-chip.male .chip-avatar {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .family-chip.female .chip-avatar {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .family-chip.unknown .chip-avatar {
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .chip-name {
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Spouse Cards with Marriage Details */
  .spouses-group .spouse-cards {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .spouse-card {
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .spouse-card.current {
    border-left: 3px solid var(--accent-sage);
  }

  .spouse-card.divorced {
    border-left: 3px solid var(--accent-copper);
  }

  .spouse-card.widowed {
    border-left: 3px solid var(--text-muted);
  }

  .spouse-card.annulled {
    border-left: 3px solid #9b8a6b;
  }

  .spouse-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.6rem;
  }

  .spouse-info {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    flex: 1;
  }

  .spouse-info:hover .spouse-name {
    color: var(--accent-gold);
  }

  .spouse-avatar {
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
  }

  .spouse-avatar.male {
    background: linear-gradient(135deg, #5e7a94 0%, #3d5467 100%);
  }

  .spouse-avatar.female {
    background: linear-gradient(135deg, #9b6b8a 0%, #7b4a6a 100%);
  }

  .spouse-avatar.unknown {
    background: linear-gradient(135deg, #7a7a7a 0%, #5a5a5a 100%);
  }

  .spouse-details {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .spouse-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
    font-family: var(--font-body);
    transition: color 0.2s ease;
  }

  .marriage-status {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .marriage-status.current {
    color: var(--accent-sage);
  }

  .marriage-status.divorced {
    color: var(--accent-copper);
  }

  .marriage-status.widowed {
    color: var(--text-muted);
  }

  .marriage-status.annulled {
    color: #9b8a6b;
  }

  .edit-marriage-btn {
    background: none;
    border: none;
    padding: 0.4rem;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all 0.2s ease;
  }

  .edit-marriage-btn:hover {
    background: var(--bg-main);
    color: var(--accent-gold);
  }

  .marriage-details {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 0.5rem 0.75rem;
    background: rgba(0, 0, 0, 0.15);
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .marriage-order {
    background: var(--bg-main);
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .divorce-date {
    color: var(--accent-copper);
  }

  .marriage-edit-form {
    padding: 0.75rem;
    background: var(--bg-main);
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .marriage-edit-form .edit-row {
    display: flex;
    gap: 0.75rem;
  }

  .marriage-edit-form label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .marriage-edit-form label span {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .marriage-edit-form input,
  .marriage-edit-form select {
    padding: 0.4rem 0.6rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.85rem;
  }

  .marriage-edit-form input:focus,
  .marriage-edit-form select:focus {
    outline: none;
    border-color: var(--accent-gold);
  }

  .marriage-edit-form .edit-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    padding-top: 0.5rem;
  }

  .marriage-edit-form .save-btn {
    background: var(--accent-gold);
    color: var(--bg-deep);
    border: none;
    padding: 0.4rem 1rem;
    border-radius: var(--radius-sm);
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.85rem;
  }

  .marriage-edit-form .save-btn:hover {
    opacity: 0.9;
  }

  .marriage-edit-form .cancel-btn {
    background: none;
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    padding: 0.4rem 1rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.85rem;
  }

  .marriage-edit-form .cancel-btn:hover {
    border-color: var(--text-muted);
  }

  /* History Card */
  .history-preview {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--text-muted);
  }

  .history-item.positive { border-color: var(--accent-sage); }
  .history-item.negative { border-color: var(--accent-copper); }

  .history-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .history-year {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--accent-gold);
    font-size: 0.85rem;
    flex-shrink: 0;
    width: 45px;
  }

  .history-name {
    font-size: 0.85rem;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .browse-all-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.75rem;
    background: linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-main) 100%);
    border: 1px solid var(--accent-gold);
    border-radius: var(--radius-sm);
    color: var(--accent-gold);
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .browse-all-btn:hover {
    background: var(--accent-gold);
    color: var(--bg-deep);
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(212, 168, 83, 0.3);
  }

  /* Scrollbar */
  .modal-body::-webkit-scrollbar {
    width: 8px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: var(--bg-card);
  }

  .modal-body::-webkit-scrollbar-thumb {
    background: var(--border-subtle);
    border-radius: 4px;
  }

  .modal-body::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }

  /* Responsive */
  @media (max-width: 900px) {
    .modal-overlay {
      padding: 1rem;
    }

    .modal-body {
      grid-template-columns: 1fr;
    }

    .modal-header {
      flex-wrap: wrap;
      padding: 1.5rem;
    }

    .header-right {
      width: 100%;
      margin-top: 1rem;
    }

    .age-badge {
      flex-direction: row;
      gap: 0.5rem;
      justify-content: center;
    }

    .person-name {
      font-size: 1.5rem;
    }
  }

  @media (max-width: 600px) {
    .modal-overlay {
      padding: 0;
    }

    .modal-container {
      max-height: 100vh;
      border-radius: 0;
    }

    .family-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
