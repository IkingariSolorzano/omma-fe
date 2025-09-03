import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from './auth.service';

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'professional';
  specialty?: string;
  description?: string;
}

export interface Space {
  id: number;
  name: string;
  description: string;
  capacity: number;
  cost_credits: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSpaceRequest {
  name: string;
  description: string;
  capacity: number;
  cost_credits: number;
}

export interface Schedule {
  id: number;
  space_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface CreateScheduleRequest {
  space_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface AddCreditsRequest {
  user_id: number;
  amount: number;
}

export interface ExtendExpiryRequest {
  user_id: number;
  days: number;
}

export interface ReactivateExpiredRequest {
  user_id: number;
  new_expiry: string; // YYYY-MM-DD
}

export interface TransferCreditsRequest {
  from_user_id: number;
  to_user_id: number;
  amount: number;
}

export interface DeductCreditsRequest {
  user_id: number;
  amount: number;
}

// Per-credit-lot operations
export interface CreditLot {
  id: number;
  user_id?: number;
  amount: number;
  purchase_date: string;
  expiry_date: string;
  is_active: boolean;
}

export interface ExtendCreditLotRequest {
  credit_id: number;
  days: number;
}

export interface ReactivateCreditLotRequest {
  credit_id: number;
  new_expiry: string; // YYYY-MM-DD
}

export interface TransferFromLotRequest {
  credit_id: number;
  to_user_id: number;
  amount: number;
}

export interface DeductFromLotRequest {
  credit_id: number;
  amount: number;
}

export interface PendingReservation {
  id: number;
  user_id: number;
  space_id: number;
  start_time: string;
  end_time: string;
  status: string;
  user_name: string;
  space_name: string;
}

export interface Payment {
  id: number;
  user_id: number;
  amount: number;
  credits: number;
  payment_method: string;
  reference?: string;
  notes?: string;
  created_at: string;
  user_name?: string;
}

export interface RegisterPaymentRequest {
  user_id: number;
  amount: number;
  credits: number;
  payment_method: 'cash' | 'transfer';
  reference?: string;
  notes?: string;
}

export interface CalendarSlot {
  id: number;
  space_id: number;
  space_name: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'reserved' | 'occupied';
  user_name?: string;
  reservation_id?: number;
}

export interface CalendarParams {
  period: 'week' | 'month' | 'custom';
  start_date: string;
  end_date?: string;
  space_ids?: string;
}

export interface CancelReservationRequest {
  reason: string;
  penalty?: number;
  notes?: string;
}

export interface UpdateUserRequest {
  name?: string;
  phone?: string;
  specialty?: string;
  description?: string;
}

export interface ChangePasswordRequest {
  new_password: string;
}

export interface BusinessHour {
  id?: number;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

export interface ClosedDate {
  id?: number;
  date: string;
  reason: string;
  is_active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // User Management
  createUser(userData: CreateUserRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/admin/users`, userData);
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<any>(`${this.apiUrl}/admin/users`).pipe(
      map((res: any) => {
        // Support plain array or wrapped payloads
        if (Array.isArray(res)) return res as User[];
        return (res?.data ?? res?.users ?? res?.content ?? []) as User[];
      })
    );
  }

  updateUser(userId: number, userData: UpdateUserRequest): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/admin/users/${userId}`, userData);
  }

  changeUserPassword(userId: number, passwordData: ChangePasswordRequest): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/users/${userId}/password`, passwordData);
  }

  addCredits(creditsData: AddCreditsRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/credits`, creditsData);
  }

  extendCreditExpiry(payload: ExtendExpiryRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/credits/extend`, payload);
  }

  reactivateExpiredCredits(payload: ReactivateExpiredRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/credits/reactivate`, payload);
  }

