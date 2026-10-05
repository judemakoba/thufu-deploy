export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'admin' | 'reviewer' | 'surveyor';
  avatar_url: string | null;
}

export interface Site {
  id: string;
  tenant_id: string;
  site_id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  created_at: string;
}

export interface SurveyTemplate {
  id: string;
  name: string;
  record_type: 'ground_info' | 'dcdb_info' | 'tower_info' | 'innovis_survey';
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SurveyQuestion {
  id: string;
  section_id: string;
  field_name: string;
  label: string;
  input_type: string;
  description: string | null;
  required: number;
  order_index: number;
  options: string | null; // JSON string
}

export interface SurveySection {
  id: string;
  template_id: string;
  name: string;
  order_index: number;
  description: string | null;
  questions: SurveyQuestion[];
}

export interface SurveyTemplateDetail extends SurveyTemplate {
  sections: SurveySection[];
}

export interface Submission {
  id: string;
  tenant_id: string;
  site_id: string;
  template_id: string;
  record_type: 'ground_info' | 'dcdb_info' | 'tower_info' | 'innovis_survey';
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  technician_id: string;
  technician_name: string;
  site_name: string;
  template_name: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface Analytics {
  total_sites: number;
  total_submissions: number;
  pending_review: number;
  approved: number;
  rejected: number;
  by_type: { record_type: string; count: number }[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export const RECORD_TYPE_LABELS: Record<string, string> = {
  ground_info: 'Ground Equipment',
  dcdb_info: 'DCDB Power Audit',
  tower_info: 'Tower Equipment',
  innovis_survey: 'Innovis Survey',
};
