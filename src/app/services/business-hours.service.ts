import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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

export interface AvailabilityInfo {
  isAvailable: boolean;
  requiresApproval: boolean;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BusinessHoursService {
  private apiUrl = environment.apiUrl;
  private businessHoursSubject = new BehaviorSubject<BusinessHour[]>([]);
  private closedDatesSubject = new BehaviorSubject<ClosedDate[]>([]);

  public businessHours$ = this.businessHoursSubject.asObservable();
  public closedDates$ = this.closedDatesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadBusinessHours();
    this.loadClosedDates();
  }

  private loadBusinessHours(): void {
    console.log('Loading business hours from:', `${this.apiUrl}/admin/business-hours`);
    this.http.get<BusinessHour[]>(`${this.apiUrl}/admin/business-hours`).subscribe({
      next: (hours) => {
        console.log('Business hours API response:', hours);
        this.businessHoursSubject.next(hours);
      },
      error: (error) => {
        console.error('Error loading business hours:', error);
        // Provide fallback data for testing
        const fallbackHours: BusinessHour[] = [
          { id: 1, day_of_week: 1, start_time: '09:00', end_time: '20:00', is_closed: false },
          { id: 2, day_of_week: 2, start_time: '09:00', end_time: '20:00', is_closed: false },
          { id: 3, day_of_week: 3, start_time: '09:00', end_time: '20:00', is_closed: false },
          { id: 4, day_of_week: 4, start_time: '09:00', end_time: '20:00', is_closed: false },
          { id: 5, day_of_week: 5, start_time: '09:00', end_time: '20:00', is_closed: false },
          { id: 6, day_of_week: 6, start_time: '09:00', end_time: '16:00', is_closed: false }
        ];
        console.log('Using fallback business hours:', fallbackHours);
        this.businessHoursSubject.next(fallbackHours);
      }
    });
  }

  private loadClosedDates(): void {
    // Try public endpoint first, fallback to admin endpoint
    this.http.get<ClosedDate[]>(`${this.apiUrl}/closed-dates`).subscribe({
      next: (dates) => {
        console.log('Closed dates API response:', dates);
        this.closedDatesSubject.next(dates);
      },
      error: (error) => {
        console.error('Error loading closed dates from public endpoint:', error);
        // Try admin endpoint as fallback
        this.http.get<ClosedDate[]>(`${this.apiUrl}/admin/closed-dates`).subscribe({
          next: (dates) => {
            console.log('Closed dates from admin endpoint:', dates);
            this.closedDatesSubject.next(dates);
          },
          error: (adminError) => {
            console.error('Error loading closed dates from admin endpoint:', adminError);
            // Provide empty array as fallback
            this.closedDatesSubject.next([]);
          }
        });
      }
    });
  }

  // Public method to refresh data
  refreshData(): void {
    this.loadBusinessHours();
    this.loadClosedDates();
  }

  // Check if a specific date and time is available for reservations
  checkAvailability(date: Date, startTime: string, endTime: string): AvailabilityInfo {
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    // Check if date is closed
    const closedDates = this.closedDatesSubject.value;
    const closedDate = closedDates.find(cd => cd.date === dateStr && cd.is_active);
    if (closedDate) {
      return {
        isAvailable: false,
        requiresApproval: true,
        reason: `Fecha cerrada: ${closedDate.reason}`
      };
    }

    // Check business hours for the day
    const businessHours = this.businessHoursSubject.value;
    const dayHours = businessHours.find(bh => bh.day_of_week === dayOfWeek);
    
    if (!dayHours) {
      return {
        isAvailable: false,
        requiresApproval: true,
        reason: 'No hay horarios definidos para este día'
      };
    }

    if (dayHours.is_closed) {
      return {
        isAvailable: false,
        requiresApproval: true,
        reason: 'El negocio está cerrado este día'
      };
    }

    // Check if time is within business hours
    if (startTime < dayHours.start_time || endTime > dayHours.end_time) {
      return {
        isAvailable: true,
        requiresApproval: true,
        reason: `Fuera del horario de atención (${dayHours.start_time} - ${dayHours.end_time})`
      };
    }

    return {
      isAvailable: true,
      requiresApproval: false
    };
  }

  // Get business hours for a specific day
  getBusinessHoursForDay(dayOfWeek: number): BusinessHour | null {
    const businessHours = this.businessHoursSubject.value;
    return businessHours.find(bh => bh.day_of_week === dayOfWeek) || null;
  }

  // Check if a date is closed
  isDateClosed(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0];
    const closedDates = this.closedDatesSubject.value;
    return closedDates.some(cd => cd.date === dateStr && cd.is_active);
  }

  // Get available time slots for a specific date
  getAvailableTimeSlots(date: Date): string[] {
    const dayOfWeek = date.getDay();
    const businessHour = this.getBusinessHoursForDay(dayOfWeek);
    
    if (!businessHour || businessHour.is_closed || this.isDateClosed(date)) {
      return [];
    }

    const slots: string[] = [];
    const startHour = parseInt(businessHour.start_time.split(':')[0]);
    const endHour = parseInt(businessHour.end_time.split(':')[0]);

    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }

    return slots;
  }

  // Get day names in Spanish
  getDayName(dayOfWeek: number): string {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[dayOfWeek];
  }
}
