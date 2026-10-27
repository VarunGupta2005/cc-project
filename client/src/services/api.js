// Default API URL points to the Nginx Load Balancer on port 80 (or localhost:5000 in dev)
export const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost';

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function registerUser(payload) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export function saveSession(token, user, org) {
  localStorage.setItem('rg_token', token);
  localStorage.setItem('rg_user', JSON.stringify(user));
  localStorage.setItem('rg_org', JSON.stringify(org || {}));
}

export function getStoredSession() {
  const token = localStorage.getItem('rg_token');
  const user = localStorage.getItem('rg_user');
  const org = localStorage.getItem('rg_org');
  if (!token || !user) return null;
  try {
    return {
      token,
      user: JSON.parse(user),
      org: org ? JSON.parse(org) : null,
    };
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('rg_token');
  localStorage.removeItem('rg_user');
  localStorage.removeItem('rg_org');
}

export async function fetchNearbyListings(lat = 12.9716, lng = 77.5946, radius = 15) {
  const res = await fetch(`${API_BASE}/api/listings/nearby?lat=${lat}&lng=${lng}&radius_km=${radius}`);
  if (!res.ok) throw new Error('Failed to fetch nearby listings');
  return await res.json();
}

export async function fetchAllListings(customToken) {
  const token = customToken || localStorage.getItem('rg_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/listings`, { headers });
  if (!res.ok) throw new Error('Failed to fetch all listings');
  return await res.json();
}

export async function createFoodListing(data, customToken) {
  const token = customToken || localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/listings`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create listing');
  }
  return await res.json();
}

export async function claimFoodListing(listingId, shelterId, customToken) {
  const token = customToken || localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/listings/${listingId}/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ shelter_id: shelterId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to claim batch');
  }
  return data;
}

export async function verifyPickup(listingId, verificationCode, customToken) {
  const token = customToken || localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/deliveries/verify-pickup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ listing_id: listingId, verification_code: verificationCode }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Pickup verification failed');
  }
  return data;
}

export async function confirmDelivery(listingId, notes = 'Verified handover at shelter', customToken) {
  const token = customToken || localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/deliveries/confirm-delivery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ listing_id: listingId, notes }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Delivery confirmation failed');
  }
  return data;
}

export async function fetchShelters() {
  const res = await fetch(`${API_BASE}/api/shelters`);
  if (!res.ok) throw new Error('Failed to fetch shelters');
  return await res.json();
}

export async function fetchAudits() {
  const res = await fetch(`${API_BASE}/api/deliveries/audits`);
  if (!res.ok) throw new Error('Failed to fetch audits');
  return await res.json();
}

export async function fetchListingRecommendations(listingId, customToken) {
  const token = customToken || localStorage.getItem('rg_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/listings/${listingId}/recommendations`, { headers });
  if (!res.ok) throw new Error('Failed to fetch recommendations');
  return await res.json();
}

export async function fetchRecipientRequests(orgId) {
  const url = orgId ? `${API_BASE}/api/requests?org_id=${orgId}` : `${API_BASE}/api/requests`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch recipient requests');
  return await res.json();
}

export async function createRecipientRequest(data, customToken) {
  const token = customToken || localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const resData = await res.json();
  if (!res.ok) throw new Error(resData.error || 'Failed to post requirement');
  return resData;
}

export async function cancelRecipientRequest(requestId, customToken) {
  const token = customToken || localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/requests/${requestId}`, {
    method: 'DELETE',
    headers,
  });
  const resData = await res.json();
  if (!res.ok) throw new Error(resData.error || 'Failed to cancel requirement');
  return resData;
}
