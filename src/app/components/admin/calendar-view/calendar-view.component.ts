import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminService, CalendarSlot, CalendarParams, Space, BusinessHour, Schedule, ClosedDate, CreateExternalReservationRequest } from '../../../services/admin.service';
import { BusinessHoursService } from '../../../services/business-hours.service';
import { ProfessionalService } from '../../../services/professional.service';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isEnabled: boolean;
  slots: CalendarSlot[];
}

interface CalendarWeek {
  days: CalendarDay[];
}

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss']
})
export class CalendarViewComponent implements OnInit {
  calendarSlots: CalendarSlot[] = [];
  spaces: Space[] = [];
  businessHours: BusinessHour[] = [];
  spaceSchedules: Schedule[] = [];
  closedDates: ClosedDate[] = [];
  filterForm: FormGroup;
  loading = false;
  error = '';
  currentView: 'week' | 'month' = 'month';
  currentDate = new Date();
  calendarWeeks: CalendarWeek[] = [];
  weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  currentWeekDays: CalendarDay[] = [];
  selectedDay: CalendarDay | null = null;
  showBookingModal = false;
  adminSpaceSchedules: Schedule[] = [];
  availableHours: string[] = [];
  selectedSpaceId: number | null = null;
  bookingForm: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
    private businessHoursService: BusinessHoursService,
    private professionalService: ProfessionalService
  ) {
    this.filterForm = this.fb.group({
      view_type: ['month'],
      space_ids: ['']
    });
    
    this.bookingForm = this.fb.group({
      clientName: ['', Validators.required],
      clientPhone: ['', Validators.required],
      clientEmail: [''],
      spaceId: ['', Validators.required],
      duration: [1, [Validators.required, Validators.min(1)]],
      startHour: ['', Validators.required],
      status: ['confirmed'],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.loadSpaces();
    this.loadBusinessHours();
    this.loadClosedDates();
    this.loadSpaceSchedules();
    this.loadCalendar();
  }

  loadSpaces(): void {
    this.adminService.getAllSpaces().subscribe({
      next: (spaces) => {
        this.spaces = spaces;
      },
      error: (error) => {
        console.error('Error loading spaces:', error);
      }
    });
  }

  loadBusinessHours(): void {
    this.adminService.getBusinessHours().subscribe({
      next: (businessHours) => {
        this.businessHours = businessHours;
      },
      error: (error) => {
        console.error('Error loading business hours:', error);
      }
    });
  }


  loadClosedDates(): void {
    this.adminService.getClosedDates().subscribe({
      next: (dates) => {
        this.closedDates = dates;
      },
      error: (error) => {
        console.error('Error loading closed dates:', error);
      }
    });
  }

  isDayEnabled(date: Date): boolean {
    // First: disable if it's an explicit closed date (active)
    const dateStr = this.formatDate(date);
    const isClosedDate = (this.closedDates || []).some(cd => {
      const closedDateStr = this.formatDate(new Date(cd.date));
      return closedDateStr === dateStr && cd.is_active;
    });
    if (isClosedDate) return false;

    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Check business hours
    let businessHourEnabled = false;
    if (this.businessHours && this.businessHours.length > 0) {
      const businessHour = this.businessHours.find(bh => bh.day_of_week === dayOfWeek);
      businessHourEnabled = businessHour ? !businessHour.is_closed : false;
    }

    // Check space schedules
    let spaceScheduleEnabled = false;
    if (this.spaceSchedules && this.spaceSchedules.length > 0) {
      const hasSpaceSchedule = this.spaceSchedules.some(schedule => schedule.day_of_week === dayOfWeek);
      spaceScheduleEnabled = hasSpaceSchedule;
    }

    // Enable day if either business hours OR space schedules are available for this day
    return businessHourEnabled || spaceScheduleEnabled;
  }

  loadCalendar(): void {
    this.loading = true;
    this.error = '';
    this.currentView = this.filterForm.value.view_type;

    const startDate = this.getCalendarStartDate();
    const endDate = this.getCalendarEndDate();

    console.log('Loading calendar with params:', {
      startDate: this.formatDate(startDate),
      endDate: this.formatDate(endDate),
      currentView: this.currentView,
      spaceIds: this.filterForm.value.space_ids
    });

    const params: CalendarParams = {
      period: 'custom',
      start_date: this.formatDate(startDate),
      end_date: this.formatDate(endDate),
      space_ids: this.filterForm.value.space_ids || undefined
    };

    this.adminService.getCalendar(params).subscribe({
      next: (slots) => {
        console.log('Calendar data received:', slots);
        this.calendarSlots = slots || [];
        this.buildCalendarView();
        this.loading = false;
      },
      error: (error) => {
        console.error('Calendar API error:', error);
        this.error = error?.error?.error || error?.message || 'Error al cargar calendario';
        this.loading = false;
        this.calendarSlots = [];
        this.buildCalendarView(); // Build empty view to show something
      }
    });
  }

  onFilterChange(): void {
    this.loadCalendar();
  }

  switchView(viewType: 'week' | 'month'): void {
    this.currentView = viewType;
    this.filterForm.patchValue({ view_type: viewType });
    this.loadCalendar();
  }

  getCalendarStartDate(): Date {
    if (this.currentView === 'month') {
      // Start of month, then go to start of week (Sunday = 0)
      const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
      const startOfWeek = new Date(firstDay);
      startOfWeek.setDate(firstDay.getDate() - firstDay.getDay());
      return startOfWeek;
    } else {
      // Start of current week (Sunday = 0)
      const startOfWeek = new Date(this.currentDate);
      startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay());
      return startOfWeek;
    }
  }

  getCalendarEndDate(): Date {
    if (this.currentView === 'month') {
      // End of month, then go to end of week
      const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
      const endOfWeek = new Date(lastDay);
      endOfWeek.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
      return endOfWeek;
    } else {
      // End of current week
      const endOfWeek = new Date(this.currentDate);
      endOfWeek.setDate(this.currentDate.getDate() + (6 - this.currentDate.getDay()));
      return endOfWeek;
    }
  }

  buildCalendarView(): void {
    if (this.currentView === 'month') {
      this.buildMonthView();
    } else {
      this.buildWeekView();
    }
  }

  buildMonthView(): void {
    const startDate = this.getCalendarStartDate();
    const endDate = this.getCalendarEndDate();
    const weeks: CalendarWeek[] = [];
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const week: CalendarWeek = { days: [] };
      
      // Build 7 days for this week
      for (let i = 0; i < 7; i++) {
        const daySlots = this.getSlotsForDate(currentDate);
        const day: CalendarDay = {
          date: new Date(currentDate),
          isCurrentMonth: currentDate.getMonth() === this.currentDate.getMonth(),
          isToday: this.isSameDay(currentDate, new Date()),
          isEnabled: this.isDayEnabled(currentDate),
          slots: daySlots
        };
        
        week.days.push(day);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      weeks.push(week);
      
      // Stop if we've gone past the end date
      if (currentDate > endDate) {
        break;
      }
    }
    
    this.calendarWeeks = weeks;

    // Automatically select today if visible, or the first available day
    if (!this.selectedDay || !weeks.flatMap(w => w.days).some(d => this.isSelected(d))) {
      const today = new Date();
      const todayInView = weeks.flatMap(w => w.days).find(d => this.isSameDay(d.date, today) && d.isEnabled);
      if (todayInView) {
        this.selectDay(todayInView);
      } else {
        const firstEnabledDay = weeks.flatMap(w => w.days).find(d => d.isCurrentMonth && d.isEnabled);
        if (firstEnabledDay) {
          this.selectDay(firstEnabledDay);
        } else {
            const anyEnabledDay = weeks.flatMap(w => w.days).find(d => d.isEnabled);
            if(anyEnabledDay) {
                this.selectDay(anyEnabledDay);
            } else {
                this.selectedDay = null;
            }
        }
      }
    }

  }

  buildWeekView(): void {
    const startDate = this.getCalendarStartDate();
    const days: CalendarDay[] = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const daySlots = this.getSlotsForDate(currentDate);
      
      days.push({
        date: currentDate,
        isCurrentMonth: currentDate.getMonth() === this.currentDate.getMonth(),
        isToday: this.isSameDay(currentDate, new Date()),
        isEnabled: this.isDayEnabled(currentDate),
        slots: daySlots
      });
    }
    
    this.currentWeekDays = days;

    // Auto-select day in week view
    if (!this.selectedDay || !this.currentWeekDays.some(d => this.isSameDay(d.date, this.selectedDay!.date))) {
        const todayInView = this.currentWeekDays.find(d => this.isSameDay(d.date, new Date()) && d.isEnabled);
        if (todayInView) {
            this.selectDay(todayInView);
        } else {
            const firstEnabledDay = this.currentWeekDays.find(d => d.isEnabled);
            if (firstEnabledDay) {
                this.selectDay(firstEnabledDay);
            } else {
                this.selectedDay = null;
            }
        }
    }

  }

  getSlotsForDate(date: Date): CalendarSlot[] {
    const dateStr = this.formatDate(date);
    return this.calendarSlots.filter(slot => {
      const slotDate = new Date(slot.start_time);
      return this.formatDate(slotDate) === dateStr;
    });
  }

  selectDay(day: CalendarDay): void {
    console.log('selectDay called with:', day.date, 'isEnabled:', day.isEnabled);
    
    // Always allow selection, even for disabled days to show "closed" message
    const updatedDay: CalendarDay = {
      ...day,
      slots: this.getSlotsForDate(day.date)
    };
    
    this.selectedDay = updatedDay;
    console.log('Day selected:', this.selectedDay.date, 'Slots:', this.selectedDay.slots.length);
    
    // Force change detection
    this.cdr.detectChanges();
  }

  isSelected(day: CalendarDay): boolean {
    if (!this.selectedDay) return false;
    return this.isSameDay(day.date, this.selectedDay.date);
  }

  navigateWeek(direction: 'prev' | 'next'): void {
    const days = direction === 'next' ? 7 : -7;
    this.currentDate.setDate(this.currentDate.getDate() + days);
    this.loadCalendar();
  }

  navigateMonth(direction: 'prev' | 'next'): void {
    const months = direction === 'next' ? 1 : -1;
    this.currentDate.setMonth(this.currentDate.getMonth() + months);
    this.loadCalendar();
  }

  goToToday(): void {
    this.currentDate = new Date();
    this.loadCalendar();
  }

  getMonthName(): string {
    return this.currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }

  getWeekRange(): string {
    const startOfWeek = this.getCalendarStartDate();
    const endOfWeek = this.getCalendarEndDate();
    return `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${endOfWeek.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
  }

  getSlotStatusClass(status: string): string {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'occupied':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'available':
        return 'Disponible';
      case 'reserved':
        return 'Reservado';
      case 'occupied':
        return 'Ocupado';
      default:
        return status;
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  openBookingModal(): void {
    this.showBookingModal = true;
    this.selectedSpaceId = null;
    this.availableHours = [];
    this.bookingForm.reset({
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      spaceId: '',
      duration: 1,
      startHour: '',
      status: 'confirmed',
      notes: ''
    });
  }

  closeBookingModal(): void {
    this.showBookingModal = false;
    this.isSubmitting = false;
  }

  loadSpaceSchedules(): void {
    this.professionalService.getSchedules().subscribe({
      next: (response: any) => {
        console.log('Raw schedules response:', response);
        // Handle different response formats
        if (Array.isArray(response)) {
          this.adminSpaceSchedules = response;
        } else if (response && Array.isArray(response.schedules)) {
          this.adminSpaceSchedules = response.schedules;
        } else if (response && Array.isArray(response.data)) {
          this.adminSpaceSchedules = response.data;
        } else {
          console.warn('Unexpected schedules response format:', response);
          this.adminSpaceSchedules = [];
        }
        console.log('Admin space schedules loaded:', this.adminSpaceSchedules);
      },
      error: (error) => {
        console.error('Error loading space schedules:', error);
        this.adminSpaceSchedules = [];
      }
    });
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  onSpaceChange(event: any): void {
    const spaceId = parseInt(event.target.value);
    this.selectedSpaceId = spaceId || null;
    this.bookingForm.patchValue({ spaceId: spaceId || '' });
    this.updateAvailableHours();
  }

  updateAvailableHours(): void {
    if (!this.selectedDay || !this.selectedSpaceId) {
      this.availableHours = [];
      return;
    }

    const dayOfWeek = this.selectedDay.date.getDay();
    const spaceSchedule = this.adminSpaceSchedules.find(
      schedule => schedule.space_id === this.selectedSpaceId && 
                  schedule.day_of_week === dayOfWeek && 
                  true
    );

    if (!spaceSchedule) {
      this.availableHours = [];
      return;
    }

    // Get business hours for this day
    const businessHour = this.businessHours.find(bh => bh.day_of_week === dayOfWeek);
    if (!businessHour || businessHour.is_closed) {
      this.availableHours = [];
      return;
    }

    // Generate available hours based on space schedule
    const spaceStartHour = parseInt(spaceSchedule.start_time.split(':')[0]);
    const spaceEndHour = parseInt(spaceSchedule.end_time.split(':')[0]);
    
    const hours: string[] = [];
    for (let hour = spaceStartHour; hour < spaceEndHour; hour++) {
      if (this.isHourAvailable(hour)) {
        hours.push(`${hour.toString().padStart(2, '0')}:00`);
      }
    }
    
    this.availableHours = hours;
  }

  isHourAvailable(hour: number): boolean {
    if (!this.selectedDay || !this.selectedSpaceId) return false;

    const now = new Date();
    if (this.isSameDay(this.selectedDay.date, now) && hour <= now.getHours()) {
      return false; // Past hour for today
    }

    // Check existing reservations
    const reservationDateTime = new Date(this.selectedDay.date);
    reservationDateTime.setHours(hour, 0, 0, 0);
    
    const hasExistingReservation = this.calendarSlots.some(slot => {
      if (slot.space_id !== this.selectedSpaceId) return false;
      if (slot.status === 'cancelled') return false;
      
      const slotStart = new Date(slot.start_time);
      const slotEnd = new Date(slot.end_time);
      
      const requestedStart = new Date(reservationDateTime);
      const requestedEnd = new Date(reservationDateTime);
      requestedEnd.setHours(hour + 1);
      
      return (requestedStart < slotEnd && requestedEnd > slotStart);
    });
    
    return !hasExistingReservation;
  }

  clearMessages(): void {
    this.error = '';
  }

  createReservation(): void {
    if (this.bookingForm.invalid || !this.selectedDay) {
      this.markFormGroupTouched(this.bookingForm);
      return;
    }

    this.isSubmitting = true;
    
    const formValue = this.bookingForm.value;
    const startDateTime = new Date(this.selectedDay.date);
    const [hour, minute] = formValue.startHour.split(':').map(Number);
    startDateTime.setHours(hour, minute || 0, 0, 0);

    const reservationRequest = {
      client_name: formValue.clientName,
      client_phone: formValue.clientPhone,
      client_email: formValue.clientEmail || undefined,
      space_id: formValue.spaceId,
      start_time: startDateTime.toISOString(),
      duration: parseInt(formValue.duration, 10),
      status: formValue.status,
      notes: formValue.notes || undefined
    };

    this.adminService.createExternalReservation(reservationRequest).subscribe({
      next: (response) => {
        console.log('Reserva creada exitosamente:', response);
        this.closeBookingModal();
        this.loadCalendar(); // Refresh calendar to show new reservation
        // You could add a success message here
      },
      error: (error) => {
        console.error('Error al crear la reserva:', error);
        this.error = error?.error?.error || 'Error al crear la reserva';
        this.isSubmitting = false;
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }
}
