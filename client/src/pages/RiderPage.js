import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Clock,
  Phone,
  Navigation,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  XCircle,
  Copy,
  Check,
} from 'lucide-react';
import { fetchRiderTasks, acceptRiderTask, cancelRiderAssignment, updateRiderAvailability } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

export default function RiderPage({ session }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [copiedOtp, setCopiedOtp] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await fetchRiderTasks();
      setTasks(data.tasks || []);
      if (data.is_available !== undefined) {
        setIsAvailable(data.is_available);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load assigned rider tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 15000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const handleAccept = async (assignmentId) => {
    try {
      setActionLoading(true);
      await acceptRiderTask(assignmentId);
      await loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to accept task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async (assignmentId) => {
    const reason = window.prompt('Please enter reason for declining/releasing this task (e.g. flat tire, shift end):');
    if (!reason) return;
    try {
      setActionLoading(true);
      await cancelRiderAssignment(assignmentId, reason);
      await loadTasks();
    } catch (err) {
      alert(err.message || 'Failed to cancel assignment');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedOtp(id);
    setTimeout(() => setCopiedOtp(null), 2000);
  };

  const handleToggleAvailability = async () => {
    try {
      setTogglingAvailability(true);
      const newStatus = !isAvailable;
      await updateRiderAvailability(newStatus);
      setIsAvailable(newStatus);
    } catch (err) {
      alert(err.message || 'Failed to update availability status');
    } finally {
      setTogglingAvailability(false);
    }
  };

  const activeTasks = tasks.filter((t) => t.assignment_status !== 'COMPLETED' && t.assignment_status !== 'CANCELLED');
  const completedTasks = tasks.filter((t) => t.assignment_status === 'COMPLETED');

  return (
    <div className="page-container" style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Rider Header & Status Banner */}
      <Card style={{ marginBottom: '1.25rem' }}>
        <CardContent style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--secondary)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--foreground)',
              }}>
                <Truck size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--foreground)' }}>
                    Rider Dispatch Terminal
                  </h2>
                  {isAvailable ? (
                    <Badge variant="success" style={{ gap: '0.35rem' }}>
                      <CheckCircle2 size={11} />
                      <span>On Duty</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', gap: '0.35rem' }}>
                      <XCircle size={11} />
                      <span>Off Duty / Unavailable</span>
                    </Badge>
                  )}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                  Carrier: <b>{session?.user?.full_name}</b> &bull; Assigned to: <b>{session?.org?.name || 'Hope Haven Shelter'}</b>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Button
                variant={isAvailable ? 'outline' : 'default'}
                size="sm"
                onClick={handleToggleAvailability}
                disabled={togglingAvailability}
                style={{
                  fontSize: '0.8rem',
                  gap: '0.4rem',
                  backgroundColor: !isAvailable ? '#16a34a' : undefined,
                  color: !isAvailable ? '#ffffff' : undefined,
                  borderColor: isAvailable ? 'rgba(239, 68, 68, 0.4)' : undefined,
                }}
              >
                {isAvailable ? (
                  <>
                    <XCircle size={13} style={{ color: '#f87171' }} />
                    <span style={{ color: '#f87171' }}>{togglingAvailability ? 'Updating...' : 'Mark Unavailable (Go Off Duty)'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>{togglingAvailability ? 'Updating...' : 'Mark Available (Go On Duty)'}</span>
                  </>
                )}
              </Button>

              <Button variant="outline" size="sm" onClick={loadTasks} disabled={loading}>
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Refresh Tasks</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isAvailable && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 'var(--radius)',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          marginBottom: '1.25rem',
          fontSize: '0.825rem',
          color: '#f87171',
        }}>
          <XCircle size={16} />
          <span>You are currently <b>Off Duty / Unavailable</b>. Shelter dispatchers cannot assign new pickup missions to you until you toggle back to On Duty.</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert-box alert-box--error">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Segmented Task Lists */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <TabsList>
            <TabsTrigger value="active">
              <Truck size={14} />
              <span>Active Missions</span>
              {activeTasks.length > 0 && (
                <Badge variant="info" style={{ marginLeft: '0.35rem', fontSize: '0.65rem' }}>
                  {activeTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">
              <CheckCircle2 size={14} />
              <span>Completed Deliveries</span>
              {completedTasks.length > 0 && (
                <Badge variant="secondary" style={{ marginLeft: '0.35rem', fontSize: '0.65rem' }}>
                  {completedTasks.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ACTIVE MISSIONS TAB */}
        <TabsContent value="active">
          {loading && tasks.length === 0 ? (
            <Card>
              <CardContent style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                Loading assigned courier dispatches...
              </CardContent>
            </Card>
          ) : activeTasks.length === 0 ? (
            <Card>
              <CardContent style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                <Truck size={36} color="var(--muted-foreground)" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  No Active Pickup Tasks Assigned
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: '0.25rem', maxWidth: '420px', margin: '0.25rem auto 0 auto' }}>
                  When your shelter claims surplus food batches, the dispatcher will assign delivery tasks to you here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeTasks.map((task) => {
                const isAssigned = task.assignment_status === 'ASSIGNED';
                const isAccepted = task.assignment_status === 'ACCEPTED';
                const isPickedUp = task.assignment_status === 'PICKED_UP';

                const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${task.pickup_lat},${task.pickup_lng}`;

                return (
                  <Card key={task.assignment_id} style={{ borderColor: isPickedUp ? 'var(--primary)' : 'var(--border)' }}>
                    <CardHeader style={{ paddingBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CardTitle style={{ fontSize: '1.1rem' }}>{task.food_type}</CardTitle>
                            <Badge variant="outline">{task.category || 'COOKED_MEAL'}</Badge>
                            {task.dietary_type && <Badge variant="secondary">{task.dietary_type}</Badge>}
                          </div>
                          <CardDescription style={{ marginTop: '0.25rem' }}>
                            Allocation: <b>{task.allocated_kg} kg</b> &bull; Storage: <b>{task.storage_condition || 'AMBIENT'}</b>
                          </CardDescription>
                        </div>

                        <div>
                          {isAssigned && (
                            <Badge variant="warning" style={{ fontSize: '0.75rem' }}>
                              ⚡ Awaiting Your Acceptance
                            </Badge>
                          )}
                          {isAccepted && (
                            <Badge variant="info" style={{ fontSize: '0.75rem' }}>
                              🚗 Accepted &bull; En Route to Pickup
                            </Badge>
                          )}
                          {isPickedUp && (
                            <Badge variant="success" style={{ fontSize: '0.75rem' }}>
                              📦 In Transit to Shelter
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      {/* Physical Location & Contact Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '0.75rem',
                        backgroundColor: 'var(--secondary)',
                        padding: '1rem',
                        borderRadius: 'var(--radius)',
                        marginBottom: '1rem',
                        border: '1px solid var(--border)',
                      }}>
                        {/* Donor Pickup Dock */}
                        <div>
                          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--muted-foreground)', fontWeight: 700, marginBottom: '0.25rem' }}>
                            1. Pickup Dock (Commercial Kitchen)
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>
                            {task.pickup_address}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                            Contact: <b>{task.donor_name || 'Kitchen Manager'}</b>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            {task.donor_phone && (
                              <a
                                href={`tel:${task.donor_phone}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  fontSize: '0.75rem',
                                  color: 'var(--foreground)',
                                  backgroundColor: 'var(--card)',
                                  padding: '0.25rem 0.6rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border)',
                                  textDecoration: 'none',
                                }}
                              >
                                <Phone size={12} />
                                <span>{task.donor_phone}</span>
                              </a>
                            )}
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.75rem',
                                color: 'var(--primary-foreground)',
                                backgroundColor: 'var(--primary)',
                                padding: '0.25rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                textDecoration: 'none',
                                fontWeight: 600,
                              }}
                            >
                              <Navigation size={12} />
                              <span>Open GPS Route</span>
                            </a>
                          </div>
                        </div>

                        {/* Recipient Shelter Destination */}
                        <div>
                          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--muted-foreground)', fontWeight: 700, marginBottom: '0.25rem' }}>
                            2. Destination (Your Shelter)
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>
                            {task.shelter_name || 'Hope Haven Shelter'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                            Delivery destination for intake and weighing
                          </div>

                          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                            <Clock size={12} />
                            <span>Must pick up before: <b>{new Date(task.pickup_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></span>
                          </div>
                        </div>
                      </div>

                      {/* PHYSICAL HANDOVER OTP PASS CARD (Visible to Assigned Rider) */}
                      {!isPickedUp ? (
                        <div className="otp-pass-card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Authorized Pickup Verification Pass
                          </div>
                          <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                            Present this 6-digit verification code to the kitchen staff at pickup:
                          </p>

                          <div className="otp-digit-display" style={{ margin: '0.65rem 0' }}>
                            {task.pickup_otp || '••••••'}
                          </div>

                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(task.pickup_otp, task.assignment_id)}
                            >
                              {copiedOtp === task.assignment_id ? <Check size={13} color="#22c55e" /> : <Copy size={13} />}
                              <span>{copiedOtp === task.assignment_id ? 'Copied' : 'Copy Code'}</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="alert-box alert-box--success" style={{ marginBottom: '1rem' }}>
                          <CheckCircle2 size={16} />
                          <span>
                            <b>Pickup Handover Verified by Donor!</b> Food is safely loaded in your vehicle. Drive to {task.shelter_name}. Shelter intake staff will verify receipt.
                          </span>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                          Task ID: <code style={{ color: 'var(--foreground)' }}>{task.assignment_id.substring(0, 8)}</code>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {isAssigned && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDecline(task.assignment_id)}
                                disabled={actionLoading}
                                style={{ color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)' }}
                              >
                                <XCircle size={13} />
                                <span>Decline Task</span>
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => handleAccept(task.assignment_id)}
                                disabled={actionLoading}
                              >
                                <Check size={13} />
                                <span>Accept Mission</span>
                              </Button>
                            </>
                          )}

                          {isAccepted && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDecline(task.assignment_id)}
                              disabled={actionLoading}
                              style={{ color: 'var(--destructive-text)', borderColor: 'var(--destructive-border)' }}
                            >
                              <XCircle size={13} />
                              <span>Release Task (Emergency)</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* COMPLETED MISSIONS HISTORY */}
        <TabsContent value="history">
          {completedTasks.length === 0 ? (
            <Card>
              <CardContent style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                No completed delivery dispatches recorded yet.
              </CardContent>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {completedTasks.map((t) => (
                <Card key={t.assignment_id}>
                  <CardContent style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--foreground)' }}>
                        {t.food_type} ({t.allocated_kg} kg)
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                        From <b>{t.pickup_address}</b> to <b>{t.shelter_name}</b>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                        Completed: {t.completed_at ? new Date(t.completed_at).toLocaleString() : 'Verified'}
                      </div>
                    </div>

                    <Badge variant="success" style={{ gap: '0.35rem' }}>
                      <CheckCircle2 size={12} />
                      <span>Delivered</span>
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
