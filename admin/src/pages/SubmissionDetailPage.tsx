import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubmission, updateSubmission } from '../lib/api';
import { Submission, STATUS_COLORS, RECORD_TYPE_LABELS } from '../lib/types';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

// Flat shape returned by the backend
interface SubmissionResponse {
  id: string;
  tenant_id: string;
  assignment_id: string;
  site_id: string;
  template_id: string;
  record_type: string;
  status: string;
  answers: string;
  technician_id: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  template_name: string;
  site_name: string;
  technician_name: string;
  photos: unknown[];
  formData: Record<string, unknown> | null;
}

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [reviewNotes, setReviewNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getSubmission(id)
      .then(r => {
        const sub: SubmissionResponse = r.data.data;
        setSubmission(sub);
        setReviewNotes(sub.review_notes || '');

        // Parse answers from the sync payload (mobile app writes JSON here)
        if (sub.answers && typeof sub.answers === 'string' && sub.answers.trim() !== '') {
          try {
            setAnswers(JSON.parse(sub.answers) as Record<string, unknown>);
          } catch {
            setAnswers({});
          }
        } else {
          setAnswers({});
        }
      })
      .catch(err => {
        console.error('Failed to load submission:', err);
        setError(err.response?.data?.error || 'Failed to load submission');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!id) return;
    setUpdating(true);
    try {
      await updateSubmission(id, { status, review_notes: reviewNotes });
      setSubmission(prev => prev ? { ...prev, status } : prev);
    } catch {
      alert('Update failed');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading submission...</div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/submissions')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <span className="text-red-500">{error || 'Submission not found'}</span>
        </div>
      </div>
    );
  }

  const canReview = submission.status === 'submitted' || submission.status === 'under_review';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/submissions')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{submission.site_id}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[submission.status] || 'bg-gray-100 text-gray-700'}`}>
              {submission.status}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {submission.site_name} · {RECORD_TYPE_LABELS[submission.record_type] || submission.record_type} · {submission.technician_name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Survey Data */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={18} className="text-brand-600" />
              <h2 className="font-semibold text-gray-900">Survey Data</h2>
            </div>
            <div className="space-y-3">
              {Object.keys(answers).length === 0 ? (
                <p className="text-gray-400 text-sm">No answers recorded yet.</p>
              ) : (
                Object.entries(answers)
                  .filter(([, v]) => v !== null && v !== undefined && v !== '')
                  .map(([key, value]) => (
                    <div key={key} className="grid grid-cols-3 gap-4 border-b border-gray-100 pb-3">
                      <dt className="text-sm font-medium text-gray-500 capitalize">
                        {key.replace(/_/g, ' ')}
                      </dt>
                      <dd className="col-span-2 text-sm text-gray-900">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </dd>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Meta */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Survey Type</dt>
                <dd className="font-medium">{RECORD_TYPE_LABELS[submission.record_type] || submission.record_type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Technician</dt>
                <dd className="font-medium">{submission.technician_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd>{format(new Date(submission.created_at), 'dd MMM yyyy HH:mm')}</dd>
              </div>
              {submission.submitted_at ? (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Submitted</dt>
                  <dd>{format(new Date(submission.submitted_at), 'dd MMM yyyy HH:mm')}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {/* Review Actions */}
          {canReview ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Review Decision</h3>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Add review notes..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReview('approved')}
                  disabled={updating}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={16} /> Approve
                </button>
                <button
                  onClick={() => handleReview('rejected')}
                  disabled={updating}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <XCircle size={16} /> Reject
                </button>
              </div>
            </div>
          ) : null}

          {submission.review_notes ? (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-gray-400" />
                <h4 className="text-sm font-medium text-gray-700">Review Notes</h4>
              </div>
              <p className="text-sm text-gray-600">{submission.review_notes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
