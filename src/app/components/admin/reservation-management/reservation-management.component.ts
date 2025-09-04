import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, Reservation, CancelReservationRequest } from '../../../services/admin.service';

interface DayGroup {
  date: string;
  displayDate: string;
  spaces: SpaceGroup[];
  expanded: boolean;
}

interface SpaceGroup {
  spaceId: number;
  spaceName: string;
  reservations: Reservation[];
  expanded: boolean;
}

@Component({
  selector: 'app-reservation-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reservation-management.component.html',
  styleUrls: ['./reservation-management.component.scss']
})

export class ReservationManagementComponent implements OnInit {
  reservations: Reservation[] = [];
  groupedReservations: DayGroup[] = [];
  pendingReservations: Reservation[] = [];
  loading = false;
  pendingLoading = false;
  error = '';
  success = '';
  showCancelModal = false;
  selectedReservation: Reservation | null = null;
  cancelForm: FormGroup;

  // Filtros
  filterForm: FormGroup;

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder
  ) {
    this.cancelForm = this.fb.group({
      reason: ['', Validators.required],
      penalty: [0, [Validators.min(0)]],
      notes: ['']
    });

    // Set default dates: today and today + 10 days
    const today = new Date();
    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(today.getDate() + 10);

    this.filterForm = this.fb.group({
      status: ['confirmed'],
      startDate: [this.formatDateForInput(today)],
      endDate: [this.formatDateForInput(tenDaysFromNow)]
    });
  }

  ngOnInit(): void {
    this.loadReservations();
    this.loadPendingReservations();
    this.filterForm.valueChanges.subscribe(() => {
      this.loadReservations();
    });
  }

  loadReservations(): void {
    this.loading = true;
    const filters = this.filterForm.value;
    this.adminService.getAllReservations(filters).subscribe({
      next: (reservations) => {
        this.reservations = reservations;
        this.groupReservations();
        this.loading = false;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al cargar las reservaciones';
        this.loading = false;
        console.error('Error loading reservations:', error);
        this.setAutoClearMessages();
      }
    });
  }

  loadPendingReservations(): void {
    this.pendingLoading = true;
    this.adminService.getAllReservations({ status: 'pending' }).subscribe({
      next: (reservations) => {
        this.pendingReservations = reservations.sort((a, b) => 
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
        this.pendingLoading = false;
      },
      error: (error) => {
        console.error('Error loading pending reservations:', error);
        this.pendingLoading = false;
      }
    });
  }

  groupReservations(): void {
    const grouped = new Map<string, Map<number, Reservation[]>>();

    // Group by date first, then by space
    this.reservations.forEach(reservation => {
      const date = new Date(reservation.start_time).toDateString();
      const spaceId = reservation.space?.id || 0;
      
      if (!grouped.has(date)) {
        grouped.set(date, new Map());
      }
      
      const dayGroup = grouped.get(date)!;
      if (!dayGroup.has(spaceId)) {
        dayGroup.set(spaceId, []);
      }
      
      dayGroup.get(spaceId)!.push(reservation);
    });

    // Convert to array format and sort
    this.groupedReservations = Array.from(grouped.entries())
      .map(([date, spaces]) => ({
        date,
        displayDate: this.formatDisplayDate(new Date(date)),
        expanded: false,
        spaces: Array.from(spaces.entries())
          .map(([spaceId, reservations]) => ({
            spaceId,
            spaceName: reservations[0]?.space?.name || 'Espacio Desconocido',
            reservations: reservations.sort((a, b) => 
              new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            ),
            expanded: false
          }))
          .sort((a, b) => a.spaceName.localeCompare(b.spaceName))
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  approveReservation(reservationId: number): void {
    this.adminService.approveReservation(reservationId).subscribe({
      next: () => {
        this.success = 'Reservación aprobada exitosamente';
        this.loadReservations();
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

  openCancelModal(reservation: Reservation): void {
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
        this.loadReservations();
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
    if (!dateTime) return 'N/A';
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

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDisplayDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  toggleDayExpansion(dayGroup: DayGroup): void {
    dayGroup.expanded = !dayGroup.expanded;
  }

  toggleSpaceExpansion(spaceGroup: SpaceGroup): void {
    spaceGroup.expanded = !spaceGroup.expanded;
  }

  getTotalReservationsForDay(dayGroup: DayGroup): number {
    return dayGroup.spaces.reduce((total, space) => total + space.reservations.length, 0);
  }
}
