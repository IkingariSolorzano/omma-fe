import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AdminService, Space, Reservation } from '../../../services/admin.service';
import { BusinessHoursService, BusinessHour } from '../../../services/business-hours.service';

interface ScheduleSlot {
  time: string;
  hour: number;
  spaces: {
    [spaceId: number]: {
      status: 'available' | 'booked' | 'special' | 'closed';
      reservation?: Reservation;
      isBusinessHour: boolean;
    };
  };
}

@Component({
  selector: 'app-weekly-dashboard',
  imports: [CommonModule],
  templateUrl: './weekly-dashboard.component.html',
  styleUrl: './weekly-dashboard.component.scss'
})
export class WeeklyDashboardComponent implements OnInit {
  spaces: Space[] = [];
  scheduleSlots: ScheduleSlot[] = [];
  businessHours: BusinessHour[] = [];
  reservations: Reservation[] = [];
  currentDay: Date = new Date();
  loading = false;
  error = '';

  // Horarios disponibles (7 AM a 10 PM)
  timeSlots = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00', '22:00'
  ];

  constructor(
    private adminService: AdminService,
    private businessHoursService: BusinessHoursService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';

    const startOfDay = this.getStartOfDay(this.currentDay);
    const endOfDay = this.getEndOfDay(this.currentDay);

    const reservations$ = this.adminService.getAllReservations({
      startDate: startOfDay.toISOString().split('T')[0],
      endDate: endOfDay.toISOString().split('T')[0]
    });

    forkJoin({
      spaces: this.adminService.getAllSpaces(),
      businessHours: this.businessHoursService.getBusinessHours(),
      reservations: reservations$
    }).subscribe({
      next: (data) => {
        this.spaces = data.spaces;
        this.businessHours = data.businessHours;
        this.reservations = data.reservations.filter(res => res.status !== 'cancelled');
        
        this.generateScheduleGrid();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar los datos del tablero';
        this.loading = false;
        console.error('Error loading dashboard data:', err);
      }
    });
  }

  generateScheduleGrid(): void {
    this.scheduleSlots = this.timeSlots.map(timeSlot => {
      const hour = parseInt(timeSlot.split(':')[0]);
      const slot: ScheduleSlot = {
        time: timeSlot,
        hour: hour,
        spaces: {}
      };

      // Procesar cada espacio para este horario
      this.spaces.forEach(space => {
        const status = this.getSpaceStatusForTime(space, hour);
        slot.spaces[space.id] = status;
      });

      return slot;
    });
  }

  getSpaceStatusForTime(space: Space, hour: number): {
    status: 'available' | 'booked' | 'special' | 'closed';
    reservation?: Reservation;
    isBusinessHour: boolean;
  } {
    // Verificar si es horario de negocio
    const isBusinessHour = this.isBusinessHour(hour);

    // Buscar reserva para este espacio y hora
    const reservation = this.findReservationForSpaceAndHour(space.id, hour);

    if (reservation) {
      return {
        status: 'booked',
        reservation: reservation,
        isBusinessHour: isBusinessHour
      };
    }

    if (!isBusinessHour) {
      return {
        status: 'special',
        isBusinessHour: false
      };
    }

    return {
      status: 'available',
      isBusinessHour: true
    };
  }

  isBusinessHour(hour: number): boolean {
    // Asumir horario de negocio de 8 AM a 6 PM de lunes a viernes
    const currentDate = new Date();
    const dayOfWeek = currentDate.getDay(); // 0 = Domingo, 1 = Lunes, etc.

    // Solo días de semana (lunes a viernes)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Solo horas de 8 AM a 6 PM
    return hour >= 8 && hour <= 18;
  }

  findReservationForSpaceAndHour(spaceId: number, hour: number): Reservation | undefined {
    console.log(`=== DEBUG: Finding reservation for space ${spaceId} at hour ${hour} ===`);

    const result = this.reservations.find(reservation => {
      if (reservation.space_id !== spaceId) {
        return false;
      }

      // Verificar si la reserva cubre esta hora
      const reservationStart = new Date(reservation.start_time);
      const reservationEnd = new Date(reservation.end_time);

      // Crear slotTime considerando la zona horaria de México
      const slotTime = new Date(this.currentDay.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
      slotTime.setHours(hour, 0, 0, 0);

      console.log(`Comparing reservation:`, {
        reservationId: reservation.id,
        spaceId: reservation.space_id,
        startTime: reservationStart.toISOString(),
        endTime: reservationEnd.toISOString(),
        slotTime: slotTime.toISOString(),
        hour: hour,
        isWithinRange: slotTime >= reservationStart && slotTime < reservationEnd
      });

      return slotTime >= reservationStart && slotTime < reservationEnd;
    });

    if (result) {
      console.log('=== FOUND RESERVATION ===', result);
    } else {
      console.log('=== NO RESERVATION FOUND ===');
    }

    return result;
  }

  getStartOfDay(date: Date): Date {
    // Crear fecha en zona horaria de México
    const mexicoDate = new Date(date.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    const start = new Date(mexicoDate);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  getEndOfDay(date: Date): Date {
    // Crear fecha en zona horaria de México
    const mexicoDate = new Date(date.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    const end = new Date(mexicoDate);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  previousDay(): void {
    // Navegar al día anterior usando zona horaria de México
    const mexicoDate = new Date(this.currentDay.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    mexicoDate.setDate(mexicoDate.getDate() - 1);
    this.currentDay = mexicoDate;
    this.loadData();
  }

  nextDay(): void {
    // Navegar al día siguiente usando zona horaria de México
    const mexicoDate = new Date(this.currentDay.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    mexicoDate.setDate(mexicoDate.getDate() + 1);
    this.currentDay = mexicoDate;
    this.loadData();
  }

  getCurrentDayLabel(): string {
    // Formatear fecha usando zona horaria de México
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Mexico_City'
    };

    return this.currentDay.toLocaleDateString('es-MX', options);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'booked':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'special':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'closed':
        return 'bg-red-100 text-red-600 border-red-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  }

  getStatusText(slot: any, spaceId: number): string {
    const spaceSlot = slot.spaces[spaceId];

    if (spaceSlot.status === 'booked' && spaceSlot.reservation) {
      // Mostrar nombre del usuario que reservó
      return spaceSlot.reservation.user?.name || 'Reservado';
    }

    switch (spaceSlot.status) {
      case 'available':
        return 'Disponible';
      case 'special':
        return 'Horario especial';
      case 'closed':
        return 'Cerrado';
      default:
        return '';
    }
  }
}
