import { useEffect, useState } from 'react';
import { listTemplates, getTemplate } from '../lib/api';
import { SurveyTemplate, SurveyTemplateDetail, RECORD_TYPE_LABELS } from '../lib/types';
import { format } from 'date-fns';
import {
  Activity, FileText, Network, Zap, X, MapPin, Camera, ChevronRight,
  CheckSquare, CircleDot, ListChecks, AlignLeft, Hash, Calendar, Globe
} from 'lucide-react';

const recordTypeIcons: Record<string, React.ReactNode> = {
  ground_info: <FileText size={24} className="text-blue-600" />,
  dcdb_info: <Zap size={24} className="text-yellow-600" />,
  tower_info: <Network size={24} className="text-purple-600" />,
  innovis_survey: <Activity size={24} className="text-brand-600" />,
};

const INPUT_ICONS: Record<string, React.ReactNode> = {
  text: <AlignLeft size={14} />,
  number: <Hash size={14} />,
  date: <Calendar size={14} />,
  dropdown: <CircleDot size={14} />,
  multiselect: <ListChecks size={14} />,
  checkbox: <CheckSquare size={14} />,
  textarea: <AlignLeft size={14} />,
  gps: <Globe size={14} />,
  photo: <Camera size={14} />,
};

function QuestionPreview({ label, input_type, required, options }: {
  label: string; input_type: string; required: number; options: string | null;
}) {
  const opts: { value: string; label: string }[] = options ? (() => { try { return JSON.parse(options); } catch { return []; } })() : [];
  const req = required === 1;

  if (input_type === 'checkbox') {
    return (
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-gray-300 rounded bg-white flex-shrink-0" />
        <span className="text-sm text-gray-600">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</span>
      </div>
    );
  }

  if (input_type === 'multiselect') {
    return (
      <div>
        <p className="text-sm text-gray-600 mb-1.5">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</p>
        <div className="flex flex-wrap gap-2">
          {opts.length > 0 ? opts.map(o => (
            <span key={o.value} className="px-2 py-0.5 border border-gray-300 rounded text-xs text-gray-500">{o.label}</span>
          )) : <span className="text-xs text-gray-400 italic">options...</span>}
        </div>
      </div>
    );
  }

  if (input_type === 'dropdown') {
    return (
      <div>
        <p className="text-sm text-gray-600 mb-1.5">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</p>
        <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-400">
          <option value="">Select...</option>
          {opts.map(o => <option key={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  if (input_type === 'gps') {
    return (
      <div>
        <p className="text-sm text-gray-600 mb-1.5">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <MapPin size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Latitude" readOnly
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400" />
          </div>
          <div className="relative">
            <MapPin size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Longitude" readOnly
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  if (input_type === 'photo') {
    return (
      <div>
        <p className="text-sm text-gray-600 mb-1.5">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</p>
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center bg-gray-50">
          <Camera size={20} className="mx-auto text-gray-400 mb-1" />
          <p className="text-xs text-gray-400">Click to attach photo</p>
        </div>
      </div>
    );
  }

  if (input_type === 'textarea') {
    return (
      <div>
        <p className="text-sm text-gray-600 mb-1.5">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</p>
        <textarea readOnly rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 resize-none"
          placeholder="Enter details..." />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-1.5">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</p>
      <input type={input_type === 'number' ? 'number' : input_type === 'date' ? 'date' : 'text'}
        readOnly placeholder={`Enter ${label.toLowerCase()}...`}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
    </div>
  );
}

function TemplateDetailModal({ template, onClose }: { template: SurveyTemplateDetail; onClose: () => void }) {
  const totalQuestions = template.sections.reduce((acc, s) => acc + s.questions.length, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-brand-50 text-brand-700">
                  {template.record_type}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${template.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{template.name}</h2>
              {template.description && (
                <p className="text-sm text-gray-500 mt-1">{template.description}</p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-4">
              <X size={20} />
            </button>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span>{template.sections.length} sections</span>
            <span>{totalQuestions} fields</span>
            <span>v{template.version}</span>
          </div>
        </div>

        {/* Sections */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {template.sections.map((section, si) => (
            <div key={section.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {si + 1}
                </span>
                <h3 className="text-sm font-semibold text-gray-900">{section.name}</h3>
              </div>
              <div className="ml-8 space-y-3">
                {section.questions.map(q => {
                  const typeLabel = q.input_type.replace('_', ' ');
                  return (
                    <div key={q.id} className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-2">
                        <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                          {INPUT_ICONS[q.input_type] || <AlignLeft size={13} />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium text-gray-500 capitalize">{typeLabel}</span>
                          {q.required === 1 && (
                            <span className="text-xs text-red-500 font-medium">Required</span>
                          )}
                        </div>
                        <QuestionPreview
                          label={q.label}
                          input_type={q.input_type}
                          required={q.required}
                          options={q.options}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">Preview — {template.name}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SurveyTemplateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    listTemplates()
      .then(r => setTemplates(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openTemplate = async (tpl: SurveyTemplate) => {
    setDetailLoading(true);
    try {
      const r = await getTemplate(tpl.id);
      setSelected(r.data.data);
    } catch {
      alert('Failed to load template details');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Survey Templates</h1>
        <p className="text-gray-500 text-sm mt-1">BTS Field Audit form definitions</p>
      </div>

      {loading && <div className="text-center py-12 text-gray-400">Loading...</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {templates.map(tpl => (
          <button
            key={tpl.id}
            onClick={() => openTemplate(tpl)}
            disabled={detailLoading}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:border-brand-300 transition-all text-left group"
          >
            <div className="p-6">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
                {recordTypeIcons[tpl.record_type] || <Activity size={24} className="text-gray-600" />}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{tpl.name}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{tpl.description}</p>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">{tpl.record_type}</span>
                <span>v{tpl.version}</span>
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
              <span>{tpl.is_active ? 'Active' : 'Inactive'}</span>
              <span>{format(new Date(tpl.created_at), 'dd MMM yyyy')}</span>
              <span className="flex items-center gap-1 text-brand-600 font-medium group-hover:gap-2 transition-all">
                View <ChevronRight size={13} />
              </span>
            </div>
          </button>
        ))}
      </div>

      {detailLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-sm text-gray-500">Loading template...</div>
        </div>
      )}

      {selected && (
        <TemplateDetailModal template={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
