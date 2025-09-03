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
    if (this.businessHoursForm.valid) {
      this.loading = true;
      this.clearMessages();

      const formData = this.businessHoursForm.value;
      
      // Check if business hour for this day already exists
      const existingHour = this.businessHours.find(h => h.day_of_week === parseInt(formData.day_of_week));
      
      if (existingHour) {
        // Update existing
        const updatedHour = { ...existingHour, ...formData, day_of_week: parseInt(formData.day_of_week) };
        this.adminService.updateBusinessHour(existingHour.id!, updatedHour).subscribe({
          next: () => {
            this.success = 'Horario actualizado exitosamente';
            this.businessHoursForm.reset();
            this.loadBusinessHours();
            this.loading = false;
          },
          error: (error) => {
            this.error = 'Error al actualizar horario';
            this.loading = false;
            console.error('Error updating business hour:', error);
          }
        });
      } else {
        // Create new
        const newHour = { ...formData, day_of_week: parseInt(formData.day_of_week) };
        this.adminService.createBusinessHour(newHour).subscribe({
          next: () => {
            this.success = 'Horario creado exitosamente';
            this.businessHoursForm.reset();
            this.loadBusinessHours();
            this.loading = false;
          },
          error: (error) => {
            this.error = 'Error al crear horario';
            this.loading = false;
            console.error('Error creating business hour:', error);
          }
        });
      }
    }
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
