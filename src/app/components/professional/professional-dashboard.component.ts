import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../services/auth.service';
import { ProfessionalService, Credits, Reservation } from '../../services/professional.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-professional-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './professional-dashboard.component.html',
  styleUrl: './professional-dashboard.component.scss'
})
export class ProfessionalDashboardComponent implements OnInit {
  currentUser: User | null = null;
  credits: Credits | null = null;
  upcomingReservations: Reservation[] = [];
  loading = false;

  constructor(
    private authService: AuthService,
    private professionalService: ProfessionalService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    let creditsLoaded = false;
    let reservationsLoaded = false;

    const checkLoadingComplete = () => {
      if (creditsLoaded && reservationsLoaded) {
        this.loading = false;
      }
    };

    // Load credits
    this.professionalService.getCredits().subscribe({
      next: (credits) => {
        this.credits = credits;
        creditsLoaded = true;
        checkLoadingComplete();
      },
      error: (error) => {
        console.error('Error loading credits:', error);
        creditsLoaded = true;
        checkLoadingComplete();
      }
    });

    // Load reservations
    this.professionalService.getMyReservations().subscribe({
      next: (reservations) => {
        const now = new Date();
        this.upcomingReservations = reservations
          .filter(r => new Date(r.start_time) > now && r.status !== 'cancelled')
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .slice(0, 5);
        reservationsLoaded = true;
        checkLoadingComplete();
      },
      error: (error) => {
        console.error('Error loading reservations:', error);
        this.upcomingReservations = [];
        reservationsLoaded = true;
        checkLoadingComplete();
      }
    });
  }


  formatDateTime(dateTime: string): string {
    return new Date(dateTime).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getAvailableHours(): number {
    return this.credits ? Math.floor(this.credits.active / 10) : 0;
  }

  getDaysUntilExpiry(): number {
    if (!this.credits?.expiry_date) return 0;
    const expiry = new Date(this.credits.expiry_date);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
