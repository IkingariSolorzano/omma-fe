import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AdminService, BusinessHour, ClosedDate } from '../../../services/admin.service';

@Component({
  selector: 'app-business-hours',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './business-hours.component.html',
  styleUrl: './business-hours.component.scss'
})
export class BusinessHoursComponent implements OnInit {
  businessHours: BusinessHour[] = [];
  closedDates: ClosedDate[] = [];
  businessHoursForm: FormGroup;
  closedDateForm: FormGroup;
  loading = false;
  error = '';
  success = '';
  
  dayNames = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 
    'Jueves', 'Viernes', 'Sábado'
  ];

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService
  ) {
    this.businessHoursForm = this.fb.group({
      day_of_week: ['', [Validators.required]],
      start_time: ['09:00', [Validators.required]],
      end_time: ['18:00', [Validators.required]],
      is_closed: [false]
    });

    this.closedDateForm = this.fb.group({
      date: ['', [Validators.required]],
      reason: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.loadBusinessHours();
    this.loadClosedDates();
  }

  loadBusinessHours(): void {
    this.adminService.getBusinessHours().subscribe({
      next: (hours) => {
        this.businessHours = hours;
      },
      error: (error) => {
        this.error = 'Error al cargar horarios de negocio';
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
        this.error = 'Error al cargar días cerrados';
        console.error('Error loading closed dates:', error);
      }
    });
  }

  onSubmitBusinessHours(): void {
    if (this.businessHoursForm.invalid) {
      this.error = 'Por favor, complete todos los campos requeridos.';
      return;
    }

    this.loading = true;
    this.clearMessages();

    const formData = this.businessHoursForm.value;
    const dayOfWeek = parseInt(formData.day_of_week, 10);

    if (isNaN(dayOfWeek)) {
        this.error = 'El día de la semana no es válido.';
        this.loading = false;
        return;
    }

    const payload: BusinessHour = {
        day_of_week: dayOfWeek,
        start_time: formData.start_time,
        end_time: formData.end_time,
        is_closed: formData.is_closed
    };

    // The backend now handles both create and update (restore) logic via the same endpoint.
    this.adminService.createBusinessHour(payload).subscribe({
        next: (response) => {
            // The backend might return a 200 (OK) for an update/restore or a 201 (Created) for a new record.
            // We can treat both as a success.
            this.success = 'Horario guardado exitosamente';
            this.resetForms();
            this.loadBusinessHours();
        },
        error: (err) => this.handleError(err, 'guardar'),
        complete: () => this.loading = false
    });
  }

  private resetForms(): void {
    this.businessHoursForm.reset({
        day_of_week: '',
        start_time: '09:00',
        end_time: '18:00',
        is_closed: false
    });
  }

  private handleError(error: any, action: string): void {
    this.error = `Error al ${action} el horario.`;
    console.error(`Error ${action} business hour:`, error);
    this.loading = false;
  }

  onSubmitClosedDate(): void {
    if (this.closedDateForm.valid) {
      this.loading = true;
      this.clearMessages();

      const closedDateData = { ...this.closedDateForm.value, is_active: true };

      this.adminService.createClosedDate(closedDateData).subscribe({
        next: () => {
          this.success = 'Día cerrado agregado exitosamente';
          this.closedDateForm.reset();
          this.loadClosedDates();
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Error al agregar día cerrado';
          this.loading = false;
          console.error('Error creating closed date:', error);
        }
      });
    }
  }

  deleteBusinessHour(id: number): void {
    if (confirm('¿Estás seguro de que quieres eliminar este horario?')) {
      this.adminService.deleteBusinessHour(id).subscribe({
        next: () => {
          this.success = 'Horario eliminado exitosamente';
          this.loadBusinessHours();
        },
        error: (error) => {
          this.error = 'Error al eliminar horario';
          console.error('Error deleting business hour:', error);
        }
      });
    }
  }

  deleteClosedDate(id: number): void {
    if (confirm('¿Estás seguro de que quieres eliminar este día cerrado?')) {
      this.adminService.deleteClosedDate(id).subscribe({
        next: () => {
          this.success = 'Día cerrado eliminado exitosamente';
          this.loadClosedDates();
        },
        error: (error) => {
          this.error = 'Error al eliminar día cerrado';
          console.error('Error deleting closed date:', error);
        }
      });
    }
  }

  editBusinessHour(hour: BusinessHour): void {
    this.businessHoursForm.patchValue({
      day_of_week: hour.day_of_week,
      start_time: hour.start_time,
      end_time: hour.end_time,
      is_closed: hour.is_closed
    });
  }

  clearMessages(): void {
    this.error = '';
    this.success = '';
  }

  getDayName(dayOfWeek: number): string {
    return this.dayNames[dayOfWeek] || 'Desconocido';
  }

  getAvailableDays(): number[] {
    const usedDays = this.businessHours.map(h => h.day_of_week);
    return [0, 1, 2, 3, 4, 5, 6].filter(day => !usedDays.includes(day));
  }

  getMinDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // Form getters
  get day_of_week() { return this.businessHoursForm.get('day_of_week'); }
  get start_time() { return this.businessHoursForm.get('start_time'); }
  get end_time() { return this.businessHoursForm.get('end_time'); }
  get is_closed() { return this.businessHoursForm.get('is_closed'); }
  get date() { return this.closedDateForm.get('date'); }
  get reason() { return this.closedDateForm.get('reason'); }
}
