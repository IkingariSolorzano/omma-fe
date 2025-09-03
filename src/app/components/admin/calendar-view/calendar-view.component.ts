import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AdminService, CalendarSlot, CalendarParams, Space, BusinessHour, Schedule, ClosedDate } from '../../../services/admin.service';

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

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService
  ) {
    this.filterForm = this.fb.group({
      view_type: ['month'],
      space_ids: ['']
    });
  }

  ngOnInit(): void {
    this.loadSpaces();
    this.loadBusinessHours();
    this.loadSpaceSchedules();
    this.loadClosedDates();
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

  loadSpaceSchedules(): void {
    this.adminService.getAllSchedules().subscribe({
      next: (schedules) => {
        this.spaceSchedules = schedules;
      },
      error: (error) => {
        console.error('Error loading space schedules:', error);
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
  }

  getSlotsForDate(date: Date): CalendarSlot[] {
    const dateStr = this.formatDate(date);
    return this.calendarSlots.filter(slot => {
      const slotDate = new Date(slot.start_time);
      return this.formatDate(slotDate) === dateStr;
    });
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
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

  clearMessages(): void {
    this.error = '';
  }
}
