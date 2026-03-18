import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';
import { Customer, Lead, LeadAssigneeSummary, LeadFollowUp } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';

interface LeadFormState {
  source: string;
  customer_id: string;
  prospect_name: string;
  prospect_phone: string;
  prospect_email: string;
  prospect_company: string;
  trip_type: string;
  from_location: string;
  to_location: string;
  travel_date: string;
  return_date: string;
  pax_count: string;
  vehicle_preference: string;
  num_vehicles: string;
  special_requirements: string;
  estimated_amount: string;
  status: string;
  assigned_to: string;
  priority: string;
  lost_reason: string;
  remarks: string;
}

interface FollowUpFormState {
  follow_up_date: string;
  next_follow_up: string;
  contact_mode: string;
  summary: string;
  quoted_amount: string;
}

const leadStatusOptions = ['new', 'contacted', 'quoted', 'negotiating', 'converted', 'lost', 'on_hold'];
const leadSourceOptions = ['walk_in', 'phone', 'email', 'whatsapp', 'website', 'referral', 'repeat_customer', 'agent', 'other'];
const priorityOptions = ['low', 'medium', 'high', 'urgent'];
const vehiclePreferenceOptions = ['', 'bus', 'mini_bus', 'van', 'car', 'truck'];
const contactModeOptions = ['phone', 'email', 'whatsapp', 'in_person'];

const initialLeadForm: LeadFormState = {
  source: 'phone',
  customer_id: '',
  prospect_name: '',
  prospect_phone: '',
  prospect_email: '',
  prospect_company: '',
  trip_type: '',
  from_location: '',
  to_location: '',
  travel_date: '',
  return_date: '',
  pax_count: '1',
  vehicle_preference: '',
  num_vehicles: '1',
  special_requirements: '',
  estimated_amount: '',
  status: 'new',
  assigned_to: '',
  priority: 'medium',
  lost_reason: '',
  remarks: '',
};

const initialFollowUpForm: FollowUpFormState = {
  follow_up_date: '',
  next_follow_up: '',
  contact_mode: 'phone',
  summary: '',
  quoted_amount: '',
};

