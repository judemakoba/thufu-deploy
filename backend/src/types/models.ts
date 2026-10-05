// ============================================================
// Thufu Deploy — TypeScript Type Definitions
// ============================================================

// ----- Core Types -----

export type TenantPlan = 'starter' | 'professional' | 'enterprise';

export type UserRole = 'admin' | 'reviewer' | 'surveyor';

export type SubmissionStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';

export type AssignmentStatus = 'pending' | 'in_progress' | 'submitted' | 'reviewed' | 'approved' | 'rejected';

export type RecordType = 'ground_info' | 'dcdb_info' | 'tower_info' | 'innovis_survey';

export type InputType =
  | 'text'
  | 'number'
  | 'photo'
  | 'gps'
  | 'dropdown'
  | 'checkbox'
  | 'multiselect'
  | 'date'
  | 'signature'
  | 'textarea';

// ----- Tenant -----

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  logo_url: string | null;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// ----- User -----

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserPublic {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
}

// ----- Site -----

export interface Site {
  id: string;
  tenant_id: string;
  site_id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  gps_accuracy: number | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
}

// ----- Survey Template -----

export interface SurveySection {
  id: string;
  template_id: string;
  name: string;
  order_index: number;
  description: string | null;
  questions?: SurveyQuestion[];
  created_at: Date;
}

export interface SurveyQuestion {
  id: string;
  section_id: string;
  field_name: string;
  label: string;
  input_type: InputType;
  description: string | null;
  required: boolean;
  order_index: number;
  options: { value: string; label: string }[] | null;
  validation: QuestionValidation | null;
  depends_on: string | null;
  depends_value: string | null;
  created_at: Date;
}

export interface QuestionValidation {
  min?: number;
  max?: number;
  max_length?: number;
  pattern?: string;
  max_photos?: number;
}

export interface SurveyTemplate {
  id: string;
  tenant_id: string;
  name: string;
  record_type: RecordType;
  description: string | null;
  sections: SurveySection[];
  is_active: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}

// ----- Survey Assignment -----

export interface SurveyAssignment {
  id: string;
  tenant_id: string;
  template_id: string;
  site_id: string;
  assigned_to: string;
  assigned_by: string;
  status: AssignmentStatus;
  due_date: Date | null;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// ----- Submission -----

export interface Submission {
  id: string;
  tenant_id: string;
  assignment_id: string;
  site_id: string;
  template_id: string;
  record_type: RecordType;
  status: SubmissionStatus;
  answers: Record<string, unknown>;
  technician_id: string;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// ----- Photo -----

export interface Photo {
  id: string;
  tenant_id: string;
  submission_id: string;
  site_id: string;
  field_name: string;
  original_name: string | null;
  stored_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  latitude: number | null;
  longitude: number | null;
  captured_at: Date;
  uploaded_at: Date;
}

// ----- Form 1: Ground Equipment -----

export interface GroundEquipment {
  id: string;
  submission_id: string;
  tenant_id: string;
  site_id: string;
  site_name_plate_photo_id: string | null;
  survey_date: Date | null;
  technician_name: string | null;
  technician_contact: string | null;
  contractor_name: string;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  altitude: number | null;
  gps_screenshot_id: string | null;
  tower_type: string | null;
  tower_height: number | null;
  building_height: number | null;
  total_height: number | null;
  site_indoor_outdoor: string | null;
  no_of_tenants: number | null;
  other_tenants: string[] | null;
  site_photo_id: string | null;
  has_grid: boolean;
  has_dg: boolean;
  has_solar: boolean;
  grid_distance_to_3phase: number | null;
  guard_at_site: boolean;
  rru_type: string | null;
  rru_count: number | null;
  cabinet_types: string | null;
  cabinet_count: number | null;
  equipment_labelled: boolean;
  cabinet_comments: string | null;
  cabinet_dimensions: string | null;
  active_idu_types: string | null;
  non_active_idu_types: string | null;
  non_active_idu_count: number | null;
  slab_dimensions: string | null;
  redundant_equipment_count: number | null;
  is_on_fiber: boolean | null;
  overall_remarks: string | null;
  created_at: Date;
  updated_at: Date;
}

// ----- Form 2: DCDB Records -----

export interface DCDBDCDUSlot {
  slot: string;
  cable_size: string;
  breaker_rating: string;
}

export interface DCDUDetail {
  dcduslot: string;
  dcdutype: string;
  dcducount: number;
  cableno: string;
}

export interface RRUDetail {
  rruslot: string;
  rrutype: string;
  dcduslot: string;
  cableno: string;
  cablelen: number;
}

export interface AAUDetail {
  aauslot: string;
  aautype: string;
  dcduslot: string;
  cableno: string;
  cablelen: number;
}

export interface BTSEarthing {
  cable_size: string;
  test_result: string;
  photo_id: string | null;
}

export interface DCDBRecord {
  id: string;
  submission_id: string;
  tenant_id: string;
  grid_distance_to_3phase: number | null;
  np_cable_size_dcdb: string | null;
  np_breaker1_mcb: string | null;
  np_dcdus: DCDBDCDUSlot[];
  pp_cable_size_dcdb: string | null;
  pp_breaker1_mcb: string | null;
  pp_dcdus: DCDBDCDUSlot[];
  dcdus: DCDUDetail[];
  rru_dcdus: RRUDetail[];
  aau_dcdus: AAUDetail[];
  bts_earthing: BTSEarthing;
  created_at: Date;
  updated_at: Date;
}

// ----- Form 3: Tower Equipment -----

export interface Antenna {
  antenna_id: string;
  antenna_type: string;
  azimuth: number;
  height: number;
  mtw: number;
  downtilt: number;
  brand: string;
  total_count: number;
  status: string;
}

export interface RRU {
  rru_id: string;
  rru_type: string;
  azimuth: number;
  height: number;
  rru_count: number;
  status: string;
}

export interface TowerEquipment {
  id: string;
  submission_id: string;
  tenant_id: string;
  antennas: Antenna[];
  rrus: RRU[];
  created_at: Date;
  updated_at: Date;
}

// ----- API Response Types -----

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// ----- Auth -----

export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserPublic;
}

// ----- Sync Request (mobile) -----

export interface MobileSyncRequest {
  record_type: RecordType;
  submission_id?: string;
  site_id: string;
  answers: Record<string, unknown>;
  photos?: PhotoUpload[];
}

export interface PhotoUpload {
  field_name: string;
  original_name: string;
  latitude?: number;
  longitude?: number;
  captured_at?: string;
  file_data: string; // base64
}