  transferCredits(payload: TransferCreditsRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/credits/transfer`, payload);
  }

  deductCredits(payload: DeductCreditsRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/credits/deduct`, payload);
  }

  // Credit lots (per-lot)
  getUserCreditLots(userId: number): Observable<{ credits: CreditLot[]; active_credits: number }>{
    return this.http.get<any>(`${this.apiUrl}/admin/users/${userId}/credit-lots`).pipe(
      map((res: any) => ({
        credits: (res?.credits ?? res?.data ?? []) as CreditLot[],
        active_credits: (res?.active_credits ?? 0) as number,
      }))
    );
  }

  extendCreditLot(payload: ExtendCreditLotRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/credit-lots/extend`, payload);
  }

  reactivateCreditLot(payload: ReactivateCreditLotRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/credit-lots/reactivate`, payload);
  }

  transferFromCreditLot(payload: TransferFromLotRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/credit-lots/transfer`, payload);
  }

  deductFromCreditLot(payload: DeductFromLotRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/credit-lots/deduct`, payload);
  }

  // Space Management
  createSpace(spaceData: CreateSpaceRequest): Observable<Space> {
    return this.http.post<Space>(`${this.apiUrl}/admin/spaces`, spaceData);
  }

  getAllSpaces(): Observable<Space[]> {
    return this.http.get<any>(`${this.apiUrl}/admin/spaces`).pipe(
      map((res: any) => Array.isArray(res) ? (res as Space[]) : ((res?.data ?? res?.spaces ?? res?.content ?? []) as Space[]))
    );
  }

  // Schedule Management
  createSchedule(scheduleData: CreateScheduleRequest): Observable<Schedule> {
    return this.http.post<Schedule>(`${this.apiUrl}/admin/schedules`, scheduleData);
  }

  getAllSchedules(spaceId?: number): Observable<Schedule[]> {
    let url = `${this.apiUrl}/admin/schedules`;
    if (spaceId) {
      url += `?space_id=${spaceId}`;
    }
    console.log('Fetching schedules from URL:', url);
    return this.http.get<any>(url).pipe(
      map((res: any) => {
        console.log('Raw API response:', res);
        // Backend returns {"schedules": [...]}
        const schedules = res?.schedules ?? [];
        console.log('Extracted schedules:', schedules);
        return schedules;
      })
    );
  }

  updateSchedule(scheduleId: number, scheduleData: CreateScheduleRequest): Observable<Schedule> {
    return this.http.put<Schedule>(`${this.apiUrl}/admin/schedules/${scheduleId}`, scheduleData);
  }

  deleteSchedule(scheduleId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/schedules/${scheduleId}`);
  }

  // Reservation Management
  getPendingReservations(): Observable<PendingReservation[]> {
    return this.http.get<{ reservations: PendingReservation[] }>(`${this.apiUrl}/admin/reservations/pending`).pipe(
      map(response => response.reservations || [])
    );
  }

  approveReservation(reservationId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/reservations/${reservationId}/approve`, {});
  }

  // Payment Management
  registerPayment(paymentData: RegisterPaymentRequest): Observable<Payment> {
    return this.http.post<Payment>(`${this.apiUrl}/admin/payments`, paymentData);
  }

  getAllPayments(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.apiUrl}/admin/payments`);
  }

  getUserPaymentHistory(userId: number): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.apiUrl}/admin/payments?user_id=${userId}`);
  }

  // Cancel Reservation
  cancelReservation(reservationId: number, cancelData?: CancelReservationRequest): Observable<any> {
    if (cancelData) {
      return this.http.put(`${this.apiUrl}/admin/reservations/${reservationId}/cancel`, cancelData);
    }
    return this.http.delete(`${this.apiUrl}/reservations/${reservationId}`);
  }

  // Calendar Management
  getCalendar(params: CalendarParams): Observable<CalendarSlot[]> {
    let queryParams = `period=${params.period}&start_date=${params.start_date}`;
    if (params.end_date) queryParams += `&end_date=${params.end_date}`;
    if (params.space_ids) queryParams += `&space_ids=${params.space_ids}`;
    
    return this.http.get<{reservations: CalendarSlot[]}>(`${this.apiUrl}/calendar?${queryParams}`)
      .pipe(map(response => response.reservations || []));
  }

  getAvailableSlots(date: string, spaceId?: number): Observable<CalendarSlot[]> {
    let queryParams = `date=${date}`;
    if (spaceId) queryParams += `&space_id=${spaceId}`;
    
    return this.http.get<CalendarSlot[]>(`${this.apiUrl}/calendar/available?${queryParams}`);
  }

  // Dashboard Stats
  getDashboardStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/dashboard/stats`);
  }

  getRecentActivity(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/dashboard/activity`);
  }

  // Business Hours Management
  getBusinessHours(): Observable<BusinessHour[]> {
    return this.http.get<BusinessHour[]>(`${this.apiUrl}/admin/business-hours`);
  }

  createBusinessHour(businessHour: BusinessHour): Observable<BusinessHour> {
    return this.http.post<BusinessHour>(`${this.apiUrl}/admin/business-hours`, businessHour);
  }

  updateBusinessHour(id: number, businessHour: BusinessHour): Observable<BusinessHour> {
    return this.http.put<BusinessHour>(`${this.apiUrl}/admin/business-hours/${id}`, businessHour);
  }

  deleteBusinessHour(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/business-hours/${id}`);
  }

  // Closed Dates Management
  getClosedDates(): Observable<ClosedDate[]> {
    return this.http.get<ClosedDate[]>(`${this.apiUrl}/admin/closed-dates`);
  }

  createClosedDate(closedDate: ClosedDate): Observable<ClosedDate> {
    return this.http.post<ClosedDate>(`${this.apiUrl}/admin/closed-dates`, closedDate);
  }

  deleteClosedDate(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/closed-dates/${id}`);
  }
}
