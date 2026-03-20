import { FormEvent, useState } from 'react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { TripExpense } from '../../lib/types';
import { ConfirmModal } from '../Layout/ConfirmModal';
import { Modal } from '../Layout/Modal';

interface DutySlipExpensesTabProps {
  tripId: string;
  expenses: TripExpense[];
  canManage: boolean;
  onRefresh: () => Promise<void>;
}

interface ExpenseFormState {
  expense_type: string;
  amount: string;
  description: string;
  receipt_number: string;
  is_billable_to_hirer: boolean;
}

const initialExpenseForm: ExpenseFormState = {
  expense_type: 'fuel',
  amount: '',
  description: '',
  receipt_number: '',
  is_billable_to_hirer: false,
};

export function DutySlipExpensesTab({ tripId, expenses, canManage, onRefresh }: DutySlipExpensesTabProps) {
  const [formState, setFormState] = useState<ExpenseFormState>(initialExpenseForm);
  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TripExpense | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  function openCreate() {
    setEditingExpense(null);
    setFormState(initialExpenseForm);
    setIsModalOpen(true);
  }

  function startEdit(expense: TripExpense) {
    setEditingExpense(expense);
    setFormState({
      expense_type: expense.expense_type,
      amount: String(expense.amount),
      description: expense.description ?? '',
      receipt_number: expense.receipt_number ?? '',
      is_billable_to_hirer: expense.is_billable_to_hirer,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setEditingExpense(null);
    setFormState(initialExpenseForm);
    setIsModalOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        expense_type: formState.expense_type,
        amount: Number(formState.amount),
        description: formState.description || null,
        receipt_number: formState.receipt_number || null,
        is_billable_to_hirer: formState.is_billable_to_hirer,
      };

      if (editingExpense) {
        await api.put(`/trips/${tripId}/expenses/${editingExpense.id}`, payload);
      } else {
        await api.post(`/trips/${tripId}/expenses`, payload);
      }

      await onRefresh();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save trip expense.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setError('');
    try {
      await api.delete(`/trips/${tripId}/expenses/${deleteTarget.id}`);
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete trip expense.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-4">
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Expenses</p>
          <h4 className="mt-2 text-xl font-semibold text-slate-900">Trip expenses</h4>
        </div>
        {canManage ? <button type="button" onClick={openCreate} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">Add Expense</button> : null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Billable</th>
              {canManage ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td className="px-4 py-3">{expense.expense_type}</td>
                <td className="px-4 py-3">{formatCurrency(expense.amount)}</td>
                <td className="px-4 py-3">{expense.receipt_number ?? '-'}</td>
                <td className="px-4 py-3">{expense.description ?? '-'}</td>
                <td className="px-4 py-3">{expense.is_billable_to_hirer ? 'Yes' : 'No'}</td>
                {canManage ? <td className="px-4 py-3"><button type="button" onClick={() => startEdit(expense)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">Edit</button><button type="button" onClick={() => setDeleteTarget(expense)} className="ml-2 rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">Delete</button></td> : null}
              </tr>
            ))}
            {expenses.length === 0 ? <tr><td colSpan={canManage ? 6 : 5} className="px-4 py-6 text-center text-slate-500">No expenses recorded for this trip.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={saving ? () => undefined : closeModal} title={editingExpense ? 'Edit Expense' : 'Add Expense'} size="md" closeOnBackdrop={!saving} closeOnEsc={!saving}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="text-sm font-semibold text-slate-800">Expense Type<select value={formState.expense_type} onChange={(event) => setFormState((current) => ({ ...current, expense_type: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal"><option value="fuel">Fuel expense</option><option value="toll">Toll expense</option><option value="parking">Parking expense</option><option value="food">Food expense</option><option value="other">Other expense</option></select></label>
          <label className="text-sm font-semibold text-slate-800">Expense Amount<input value={formState.amount} onChange={(event) => setFormState((current) => ({ ...current, amount: event.target.value }))} type="number" min="0" className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" required /></label>
          <label className="text-sm font-semibold text-slate-800">Receipt Reference<input value={formState.receipt_number} onChange={(event) => setFormState((current) => ({ ...current, receipt_number: event.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="text-sm font-semibold text-slate-800">Description<textarea value={formState.description} onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-normal" /></label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={formState.is_billable_to_hirer} onChange={(event) => setFormState((current) => ({ ...current, is_billable_to_hirer: event.target.checked }))} />Billable to Hirer</label>
          <div className="flex justify-end gap-3"><button type="button" onClick={closeModal} disabled={saving} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-60">Cancel</button><button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60">{saving ? 'Saving...' : editingExpense ? 'Update' : 'Add'}</button></div>
        </form>
      </Modal>

      <ConfirmModal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} title="Delete Expense" message={deleteTarget ? `Delete ${deleteTarget.expense_type} expense?` : ''} confirmLabel="Delete" loading={deleting} />
    </section>
  );
}
