import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, PendingReservation, CancelReservationRequest } from '../../../services/admin.service';

@Component({
  selector: 'app-reservation-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reservation-management.component.html',
  styleUrls: ['./reservation-management.component.scss']
})
export class ReservationManagementComponent implements OnInit {
  pendingReservations: PendingReservation[] = [];
  loading = false;
  error = '';
  success = '';
  showCancelModal = false;
  selectedReservation: PendingReservation | null = null;
  cancelForm: FormGroup;

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder
  ) {
    this.cancelForm = this.fb.group({
      reason: ['', Validators.required],
      penalty: [0, [Validators.min(0)]],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.loadPendingReservations();
  }

  loadPendingReservations(): void {
    this.loading = true;
    this.adminService.getPendingReservations().subscribe({
      next: (reservations) => {
        this.pendingReservations = reservations;
        this.loading = false;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al cargar reservaciones pendientes';
        this.loading = false;
        console.error('Error loading pending reservations:', error);
        this.setAutoClearMessages();
      }
    });
  }

    approveReservation(reservationId: number): void {
    this.adminService.approveReservation(reservationId).subscribe({
      next: () => {
        this.success = 'Reservación aprobada exitosamente';
        this.loadPendingReservations();
        this.setAutoClearMessages();
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al aprobar reservación';
        console.error('Error approving reservation:', error);
        this.setAutoClearMessages();
      }
    });
  }

  openCancelModal(reservation: PendingReservation): void {
    this.selectedReservation = reservation;
    this.showCancelModal = true;
    this.cancelForm.reset({
      reason: '',
      penalty: 0,
      notes: ''
    });
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.selectedReservation = null;
    this.cancelForm.reset();
  }

  cancelReservation(): void {
    if (!this.selectedReservation || this.cancelForm.invalid) return;

    const formData = this.cancelForm.value;
        this.adminService.cancelReservation(this.selectedReservation.id, formData).subscribe({
      next: () => {
        this.success = 'Reservación cancelada exitosamente';
        this.closeCancelModal();
        this.loadPendingReservations();
        this.setAutoClearMessages();
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al cancelar reservación';
        console.error('Error canceling reservation:', error);
        this.setAutoClearMessages();
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

  private setAutoClearMessages(): void {
    setTimeout(() => {
      this.success = '';
      this.error = '';
    }, 3000);
  }
}
