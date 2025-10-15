import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, Subscription } from 'rxjs';
import { AdminService, Space, Reservation } from '../../../services/admin.service';
import { BusinessHoursService, BusinessHour } from '../../../services/business-hours.service';
import { WebsocketService, ReservationEvent } from '../../../services/websocket.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';

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
export class WeeklyDashboardComponent implements OnInit, OnDestroy {
  spaces: Space[] = [];
  scheduleSlots: ScheduleSlot[] = [];
  businessHours: BusinessHour[] = [];
  reservations: Reservation[] = [];
  currentDay: Date = new Date();
  loading = false;
  error = '';

  // WebSocket subscriptions
  private wsSubscriptions: Subscription[] = [];

  // Horarios disponibles (7 AM a 10 PM)
  timeSlots = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00', '22:00'
  ];

  constructor(
    private adminService: AdminService,
    private businessHoursService: BusinessHoursService,
    private wsService: WebsocketService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.connectWebSocket();
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
    const dayOfWeek = this.currentDay.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    
    // Buscar el horario de negocio para este día
    const businessHour = this.businessHours.find(bh => bh.day_of_week === dayOfWeek);
    
    if (!businessHour) {
      return false; // No hay horario definido para este día
    }
    
    // Si el día está marcado como cerrado
    if (businessHour.is_closed) {
      return false;
    }
    
    // Verificar si la hora está dentro del rango de horario de negocio
    const startHour = parseInt(businessHour.start_time.split(':')[0]);
    const endHour = parseInt(businessHour.end_time.split(':')[0]);
    
    return hour >= startHour && hour < endHour;
  }

  findReservationForSpaceAndHour(spaceId: number, hour: number): Reservation | undefined {
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

      return slotTime >= reservationStart && slotTime < reservationEnd;
    });

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
      // Mostrar nombre del usuario registrado o del cliente externo
      return spaceSlot.reservation.user?.name || 
             spaceSlot.reservation.external_client?.name || 
             'Reservado';
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
      this.loadData();
    });

    // Store subscriptions for cleanup
    this.wsSubscriptions.push(createdSub, updatedSub, cancelledSub, approvedSub, refreshSub);
  }

  private handleReservationEvent(event: ReservationEvent, action: string): void {
    // Show toast notification
    const actionText = this.getActionText(action);
    this.toastService.info(`Reservación ${actionText}: ${event.user_name} - ${event.space_name}`, 4000);
    
    // Reload data to show updated reservations
    this.loadData();
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

  ngOnDestroy(): void {
    // Unsubscribe from all WebSocket subscriptions
    this.wsSubscriptions.forEach(sub => sub.unsubscribe());
    
    // Disconnect WebSocket
    this.wsService.disconnect();
  }
}
