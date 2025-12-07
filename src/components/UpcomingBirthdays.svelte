<script>
  import { familyData, selectedPerson } from '../stores/familyStore.js';

  // Extract month and day from birth date string or use normalized fields
  function extractMonthDay(person) {
    // Prefer normalized fields if available
    if (person.birth_month !== null && person.birth_month !== undefined && 
        person.birth_day !== null && person.birth_day !== undefined) {
      return { month: person.birth_month, day: person.birth_day };
    }
    
    // Fallback to parsing date string
    const dateStr = person.birth_date;
    if (!dateStr) return null;
    
    // Try to extract month and day from various date formats
    // Formats: "Jan 15, 1950", "1/15/1950", "15 Jan 1950", "1950-01-15", "January 15, 1950", etc.
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                        'july', 'august', 'september', 'october', 'november', 'december'];
    const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                       'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    // Try ISO format first (YYYY-MM-DD)
    let match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      return { month: parseInt(match[2]), day: parseInt(match[3]) };
    }
    
    // Try MM/DD/YYYY or M/D/YYYY
    match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      return { month: parseInt(match[1]), day: parseInt(match[2]) };
    }
    
    // Try DD/MM/YYYY (less common but possible)
    match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match && parseInt(match[1]) > 12) {
      return { month: parseInt(match[2]), day: parseInt(match[1]) };
    }
    
    // Try "Month Day, Year" or "Day Month Year"
    const lowerStr = dateStr.toLowerCase();
    for (let i = 0; i < monthNames.length; i++) {
      const monthName = monthNames[i];
      const monthAbbrName = monthAbbr[i];
      
      // "January 15, 1950" or "Jan 15, 1950"
      match = dateStr.match(new RegExp(`(${monthName}|${monthAbbrName})\\s+(\\d{1,2})`, 'i'));
      if (match) {
        return { month: i + 1, day: parseInt(match[2]) };
      }
      
      // "15 January 1950" or "15 Jan 1950"
      match = dateStr.match(new RegExp(`(\\d{1,2})\\s+(${monthName}|${monthAbbrName})`, 'i'));
      if (match) {
        return { month: i + 1, day: parseInt(match[1]) };
      }
    }
    
    // If we only have a year, return null (can't determine month/day)
    if (dateStr.match(/^\d{4}$/)) {
      return null;
    }
    
    return null;
  }

  // Calculate days until birthday
  function daysUntilBirthday(month, day) {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Create date for this year's birthday
    let birthdayThisYear = new Date(currentYear, month - 1, day);
    
    // If birthday has already passed this year, use next year
    if (birthdayThisYear < today) {
      birthdayThisYear = new Date(currentYear + 1, month - 1, day);
    }
    
    // Calculate difference in days
    const diffTime = birthdayThisYear - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  // Get upcoming birthdays
  $: upcomingBirthdays = (() => {
    const birthdays = [];
    const today = new Date();
    
    $familyData.forEach(person => {
      // Skip if person is deceased (only show birthdays for living people)
      if (person.death_date) return;
      
      // Try to get month/day from normalized fields or parse from date string
      const monthDay = extractMonthDay(person);
      if (!monthDay) return;
      
      const daysUntil = daysUntilBirthday(monthDay.month, monthDay.day);
      
      birthdays.push({
        person,
        month: monthDay.month,
        day: monthDay.day,
        daysUntil,
        dateStr: person.birth_date
      });
    });
    
    // Sort by days until birthday
    birthdays.sort((a, b) => a.daysUntil - b.daysUntil);
    
    if (birthdays.length === 0) return null;
    
    // Get the next birthday (or birthdays if multiple on same day)
    const nextDays = birthdays[0].daysUntil;
    const nextBirthdays = birthdays.filter(b => b.daysUntil === nextDays);
    
    return {
      daysUntil: nextDays,
      people: nextBirthdays,
      month: nextBirthdays[0].month,
      day: nextBirthdays[0].day
    };
  })();

  function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
  }

  function formatDaysUntil(days) {
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `In ${days} days`;
    if (days <= 30) return `In ${days} days`;
    return `In ${days} days`;
  }

  function handlePersonClick(person) {
    selectedPerson.set(person);
  }
</script>

{#if upcomingBirthdays}
  <div class="upcoming-birthdays">
    <div class="birthday-header">
      <svg viewBox="0 0 24 24" width="24" height="24" class="birthday-icon">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="none" stroke="currentColor" stroke-width="2"/>
        <circle cx="12" cy="9" r="2.5" fill="currentColor"/>
      </svg>
      <div class="birthday-info">
        <h3 class="birthday-title">Upcoming Birthday{upcomingBirthdays.people.length > 1 ? 's' : ''}</h3>
        <p class="birthday-date">
          {getMonthName(upcomingBirthdays.month)} {upcomingBirthdays.day}
          <span class="days-until"> • {formatDaysUntil(upcomingBirthdays.daysUntil)}</span>
        </p>
      </div>
    </div>
    
    <div class="birthday-people">
      {#each upcomingBirthdays.people as birthday}
        <button class="birthday-person" on:click={() => handlePersonClick(birthday.person)}>
          <div class="person-avatar" class:male={birthday.person.sex === 'M'} class:female={birthday.person.sex === 'F'}>
            {birthday.person.name?.charAt(0) || '?'}
          </div>
          <div class="person-details">
            <span class="person-name">{birthday.person.name || 'Unknown'}</span>
            {#if birthday.person.birth_date}
              {@const birthYear = birthday.person.birth_date.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/)?.[0]}
              {#if birthYear}
                <span class="person-birth-year">Born {birthYear}</span>
              {/if}
            {/if}
          </div>
          <svg viewBox="0 0 24 24" width="16" height="16" class="arrow-icon">
            <polyline points="9 18 15 12 9 6" fill="none" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .upcoming-birthdays {
    background: linear-gradient(135deg, rgba(212, 168, 83, 0.15) 0%, rgba(212, 168, 83, 0.05) 100%);
    border: 1px solid var(--accent-gold);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .birthday-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .birthday-icon {
    color: var(--accent-gold);
    flex-shrink: 0;
  }

  .birthday-info {
    flex: 1;
  }

  .birthday-title {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.25rem 0;
  }

  .birthday-date {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .days-until {
    color: var(--accent-gold);
    font-weight: 500;
  }

  .birthday-people {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .birthday-person {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .birthday-person:hover {
    background: var(--bg-main);
    border-color: var(--accent-gold);
    transform: translateX(4px);
  }

  .person-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1rem;
    flex-shrink: 0;
    background: var(--bg-main);
    color: var(--text-primary);
  }

  .person-avatar.male {
    background: rgba(94, 122, 148, 0.2);
    color: var(--accent-blue);
  }

  .person-avatar.female {
    background: rgba(155, 107, 138, 0.2);
    color: var(--accent-purple);
  }

  .person-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .person-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .person-birth-year {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .arrow-icon {
    color: var(--text-muted);
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }

  .birthday-person:hover .arrow-icon {
    transform: translateX(4px);
    color: var(--accent-gold);
  }
</style>

