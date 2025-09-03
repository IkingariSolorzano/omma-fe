import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { CommonModule } from '@angular/common';
import { ProfessionalService, CreateReservationRequest, Credits, Reservation } from '../../../services/professional.service';
import { Space } from '../../../services/admin.service';
import { BusinessHoursService, BusinessHour, ClosedDate } from '../../../services/business-hours.service';

@Component({
  selector: 'app-space-booking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './space-booking.component.html',
  styleUrls: ['./space-booking.component.scss']
})
export class SpaceBookingComponent implements OnInit {
  spaces: Space[] = [];
  credits: Credits | null = null;
  loading = false;
  error = '';
  success = '';
  
  // Calendar state
  currentDate = new Date();
  reservations: any[] = [];
  existingReservations: any[] = [];
  selectedDate: Date | null = null;
  calendarDays: CalendarDay[] = [];
  selectedDayReservations: Reservation[] = [];
  
  // Day view state
  showDayView = false;
  dayViewHours: HourSlot[] = [];
  businessHours: BusinessHour[] = [];
  closedDates: ClosedDate[] = [];
  spaceSchedules: any[] = [];
  
  // Booking state
  selectedHour: HourSlot | null = null;
  selectedSpace: Space | null = null;
  selectedHourSlot: HourSlot | null = null;
  selectedSpaceSlot: SpaceSlot | null = null;
  showBookingConfirmation = false;
  showSpecialRequestConfirmation = false;

  myReservations: Reservation[] = [];
  selectedReservationForDetail: Reservation | null = null;

  constructor(
    private professionalService: ProfessionalService,
    private businessHoursService: BusinessHoursService
  ) {}

  translateStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'confirmed': 'Confirmada',
      'pending': 'Pendiente',
      'cancelled': 'Cancelada'
    };
    return statusMap[status] || status;
  }

  private refreshAfterReservationChange(): void {
    this.loading = true;
    this.error = '';
    // Reload credits and my reservations, then update day list and calendar
    forkJoin({
      credits: this.professionalService.getCredits(),
      myRes: this.professionalService.getMyReservations()
    }).subscribe({
      next: ({ credits, myRes }) => {
        this.credits = credits;
        this.myReservations = myRes;
        this.existingReservations = myRes;

        if (this.selectedDate) {
          this.selectedDayReservations = this.myReservations
            .filter(r => this.isSameDay(new Date(r.start_time), this.selectedDate!))
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        }

        this.selectedReservationForDetail = null;
        this.generateDayView();
        this.loading = false;
        this.clearSelection();
      },
      error: (err) => {
        console.error('Error refreshing data after reservation change:', err);
        this.loading = false;
      }
    });
  }

  getReservationCancellationState(reservation: any): { canCancel: boolean; hasPenalty: boolean } {
    if (reservation.status === 'cancelled') {
      return { canCancel: false, hasPenalty: false };
    }

    // Pending reservations can be cancelled without penalty.
    if (reservation.status === 'pending') {
      const reservationTime = new Date(reservation.start_time).getTime();
      const now = new Date().getTime();
      const hoursDifference = (reservationTime - now) / (1000 * 60 * 60);
      // Allow cancellation only for future pending reservations
      return { canCancel: hoursDifference > 0, hasPenalty: false };
    }

    if (reservation.status === 'confirmed') {
      const reservationTime = new Date(reservation.start_time).getTime();
      const now = new Date().getTime();
      const hoursDifference = (reservationTime - now) / (1000 * 60 * 60);
      
      const canCancel = hoursDifference > 0; // Can't cancel past reservations
      const hasPenalty = hoursDifference <= 24;

      return { canCancel, hasPenalty };
    }

    return { canCancel: false, hasPenalty: false }; // Default for any other status
  }

  cancelReservation(reservation: any): void {
    const state = this.getReservationCancellationState(reservation);
    if (!state.canCancel) return;

    const title = '¿Estás seguro?';
    let text = 'Esta acción no se puede deshacer.';
    let confirmButtonText = 'Sí, ¡cancelar!';

    if (state.hasPenalty) {
      text = 'Se aplicará una penalización de 4 créditos por cancelación tardía.';
    } else {
      text = 'No se aplicará ninguna penalización.';
    }

    Swal.fire({
      title: title,
      text: text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: confirmButtonText,
      cancelButtonText: 'No, mantener'
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.professionalService.cancelReservation(reservation.id).subscribe({
      next: () => {
        this.success = 'Reservación cancelada exitosamente.';
        this.error = '';

        // Use forkJoin to wait for all data to be reloaded before updating the UI
        forkJoin({
          credits: this.professionalService.getCredits(),
          reservations: this.professionalService.getMyReservations()
        }).subscribe(({ credits, reservations }) => {
          this.credits = credits;
          this.myReservations = reservations;
          this.existingReservations = reservations;

          // Update the daily reservation list
          if (this.selectedDate) {
            this.selectedDayReservations = this.myReservations
              .filter(r => this.isSameDay(new Date(r.start_time), this.selectedDate!))
              .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
          }

          this.selectedReservationForDetail = null; // Reset detail view

          // Regenerate the calendar grid
          this.generateDayView();
          this.loading = false;
        });
      },
      error: (err) => {
        this.error = err.error.error || 'Ocurrió un error al cancelar la reservación.';
        this.success = '';
        this.loading = false;
      }
    });
      }
    });
  }

  ngOnInit(): void {
    this.loadSpaces();
    this.loadCredits();
    this.loadBusinessData();
    this.loadMyReservations();
    this.loadExistingReservations();
    this.loadSpaceSchedules();
    this.generateCalendar();
  }

  loadSpaces(): void {
    this.professionalService.getSpaces().subscribe({
      next: (spaces) => {
        this.spaces = spaces;
      },
      error: (error) => {
        this.error = 'Error al cargar espacios';
        console.error('Error loading spaces:', error);
      }
    });
  }

  loadCredits(): void {
    this.professionalService.getCredits().subscribe({
      next: (credits) => {
        this.credits = credits;
      },
      error: (error) => {
        console.error('Error loading credits:', error);
      }
    });
  }

  loadExistingReservations(): void {
    this.professionalService.getMyReservations().subscribe({
      next: (reservations: any) => {
        console.log('Existing reservations loaded:', reservations);
        this.existingReservations = reservations;
        if (this.showDayView) {
          this.generateDayView();
        }
      },
      error: (error: any) => {
        console.error('Error loading existing reservations:', error);
        this.existingReservations = [];
      }
    });
  }

  loadSpaceSchedules(): void {
    this.professionalService.getSchedules().subscribe({
      next: (response: any) => {
        console.log('Raw schedules response:', response);
        // Handle different response formats
        if (Array.isArray(response)) {
          this.spaceSchedules = response;
        } else if (response && Array.isArray(response.schedules)) {
          this.spaceSchedules = response.schedules;
        } else if (response && Array.isArray(response.data)) {
          this.spaceSchedules = response.data;
        } else {
          console.warn('Unexpected schedules response format:', response);
          this.spaceSchedules = [];
        }
        console.log('Space schedules loaded:', this.spaceSchedules);
        this.generateDayView();
      },
      error: (error) => {
        console.error('Error loading space schedules:', error);
        this.spaceSchedules = [];
        this.generateDayView(); // Still generate view with fallback logic
      }
    });
  }

  loadBusinessData(): void {
    // Force refresh of business hours data
    this.businessHoursService.refreshData();
    
    this.businessHoursService.businessHours$.subscribe(hours => {
      console.log('Business hours loaded:', hours);
      this.businessHours = hours;
      if (hours.length > 0) {
        this.generateCalendar();
      }
    });
    
    this.businessHoursService.closedDates$.subscribe(dates => {
      console.log('Closed dates loaded:', dates);
      this.closedDates = dates;
      if (this.businessHours.length > 0) {
        this.generateCalendar();
      }
    });
  }

  loadMyReservations() {
    this.professionalService.getMyReservations().subscribe(reservations => {
      this.myReservations = reservations;
      this.generateCalendar();
    });
  }

  isDayWithMyReservation(day: Date): boolean {
    if (!day) return false;
    return this.myReservations.some(reservation => {
      const reservationDate = new Date(reservation.start_time);
      return reservationDate.getFullYear() === day.getFullYear() &&
             reservationDate.getMonth() === day.getMonth() &&
             reservationDate.getDate() === day.getDate();
    });
  }

  generateCalendar(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    this.calendarDays = [];
    
    // Debug: Log business hours data
    console.log('Business Hours:', this.businessHours);
    console.log('Closed Dates:', this.closedDates);
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayOfWeek = date.getDay();
      const businessHour = this.businessHours.find(bh => bh.day_of_week === dayOfWeek);
      const isClosedDate = this.closedDates.some(cd => 
        cd.date === date.toISOString().split('T')[0] && cd.is_active
      );
      
      // Debug: Log each day's evaluation
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isAfterToday = date >= today;
      
      console.log(`Date: ${date.toDateString()}, DayOfWeek: ${dayOfWeek}, BusinessHour:`, businessHour, 
                  `IsClosedDate: ${isClosedDate}, IsAfterToday: ${isAfterToday}`);
      
      // Simplified logic for debugging
      let isActive = false;
      if (businessHour && !businessHour.is_closed && !isClosedDate && isAfterToday) {
        isActive = true;
      }
      
      this.calendarDays.push({
        date: new Date(date),
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: this.isToday(date),
        isActive: isActive,
        isSelected: !!(this.selectedDate && this.isSameDay(date, this.selectedDate)),
        hasMyReservation: this.isDayWithMyReservation(date)
      });
    }
  }

  selectDate(day: CalendarDay): void {
    this.selectedReservationForDetail = null; // Reset detail view on new day selection

    if (!day.isActive) {
      this.selectedDayReservations = [];
      return;
    }

    this.selectedDate = day.date;
    this.loadMyReservations(); // Force refresh reservations for the user
    this.generateCalendar(); // Regenerate to show selection

    if (day.hasMyReservation) {
      this.selectedDayReservations = this.myReservations
        .filter(reservation => {
          const reservationDate = new Date(reservation.start_time);
          return this.isSameDay(reservationDate, day.date);
        })
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    } else {
      this.selectedDayReservations = [];
    }

    this.generateDayView();
    this.showDayView = true;
  }

  generateDayView(): void {
    if (!this.selectedDate) return;
    
    const dayOfWeek = this.selectedDate.getDay();
    const businessHour = this.businessHours.find(bh => bh.day_of_week === dayOfWeek);
    
    if (!businessHour || businessHour.is_closed) {
      this.dayViewHours = [];
      return;
    }
    
    // Get all possible hours from business hours
    const businessStartHour = parseInt(businessHour.start_time.split(':')[0]);
    const businessEndHour = parseInt(businessHour.end_time.split(':')[0]);
    
    this.dayViewHours = [];
    
    // Check if spaceSchedules is loaded and is an array
    if (!Array.isArray(this.spaceSchedules)) {
      console.warn('Space schedules not loaded yet, using fallback logic');
      // Fallback to original logic if schedules aren't loaded
      for (let hour = businessStartHour; hour < businessEndHour; hour++) {
        const hourSlot: HourSlot = {
          hour: hour,
          timeLabel: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
          spaces: this.spaces.map(space => ({
            space: space,
            isAvailable: this.isSpaceAvailable(space, hour),
            isSelected: false
          }))
        };
        
        this.dayViewHours.push(hourSlot);
      }
      return;
    }
    
    // Generate extended hours (7 AM to 10 PM) to allow special requests
    const extendedStartHour = 7;
    const extendedEndHour = 22;
    
    for (let hour = extendedStartHour; hour < extendedEndHour; hour++) {
      const isWithinBusinessHours = hour >= businessStartHour && hour < businessEndHour;
      
      const spacesForThisHour = this.spaces.map(space => {
        const spaceSchedule = this.spaceSchedules.find(schedule => 
          schedule.space_id === space.id && schedule.day_of_week === dayOfWeek && schedule.is_active
        );
        
        let isSpaceAvailableForHour = false;
        let requiresSpecialApproval = false;
        
        if (isWithinBusinessHours && spaceSchedule) {
          const spaceStartHour = parseInt(spaceSchedule.start_time.split(':')[0]);
          const spaceEndHour = parseInt(spaceSchedule.end_time.split(':')[0]);
          isSpaceAvailableForHour = hour >= spaceStartHour && hour < spaceEndHour;
        } else if (!isWithinBusinessHours) {
          // Outside business hours - available for special requests
          requiresSpecialApproval = true;
          isSpaceAvailableForHour = true;
        }
        
        return {
          space: space,
          isAvailable: isSpaceAvailableForHour && this.isSpaceAvailable(space, hour),
          isSelected: false,
          requiresSpecialApproval: requiresSpecialApproval
        };
      });
      
      // Always add hour slot to maintain consistent grid structure
      const hourSlot: HourSlot = {
        hour: hour,
        timeLabel: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
        spaces: spacesForThisHour,
        isOutsideBusinessHours: !isWithinBusinessHours
      };
      
      this.dayViewHours.push(hourSlot);
    }
  }

  isSpaceAvailable(space: Space, hour: number): boolean {
    if (!this.selectedDate) return false;
    
    // Check if there's an existing reservation for this space, date, and hour
    const reservationDateTime = new Date(this.selectedDate);
    reservationDateTime.setHours(hour, 0, 0, 0);
    
    const hasExistingReservation = this.existingReservations.some(reservation => {
      if (reservation.space_id !== space.id) return false;
      if (reservation.status === 'cancelled') return false;
      
      const reservationStart = new Date(reservation.start_time);
      const reservationEnd = new Date(reservation.end_time);
      
      // Check if the requested hour overlaps with existing reservation
      const requestedStart = new Date(reservationDateTime);
      const requestedEnd = new Date(reservationDateTime);
      requestedEnd.setHours(hour + 1);
      
      return (requestedStart < reservationEnd && requestedEnd > reservationStart);
    });
    
    console.log(`Space ${space.id} at ${hour}:00 on ${this.selectedDate.toDateString()}: ${hasExistingReservation ? 'OCCUPIED' : 'AVAILABLE'}`);
    
    return !hasExistingReservation;
  }

  selectHourSpace(hourSlot: HourSlot, spaceSlot: SpaceSlot): void {
    if (!spaceSlot.isAvailable) return;
    
    // Clear previous selections
    this.dayViewHours.forEach(hour => {
      hour.spaces.forEach(space => space.isSelected = false);
    });
    
    // Select the clicked slot
    spaceSlot.isSelected = true;
    this.selectedHourSlot = hourSlot;
    this.selectedSpaceSlot = spaceSlot;
    
    // Check if this is a special request
    if (spaceSlot.requiresSpecialApproval) {
      this.showSpecialRequestConfirmation = true;
    } else {
      this.showBookingConfirmation = true;
    }
  }

  confirmBooking(): void {
    if (!this.selectedDate || !this.selectedHourSlot || !this.selectedSpaceSlot) return;
    
    if (!this.hasEnoughCredits()) {
      this.error = 'No tienes suficientes créditos para esta reservación';
      return;
    }
    
    this.loading = true;
    this.error = '';
    this.success = '';
    
    const startTime = new Date(this.selectedDate);
    startTime.setHours(this.selectedHourSlot.hour, 0, 0, 0);
    
    const endTime = new Date(this.selectedDate);
    endTime.setHours(this.selectedHourSlot.hour + 1, 0, 0, 0);
    
    const reservationData = {
      space_id: this.selectedSpaceSlot.space.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    };

    this.professionalService.createReservation(reservationData).subscribe({
      next: (reservation) => {
        this.success = 'Reservación creada exitosamente';
        // Refresh credits and reservations, then update day list
        this.refreshAfterReservationChange();
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al crear la reservación';
        this.loading = false;
        console.error('Error creating reservation:', error);
      }
    });
  }

  confirmSpecialRequest(): void {
    if (!this.selectedDate || !this.selectedHourSlot || !this.selectedSpaceSlot) return;
    
    this.loading = true;
    this.error = '';
    this.success = '';
    
    const startTime = new Date(this.selectedDate);
    startTime.setHours(this.selectedHourSlot.hour, 0, 0, 0);
    
    const endTime = new Date(this.selectedDate);
    endTime.setHours(this.selectedHourSlot.hour + 1, 0, 0, 0);
    
    const reservationData = {
      space_id: this.selectedSpaceSlot.space.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    };

    this.professionalService.createReservation(reservationData).subscribe({
      next: (reservation) => {
        this.success = 'Solicitud de reserva especial enviada. Espera la aprobación del administrador.';
        this.refreshAfterReservationChange();
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al enviar la solicitud';
        this.loading = false;
        console.error('Error creating special request:', error);
      }
    });
  }

  clearSelection(): void {
    this.selectedHourSlot = null;
    this.selectedSpaceSlot = null;
    this.showBookingConfirmation = false;
    this.showSpecialRequestConfirmation = false;
    
    this.dayViewHours.forEach(hour => {
      hour.spaces.forEach(space => space.isSelected = false);
    });
  }

  cancelBooking(): void {
    this.clearSelection();
  }

  hasEnoughCredits(): boolean {
    if (!this.credits || !this.selectedSpaceSlot) return false;
    const totalCost = this.selectedSpaceSlot.requiresSpecialApproval 
      ? this.selectedSpaceSlot.space.cost_credits + 1 
      : this.selectedSpaceSlot.space.cost_credits;
    return this.credits.active >= totalCost;
  }

  resetSelection(): void {
    this.selectedHour = null;
    this.selectedSpace = null;
    this.dayViewHours.forEach(h => {
      h.spaces.forEach(s => s.isSelected = false);
    });
  }

  backToCalendar(): void {
    this.showDayView = false;
    this.resetSelection();
  }

  previousMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.generateCalendar();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return this.isSameDay(date, today);
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  getMonthName(): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[this.currentDate.getMonth()];
  }

  formatSelectedDate(): string {
    if (!this.selectedDate) return '';
    
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    
    const dayName = days[this.selectedDate.getDay()];
    const day = this.selectedDate.getDate();
    const monthName = months[this.selectedDate.getMonth()];
    const year = this.selectedDate.getFullYear();
    
    return `${dayName}, ${day} de ${monthName} de ${year}`;
  }

  selectReservationForDetail(reservation: Reservation): void {
    this.selectedReservationForDetail = reservation;
  }

  getSpaceSlotClass(spaceSlot: SpaceSlot): string {
    if (!spaceSlot.isAvailable) return 'bg-gray-300 cursor-not-allowed';
    if (spaceSlot.isSelected) return 'bg-blue-500 text-white';
    if (spaceSlot.requiresSpecialApproval) return 'bg-orange-100 hover:bg-orange-200 cursor-pointer border-orange-300';
    return 'bg-green-100 hover:bg-green-200 cursor-pointer';
  }
}

// Interfaces
interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isActive: boolean;
  isSelected: boolean;
  hasMyReservation: boolean;
}

interface HourSlot {
  hour: number;
  timeLabel: string;
  spaces: SpaceSlot[];
  isOutsideBusinessHours?: boolean;
}

interface SpaceSlot {
  space: Space;
  isAvailable: boolean;
  isSelected: boolean;
  requiresSpecialApproval?: boolean;
}
