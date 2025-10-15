import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Space } from './admin.service';

export interface Credits {
  total: number;
  active: number;
  expired: number;
  expiry_date: string;
}

export interface Reservation {
  id: number;
  space_id: number;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  space_name: string;
  cost_credits: number;
  created_at: string;
}

export interface CreateReservationRequest {
  space_id: number;
  start_time: string;
  end_time: string;
}

export interface Professional {
  id: number;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  description: string;
  credits: number;
  profile_image?: string;
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfessionalService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Credits Management
  getCredits(): Observable<Credits> {
    return this.http.get<any>(`${this.apiUrl}/credits`).pipe(
      map((response: any) => {
        // Handle the API response structure
        if (response.active_credits !== undefined) {
          return {
            total: response.active_credits,
            active: response.active_credits,
            expired: 0,
            expiry_date: response.credits?.[0]?.expiry_date || ''
          };
        }
        return response;
      })
    );
  }

  // Spaces
  getSpaces(): Observable<Space[]> {
    return this.http.get<any>(`${this.apiUrl}/spaces`).pipe(
      map((response: any) => {
        // Extract spaces array from response
        if (response.spaces && Array.isArray(response.spaces)) {
          return response.spaces;
        }
        // If response is already an array
        if (Array.isArray(response)) {
          return response;
        }
        return [];
      })
    );
  }

  // Reservations
  getMyReservations(): Observable<Reservation[]> {
    return this.http.get<any>(`${this.apiUrl}/reservations`).pipe(
      map((response: any) => {
        // Extract reservations array from response
        if (response.reservations && Array.isArray(response.reservations)) {
          return response.reservations;
        }
        // If response is already an array
        if (Array.isArray(response)) {
          return response;
        }
        return [];
      })
    );
  }

  createReservation(reservationData: CreateReservationRequest): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.apiUrl}/reservations`, reservationData);
  }

  cancelReservation(reservationId: number, body: { credits_to_refund: number }): Observable<any> {
    return this.http.request('DELETE', `${this.apiUrl}/reservations/${reservationId}`, { body: body });
  }

  // Schedules
  getSchedules(): Observable<any[]> {
    return this.http.get<{schedules: any[]}>(`${this.apiUrl}/schedules`).pipe(
      map(response => response.schedules || [])
    );
  }

  // Public directory
  getProfessionalDirectory(searchQuery?: string, specialty?: string): Observable<Professional[]> {
    let params: any = {};
    if (searchQuery) params.q = searchQuery;
    if (specialty) params.specialty = specialty;
    
    return this.http.get<{professionals: Professional[]}>(`${this.apiUrl}/professionals`, { params })
      .pipe(map(response => response.professionals));
  }

  // Profile management
  uploadProfilePicture(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('profile_picture', file);
    return this.http.post(`${this.apiUrl}/profile/picture`, formData);
  }

  changePassword(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile/password`, data);
  }

  updateProfile(profileData: {name?: string, phone?: string, specialty?: string, description?: string}): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile`, profileData);
  }
}
