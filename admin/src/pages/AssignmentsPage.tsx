import { useEffect, useState } from 'react';
import { listTemplates, listSites, listUsers, createAssignment } from '../lib/api';
import { SurveyTemplate, Site, User } from '../lib/types';
import { Plus, ClipboardCheck } from 'lucide-react';

export default function AssignmentsPage() {
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ template_id: '', site_id: '', assigned_to: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([listTemplates(), listSites(), listUsers()])
      .then(([t, s, u]) => {
        setTemplates(t.data.data);
        setSites(s.data.data);
        setUsers(u.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAssignment(form);
      setShowModal(false);
      setForm({ template_id: '', site_id: '', assigned_to: '' });
      alert('Assignment created!');
    } catch { alert('Failed to create assignment'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Survey Assignments</h1>
          <p className="text-gray-500 text-sm mt-1">Assign surveys to field surveyors</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Assignment
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-400">
        <ClipboardCheck size={40} className="mx-auto mb-3 opacity-40" />
        <p>Assignments are managed from the database.</p>
        <p className="text-sm mt-1">Use the form above to create new survey assignments for field surveyors.</p>
      </div>

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
