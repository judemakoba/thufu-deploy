import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, FileText, Clock, CheckCircle, XCircle, BarChart2, ArrowRight } from 'lucide-react';
import { getAnalytics } from '../lib/api';
import { Analytics } from '../lib/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<Analytics | null>(null);

  useEffect(() => {
    getAnalytics().then(r => setStats(r.data.data)).catch(console.error);
  }, []);

  if (!stats) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  }

  const cards = [
    { label: 'Total Sites', value: stats.total_sites, icon: MapPin, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Submissions', value: stats.total_submissions, icon: FileText, color: 'text-purple-600 bg-purple-50' },
    { label: 'Pending Review', value: stats.pending_review, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600 bg-red-50' },
  ];

  const completionRate = stats.total_submissions > 0
    ? Math.round((stats.approved / stats.total_submissions) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your field audit operations</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className={`p-2 rounded-lg ${color}`}>
                <Icon size={20} />
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{value}</div>
            <div className="text-sm text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Completion Rate */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Approval Rate</h2>
          <span className="text-2xl font-bold text-green-600">{completionRate}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* By Record Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Submissions by Type</h2>
            <Link to="/submissions" className="text-brand-600 text-sm flex items-center gap-1 hover:underline">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {stats.by_type.length === 0 && <p className="text-gray-400 text-sm">No submissions yet.</p>}
            {stats.by_type.map(({ record_type, count }) => (
              <div key={record_type} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 capitalize">{record_type.replace('_', ' ')}</span>
                <span className="text-sm font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="space-y-2">
            <Link to="/sites" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-gray-400" />
                <span className="text-sm font-medium">Manage Sites</span>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </Link>
            <Link to="/assignments" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-gray-400" />
                <span className="text-sm font-medium">Assign Surveys</span>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </Link>
            <Link to="/users" className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <BarChart2 size={18} className="text-gray-400" />
                <span className="text-sm font-medium">Invite Team Members</span>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
