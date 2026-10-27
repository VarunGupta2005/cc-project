import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, Utensils } from 'lucide-react';
import LiveMap from '../components/LiveMap';
import { fetchAudits, fetchRecipientRequests } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export default function MasterMapPage() {
  const [audits, setAudits] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [auditData, reqData] = await Promise.all([
        fetchAudits(),
        fetchRecipientRequests().catch(() => ({ requests: [] })),
      ]);
      setAudits(auditData.audits || []);
      setRequests(reqData.requests || []);
    } catch (err) {
      console.error('[MasterMapPage Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="page-container" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Live Map Card */}
      <LiveMap />

      {/* Active Recipient Demand Table */}
      <Card style={{ marginBottom: '1.25rem' }}>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--accent)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Utensils size={18} />
              </div>
              <div>
                <CardTitle>Active Recipient Demand (Structured Food Requirements)</CardTitle>
                <CardDescription>
                  Real-time headcount needs recorded by verified shelters. The matching algorithm ensures donations fulfill genuine demand.
                </CardDescription>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw size={13} />
              <span>Refresh</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {requests.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', padding: '0.5rem 0' }}>
              No active recipient requests recorded.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted-foreground)' }}>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Recipient Shelter</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Quantity Needed</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Food Category</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Dietary Compliance</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Available Capacity</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Need-By Deadline</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {r.org_name}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {r.quantity_kg} kg
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--muted-foreground)' }}>
                        {r.category.replace('_', ' ')}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <Badge variant="outline">{r.dietary_type}</Badge>
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--muted-foreground)' }}>
                        {r.available_capacity_kg || 50} kg
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--muted-foreground)' }}>
                        {new Date(r.needed_by).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <Badge variant="warning">{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Immutable PostgreSQL Audit Trail Table */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--accent)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <FileText size={18} />
              </div>
              <div>
                <CardTitle>PostgreSQL Handover Ledger</CardTitle>
                <CardDescription>
                  ACID compliance audit trail tracking chain of custody, cryptographic OTP tokens, and timestamps.
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
            >
              <RefreshCw size={13} />
              <span>Refresh Ledger</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', padding: '1rem 0' }}>
              Loading audit logs from PostgreSQL...
            </p>
          ) : audits.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', padding: '1rem 0' }}>
              No completed delivery audits yet. Complete a handover to write to the ledger.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted-foreground)' }}>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Audit ID</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Food Batch</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Quantity</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Donor Org</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Recipient Shelter</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>OTP Token</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>
                        {a.id.substring(0, 8)}...
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {a.food_type}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {a.quantity_kg} kg
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--muted-foreground)' }}>
                        {a.donor_name || 'Grand Palace'}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--muted-foreground)' }}>
                        {a.shelter_name || 'Hope Haven'}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <Badge variant="secondary" style={{ fontFamily: 'monospace' }}>
                          {a.verification_token ? `OTP: ${a.verification_token}` : 'Verified'}
                        </Badge>
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', color: 'var(--muted-foreground)' }}>
                        {new Date(a.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
