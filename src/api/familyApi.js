/**
 * API client for the Family Tree backend
 * Works with both local development and Netlify deployment
 */

// Use relative URL - works with Netlify redirects and local proxy
const API_BASE = '/api';

// Helper for handling API responses
async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// Check if the API is available
export async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout for serverless cold starts
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Get all people
export async function fetchAllPeople() {
  const response = await fetch(`${API_BASE}/people`);
  return handleResponse(response);
}

// Get a single person
export async function fetchPerson(id) {
  const response = await fetch(`${API_BASE}/people/${encodeURIComponent(id)}`);
  return handleResponse(response);
}

// Create a new person
export async function createPerson(personData) {
  const response = await fetch(`${API_BASE}/people`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(personData)
  });
  return handleResponse(response);
}

// Update a person
export async function updatePerson(id, updates) {
  const response = await fetch(`${API_BASE}/people/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  return handleResponse(response);
}

// Delete a person
export async function deletePerson(id) {
  const response = await fetch(`${API_BASE}/people/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  return handleResponse(response);
}

// Bulk delete people
export async function bulkDeletePeople(ids) {
  const response = await fetch(`${API_BASE}/people/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
  return handleResponse(response);
}

// Toggle favorite status
export async function toggleFavorite(id) {
  const response = await fetch(`${API_BASE}/people/${encodeURIComponent(id)}/favorite`, {
    method: 'POST'
  });
  return handleResponse(response);
}

// Toggle flag status
export async function toggleFlag(id, reason) {
  const response = await fetch(`${API_BASE}/people/${encodeURIComponent(id)}/flag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  return handleResponse(response);
}

// Get statistics
export async function fetchStats() {
  const response = await fetch(`${API_BASE}/stats`);
  return handleResponse(response);
}

// Toggle immigrant status
export async function toggleImmigrant(id, notes) {
  const response = await fetch(`${API_BASE}/people/${encodeURIComponent(id)}/immigrant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes })
  });
  return handleResponse(response);
}

// Get all immigrants
export async function fetchImmigrants() {
  const response = await fetch(`${API_BASE}/immigrants`);
  return handleResponse(response);
}

// Update marriage details
export async function updateMarriage(personId, familyId, marriageData) {
  const response = await fetch(
    `${API_BASE}/people/${encodeURIComponent(personId)}/marriage/${encodeURIComponent(familyId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(marriageData)
    }
  );
  return handleResponse(response);
}