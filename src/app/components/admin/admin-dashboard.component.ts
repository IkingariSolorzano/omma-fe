import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { WeeklyDashboardComponent } from './weekly-dashboard/weekly-dashboard.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faUsers,
  faCreditCard,
  faClock,
  faExclamationTriangle,
  faExclamationCircle,
  faBan,
  faBuilding,
  faCalendarWeek,
  faCheckCircle,
  faChartLine,
  faMoneyBillWave,
  faHistory,
  faTimes,
  faUserFriends,
  faHospital,
  faCalendarAlt,
  faClipboardList,
  faCog as faCogSolid,
  faThLarge,
  faChevronUp,
  faChevronDown
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, WeeklyDashboardComponent, FontAwesomeModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  // FontAwesome icons
  faUsers = faUsers;
  faCreditCard = faCreditCard;
  faClock = faClock;
  faExclamationTriangle = faExclamationTriangle;
  faExclamationCircle = faExclamationCircle;
  faBuilding = faBuilding;
  faCalendarWeek = faCalendarWeek;
  faClipboardList = faClipboardList;
  faChartLine = faChartLine;
  faMoneyBillWave = faMoneyBillWave;
  faCheckCircle = faCheckCircle;
  faTimes = faTimes;
  faChevronUp = faChevronUp;
  faChevronDown = faChevronDown;
  faUserCheck = faUsers;
  faHourglass = faClock;
  faCoins = faCreditCard;
  faUserSlash = faUsers;
  faUserFriends = faUsers;
  faHospital = faBuilding;
  faCalendarAlt = faCalendarWeek;
  faCog = faBuilding;

  currentUser: User | null = null;
  stats: any = {};
  recentActivity: any[] = [];
  pendingReservations: any[] = [];
  spaces: any[] = [];
  selectedSpaceId: string = '';
  loading = false;
  error = '';

  // Collapsible states
  statisticsExpanded = false;
  calendarExpanded = true;

  constructor(
    private authService: AuthService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadDashboardStats();
    this.loadSpaces();
    this.loadPendingReservations();
  }

  loadDashboardStats(): void {
    this.loading = true;
    this.error = '';

    // Load weekly dashboard stats
    this.adminService.getDashboardStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.loading = false;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al cargar estadísticas semanales';
        this.loading = false;
        console.error('Error loading dashboard stats:', error);
      }
    });

    // Load recent activity
    this.adminService.getRecentActivity().subscribe({
      next: (activity) => {
        this.recentActivity = activity;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al cargar actividad reciente';
        console.error('Error loading recent activity:', error);
      }
    });
  }

  loadSpaces(): void {
    this.adminService.getAllSpaces().subscribe({
      next: (spaces: any) => {
        this.spaces = spaces;
      },
      error: (error: any) => {
        console.error('Error loading spaces:', error);
      }
    });
  }

  selectSpace(spaceId: string): void {
    this.selectedSpaceId = spaceId;
    // Aquí puedes agregar lógica adicional para filtrar el dashboard por espacio
    console.log('Space selected:', spaceId);
  }

  loadPendingReservations(): void {
    this.adminService.getPendingReservations().subscribe({
      next: (reservations) => {
        this.pendingReservations = reservations;
      },
      error: (error) => {
        console.error('Error loading pending reservations:', error);
        this.error = 'Error al cargar las reservaciones pendientes.';
      }
    });
  }

  approveReservation(id: number): void {
    this.adminService.approveReservation(id).subscribe({
      next: () => {
        this.loadPendingReservations(); // Refresh the list
      },
      error: (error) => {
        console.error('Error approving reservation:', error);
        this.error = 'Error al aprobar la reservación.';
      }
    });
  }

  cancelReservation(id: number): void {
    this.adminService.cancelReservation(id, { reason: 'Cancelada por admin desde dashboard' }).subscribe({
      next: () => {
        this.loadPendingReservations(); // Refresh the list
      },
      error: (error) => {
        console.error('Error cancelling reservation:', error);
        this.error = 'Error al cancelar la reservación.';
      }
    });
  }

  toggleStatistics(): void {
    this.statisticsExpanded = !this.statisticsExpanded;
  }

  toggleCalendar(): void {
    this.calendarExpanded = !this.calendarExpanded;
  }

  logout(): void {
    this.authService.logout();
  }
}
