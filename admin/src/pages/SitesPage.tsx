import { useEffect, useState } from 'react';
import { listSites, createSite, updateSite, deleteSite } from '../lib/api';
import { Site } from '../lib/types';
import { MapPin, Plus, Search, Pencil, Trash2, X } from 'lucide-react';

type SiteForm = { site_id: string; name: string; latitude: string; longitude: string; address: string };

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<SiteForm>({ site_id: '', name: '', latitude: '', longitude: '', address: '' });

  // Edit modal
  const [editing, setEditing] = useState<Site | null>(null);
  const [editForm, setEditForm] = useState<SiteForm>({ site_id: '', name: '', latitude: '', longitude: '', address: '' });

  // Delete confirmation
  const [deleting, setDeleting] = useState<Site | null>(null);

  const fetchSites = () => {
    setLoading(true);
    listSites({ search: search || undefined })
      .then(r => setSites(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSites(); }, [search]);

  // --- Add ---
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSite({ ...addForm, latitude: Number(addForm.latitude), longitude: Number(addForm.longitude) });
      setShowAdd(false);
      setAddForm({ site_id: '', name: '', latitude: '', longitude: '', address: '' });
      fetchSites();
    } catch { alert('Failed to create site'); }
  };

  // --- Edit ---
  const openEdit = (site: Site) => {
    setEditing(site);
    setEditForm({
      site_id: site.site_id,
      name: site.name,
      latitude: site.latitude?.toString() ?? '',
      longitude: site.longitude?.toString() ?? '',
      address: site.address ?? '',
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await updateSite(editing.id, {
        ...editForm,
        latitude: editForm.latitude ? Number(editForm.latitude) : null,
        longitude: editForm.longitude ? Number(editForm.longitude) : null,
      });
      setEditing(null);
      fetchSites();
    } catch { alert('Failed to update site'); }
  };

  // --- Delete ---
  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteSite(deleting.id);
      setDeleting(null);
      fetchSites();
    } catch { alert('Failed to delete site'); }
  };

  const modal = (site: Site | null, form: SiteForm, setForm: (f: SiteForm) => void, onSubmit: (e: React.FormEvent) => void, title: string, submitLabel: string, onClose: () => void) => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin size={20} className="text-brand-600" /> {title}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site ID *</label>
            <input required value={form.site_id} onChange={e => setForm({ ...form, site_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="ATC-KLA-001" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site Name *</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
              <input type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
              <input type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
          <p className="text-gray-500 text-sm mt-1">{sites.length} sites registered</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Add Site
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by Site ID or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Site ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Site Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Coordinates</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Address</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && sites.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No sites found</td></tr>}
            {sites.map(site => (
              <tr key={site.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-700">{site.site_id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{site.name}</td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                  {site.latitude && site.longitude
                    ? `${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{site.address || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(site)}
                      className="p-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                      title="Edit site"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleting(site)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete site"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && modal(
        null, addForm, setAddForm, handleAdd,
        'Add New Site', 'Create Site',
        () => { setShowAdd(false); setAddForm({ site_id: '', name: '', latitude: '', longitude: '', address: '' }); }
      )}

      {/* Edit Modal */}
      {editing && modal(
        editing, editForm, setEditForm, handleEdit,
        'Edit Site', 'Save Changes',
        () => setEditing(null)
      )}

      {/* Delete Confirmation */}
      {deleting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Delete Site</h2>
            </div>
            <p className="text-gray-600 text-sm mb-1">
              Are you sure you want to delete <strong>{deleting.name}</strong>?
            </p>
            <p className="text-gray-400 text-xs mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
