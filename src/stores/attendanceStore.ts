import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import {
  validateAuth,
  createAuthError,
  createTenantError,
  initialStoreState,
  setLoading,
  setError,
  setSuccess,
  addItem,
  updateItem,
  type StoreState,
} from './utils/storeUtils';

export interface AttendanceLog {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: 'Present' | 'Absent' | 'Late' | 'Half Day';
  notes: string | null;
  verification_method?: 'manual' | 'face_recognition' | 'fallback';
  face_confidence?: number;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceSettings {
  id: string;
  name: string;
  description: string | null;
  clock_in_start: string;
  clock_in_end: string;
  clock_out_start: string;
  clock_out_end: string;
  late_threshold_minutes: number;
  half_day_threshold_minutes: number;
  is_active: boolean;
  tenant_id?: string;
}

export interface ShiftAttendanceSettings {
  clock_in_start: string;
  clock_in_end: string;
  clock_out_start: string;
  clock_out_end: string;
  late_threshold_minutes: number;
  half_day_threshold_minutes: number;
}

interface AttendanceStore extends StoreState<AttendanceLog> {
  settings: AttendanceSettings | null;
  settingsLoading: boolean;
  settingsError: string | null;
  fetchAttendanceRecords: (employeeId: string, startDate: string, endDate: string) => Promise<void>;
  fetchAttendanceSettings: () => Promise<void>;
  updateAttendanceSettings: (settings: Partial<AttendanceSettings>) => Promise<void>;
  getShiftAttendanceSettings: (shiftId: string, date: string) => Promise<ShiftAttendanceSettings>;
  updateShiftAttendanceSettings: (shiftId: string, settings: {
    clock_in_start_offset: string;
    clock_in_end_offset: string;
    clock_out_start_offset: string;
    clock_out_end_offset: string;
    late_threshold_minutes: number;
    half_day_threshold_minutes: number;
  }) => Promise<void>;
  clockIn: (
    employeeId: string,
    shiftId: string,
    customTime?: Date,
    notes?: string,
    userId?: string,
    verificationMethod?: 'manual' | 'face_recognition' | 'fallback',
    faceConfidence?: number
  ) => Promise<AttendanceLog>;
  clockOut: (
    employeeId: string,
    shiftId: string,
    customTime?: Date,
    notes?: string,
    verificationMethod?: 'manual' | 'face_recognition' | 'fallback',
    faceConfidence?: number
  ) => Promise<AttendanceLog>;
  updateAttendanceStatus: (id: string, status: AttendanceLog['status'], notes?: string) => Promise<void>;
  reset: () => void;
}


export const useAttendanceStore = create<AttendanceStore>()(
  persist(
    (set, get) => ({
      ...initialStoreState<AttendanceLog>(),
      settings: null,
      settingsLoading: false,
      settingsError: null,

      fetchAttendanceRecords: async (employeeId, startDate, endDate) => {
        if (!employeeId) {
          set(state => setSuccess(state, []));
          return;
        }

        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          set(state => setError(state, createAuthError().message));
          return;
        }

        if (!auth.tenantId) {
          set(state => setError(state, createTenantError().message));
          return;
        }

        set(state => setLoading(state));

        try {
          const { data, error } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('tenant_id', auth.tenantId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });

          if (error) throw error;

          set(state => setSuccess(state, data || []));
        } catch (error) {
          set(state => setError(state, error instanceof Error ? error.message : 'Failed to fetch attendance records'));
        }
      },

      fetchAttendanceSettings: async () => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          set({ settingsError: createAuthError().message });
          return;
        }

        if (!auth.tenantId) {
          set({ settingsError: createTenantError().message });
          return;
        }

        set({ settingsLoading: true, settingsError: null });

        try {
          const { data, error } = await supabase
            .from('attendance_settings')
            .select('*')
            .eq('tenant_id', auth.tenantId)
            .eq('is_active', true)
            .maybeSingle();

          if (error) throw error;

          set({ settings: data, settingsLoading: false });
        } catch (error) {
          set({
            settingsError: error instanceof Error ? error.message : 'Failed to fetch attendance settings',
            settingsLoading: false,
          });
        }
      },

