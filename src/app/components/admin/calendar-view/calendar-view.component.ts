import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminService, CalendarSlot, CalendarParams, Space, BusinessHour, Schedule, ClosedDate, CreateExternalReservationRequest, ExternalClient, ExternalClientWithCount } from '../../../services/admin.service';
import { BusinessHoursService } from '../../../services/business-hours.service';
import { ProfessionalService } from '../../../services/professional.service';
import { WebsocketService, ReservationEvent } from '../../../services/websocket.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBuilding,
  faThLarge
} from '@fortawesome/free-solid-svg-icons';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subscription } from 'rxjs';

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
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule],
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss']
})
export class CalendarViewComponent implements OnInit, OnDestroy {
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
  selectedHours: string[] = [];
  bookingForm: FormGroup;
  isSubmitting = false;
  
  // Autocomplete para clientes externos
  clientSuggestions: ExternalClient[] = [];
  frequentClients: ExternalClientWithCount[] = [];
  showSuggestions = false;
  nameInputHasFocus = false;

  // WebSocket subscriptions
  private wsSubscriptions: Subscription[] = [];

  // FontAwesome icons
  faBuilding = faBuilding;
  faThLarge = faThLarge;

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
    private businessHoursService: BusinessHoursService,
    private professionalService: ProfessionalService,
    private wsService: WebsocketService,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    this.filterForm = this.fb.group({
      view_type: ['month'],
      space_ids: ['']
    });
    