function formatDateTimeLocalInput(value?: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function getLeadLabel(lead: Lead): string {
  return lead.customer?.name || lead.prospect_name || lead.prospect_phone;
}

export function LeadList() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [assignees, setAssignees] = useState<LeadAssigneeSummary[]>([]);
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([]);
  const [leadForm, setLeadForm] = useState<LeadFormState>(initialLeadForm);
  const [followUpForm, setFollowUpForm] = useState<FollowUpFormState>(initialFollowUpForm);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [deleteLeadTarget, setDeleteLeadTarget] = useState<Lead | null>(null);
  const [deleteFollowUpTarget, setDeleteFollowUpTarget] = useState<LeadFollowUp | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingLead, setSavingLead] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [deletingFollowUpId, setDeletingFollowUpId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const canManage = profile ? ['admin', 'manager', 'operator'].includes(profile.role) : false;
  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  async function loadLeads() {
    const leadRows = await api.get<Lead[]>('/leads');
    setLeads(leadRows);
  }

  async function loadFollowUps(leadId: string) {
    const followUpRows = await api.get<LeadFollowUp[]>(`/leads/${leadId}/follow-ups`);
    setFollowUps(followUpRows);
  }

  useEffect(() => {
    async function hydrate() {
      try {
        const [leadRows, meta] = await Promise.all([
          api.get<Lead[]>('/leads'),
          api.get<{ customers: Customer[]; assignees: LeadAssigneeSummary[] }>('/leads/meta'),
        ]);

        setLeads(leadRows);
        setCustomers(meta.customers);
        setAssignees(meta.assignees);
        setLeadForm((current) => ({
          ...current,
          assigned_to: current.assigned_to || profile?.id || '',
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load leads.');
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, [profile?.id]);

  useEffect(() => {
    if (!selectedLeadId) {
      setFollowUps([]);
      return;
    }

    void loadFollowUps(selectedLeadId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Unable to load follow-ups.');
    });
  }, [selectedLeadId]);

  function openCreate() {
    setEditingId(null);
    setLeadForm({
      ...initialLeadForm,
      assigned_to: profile?.id || '',
    });
    setIsLeadModalOpen(true);
  }

  function resetLeadForm() {
    setEditingId(null);
    setLeadForm({
      ...initialLeadForm,
      assigned_to: profile?.id || '',
    });
    setIsLeadModalOpen(false);
  }

  function startEdit(lead: Lead) {
    setEditingId(lead.id);
    setSelectedLeadId(lead.id);
    setLeadForm({
      source: lead.source,
      customer_id: lead.customer_id ?? '',
      prospect_name: lead.prospect_name ?? '',
      prospect_phone: lead.prospect_phone,
      prospect_email: lead.prospect_email ?? '',
      prospect_company: lead.prospect_company ?? '',
      trip_type: lead.trip_type,
      from_location: lead.from_location,
      to_location: lead.to_location ?? '',
      travel_date: lead.travel_date?.slice(0, 10) ?? '',
      return_date: lead.return_date?.slice(0, 10) ?? '',
      pax_count: String(lead.pax_count ?? 1),
      vehicle_preference: lead.vehicle_preference ?? '',
      num_vehicles: String(lead.num_vehicles ?? 1),
      special_requirements: lead.special_requirements ?? '',
      estimated_amount: lead.estimated_amount != null ? String(lead.estimated_amount) : '',
      status: lead.status,
      assigned_to: lead.assigned_to ?? '',
      priority: lead.priority,
      lost_reason: lead.lost_reason ?? '',
      remarks: lead.remarks ?? '',
    });
  }

  async function handleLeadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingLead(true);
    setError('');

    try {
      const payload = {
        ...leadForm,
        customer_id: leadForm.customer_id || null,
        prospect_name: leadForm.customer_id ? null : leadForm.prospect_name,
        prospect_email: leadForm.prospect_email || null,
        prospect_company: leadForm.prospect_company || null,
        to_location: leadForm.to_location || null,
        return_date: leadForm.return_date || null,
        pax_count: Number(leadForm.pax_count),
        vehicle_preference: leadForm.vehicle_preference || null,
        num_vehicles: Number(leadForm.num_vehicles || 1),
        special_requirements: leadForm.special_requirements || null,
        estimated_amount: leadForm.estimated_amount ? Number(leadForm.estimated_amount) : null,
        assigned_to: leadForm.assigned_to || null,
        lost_reason: leadForm.status === 'lost' ? leadForm.lost_reason || null : null,
        remarks: leadForm.remarks || null,
      };

      if (editingId) {
        await api.put(`/leads/${editingId}`, payload);
      } else {
        await api.post('/leads', payload);
      }

      resetLeadForm();
      await loadLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save lead.');
    } finally {
      setSavingLead(false);
    }
  }

  async function handleFollowUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeadId) {
      return;
    }

    setSavingFollowUp(true);
    setError('');

    try {
      await api.post(`/leads/${selectedLeadId}/follow-ups`, {
        follow_up_date: new Date(followUpForm.follow_up_date).toISOString(),
        next_follow_up: followUpForm.next_follow_up ? new Date(followUpForm.next_follow_up).toISOString() : null,
        contact_mode: followUpForm.contact_mode,
        summary: followUpForm.summary,
        quoted_amount: followUpForm.quoted_amount ? Number(followUpForm.quoted_amount) : null,
      });

      setFollowUpForm(initialFollowUpForm);
      await Promise.all([loadFollowUps(selectedLeadId), loadLeads()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record follow-up.');
    } finally {
      setSavingFollowUp(false);
    }
  }

  function handleDeleteLead(lead: Lead) {
    setDeleteLeadTarget(lead);
  }

  async function handleDeleteLeadConfirm() {
    if (!deleteLeadTarget) {
      return;
    }

    try {
      setDeletingLeadId(deleteLeadTarget.id);
      setError('');
      await api.delete(`/leads/${deleteLeadTarget.id}`);
      if (selectedLeadId === deleteLeadTarget.id) {
        setSelectedLeadId(null);
      }
      if (editingId === deleteLeadTarget.id) {
        resetLeadForm();
      }
      setDeleteLeadTarget(null);
      await loadLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete lead.');
    } finally {
      setDeletingLeadId(null);
    }
  }

  function handleDeleteFollowUp(followUp: LeadFollowUp) {
    setDeleteFollowUpTarget(followUp);
  }

  async function handleDeleteFollowUpConfirm() {
    if (!selectedLeadId || !deleteFollowUpTarget) {
      return;
    }

    try {
      setDeletingFollowUpId(deleteFollowUpTarget.id);
      setError('');
      await api.delete(`/leads/${selectedLeadId}/follow-ups/${deleteFollowUpTarget.id}`);
      setDeleteFollowUpTarget(null);
      await Promise.all([loadFollowUps(selectedLeadId), loadLeads()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete follow-up.');
    } finally {
      setDeletingFollowUpId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading leads...</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Leads</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Lead capture and follow-up</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Capture inquiries before they become trips. This first slice covers lead intake, assignment, status tracking, and follow-up history.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
          >
            Add Lead
          </button>
        ) : null}
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}

      <Modal
        isOpen={isLeadModalOpen}
        onClose={savingLead ? () => undefined : resetLeadForm}
        title={editingId ? 'Edit Lead' : 'Add Lead'}
        size="xl"
        closeOnBackdrop={!savingLead}
        closeOnEsc={!savingLead}
      >
        <form onSubmit={handleLeadSubmit} className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm font-semibold text-slate-800">
            Lead Source
            <select value={leadForm.source} onChange={(event) => setLeadForm((current) => ({ ...current, source: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              {leadSourceOptions.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Existing Customer
            <select value={leadForm.customer_id} onChange={(event) => setLeadForm((current) => ({ ...current, customer_id: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              <option value="">New prospect / not in master yet</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_code} - {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Prospect Name
            <input value={leadForm.prospect_name} onChange={(event) => setLeadForm((current) => ({ ...current, prospect_name: event.target.value }))} placeholder="Name if this is a new lead" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" disabled={Boolean(leadForm.customer_id)} />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Phone Number
            <input value={leadForm.prospect_phone} onChange={(event) => setLeadForm((current) => ({ ...current, prospect_phone: event.target.value }))} placeholder="Primary contact number" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Email Address
            <input value={leadForm.prospect_email} onChange={(event) => setLeadForm((current) => ({ ...current, prospect_email: event.target.value }))} placeholder="Optional email for quotation" type="email" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Company Name
            <input value={leadForm.prospect_company} onChange={(event) => setLeadForm((current) => ({ ...current, prospect_company: event.target.value }))} placeholder="Organization / corporate name" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Trip Type
            <input value={leadForm.trip_type} onChange={(event) => setLeadForm((current) => ({ ...current, trip_type: event.target.value }))} placeholder="e.g. outstation, local, airport" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Travel Date
            <input type="date" value={leadForm.travel_date} onChange={(event) => setLeadForm((current) => ({ ...current, travel_date: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Return Date
            <input type="date" value={leadForm.return_date} onChange={(event) => setLeadForm((current) => ({ ...current, return_date: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            From Location
            <input value={leadForm.from_location} onChange={(event) => setLeadForm((current) => ({ ...current, from_location: event.target.value }))} placeholder="Pickup point" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            To Location
            <input value={leadForm.to_location} onChange={(event) => setLeadForm((current) => ({ ...current, to_location: event.target.value }))} placeholder="Drop / destination" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Passenger Count
            <input value={leadForm.pax_count} onChange={(event) => setLeadForm((current) => ({ ...current, pax_count: event.target.value }))} placeholder="e.g. 18" type="number" min="1" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Vehicle Preference
            <select value={leadForm.vehicle_preference} onChange={(event) => setLeadForm((current) => ({ ...current, vehicle_preference: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              <option value="">No specific preference</option>
              {vehiclePreferenceOptions.filter(Boolean).map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Number of Vehicles
            <input value={leadForm.num_vehicles} onChange={(event) => setLeadForm((current) => ({ ...current, num_vehicles: event.target.value }))} placeholder="Default 1" type="number" min="1" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Estimated Amount
            <input value={leadForm.estimated_amount} onChange={(event) => setLeadForm((current) => ({ ...current, estimated_amount: event.target.value }))} placeholder="Quote in INR, if already discussed" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Assign To
            <select value={leadForm.assigned_to} onChange={(event) => setLeadForm((current) => ({ ...current, assigned_to: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              <option value="">Unassigned</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.full_name} ({assignee.role})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Lead Status
            <select value={leadForm.status} onChange={(event) => setLeadForm((current) => ({ ...current, status: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              {leadStatusOptions.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Priority
            <select value={leadForm.priority} onChange={(event) => setLeadForm((current) => ({ ...current, priority: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
              {priorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800 lg:col-span-3">
            Special Requirements
            <textarea value={leadForm.special_requirements} onChange={(event) => setLeadForm((current) => ({ ...current, special_requirements: event.target.value }))} placeholder="AC / luggage / sleeper / stopovers / VIP guest notes" rows={3} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-800 lg:col-span-3">
            Internal Remarks
            <textarea value={leadForm.remarks} onChange={(event) => setLeadForm((current) => ({ ...current, remarks: event.target.value }))} placeholder="Negotiation notes, route assumptions, booking context" rows={3} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
          </label>
          {leadForm.status === 'lost' ? (
            <label className="text-sm font-semibold text-slate-800 lg:col-span-3">
              Lost Reason
              <textarea value={leadForm.lost_reason} onChange={(event) => setLeadForm((current) => ({ ...current, lost_reason: event.target.value }))} placeholder="Why this lead was lost" rows={3} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
            </label>
          ) : null}
          <div className="lg:col-span-3 flex justify-end gap-3 pt-2">
            <button type="button" onClick={resetLeadForm} disabled={savingLead} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={savingLead} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">
              {savingLead ? 'Saving...' : editingId ? 'Update Lead' : 'Add Lead'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {leads.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              No leads yet. Start by capturing the first inquiry.
            </div>
          ) : null}
          {leads.map((lead) => {
            const isSelected = lead.id === selectedLeadId;

            return (
              <article key={lead.id} className={`rounded-3xl border p-5 shadow-sm transition ${isSelected ? 'border-sky-300 bg-sky-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{lead.lead_number}</p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {lead.status.replaceAll('_', ' ')}
                      </span>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        {lead.priority}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900">{getLeadLabel(lead)}</h3>
                    <p className="text-sm text-slate-600">
                      {lead.trip_type} | {lead.from_location}{lead.to_location ? ` -> ${lead.to_location}` : ''} | Travel {formatDate(lead.travel_date)}
                    </p>
                    <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p><span className="font-semibold text-slate-800">Phone:</span> {lead.prospect_phone}</p>
                      <p><span className="font-semibold text-slate-800">Source:</span> {lead.source.replaceAll('_', ' ')}</p>
                      <p><span className="font-semibold text-slate-800">PAX:</span> {lead.pax_count}</p>
                      <p><span className="font-semibold text-slate-800">Vehicles:</span> {lead.num_vehicles}</p>
                      <p><span className="font-semibold text-slate-800">Assigned:</span> {lead.assigned_user?.full_name ?? 'Unassigned'}</p>
                      <p><span className="font-semibold text-slate-800">Estimate:</span> {lead.estimated_amount != null ? formatCurrency(lead.estimated_amount) : '-'}</p>
                    </div>
                    {lead.next_follow_up ? (
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-800">Next follow-up:</span> {formatDate(lead.next_follow_up)}
                      </p>
                    ) : null}
                    {lead.last_follow_up_summary ? (
                      <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <span className="font-semibold text-slate-800">Last note:</span> {lead.last_follow_up_summary}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedLeadId(lead.id)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {isSelected ? 'Selected' : 'Follow-ups'}
                    </button>
                    {canManage ? (
                      <button type="button" onClick={() => startEdit(lead)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                        Edit
                      </button>
                    ) : null}
                    {canManage ? (
                      <button type="button" onClick={() => void handleDeleteLead(lead)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Follow-ups</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">
              {selectedLead ? `Lead ${selectedLead.lead_number}` : 'Select a lead'}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {selectedLead ? `Track every call, quote, and next action for ${getLeadLabel(selectedLead)}.` : 'Choose a lead from the list to see and record follow-up history.'}
            </p>
          </div>

          {selectedLead && canManage ? (
            <form onSubmit={handleFollowUpSubmit} className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <label className="text-sm font-semibold text-slate-800">
                Follow-up Date & Time
                <input type="datetime-local" value={followUpForm.follow_up_date} onChange={(event) => setFollowUpForm((current) => ({ ...current, follow_up_date: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Next Follow-up
                <input type="datetime-local" value={followUpForm.next_follow_up} onChange={(event) => setFollowUpForm((current) => ({ ...current, next_follow_up: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Contact Mode
                <select value={followUpForm.contact_mode} onChange={(event) => setFollowUpForm((current) => ({ ...current, contact_mode: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal">
                  {contactModeOptions.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Quoted Amount
                <input value={followUpForm.quoted_amount} onChange={(event) => setFollowUpForm((current) => ({ ...current, quoted_amount: event.target.value }))} placeholder="Optional quotation discussed in this follow-up" type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" />
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Summary
                <textarea value={followUpForm.summary} onChange={(event) => setFollowUpForm((current) => ({ ...current, summary: event.target.value }))} placeholder="What was discussed and what happens next" rows={4} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required />
              </label>
              <button type="submit" disabled={savingFollowUp} className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60">
                {savingFollowUp ? 'Saving...' : 'Record Follow-up'}
              </button>
            </form>
          ) : null}

          {selectedLead ? (
            <div className="space-y-3">
              {followUps.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  No follow-ups recorded yet for this lead.
                </div>
              ) : null}
              {followUps.map((followUp) => (
                <article key={followUp.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{formatDate(followUp.follow_up_date)}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{followUp.contact_mode.replaceAll('_', ' ')}</p>
                    </div>
                    {canManage ? (
                      <button type="button" onClick={() => void handleDeleteFollowUp(followUp)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">
                        Delete
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{followUp.summary}</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <p><span className="font-semibold text-slate-800">Quoted amount:</span> {followUp.quoted_amount != null ? formatCurrency(followUp.quoted_amount) : '-'}</p>
                    <p><span className="font-semibold text-slate-800">Next follow-up:</span> {followUp.next_follow_up ? formatDate(followUp.next_follow_up) : '-'}</p>
                    <p><span className="font-semibold text-slate-800">Recorded by:</span> {followUp.created_by_user?.full_name ?? 'System'}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteLeadTarget !== null}
        onClose={() => setDeleteLeadTarget(null)}
        onConfirm={handleDeleteLeadConfirm}
        title="Delete Lead"
        message={deleteLeadTarget ? `Delete lead ${deleteLeadTarget.lead_number}?` : ''}
        confirmLabel="Delete"
        loading={deleteLeadTarget ? deletingLeadId === deleteLeadTarget.id : false}
      />

      <ConfirmModal
        isOpen={deleteFollowUpTarget !== null}
        onClose={() => setDeleteFollowUpTarget(null)}
        onConfirm={handleDeleteFollowUpConfirm}
        title="Delete Follow-up"
        message="Delete this follow-up entry?"
        confirmLabel="Delete"
        loading={deleteFollowUpTarget ? deletingFollowUpId === deleteFollowUpTarget.id : false}
      />
    </section>
  );
}









