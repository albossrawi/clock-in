export type Role = 'employee' | 'admin';

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  shift_length_minutes: number;
  break_length_minutes: number;
  is_active: boolean;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  notes: string | null;
}

export interface Break {
  id: string;
  time_entry_id: string;
  start_at: string;
  end_at: string | null;
}