    this.bookingForm = this.fb.group({
      clientName: ['', Validators.required],
      clientPhone: ['', Validators.required],
      clientEmail: [''],
      spaceId: [null, Validators.required],
      status: ['confirmed'],
      notes: ['']
    });
  }

  ngOnInit(): void {
    // Conectar WebSocket
    this.connectWebSocket();
    
    // Cargar datos necesarios primero, luego el calendario
    this.loadSpaces();
    this.loadSpaceSchedules();
    
    // Cargar business hours y closed dates ANTES del calendario
    this.loadBusinessHours();
    this.loadClosedDates();
    
    // Esperar un momento para asegurar que los datos se carguen
    setTimeout(() => {
      this.loadCalendar();
    }, 100);
    
    // Setup autocomplete para nombre de cliente
    this.bookingForm.get('clientName')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(value => {
        if (value && value.length >= 2) {
          this.searchClients(value);
        } else {
          this.clientSuggestions = [];
          this.showSuggestions = false;
        }
      });
    
    // Setup autocompletado por teléfono
    this.bookingForm.get('clientPhone')?.valueChanges
      .pipe(
        debounceTime(500)
      )
      .subscribe(phone => {
        if (phone && phone.length === 10) {
          this.checkExistingClientByPhone(phone);
        }
      });
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

    const params: CalendarParams = {
      period: 'custom',
      start_date: this.formatDate(startDate),
      end_date: this.formatDate(endDate),
      space_ids: this.filterForm.value.space_ids || undefined
    };

    this.adminService.getCalendar(params).subscribe({
      next: (slots) => {
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
    const dateStr = this.formatDateInMexicoTimezone(date);
    
    return this.calendarSlots.filter(slot => {
      // Parse slot date and format in Mexico timezone
      const slotDate = new Date(slot.start_time);
      const slotDateStr = slotDate.toLocaleDateString('en-CA', {timeZone: "America/Mexico_City"});
      
      
      
      return slotDateStr === dateStr;
    });
  }

  selectDay(day: CalendarDay): void {
    
    
    // Always allow selection, even for disabled days to show "closed" message
    const updatedDay: CalendarDay = {
      ...day,
      slots: this.getSlotsForDate(day.date)
    };
    
    this.selectedDay = updatedDay;
    
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

  private formatDateInMexicoTimezone(date: Date): string {
    // Format date directly in Mexico timezone without conversion
    return date.toLocaleDateString('en-CA', {timeZone: "America/Mexico_City"});
  }

  getWeekDayName(dayIndex: number): string {
    // Use direct index for Sunday-first array
    return this.weekDays[dayIndex];
  }

  openBookingModal(): void {
    this.showBookingModal = true;
    this.selectedSpaceId = null;
    this.selectedHours = [];
    this.availableHours = [];
    this.clientSuggestions = [];
    this.showSuggestions = false;
    this.bookingForm.reset({
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      spaceId: null,
      status: 'confirmed',
      notes: ''
    });
    
    // Cargar clientes frecuentes al abrir el modal
    this.loadFrequentClients();
  }

  closeBookingModal(): void {
    this.showBookingModal = false;
    this.isSubmitting = false;
  }

  loadSpaceSchedules(): void {
    this.professionalService.getSchedules().subscribe({
      next: (response: any) => {
        // Handle different response formats
        if (Array.isArray(response)) {
          this.adminSpaceSchedules = response;
        } else if (response && Array.isArray(response.schedules)) {
          this.adminSpaceSchedules = response.schedules;
        } else if (response && Array.isArray(response.data)) {
          this.adminSpaceSchedules = response.data;
        } else {
          this.adminSpaceSchedules = [];
        }
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
    this.bookingForm.patchValue({ spaceId: spaceId || null });
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
    if (this.bookingForm.invalid || !this.selectedDay || this.selectedHours.length === 0) {
      this.markFormGroupTouched(this.bookingForm);
      if (this.selectedHours.length === 0) {
        this.error = 'Debe seleccionar al menos una hora';
      }
      return;
    }

    this.isSubmitting = true;
    this.error = '';
    
    const formValue = this.bookingForm.value;
    
    // Crear múltiples reservaciones, una por cada hora seleccionada
    const reservationPromises = this.selectedHours.map(hour => {
      // Create date without timezone conversion - keep it simple
      const year = this.selectedDay!.date.getFullYear();
      const month = this.selectedDay!.date.getMonth();
      const day = this.selectedDay!.date.getDate();
      const [hourNum, minute] = hour.split(':').map(Number);
      
      // Create date directly without timezone conversions
      const startDateTime = new Date(year, month, day, hourNum, minute || 0, 0, 0);

      const reservationRequest = {
        client_name: formValue.clientName,
        client_phone: formValue.clientPhone,
        client_email: formValue.clientEmail || undefined,
        space_id: formValue.spaceId,
        start_time: startDateTime.toISOString(),
        duration: 1, // Cada reservación es de 1 hora
        status: formValue.status,
        notes: formValue.notes || undefined
      };

      return this.adminService.createExternalReservation(reservationRequest).toPromise();
    });

    // Ejecutar todas las reservaciones
    Promise.all(reservationPromises).then(
      (responses) => {
        this.closeBookingModal();
        this.loadCalendar(); // Refresh calendar to show new reservations
      }
    ).catch(
      (error) => {
        console.error('Error al crear las reservas:', error);
        this.error = error?.error?.error || 'Error al crear las reservas';
        this.isSubmitting = false;
      }
    );
  }

  selectSpace(spaceId: number): void {
    this.selectedSpaceId = spaceId;
    this.bookingForm.patchValue({ spaceId: spaceId });
    // Generate available hours for admin (no business hour restrictions)
    this.generateAdminAvailableHours();
  }

  private generateAdminAvailableHours(): void {
    // Admin can book any hour from 6 AM to 11 PM (no business hours restrictions)
    this.availableHours = [];
    for (let hour = 6; hour <= 23; hour++) {
      const timeString = hour.toString().padStart(2, '0') + ':00';
      // Only check for conflicts, not business hours
      if (this.isHourAvailableForAdmin(hour)) {
        this.availableHours.push(timeString);
      }
    }
  }

  private isHourAvailableForAdmin(hour: number): boolean {
    if (!this.selectedDay || !this.selectedSpaceId) return false;

    const now = new Date();
    if (this.isSameDay(this.selectedDay.date, now) && hour <= now.getHours()) {
      return false; // Past hour for today
    }

    // Admin reservations: Only check for conflicts, bypass business hours
    return !this.hasConflictingReservation(hour);
  }

  private hasConflictingReservation(hour: number): boolean {
    const reservationDateTime = new Date(this.selectedDay!.date);
    reservationDateTime.setHours(hour, 0, 0, 0);
    
    return this.calendarSlots.some(slot => {
      if (slot.space_id !== this.selectedSpaceId) return false;
      if (slot.status === 'cancelled') return false;
      
      const slotStart = new Date(slot.start_time);
      const slotEnd = new Date(slot.end_time);
      
      const requestedStart = new Date(reservationDateTime);
      const requestedEnd = new Date(reservationDateTime);
      requestedEnd.setHours(hour + 1);
      
      return (requestedStart < slotEnd && requestedEnd > slotStart);
    });
  }

  selectHour(hour: string): void {
    const index = this.selectedHours.indexOf(hour);
    if (index > -1) {
      // Deseleccionar hora
      this.selectedHours.splice(index, 1);
    } else {
      // Seleccionar hora
      this.selectedHours.push(hour);
    }
    // Ordenar las horas seleccionadas
    this.selectedHours.sort();
  }

  isHourSelected(hour: string): boolean {
    return this.selectedHours.includes(hour);
  }

  selectSpaceFilter(spaceId: string): void {
    this.filterForm.patchValue({ space_ids: spaceId || '' });
    this.loadCalendar();
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }
  
  // Métodos para autocomplete de clientes externos
  searchClients(query: string): void {
    this.adminService.searchExternalClients(query).subscribe({
      next: (response) => {
        this.clientSuggestions = response.clients;
        // Solo mostrar si el input tiene foco
        this.showSuggestions = this.nameInputHasFocus && this.clientSuggestions.length > 0;
      },
      error: (error) => {
        console.error('Error searching clients:', error);
        this.clientSuggestions = [];
        this.showSuggestions = false;
      }
    });
  }
  
  loadFrequentClients(): void {
    this.adminService.getFrequentExternalClients(5).subscribe({
      next: (response) => {
        this.frequentClients = response.clients;
      },
      error: (error) => {
        console.error('Error loading frequent clients:', error);
        this.frequentClients = [];
      }
    });
  }
  
  checkExistingClientByPhone(phone: string): void {
    this.adminService.getExternalClientByPhone(phone).subscribe({
      next: (response) => {
        // Cliente encontrado, autocompletar datos
        this.bookingForm.patchValue({
          clientName: response.client.name,
          clientEmail: response.client.email || ''
        });
      },
      error: (error) => {
        // Cliente no encontrado, no hacer nada (es un cliente nuevo)
      }
    });
  }
  
  selectClient(client: ExternalClient): void {
    this.bookingForm.patchValue({
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email || ''
    });
    this.hideSuggestions();
  }
  
  selectFrequentClient(client: ExternalClientWithCount): void {
    this.bookingForm.patchValue({
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email || ''
    });
    this.hideSuggestions();
  }
  
  onNameInputBlur(): void {
    this.nameInputHasFocus = false;
    // Delay para permitir que el click en la sugerencia se procese primero
    setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }
  
  onNameInputFocus(): void {
    this.nameInputHasFocus = true;
    // Mostrar sugerencias solo si hay texto y resultados
    const nameValue = this.bookingForm.get('clientName')?.value;
    if (nameValue && nameValue.length >= 2 && this.clientSuggestions.length > 0) {
      this.showSuggestions = true;
    }
  }
  
  hideSuggestions(): void {
    this.showSuggestions = false;
    this.clientSuggestions = [];
  }
  
  // Método para generar enlace de WhatsApp
  getWhatsAppLink(slot: CalendarSlot): string {
    if (!slot.user_phone) {
      return '#';
    }
    
    // Limpiar el teléfono (quitar espacios, guiones, etc.)
    const phone = slot.user_phone.replace(/\D/g, '');
    const clientName = slot.user_name || 'Cliente';
    const date = new Date(slot.start_time).toLocaleDateString('es-MX', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const time = new Date(slot.start_time).toLocaleTimeString('es-MX', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const spaceName = slot.space_name;
    
    const message = `Hola ${clientName}, tenemos registrada tu reservación para el ${date} a las ${time} en ${spaceName}. ¿Confirmas tu asistencia?`;
    
    // Formato de WhatsApp: https://wa.me/52XXXXXXXXXX?text=mensaje
    // Agregar código de país de México (52) si no lo tiene
    const fullPhone = phone.startsWith('52') ? phone : '52' + phone;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  }
  
  hasPhoneNumber(slot: CalendarSlot): boolean {
    return !!slot.user_phone && slot.user_phone.length > 0;
  }

  // WebSocket methods
  private connectWebSocket(): void {
    const token = this.authService.getToken();
    if (!token) return;

    this.wsService.connect(token);

    // Subscribe to reservation events
    const createdSub = this.wsService.onReservationCreated().subscribe(event => {
      this.handleReservationEvent(event, 'created');
    });

    const updatedSub = this.wsService.onReservationUpdated().subscribe(event => {
      this.handleReservationEvent(event, 'updated');
    });

    const cancelledSub = this.wsService.onReservationCancelled().subscribe(event => {
      this.handleReservationEvent(event, 'cancelled');
    });

    const approvedSub = this.wsService.onReservationApproved().subscribe(event => {
      this.handleReservationEvent(event, 'approved');
    });

    const refreshSub = this.wsService.onCalendarRefresh().subscribe(() => {
      this.loadCalendar();
    });

    // Store subscriptions for cleanup
    this.wsSubscriptions.push(createdSub, updatedSub, cancelledSub, approvedSub, refreshSub);
  }

  private handleReservationEvent(event: ReservationEvent, action: string): void {
    // Show notification
    this.showNotification(`Reservación ${this.getActionText(action)}: ${event.user_name} - ${event.space_name}`);
    
    // Reload calendar to show updated data
    this.loadCalendar();
  }

  private getActionText(action: string): string {
    const actions: { [key: string]: string } = {
      'created': 'creada',
      'updated': 'actualizada',
      'cancelled': 'cancelada',
      'approved': 'aprobada'
    };
    return actions[action] || action;
  }

  private showNotification(message: string): void {
    // Show toast notification
    this.toastService.info(message, 4000);
  }

  ngOnDestroy(): void {
    // Unsubscribe from all WebSocket subscriptions
    this.wsSubscriptions.forEach(sub => sub.unsubscribe());
    
    // Disconnect WebSocket
    this.wsService.disconnect();
  }
}
