import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  constructor(private http: HttpClient) {}

  getBusinessHours(): Observable<BusinessHour[]> {
    return this.http.get<BusinessHour[]>(`${this.apiUrl}/business-hours`);
  }

  getClosedDates(): Observable<ClosedDate[]> {
    return this.http.get<ClosedDate[]>(`${this.apiUrl}/closed-dates`);
  }
}
