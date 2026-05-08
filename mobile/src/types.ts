export type Role = 'employee' | 'admin';

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  shift_length_minutes: number;
  break_length_minutes: number;
  is_active: boolean;
  scheduled_start: string | null;       // 'HH:MM:SS'
  scheduled_end: string | null;
  scheduled_days: number[] | null;       // ISO 1=Mon..7=Sun
}

export interface CompanySettings {
  warn_early_clock_in: boolean;
  warn_late_clock_in: boolean;
  early_threshold_minutes: number;
  late_threshold_minutes: number;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  notes: string | null;
  shift_type_id?: string | null;
  shift_types?: { name: string; multiplier: number } | null;
  clock_in_lat?: number | null;
  clock_in_lng?: number | null;
  clock_in_accuracy_m?: number | null;
  clock_out_lat?: number | null;
  clock_out_lng?: number | null;
  clock_out_accuracy_m?: number | null;
}

export interface Break {
  id: string;
  time_entry_id: string;
  start_at: string;
  end_at: string | null;
}
