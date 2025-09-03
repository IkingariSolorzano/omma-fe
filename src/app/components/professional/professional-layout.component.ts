import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { ProfessionalService, Credits } from '../../services/professional.service';

@Component({
  selector: 'app-professional-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <header class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center py-6">
            <div class="flex items-center">
              <h1 class="text-3xl font-bold text-gray-900">Mi Panel</h1>
            </div>
            <div class="flex items-center space-x-4">
              <div *ngIf="credits" class="text-sm text-gray-600">
                <span class="font-medium">{{ credits.active }}</span> créditos activos
              </div>
              <span class="text-gray-700">{{ currentUser?.name }}</span>
              <button 
                (click)="logout()"
                class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Navigation -->
      <nav class="bg-blue-600">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex space-x-8">
            <a routerLink="/dashboard" 
               routerLinkActive="bg-blue-700" 
               [routerLinkActiveOptions]="{exact: true}"
               class="text-white hover:bg-blue-700 px-3 py-2 rounded-md text-sm font-medium">
              Dashboard
            </a>
            <a routerLink="/dashboard/spaces" 
               routerLinkActive="bg-blue-700"
               class="text-white hover:bg-blue-700 px-3 py-2 rounded-md text-sm font-medium">
              Reservar Espacio
            </a>
          </div>
        </div>
      </nav>

      <!-- Main Content -->
      <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styleUrl: './professional-layout.component.scss'
})
export class ProfessionalLayoutComponent implements OnInit {
  currentUser: User | null = null;
  credits: Credits | null = null;

  constructor(
    private authService: AuthService,
    private professionalService: ProfessionalService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadCredits();
  }

  loadCredits(): void {
    this.professionalService.getCredits().subscribe({
      next: (credits) => {
        this.credits = credits;
      },
      error: (error) => console.error('Error loading credits:', error)
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
