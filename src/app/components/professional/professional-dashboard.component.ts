import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';
import { ProfessionalService, Credits, Reservation } from '../../services/professional.service';
import { RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-professional-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './professional-dashboard.component.html',
  styleUrls: ['./professional-dashboard.component.scss'],
})
export class ProfessionalDashboardComponent implements OnInit {
  showPasswordModal = false;
  passwordForm!: FormGroup;
  currentPasswordFieldType: string = 'password';
  newPasswordFieldType: string = 'password';
  confirmPasswordFieldType: string = 'password';

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  currentUser: User | null = null;
  credits: Credits | null = null;
  upcomingReservations: Reservation[] = [];
  loading = false;
  uploadingImage = false;
  success = '';
  error = '';

  // Weekly view state
  currentWeekStart: Date = this.getStartOfWeek(new Date());
  weekDaysLabels: string[] = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  weekCells: { date: Date; reservations: Reservation[] }[] = [];

  constructor(
    private authService: AuthService,
    private professionalService: ProfessionalService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadDashboardData();
    this.passwordForm = this.fb.group({
      current_password: ['', Validators.required],
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', Validators.required]
    }, { validator: this.passwordMatchValidator });
  }

  loadDashboardData(): void {
    this.loading = true;
    let creditsLoaded = false;
    let reservationsLoaded = false;

    const checkLoadingComplete = () => {
      if (creditsLoaded && reservationsLoaded) {
        this.loading = false;
      }
    };

    // Load credits
    this.professionalService.getCredits().subscribe({
      next: (credits) => {
        this.credits = credits;
        creditsLoaded = true;
        checkLoadingComplete();
      },
      error: (error) => {
        console.error('Error loading credits:', error);
        creditsLoaded = true;
        checkLoadingComplete();
      }
    });

    // Load reservations
    this.professionalService.getMyReservations().subscribe({
      next: (reservations) => {
        const now = new Date();
        this.upcomingReservations = reservations
          .filter(r => new Date(r.start_time) > now && r.status !== 'cancelled')
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
          .slice(0, 5);
        // Build weekly view with all reservations (including confirmed/pending)
        this.buildWeekCells(reservations);
        reservationsLoaded = true;
        checkLoadingComplete();
      },
      error: (error) => {
        console.error('Error loading reservations:', error);
        this.upcomingReservations = [];
        reservationsLoaded = true;
        checkLoadingComplete();
      }
    });
  }


  formatDateTime(dateTime: string): string {
    return new Date(dateTime).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getAvailableHours(): number {
    return this.credits ? Math.floor(this.credits.active / 10) : 0;
  }

  getDaysUntilExpiry(): number {
    if (!this.credits?.expiry_date) return 0;
    const expiry = new Date(this.credits.expiry_date);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Helpers for weekly view
  public isToday(date: Date): boolean {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
           date.getMonth() === now.getMonth() &&
           date.getDate() === now.getDate();
  }

  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d;
  }

  navigateWeek(direction: 'prev' | 'next' | 'today'): void {
    if (direction === 'today') {
      this.currentWeekStart = this.getStartOfWeek(new Date());
    } else {
      const delta = direction === 'next' ? 7 : -7;
      const d = new Date(this.currentWeekStart);
      d.setDate(d.getDate() + delta);
      this.currentWeekStart = this.getStartOfWeek(d);
    }
    // rebuild using last loaded reservations (upcomingReservations only has a slice; we need all).
    // Re-fetch full list to ensure accuracy
    this.professionalService.getMyReservations().subscribe(res => {
      this.buildWeekCells(res);
    });
  }

  private buildWeekCells(allReservations: Reservation[]): void {
    const cells: { date: Date; reservations: Reservation[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(this.currentWeekStart);
      date.setDate(this.currentWeekStart.getDate() + i);
      const dayStr = date.toISOString().split('T')[0];
      const dayReservations = allReservations
        .filter(r => r.status !== 'cancelled')
        .filter(r => {
          const d = new Date(r.start_time);
          return d.toISOString().split('T')[0] === dayStr;
        })
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      cells.push({ date, reservations: dayReservations });
    }
    this.weekCells = cells;
  }

  // Profile picture methods
  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido.');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert('El archivo debe ser menor a 5MB.');
        return;
      }

      this.uploadProfilePicture(file);
    }
  }

  private uploadProfilePicture(file: File): void {
    this.uploadingImage = true;
    
    this.professionalService.uploadProfilePicture(file).subscribe({
      next: (response) => {
        // Update current user with new profile image
        if (this.currentUser) {
          this.currentUser.profile_image = response.profile_image;
          // Update localStorage
          localStorage.setItem('omma_user', JSON.stringify(this.currentUser));
        }
        this.uploadingImage = false;
      },
      error: (error) => {
        console.error('Error uploading profile picture:', error);
        alert('Error al subir la imagen. Por favor intenta de nuevo.');
        this.uploadingImage = false;
      }
    });
  }

  getProfileImageUrl(imagePath: string | undefined): string {
    if (!imagePath) return '';
    // Remove leading slash if present and construct full URL
    const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    return `${environment.apiUrl.replace('/api/v1', '')}/${cleanPath}`;
  }

  openPasswordModal() {
    this.showPasswordModal = true;
  }

  closePasswordModal() {
    this.showPasswordModal = false;
    this.passwordForm.reset();
  }

  changePassword() {
    if (this.passwordForm.invalid) {
      return;
    }
    this.loading = true;
    this.error = '';
    this.success = '';

    this.professionalService.changePassword(this.passwordForm.value).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Contraseña actualizada exitosamente.';
        this.closePasswordModal();
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error.error || 'Ocurrió un error al cambiar la contraseña.';
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('new_password')?.value;
    const confirmPassword = form.get('confirm_password')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  toggleCurrentPasswordFieldType() {
    this.currentPasswordFieldType = this.currentPasswordFieldType === 'password' ? 'text' : 'password';
  }

  toggleNewPasswordFieldType() {
    this.newPasswordFieldType = this.newPasswordFieldType === 'password' ? 'text' : 'password';
  }

  toggleConfirmPasswordFieldType() {
    this.confirmPasswordFieldType = this.confirmPasswordFieldType === 'password' ? 'text' : 'password';
  }
}
