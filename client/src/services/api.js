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

export async function claimFoodListing(listingId, shelterId, customToken, claimKg = null) {
  const token = customToken || localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const bodyPayload = { shelter_id: shelterId };
  if (claimKg !== null && claimKg !== undefined && claimKg !== '') {
    bodyPayload.claim_kg = parseFloat(claimKg);
  }

  const res = await fetch(`${API_BASE}/api/listings/${listingId}/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to claim batch');
  }
  return data;
}

export async function cancelClaimFoodListing(listingId, shelterId, customToken) {
  const token = customToken || localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/listings/${listingId}/cancel-claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ shelter_id: shelterId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to cancel claim');
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

// =============================================================
// PHASE 7: RIDER DISPATCH & ORGANIZATION MANAGEMENT APIS
// =============================================================

export async function fetchShelterRiders() {
  const token = localStorage.getItem('rg_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/riders/shelter-riders`, { headers });
  if (!res.ok) throw new Error('Failed to fetch organization riders');
  return await res.json();
}

export async function registerShelterRider(riderData) {
  const token = localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/riders/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify(riderData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to register rider');
  return data;
}

export async function assignRiderToAllocation(allocationId, riderId, notes) {
  const token = localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/riders/assign`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ allocation_id: allocationId, rider_id: riderId, notes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to assign rider');
  return data;
}

export async function cancelRiderAssignment(assignmentId, reason) {
  const token = localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/riders/assignments/${assignmentId}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to cancel assignment');
  return data;
}

export async function fetchRiderTasks() {
  const token = localStorage.getItem('rg_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/riders/my-tasks`, { headers });
  if (!res.ok) throw new Error('Failed to fetch assigned rider tasks');
  return await res.json();
}

export async function acceptRiderTask(assignmentId) {
  const token = localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/riders/tasks/${assignmentId}/accept`, {
    method: 'POST',
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to accept task');
  return data;
}

export async function updateRiderAvailability(isAvailable) {
  const token = localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/riders/availability`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ is_available: isAvailable }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update rider availability');
  return data;
}

export async function updateOrganizationProfile(orgId, updateData) {
  const token = localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/auth/organizations/${orgId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updateData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update organization profile');
  return data;
}

// =============================================================
// PLATFORM ADMIN PORTAL APIS
// =============================================================

export async function fetchAdminOverview() {
  const token = localStorage.getItem('rg_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/admin/overview`, { headers });
  if (!res.ok) throw new Error('Failed to load admin overview metrics');
  return await res.json();
}

export async function fetchAdminOrganizations(status) {
  const token = localStorage.getItem('rg_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = status ? `${API_BASE}/api/admin/organizations?status=${status}` : `${API_BASE}/api/admin/organizations`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to load organizations queue');
  return await res.json();
}

export async function verifyAdminOrganization(orgId, status) {
  const token = localStorage.getItem('rg_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/admin/organizations/${orgId}/verify`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update organization status');
  return data;
}

export async function fetchAdminDispatchMap() {
  const token = localStorage.getItem('rg_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/admin/dispatch-map`, { headers });
  if (!res.ok) throw new Error('Failed to fetch admin dispatch map data');
  return await res.json();
}

export async function fetchAdminAudits() {
  const token = localStorage.getItem('rg_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/admin/audits`, { headers });
  if (!res.ok) throw new Error('Failed to fetch admin compliance ledger');
  return await res.json();
}
