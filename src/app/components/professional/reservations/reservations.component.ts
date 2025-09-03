import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfessionalService, Reservation } from '../../../services/professional.service';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss'
})
export class ReservationsComponent implements OnInit {
  reservations: Reservation[] = [];
  loading = false;
  error = '';
  success = '';

  constructor(private professionalService: ProfessionalService) {}

  ngOnInit(): void {
    this.loadReservations();
  }

  loadReservations(): void {
    this.loading = true;
    this.professionalService.getMyReservations().subscribe({
      next: (reservations) => {
        this.reservations = reservations.sort((a, b) => 
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        );
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Error al cargar reservaciones';
        this.loading = false;
        console.error('Error loading reservations:', error);
      }
    });
  }

  cancelReservation(reservationId: number): void {
    if (confirm('¿Estás seguro de que quieres cancelar esta reservación?')) {
      this.professionalService.cancelReservation(reservationId).subscribe({
        next: () => {
          this.success = 'Reservación cancelada exitosamente';
          this.loadReservations();
        },
        error: (error) => {
          this.error = 'Error al cancelar reservación';
          console.error('Error cancelling reservation:', error);
        }
      });
    }
  }

  formatDateTime(dateTime: string): string {
    const date = new Date(dateTime);
    
    // Format date in Spanish
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    
    return date.toLocaleString('es-ES', options);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'confirmed':
        return 'Confirmada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  }

  canCancel(reservation: Reservation): boolean {
    const now = new Date();
    const startTime = new Date(reservation.start_time);
    return reservation.status !== 'cancelled' && startTime > now;
  }

  willHavePenalty(reservation: Reservation): boolean {
    const now = new Date();
    const startTime = new Date(reservation.start_time);
    const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return hoursUntilStart < 24 && hoursUntilStart > 0;
  }
}
