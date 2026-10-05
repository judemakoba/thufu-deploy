import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listSubmissions } from '../lib/api';
import { Submission, STATUS_COLORS, RECORD_TYPE_LABELS } from '../lib/types';
import { format } from 'date-fns';
import { Eye, Filter } from 'lucide-react';

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetch = () => {
    setLoading(true);
    listSubmissions({ status: statusFilter || undefined, record_type: typeFilter || undefined })
      .then(r => setSubmissions(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [statusFilter, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
          <p className="text-gray-500 text-sm mt-1">{submissions.length} records</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All Types</option>
          <option value="ground_info">Ground Equipment</option>
          <option value="dcdb_info">DCDB Power Audit</option>
          <option value="tower_info">Tower Equipment</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Site ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Site</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Technician</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Submitted</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && submissions.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No submissions found</td></tr>}
            {submissions.map(sub => (
              <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-700">{sub.site_id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{sub.site_name}</td>
                <td className="px-4 py-3 text-gray-600">{RECORD_TYPE_LABELS[sub.record_type] || sub.record_type}</td>
                <td className="px-4 py-3 text-gray-600">{sub.technician_name}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-700'}`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {sub.submitted_at ? format(new Date(sub.submitted_at), 'dd MMM yyyy') : '—'}
                </td>
                <td className="px-4 py-3">
                  <Link to={`/submissions/${sub.id}`} className="text-brand-600 hover:text-brand-700 flex items-center gap-1 text-sm">
                    <Eye size={16} /> Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
