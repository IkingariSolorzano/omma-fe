import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, Reservation, CancelReservationRequest, UpdateReservationRequest, Space } from '../../../services/admin.service';
import { BusinessHoursService, BusinessHour } from '../../../services/business-hours.service';

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

interface TimeSlot {
  hour: number;
  timeLabel: string;
  isAvailable: boolean;
  isSelected?: boolean;
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
  spaces: Space[] = [];
  loading = false;
  pendingLoading = false;
  error = '';
  success = '';
  showCancelModal = false;
  showEditModal = false;
  selectedReservation: Reservation | null = null;
  cancelForm: FormGroup;
  editForm: FormGroup;
  
  // Edit modal specific data
  availableSpaces: Space[] = [];
  availableTimeSlots: TimeSlot[] = [];
  businessHours: BusinessHour[] = [];
  spaceSchedules: any[] = [];
  selectedEditDate: string = '';
  selectedEditSpaceId: number | null = null;

  // Filtros
  filterForm: FormGroup;

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private businessHoursService: BusinessHoursService
  ) {
    this.cancelForm = this.fb.group({
      reason: ['', Validators.required],
      penalty: [0, [Validators.min(0)]],
      notes: ['']
    });

    this.editForm = this.fb.group({
      space_id: ['', Validators.required],
      date: ['', Validators.required],
      start_time: [''],
      end_time: [''],
      notes: ['']
    });
    
    // Watch for date changes in edit form
    this.editForm.get('date')?.valueChanges.subscribe(date => {
      if (date) {
        this.onEditDateChange(date);
      }
    });
    
    // Watch for space changes in edit form
    this.editForm.get('space_id')?.valueChanges.subscribe(spaceId => {
      if (spaceId) {
        this.onEditSpaceChange(parseInt(spaceId));
      }
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
    this.loadSpaces();
    this.loadBusinessHours();
    this.loadSpaceSchedules();
    this.filterForm.valueChanges.subscribe(() => {
      this.loadReservations();
    });
  }

  loadReservations(): void {
    this.loading = true;
    const filters = this.filterForm.value;
    console.log('Loading reservations with filters:', filters);
    this.adminService.getAllReservations(filters).subscribe({
      next: (reservations) => {
        console.log('Raw reservations received:', reservations);
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

  loadSpaces(): void {
    console.log('Starting to load spaces...');
    this.adminService.getAllSpaces().subscribe({
      next: (spaces: Space[]) => {
        console.log('Raw spaces response:', spaces);
        this.spaces = spaces || [];
        console.log('Spaces loaded and assigned:', this.spaces);
        console.log('Spaces array length:', this.spaces.length);
      },
      error: (error: any) => {
        console.error('Error loading spaces:', error);
        console.error('Error details:', error.error);
        this.spaces = [];
      }
    });
  }

  loadBusinessHours(): void {
    this.businessHoursService.refreshData();
    this.businessHoursService.businessHours$.subscribe(hours => {
      this.businessHours = hours;
    });
  }

  loadSpaceSchedules(): void {
    this.adminService.getSchedules().subscribe({
      next: (schedules: any[]) => {
        this.spaceSchedules = schedules;
      },
      error: (error: any) => {
        console.error('Error loading space schedules:', error);
        this.spaceSchedules = [];
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

  openEditModal(reservation: Reservation): void {
    this.selectedReservation = reservation;
    
    // Format the date for the date input (YYYY-MM-DD)
    const startDate = new Date(reservation.start_time);
    const formattedDate = startDate.getFullYear() + '-' + 
      String(startDate.getMonth() + 1).padStart(2, '0') + '-' + 
      String(startDate.getDate()).padStart(2, '0');
    
    this.selectedEditDate = formattedDate;
    this.selectedEditSpaceId = reservation.space?.id || null;
    
    // Format times for time inputs (HH:MM)
    const startTime = String(startDate.getHours()).padStart(2, '0') + ':' + 
      String(startDate.getMinutes()).padStart(2, '0');
    
    const endDate = new Date(reservation.end_time);
    const endTime = String(endDate.getHours()).padStart(2, '0') + ':' + 
      String(endDate.getMinutes()).padStart(2, '0');
    
    // Set form values first
    this.editForm.patchValue({
      space_id: reservation.space?.id || '',
      date: formattedDate,
      start_time: startTime,
      end_time: endTime,
      notes: reservation.notes || ''
    });
    
    // Load available spaces for the selected date after form is set
    this.loadAvailableSpacesForDate(formattedDate);
    
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedReservation = null;
    this.editForm.reset();
    this.availableSpaces = [];
    this.availableTimeSlots = [];
    this.selectedEditDate = '';
    this.selectedEditSpaceId = null;
  }

  updateReservation(): void {
    if (!this.selectedReservation || this.editForm.invalid) return;

    const formData = this.editForm.value;
    
    // Create proper Date objects and format them as ISO strings
    const startDate = new Date(`${formData.date}T${formData.start_time}:00`);
    const endDate = new Date(`${formData.date}T${formData.end_time}:00`);
    
    const updateData: UpdateReservationRequest = {
      space_id: parseInt(formData.space_id),
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      notes: formData.notes
    };

    this.adminService.updateReservation(this.selectedReservation.id, updateData).subscribe({
      next: () => {
        this.success = 'Reservación actualizada exitosamente';
        this.closeEditModal();
        this.loadReservations();
        this.loadPendingReservations();
        this.setAutoClearMessages();
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al actualizar reservación';
        console.error('Error updating reservation:', error);
        console.error('Request data sent:', updateData);
        console.error('Full error response:', error?.error);
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

  private formatTimeForInput(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  loadAvailableSpacesForDate(date: string): void {
    if (!date) {
      this.availableSpaces = [];
      return;
    }

    // Ensure spaces is an array
    if (!Array.isArray(this.spaces)) {
      console.log('Spaces is not an array:', this.spaces);
      this.availableSpaces = [];
      return;
    }

    // Create date in local timezone to avoid GMT offset issues
    const dateParts = date.split('-');
    const selectedDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const dayOfWeek = selectedDate.getDay();
    
    console.log('Loading spaces for date:', date, 'dayOfWeek:', dayOfWeek);
    console.log('Selected date object:', selectedDate);
    console.log('Business hours:', this.businessHours);
    console.log('Space schedules:', this.spaceSchedules);
    console.log('Spaces array:', this.spaces);
    
    // Check if this day has business hours (is open)
    const businessHour = this.businessHours.find(bh => bh.day_of_week === dayOfWeek);
    
    if (!businessHour || businessHour.is_closed) {
      console.log('No business hours or closed for day:', dayOfWeek);
      this.availableSpaces = [];
      return;
    }

    // Filter spaces that have schedules for this day of week
    this.availableSpaces = this.spaces.filter(space => {
      const hasScheduleForDay = this.spaceSchedules.some(schedule => 
        schedule.space_id === space.id && 
        schedule.day_of_week === dayOfWeek &&
        schedule.is_active !== false
      );
      console.log(`Space ${space.name} (ID: ${space.id}) has schedule for day ${dayOfWeek}:`, hasScheduleForDay);
      return hasScheduleForDay;
    });
    
    console.log('Available spaces:', this.availableSpaces);
    
    // If a space was already selected, load its time slots
    if (this.selectedEditSpaceId) {
      this.loadAvailableTimeSlotsForSpace(this.selectedEditSpaceId, date);
    }
  }

  onEditDateChange(date: string): void {
    this.selectedEditDate = date;
    this.selectedEditSpaceId = null;
    this.availableTimeSlots = [];
    this.editForm.patchValue({ space_id: '', start_time: '', end_time: '' });
    this.loadAvailableSpacesForDate(date);
  }

  onEditSpaceChange(spaceId: number): void {
    this.selectedEditSpaceId = spaceId;
    this.availableTimeSlots = [];
    this.editForm.patchValue({ start_time: '', end_time: '' });
    
    if (this.selectedEditDate && spaceId) {
      this.loadAvailableTimeSlotsForSpace(spaceId, this.selectedEditDate);
    }
  }

  loadAvailableTimeSlotsForSpace(spaceId: number, date: string): void {
    if (!spaceId || !date) {
      this.availableTimeSlots = [];
      return;
    }

    // Create date in local timezone to avoid GMT offset issues
    const dateParts = date.split('-');
    const selectedDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const dayOfWeek = selectedDate.getDay();
    
    // Get business hours for this day
    const businessHour = this.businessHours.find(bh => bh.day_of_week === dayOfWeek);
    
    if (!businessHour || businessHour.is_closed) {
      this.availableTimeSlots = [];
      return;
    }

    const businessStartHour = parseInt(businessHour.start_time.split(':')[0]);
    const businessEndHour = parseInt(businessHour.end_time.split(':')[0]);
    
    this.availableTimeSlots = [];
    
    // Generate time slots for business hours
    for (let hour = businessStartHour; hour < businessEndHour; hour++) {
      const timeSlot: TimeSlot = {
        hour: hour,
        timeLabel: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
        isAvailable: this.isTimeSlotAvailable(spaceId, date, hour)
      };
      
      this.availableTimeSlots.push(timeSlot);
    }
  }

  isTimeSlotAvailable(spaceId: number, date: string, hour: number): boolean {
    // Check if this time slot conflicts with existing reservations
    // For now, we'll assume all slots are available
    // In a real implementation, you'd check against existing reservations
    
    const selectedDate = new Date(date);
    const now = new Date();
    
    // Don't allow past time slots for today
    if (this.isSameDay(selectedDate, now) && hour <= now.getHours()) {
      return false;
    }
    
    return true;
  }

  selectTimeSlot(timeSlot: TimeSlot): void {
    if (!timeSlot.isAvailable) return;
    
    const startTime = `${timeSlot.hour.toString().padStart(2, '0')}:00`;
    const endTime = `${(timeSlot.hour + 1).toString().padStart(2, '0')}:00`;
    
    this.editForm.patchValue({
      start_time: startTime,
      end_time: endTime
    });
    
    // Update selection state
    this.availableTimeSlots.forEach(slot => slot.isSelected = false);
    timeSlot.isSelected = true;
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
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
