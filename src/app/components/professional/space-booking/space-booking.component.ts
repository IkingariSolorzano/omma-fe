import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import Swal, { SweetAlertResult } from 'sweetalert2';
import { CommonModule } from '@angular/common';
import { ProfessionalService, CreateReservationRequest, Credits, Reservation } from '../../../services/professional.service';
import { AdminService, CalendarSlot, Space } from '../../../services/admin.service';
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
  reservations: any[] = [];  // deprecated, keeping for compatibility
  existingReservations: any[] = [];
  selectedDate: Date | null = null;
  calendarDays: CalendarDay[] = [];  // Month view days with slots and status
  selectedDayReservations: Reservation[] = [];
  
  // Day view state
  showDayView = false;
  dayViewHours: HourSlot[] = [];
  businessHours: BusinessHour[] = [];
  closedDates: ClosedDate[] = [];
  spaceSchedules: any[] = [];
  // Admin-like calendar slots for month view and availability checks
  calendarSlots: CalendarSlot[] = [];
  
  // Booking state
  selectedSlots: { hourSlot: HourSlot, spaceSlot: SpaceSlot }[] = [];
  showBookingConfirmation = false;
  showSpecialRequestConfirmation = false;

  myReservations: Reservation[] = [];
  selectedReservationForDetail: Reservation | null = null;

  constructor(
    private professionalService: ProfessionalService,
    private businessHoursService: BusinessHoursService,
    private adminService: AdminService
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
    this.loadInitialData();
  }

  getReservationCancellationState(reservation: any): { canCancel: boolean; creditsToRefund: number } {
    if (reservation.status !== 'confirmed') {
      // Only confirmed reservations can be cancelled with this logic
      return { canCancel: reservation.status === 'pending', creditsToRefund: 0 };
    }

    const reservationTime = new Date(reservation.start_time).getTime();
    const now = new Date().getTime();
    const hoursDifference = (reservationTime - now) / (1000 * 60 * 60);

    if (hoursDifference <= 0) {
      return { canCancel: false, creditsToRefund: 0 }; // Cannot cancel past reservations
    }

    if (hoursDifference < 24) {
      // Within 24 hours, refund 5 credits
      return { canCancel: true, creditsToRefund: 5 };
    } else {
      // More than 24 hours, refund full amount
      return { canCancel: true, creditsToRefund: reservation.cost_credits };
    }
  }

  cancelReservation(reservation: any): void {
    const state = this.getReservationCancellationState(reservation);
    if (!state.canCancel) return;

    const title = '¿Estás seguro de cancelar?';
    let text = `Se te reembolsarán ${state.creditsToRefund} de los ${reservation.cost_credits} créditos utilizados.`;
    if (state.creditsToRefund === reservation.cost_credits) {
      text = `Se te reembolsarán todos tus créditos (${reservation.cost_credits}).`;
    } else if (state.creditsToRefund === 0) {
      text = 'No se reembolsarán créditos por esta cancelación.';
    }

    Swal.fire({
      title: title,
      text: text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No, mantener'
    }).then((result: SweetAlertResult) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.professionalService.cancelReservation(reservation.id, { credits_to_refund: state.creditsToRefund }).subscribe({
          next: () => {
            this.success = 'Reservación cancelada exitosamente.';
            this.error = '';
            this.refreshAfterReservationChange();
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
    this.loadInitialData();
  }

  // This method is now the single source of truth for loading all calendar-related data.
  // It ensures that all data is fetched before the UI is rendered, preventing race conditions.

  loadInitialData(): void {
    this.loading = true;
    const start = this.getCalendarStartDate();
    const end = this.getCalendarEndDate();

    const calendarParams = {
      period: 'custom' as const,
      start_date: this.toISODateString(start),
      end_date: this.toISODateString(end)
    };

    forkJoin({
      spaces: this.professionalService.getSpaces(),
      credits: this.professionalService.getCredits(),
      businessHours: this.businessHoursService.getBusinessHours(),
      closedDates: this.businessHoursService.getClosedDates(),
      schedules: this.professionalService.getSchedules(),
      calendarSlots: this.adminService.getCalendar(calendarParams),
      myReservations: this.professionalService.getMyReservations()
    }).subscribe({
      next: (data) => {
        this.spaces = data.spaces;
        this.credits = data.credits;
        this.businessHours = data.businessHours;
        this.closedDates = data.closedDates;
        this.spaceSchedules = this.normalizeSchedules(data.schedules);
        this.calendarSlots = data.calendarSlots;
        this.myReservations = data.myReservations;

        this.existingReservations = (data.calendarSlots || []).map((s: any) => ({
          id: s.id,
          space_id: s.space_id,
          start_time: s.start_time,
          end_time: s.end_time,
          status: s.status
        }));

        this.generateCalendar();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar los datos iniciales. Por favor, intente de nuevo.';
        console.error('Error loading initial data:', err);
        this.loading = false;
      }
    });
  }



  // Load calendar slots for the visible month/week similar to admin calendar

  private normalizeSchedules(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    } else if (response && Array.isArray(response.schedules)) {
      return response.schedules;
    } else if (response && Array.isArray(response.data)) {
      return response.data;
    }
    console.warn('Unexpected schedules response format:', response);
    return [];
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
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayOfWeek = date.getDay();
      const businessHour = this.businessHours.find(bh => bh.day_of_week === dayOfWeek);
      const isClosedDate = this.closedDates.some(cd => cd.date === this.toISODateString(date) && cd.is_active);
      
      // Debug: Log each day's evaluation
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isAfterToday = date >= today;
      
      // Simplified logic for debugging
      let isActive = false;
      if (businessHour && !businessHour.is_closed && !isClosedDate && isAfterToday) {
        isActive = true;
      }
      
      const slotsForDay = this.getSlotsForDate(date);
      this.calendarDays.push({
        date: new Date(date),
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: this.isToday(date),
        isActive: isActive,
        isSelected: !!(this.selectedDate && this.isSameDay(date, this.selectedDate)),
        hasMyReservation: this.isDayWithMyReservation(date),
        slots: slotsForDay
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

    const now = new Date();
    if (this.isSameDay(this.selectedDate, now) && hour <= now.getHours()) {
      return false; // The hour is in the past for today
    }
    
    // Check if there's an existing reservation (any user) for this space, date, and hour using calendarSlots
    const reservationDateTime = new Date(this.selectedDate);
    reservationDateTime.setHours(hour, 0, 0, 0);
    
    const hasExistingReservation = (this.calendarSlots || []).some((slot: CalendarSlot) => {
      if (slot.space_id !== space.id) return false;
      if (['cancelled'].includes(slot.status)) return false;
      const slotStart = new Date(slot.start_time);
      const slotEnd = new Date(slot.end_time);
      const requestedStart = new Date(reservationDateTime);
      const requestedEnd = new Date(reservationDateTime);
      requestedEnd.setHours(hour + 1);
      return (requestedStart < slotEnd && requestedEnd > slotStart);
    });
    
    // console.log(`Space ${space.id} at ${hour}:00 on ${this.selectedDate.toDateString()}: ${hasExistingReservation ? 'OCCUPIED' : 'AVAILABLE'}`);
    
    return !hasExistingReservation;
  }

  selectHourSpace(hourSlot: HourSlot, spaceSlot: SpaceSlot): void {
    if (!spaceSlot.isAvailable) return;

    const selectionIndex = this.selectedSlots.findIndex(
      s => s.hourSlot.hour === hourSlot.hour && s.spaceSlot.space.id === spaceSlot.space.id
    );

    if (selectionIndex > -1) {
      // Deselect the slot
      this.selectedSlots.splice(selectionIndex, 1);
      spaceSlot.isSelected = false;
    } else {
      // Check if the new selection is for a different space
      if (this.selectedSlots.length > 0 && this.selectedSlots[0].spaceSlot.space.id !== spaceSlot.space.id) {
        // Clear existing selection if space is different
        this.clearSelection();
      }
      // Add the new slot to the selection
      this.selectedSlots.push({ hourSlot, spaceSlot });
      spaceSlot.isSelected = true;
    }

    // Sort selected slots by hour
    this.selectedSlots.sort((a, b) => a.hourSlot.hour - b.hourSlot.hour);

    // Show confirmation if there's any selection
    this.showBookingConfirmation = this.selectedSlots.length > 0;
    this.showSpecialRequestConfirmation = this.selectedSlots.length > 0 && this.selectedSlots.some(s => s.spaceSlot.requiresSpecialApproval);
  }

  confirmBooking(): void {
    if (!this.selectedDate || this.selectedSlots.length === 0) return;

    if (!this.hasEnoughCredits()) {
      this.error = 'No tienes suficientes créditos para esta reservación';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    const reservationsToCreate = this.selectedSlots.map(slot => {
      const startTime = new Date(this.selectedDate!);
      startTime.setHours(slot.hourSlot.hour, 0, 0, 0);
      const endTime = new Date(this.selectedDate!);
      endTime.setHours(slot.hourSlot.hour + 1, 0, 0, 0);
      
      // Format as local time instead of UTC to preserve timezone
      const formatLocalDateTime = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-06:00`;
      };
      
      return {
        space_id: slot.spaceSlot.space.id,
        start_time: formatLocalDateTime(startTime),
        end_time: formatLocalDateTime(endTime),
      };
    });

    const creationObservables = reservationsToCreate.map(resData => this.professionalService.createReservation(resData));

    forkJoin(creationObservables).subscribe({
      next: (responses: any[]) => {
        this.success = 'Reservaciones creadas exitosamente';
        const newReservations = responses.map(res => res.reservation).filter(Boolean);

        if (newReservations.length > 0) {
          // 1. Update local reservation arrays
          this.myReservations = [...this.myReservations, ...newReservations];
          if (this.selectedDate) {
            this.selectedDayReservations = this.myReservations
              .filter(r => this.isSameDay(new Date(r.start_time), this.selectedDate!))
              .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
          }

          // 2. Manually create and add new calendar slots for optimistic availability update
          const newSlots = newReservations.map(res => ({
            id: res.id, space_id: res.space_id, start_time: res.start_time, end_time: res.end_time, status: res.status,
            user_id: res.user_id, space_name: this.spaces.find(s => s.id === res.space_id)?.name || '', user_name: ''
          }));
          this.calendarSlots = [...this.calendarSlots, ...newSlots];

          // 3. Regenerate all relevant UI components with the new, correct state
          this.generateDayView();
          this.generateCalendar();
          this.clearSelection();
        }

        // 4. Refresh only secondary data (credits)
        this.professionalService.getCredits().subscribe(credits => this.credits = credits);
        this.loading = false;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al crear las reservaciones';
        this.loading = false;
        console.error('Error creating reservations:', error);
      }
    });
  }

  confirmSpecialRequest(): void {
    if (!this.selectedDate || this.selectedSlots.length === 0) return;

    this.loading = true;
    this.error = '';
    this.success = '';

    const requestsToCreate = this.selectedSlots.map(slot => {
      const startTime = new Date(this.selectedDate!);
      startTime.setHours(slot.hourSlot.hour, 0, 0, 0);
      const endTime = new Date(this.selectedDate!);
      endTime.setHours(slot.hourSlot.hour + 1, 0, 0, 0);
      
      // Format as local time instead of UTC to preserve timezone
      const formatLocalDateTime = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-06:00`;
      };
      
      return {
        space_id: slot.spaceSlot.space.id,
        start_time: formatLocalDateTime(startTime),
        end_time: formatLocalDateTime(endTime),
      };
    });

    const creationObservables = requestsToCreate.map(reqData => this.professionalService.createReservation(reqData));

    forkJoin(creationObservables).subscribe({
      next: (responses: any[]) => {
        this.success = 'Solicitudes de reserva especial enviadas. Espera la aprobación del administrador.';
        const newReservations = responses.map(res => res.reservation).filter(Boolean);

        if (newReservations.length > 0) {
          // 1. Update local reservation arrays
          this.myReservations = [...this.myReservations, ...newReservations];
          if (this.selectedDate) {
            this.selectedDayReservations = this.myReservations
              .filter(r => this.isSameDay(new Date(r.start_time), this.selectedDate!))
              .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
          }

          // 2. Manually create and add new calendar slots for optimistic availability update
          const newSlots = newReservations.map(res => ({
            id: res.id, space_id: res.space_id, start_time: res.start_time, end_time: res.end_time, status: res.status,
            user_id: res.user_id, space_name: this.spaces.find(s => s.id === res.space_id)?.name || '', user_name: ''
          }));
          this.calendarSlots = [...this.calendarSlots, ...newSlots];

          // 3. Regenerate all relevant UI components with the new, correct state
          this.generateDayView();
          this.generateCalendar();
          this.clearSelection();
        }

        // 4. Refresh only secondary data (credits)
        this.professionalService.getCredits().subscribe(credits => this.credits = credits);
        this.loading = false;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al enviar las solicitudes';
        this.loading = false;
        console.error('Error creating special requests:', error);
      }
    });
  }

  clearSelection(): void {
    this.selectedSlots = [];
    this.showBookingConfirmation = false;
    this.showSpecialRequestConfirmation = false;
    
    this.dayViewHours.forEach(hour => {
      hour.spaces.forEach(space => space.isSelected = false);
    });
  }

  cancelBooking(): void {
    this.clearSelection();
  }

  getTotalCost(): number {
    if (this.selectedSlots.length === 0) return 0;
    return this.selectedSlots.reduce((acc, slot) => {
      const cost = slot.spaceSlot.requiresSpecialApproval
        ? slot.spaceSlot.space.cost_credits + 1
        : slot.spaceSlot.space.cost_credits;
      return acc + cost;
    }, 0);
  }

  hasEnoughCredits(): boolean {
    if (!this.credits || this.selectedSlots.length === 0) return false;

    const totalCost = this.getTotalCost();

    return this.credits.active >= totalCost;
  }

  resetSelection(): void {
    this.selectedSlots = [];
    this.dayViewHours.forEach(h => {
      h.spaces.forEach(s => s.isSelected = false);
    });
  }

  backToCalendar(): void {
    // Hide day view and clear any selections
    this.showDayView = false;
    this.resetSelection();
    this.selectedDate = null;
    this.selectedDayReservations = [];
    this.selectedReservationForDetail = null;
    // Regenerate the month calendar so no day remains marked as selected
    this.generateCalendar();
    // Ensure no element keeps focus styles (like :focus outlines)
    if (typeof document !== 'undefined' && document.activeElement) {
      const el = document.activeElement as HTMLElement;
      if (el && typeof el.blur === 'function') {
        el.blur();
      }
    }
  }

  previousMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.loadInitialData();
  }

  nextMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.loadInitialData();
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

  private toISODateString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Aggregate calendar slots for a given date (used for month-day previews)
  private getSlotsForDate(date: Date): CalendarSlot[] {
    const dateStr = this.toISODateString(date);
    return (this.calendarSlots || []).filter((slot: CalendarSlot) => {
      const slotDate = new Date(slot.start_time);
      const slotStr = this.toISODateString(slotDate);
      return slotStr === dateStr;
    });
  }

  getSpaceSlotClass(spaceSlot: SpaceSlot): string {
    if (!spaceSlot.isAvailable) return 'bg-gray-300 cursor-not-allowed';
    if (spaceSlot.isSelected) return 'bg-blue-500 text-white';
    if (spaceSlot.requiresSpecialApproval) return 'bg-orange-100 hover:bg-orange-200 cursor-pointer border-orange-300';
    return 'bg-green-100 hover:bg-green-200 cursor-pointer';
  }
  // Admin-like helpers to compute start/end for calendar API
  private getCalendarStartDate(): Date {
    const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
    const startOfWeek = new Date(firstDay);
    startOfWeek.setDate(firstDay.getDate() - firstDay.getDay());
    return startOfWeek;
  }
  private getCalendarEndDate(): Date {
    const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
    const endOfWeek = new Date(lastDay);
    endOfWeek.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    return endOfWeek;
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
  slots?: CalendarSlot[]; // aggregated slots for this day (from admin calendar)
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
