import { useEffect, useState } from 'react';
import { listTemplates, listSites, listUsers, listAssignments, createAssignment } from '../lib/api';
import { SurveyTemplate, Site, User } from '../lib/types';
import { Plus, ClipboardCheck } from 'lucide-react';

interface Assignment {
  id: string;
  template_id: string;
  site_id: string;
  template_name: string;
  site_name: string;
  assigned_to_name: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  submitted: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function AssignmentsPage() {
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ template_id: '', site_id: '', assigned_to: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchAssignments = () =>
    listAssignments()
      .then(r => setAssignments(r.data.data))
      .catch(console.error);

  useEffect(() => {
    Promise.all([listTemplates(), listSites(), listUsers(), fetchAssignments()])
      .then(([t, s, u]) => {
        setTemplates(t.data.data);
        setSites(s.data.data);
        setUsers(u.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAssignment(form);
      setShowModal(false);
      setForm({ template_id: '', site_id: '', assigned_to: '' });
      await fetchAssignments();
    } catch { alert('Failed to create assignment'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Survey Assignments</h1>
          <p className="text-gray-500 text-sm mt-1">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''} — Assign surveys to field surveyors</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Assignment
        </button>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-400">
          <ClipboardCheck size={40} className="mx-auto mb-3 opacity-40" />
          <p>No assignments yet.</p>
          <p className="text-sm mt-1">Create your first assignment using the button above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Site</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Template</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Assigned To</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{a.site_name}</div>
                    <div className="text-xs text-gray-400 font-mono">{a.site_id}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.template_name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.assigned_to_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ClipboardCheck size={20} className="text-brand-600" /> New Assignment
            </h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Survey Template</label>
                <select required value={form.template_id} onChange={e => setForm({ ...form, template_id: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
                <select required value={form.site_id} onChange={e => setForm({ ...form, site_id: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select site...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.site_id} — {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                <select required value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select surveyor...</option>
                  {users.filter(u => u.role === 'surveyor').map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                  {submitting ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