      updateAttendanceSettings: async (settings) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          throw createAuthError();
        }

        if (!auth.tenantId) {
          throw createTenantError();
        }

        set({ settingsLoading: true });

        try {
          const { data, error } = await supabase
            .from('attendance_settings')
            .update(settings)
            .eq('tenant_id', auth.tenantId)
            .eq('id', settings.id)
            .select()
            .single();

          if (error) throw error;

          set({ settings: data, settingsLoading: false, settingsError: null });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update attendance settings';
          set({ settingsError: errorMessage, settingsLoading: false });
          throw error;
        }
      },

      getShiftAttendanceSettings: async (shiftId, date) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          throw createAuthError();
        }

        if (!auth.tenantId) {
          throw createTenantError();
        }

        try {
          const { data, error } = await supabase.rpc('get_shift_attendance_settings', {
            p_shift_id: shiftId,
            p_date: date,
            p_tenant_id: auth.tenantId,
          });

          if (error) throw error;

          if (!data || data.length === 0) {
            throw new Error('Shift attendance settings not found');
          }

          return data[0];
        } catch (error) {
          throw error instanceof Error ? error : new Error('Failed to fetch shift attendance settings');
        }
      },

      updateShiftAttendanceSettings: async (shiftId, settings) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          throw createAuthError();
        }

        if (!auth.tenantId) {
          throw createTenantError();
        }

        try {
          const { error } = await supabase.rpc('update_shift_attendance_settings', {
            p_clock_in_end: settings.clock_in_end_offset,
            p_clock_in_start: settings.clock_in_start_offset,
            p_clock_out_end: settings.clock_out_end_offset,
            p_clock_out_start: settings.clock_out_start_offset,
            p_half_day_threshold_minutes: settings.half_day_threshold_minutes,
            p_late_threshold_minutes: settings.late_threshold_minutes,
            p_shift_id: shiftId,
            p_tenant_id: auth.tenantId,
          });

          if (error) throw error;
        } catch (error) {
          throw error instanceof Error ? error : new Error('Failed to update shift attendance settings');
        }
      },

      clockIn: async (employeeId, shiftId, customTime, notes, userId, verificationMethod = 'manual', faceConfidence) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          throw createAuthError();
        }

        if (!auth.tenantId) {
          throw createTenantError();
        }

        const now = customTime || new Date();
        const today = now.toISOString().split('T')[0];
        const clockInTime = now.toISOString();

        try {
          const { data: existingRecord, error: fetchError } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('date', today)
            .eq('tenant_id', auth.tenantId)
            .maybeSingle();

          if (fetchError) throw fetchError;

          if (existingRecord) {
            throw new Error('Already clocked in for today');
          }

          const settings = await get().getShiftAttendanceSettings(shiftId, today);

          const currentTime = now.getHours() * 60 + now.getMinutes();
          const [inStartHour, inStartMin] = settings.clock_in_start.split(':').map(Number);
          const [inEndHour, inEndMin] = settings.clock_in_end.split(':').map(Number);
          const clockInStartMinutes = inStartHour * 60 + inStartMin;
          const clockInEndMinutes = inEndHour * 60 + inEndMin;

          if (!customTime && (currentTime < clockInStartMinutes || currentTime > clockInEndMinutes)) {
            throw new Error(`Clock in only allowed between ${settings.clock_in_start} and ${settings.clock_in_end}`);
          }

          const minutesLate = currentTime - clockInStartMinutes;
          const status = minutesLate <= settings.late_threshold_minutes ? 'Present' : 'Late';

          const finalNotes = notes
            ? `${notes}; Verified via ${verificationMethod}`
            : `Verified via ${verificationMethod}`;

          const { data, error } = await supabase
            .from('attendance_logs')
            .insert([
              {
                employee_id: employeeId,
                date: today,
                clock_in: clockInTime,
                status,
                notes: finalNotes,
                created_by: userId || auth.userId,
                verification_method: verificationMethod,
                face_confidence: faceConfidence,
                tenant_id: auth.tenantId,
              },
            ])
            .select()
            .single();

          if (error) throw error;

          set(state => addItem(state, data));
          return data;
        } catch (error) {
          throw error instanceof Error ? error : new Error('Failed to clock in');
        }
      },

      clockOut: async (employeeId, shiftId, customTime, notes, verificationMethod = 'manual', faceConfidence) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          throw createAuthError();
        }

        if (!auth.tenantId) {
          throw createTenantError();
        }

        const now = customTime || new Date();
        const today = now.toISOString().split('T')[0];
        const clockOutTime = now.toISOString();

        try {
          const { data: existingRecord, error: fetchError } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('date', today)
            .eq('tenant_id', auth.tenantId)
            .maybeSingle();

          if (fetchError || !existingRecord) {
            throw new Error('No clock-in record found for today');
          }

          if (existingRecord.clock_out) {
            throw new Error('Already clocked out for today');
          }

          const settings = await get().getShiftAttendanceSettings(shiftId, today);

          const currentTime = now.getHours() * 60 + now.getMinutes();
          const [outStartHour, outStartMin] = settings.clock_out_start.split(':').map(Number);
          const [outEndHour, outEndMin] = settings.clock_out_end.split(':').map(Number);
          const clockOutStartMinutes = outStartHour * 60 + outStartMin;
          const clockOutEndMinutes = outEndHour * 60 + outEndMin;

          if (!customTime && (currentTime < clockOutStartMinutes || currentTime > clockOutEndMinutes)) {
            throw new Error(`Clock out only allowed between ${settings.clock_out_start} and ${settings.clock_out_end}`);
          }

          const clockInTime = new Date(existingRecord.clock_in!);
          const hoursWorked = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

          const status =
            hoursWorked >= settings.half_day_threshold_minutes / 60 ? existingRecord.status : 'Half Day';

          let finalNotes = existingRecord.notes || '';
          if (notes) {
            finalNotes += finalNotes ? `; ${notes}` : notes;
          }
          finalNotes += `; Clock out verified via ${verificationMethod}`;

          const { data, error } = await supabase
            .from('attendance_logs')
            .update({
              clock_out: clockOutTime,
              status,
              notes: finalNotes,
              verification_method: verificationMethod,
              face_confidence: faceConfidence,
            })
            .eq('id', existingRecord.id)
            .eq('tenant_id', auth.tenantId)
            .select()
            .single();

          if (error) throw error;

          set(state => updateItem(state, existingRecord.id, data));
          return data;
        } catch (error) {
          throw error instanceof Error ? error : new Error('Failed to clock out');
        }
      },

      updateAttendanceStatus: async (id, status, notes) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          throw createAuthError();
        }

        if (!auth.tenantId) {
          throw createTenantError();
        }

        try {
          const { data, error } = await supabase
            .from('attendance_logs')
            .update({ status, notes })
            .eq('id', id)
            .eq('tenant_id', auth.tenantId)
            .select()
            .single();

          if (error) throw error;

          set(state => updateItem(state, id, data));
        } catch (error) {
          throw error instanceof Error ? error : new Error('Failed to update attendance status');
        }
      },

      reset: () => {
        set({
          ...initialStoreState<AttendanceLog>(),
          settings: null,
          settingsLoading: false,
          settingsError: null,
        });
      },
    }),
    {
      name: 'attendance-storage',
      partialize: (state) => ({
        items: state.items,
        settings: state.settings,
        initialized: state.initialized,
      }),
    }
  )
);
