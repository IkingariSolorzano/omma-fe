import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  currentUser: User | null = null;
  stats: any = {};
  recentActivity: any[] = [];
  loading = false;
  error = '';

  constructor(
    private authService: AuthService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadDashboardStats();
  }

  loadDashboardStats(): void {
    this.loading = true;
    this.error = '';

    // Load comprehensive dashboard stats
    this.adminService.getDashboardStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.loading = false;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al cargar estadísticas';
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

  logout(): void {
    this.authService.logout();
  }
}
