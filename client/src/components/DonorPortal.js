import React, { useState } from 'react';
import { createFoodListing } from '../services/api';

export default function DonorPortal({ onListingCreated }) {
  const [foodType, setFoodType] = useState('Hot Vegetable Biryani & Curry');
  const [quantityKg, setQuantityKg] = useState('25');
  const [expiryOption, setExpiryOption] = useState('7200'); // 2 hours
  const [pickupAddress, setPickupAddress] = useState('Grand Palace Hotel, MG Road');
  const [lat, setLat] = useState('12.9716');
  const [lng, setLng] = useState('77.5946');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const data = await createFoodListing({
        donor_id: '11111111-1111-1111-1111-111111111111',
        food_type: foodType,
        quantity_kg: parseFloat(quantityKg),
        expires_in_seconds: parseInt(expiryOption),
        pickup_address: pickupAddress,
        pickup_lat: parseFloat(lat),
        pickup_lng: parseFloat(lng),
      });

      setSuccessMsg(
        `Surplus batch listed! ${data.nearby_shelters_alerted} nearby shelters alerted.`
      );
      if (onListingCreated) onListingCreated(data.listing);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">🍲 Institutional Donor Intake Portal</h2>
      <p className="card-subtitle">
        Submit prepared surplus food batches for local shelters to claim.
      </p>

      {successMsg && (
        <div style={{ backgroundColor: '#065f4622', border: '1px solid #059669', padding: '0.75rem', borderRadius: '0.375rem', color: '#34d399', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ backgroundColor: '#7f1d1d22', border: '1px solid #dc2626', padding: '0.75rem', borderRadius: '0.375rem', color: '#f87171', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Food Category & Description</label>
          <input
            className="form-input"
            type="text"
            value={foodType}
            onChange={(e) => setFoodType(e.target.value)}
            required
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Quantity (Estimated Kilograms)</label>
            <input
              className="form-input"
              type="number"
              step="0.5"
              value={quantityKg}
              onChange={(e) => setQuantityKg(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Perishability Shelf-Life (TTL)</label>
            <select
              className="form-select"
              value={expiryOption}
              onChange={(e) => setExpiryOption(e.target.value)}
            >
              <option value="15">⚡ 15 Seconds (Live Demo Auto-Expire)</option>
              <option value="3600">1 Hour (Highly Perishable)</option>
              <option value="7200">2 Hours (Standard Cooked Food)</option>
              <option value="14400">4 Hours (Bakery / Dry Items)</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Pickup Venue Address</label>
          <input
            className="form-input"
            type="text"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            required
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Pickup Latitude</label>
            <input
              className="form-input"
              type="text"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Pickup Longitude</label>
            <input
              className="form-input"
              type="text"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Transmitting to Cloud VPC...' : '🚀 Broadcast Surplus Food Listing'}
        </button>
      </form>
    </div>
  );
}
