import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AdminService, Space, Schedule, CreateSpaceRequest, CreateScheduleRequest } from '../../../services/admin.service';

@Component({
  selector: 'app-space-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './space-management.component.html',
  styleUrl: './space-management.component.scss'
})
export class SpaceManagementComponent implements OnInit {
  spaces: Space[] = [];
  spaceForm: FormGroup;
  scheduleForm: FormGroup;
  loading = false;
  error = '';
  success = '';
  showCreateForm = false;
  showEditForm = false;
  showScheduleForm = false;
  editingSpace: Space | null = null;
  selectedSpaceId: number | null = null;
  weeklySchedule: WeeklyScheduleDay[] = [];
  existingSchedules: Schedule[] = [];
  loadingSchedules = false;

  daysOfWeek = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' }
  ];

  // Available hours (exact hours only)
  availableHours = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00'
  ];

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService
  ) {
    this.spaceForm = this.fb.group({
      name: ['', [Validators.required]],
      description: ['', [Validators.required]],
      capacity: [1, [Validators.required, Validators.min(1)]],
      cost_credits: [6, [Validators.required, Validators.min(1)]]
    });

    this.scheduleForm = this.fb.group({
      space_id: ['', [Validators.required]],
      day_of_week: ['', [Validators.required]],
      start_time: ['09:00', [Validators.required]],
      end_time: ['18:00', [Validators.required]]
    });

    this.initializeWeeklySchedule();
  }

  ngOnInit(): void {
    this.loadSpaces();
  }

  loadSpaces(): void {
    this.adminService.getAllSpaces().subscribe({
      next: (spaces) => {
        this.spaces = spaces;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al cargar espacios';
        console.error('Error loading spaces:', error);
      }
    });
  }

  onSubmitSpace(): void {
    if (this.spaceForm.valid) {
      this.loading = true;
      this.error = '';
      this.success = '';

      const spaceData: CreateSpaceRequest = this.spaceForm.value;

      this.adminService.createSpace(spaceData).subscribe({
        next: (space) => {
          this.loading = false;
          this.success = 'Espacio creado exitosamente';
          this.spaceForm.reset();
          this.spaceForm.patchValue({ capacity: 1, cost_credits: 6 });
          this.showCreateForm = false;
          this.loadSpaces();
        },
        error: (error) => {
          this.loading = false;
          this.error = error?.error?.error || 'Error al crear espacio';
          console.error('Error creating space:', error);
        }
      });
    }
  }

  onSubmitSchedule(): void {
    if (this.scheduleForm.valid) {
      this.loading = true;
      this.error = '';
      this.success = '';

      const scheduleData: CreateScheduleRequest = {
        ...this.scheduleForm.value,
        space_id: parseInt(this.scheduleForm.value.space_id),
        day_of_week: parseInt(this.scheduleForm.value.day_of_week)
      };

      this.adminService.createSchedule(scheduleData).subscribe({
        next: () => {
          this.loading = false;
          this.success = 'Horario creado exitosamente';
          this.scheduleForm.reset();
          this.scheduleForm.patchValue({ start_time: '09:00', end_time: '18:00' });
          this.showScheduleForm = false;
        },
        error: (error) => {
          this.loading = false;
          this.error = error?.error?.error || 'Error al crear horario';
          console.error('Error creating schedule:', error);
        }
      });
    }
  }

  toggleEditForm(space?: Space): void {
    this.showEditForm = !this.showEditForm;
    if (this.showEditForm && space) {
      this.editingSpace = space;
      this.spaceForm.patchValue({
        name: space.name,
        description: space.description,
        capacity: space.capacity,
        cost_credits: space.cost_credits
      });
    } else {
      this.editingSpace = null;
      this.spaceForm.reset();
      this.spaceForm.patchValue({ capacity: 1, cost_credits: 9 });
    }
    this.error = '';
    this.success = '';
  }

  onSubmitEditSpace(): void {
    if (this.spaceForm.valid && this.editingSpace) {
      this.loading = true;
      this.error = '';
      this.success = '';

      const spaceData: CreateSpaceRequest = this.spaceForm.value;

      this.adminService.updateSpace(this.editingSpace.id, spaceData).subscribe({
        next: (space) => {
          this.loading = false;
          this.success = 'Espacio actualizado exitosamente';
          this.toggleEditForm();
          this.loadSpaces();
        },
        error: (error) => {
          this.loading = false;
          this.error = error?.error?.error || 'Error al actualizar espacio';
          console.error('Error updating space:', error);
        }
      });
    }
  }

  onDeleteSpace(space: Space): void {
    if (confirm(`¿Estás seguro de que deseas eliminar el espacio "${space.name}"? Esta acción no se puede deshacer.`)) {
      this.adminService.deleteSpace(space.id).subscribe({
        next: () => {
          this.success = 'Espacio eliminado exitosamente';
          this.loadSpaces();
        },
        error: (error) => {
          this.error = error?.error?.error || 'Error al eliminar espacio';
          console.error('Error deleting space:', error);
        }
      });
    }
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) {
      this.spaceForm.reset();
      this.spaceForm.patchValue({ capacity: 1, cost_credits: 6 });
      this.error = '';
      this.success = '';
    }
  }

  toggleScheduleForm(): void {
    this.showScheduleForm = !this.showScheduleForm;
    if (!this.showScheduleForm) {
      this.scheduleForm.reset();
      this.scheduleForm.patchValue({ start_time: '09:00', end_time: '18:00' });
      this.selectedSpaceId = null;
      this.initializeWeeklySchedule();
      this.error = '';
      this.success = '';
    }
  }

  selectSpaceForSchedule(spaceId: number): void {
    this.selectedSpaceId = spaceId;
    this.showScheduleForm = true;
    // Reset state before loading
    this.existingSchedules = [];
    this.weeklySchedule = [];
    this.loadExistingSchedules(spaceId);
    this.error = '';
    this.success = '';
  }

  loadExistingSchedules(spaceId: number): void {
    this.loadingSchedules = true;
    this.error = '';
    
    this.adminService.getAllSchedules(spaceId).subscribe({
      next: (schedules) => {
        this.existingSchedules = schedules || [];
        this.loadingSchedules = false;
        this.initializeWeeklyScheduleWithExisting();
      },
      error: (error) => {
        console.error('Error loading schedules:', error);
        this.loadingSchedules = false;
        this.error = 'Error al cargar horarios existentes';
        this.existingSchedules = [];
        this.initializeWeeklySchedule();
      }
    });
  }

  initializeWeeklyScheduleWithExisting(): void {
    // Ensure existingSchedules is an array
    if (!Array.isArray(this.existingSchedules)) {
      this.existingSchedules = [];
    }
    
    this.weeklySchedule = this.daysOfWeek.map(day => {
      const existingSchedule = this.existingSchedules.find(s => s.day_of_week === day.value);
      
      if (existingSchedule) {
        
        // Extract and format time properly
        let startTime = existingSchedule.start_time;
        let endTime = existingSchedule.end_time;
        
        // Handle different time formats that might come from backend
        if (startTime && typeof startTime === 'string') {
          // Ensure format is HH:MM
          if (startTime.length === 5 && startTime.includes(':')) {
            // Already in correct format
          } else if (startTime.length === 4) {
            // Format like "0900" -> "09:00"
            startTime = startTime.substring(0, 2) + ':' + startTime.substring(2);
          } else if (startTime.length === 3) {
            // Format like "900" -> "09:00"
            startTime = '0' + startTime.substring(0, 1) + ':' + startTime.substring(1);
          }
        } else {
          startTime = '09:00';
        }
        
        if (endTime && typeof endTime === 'string') {
          // Ensure format is HH:MM
          if (endTime.length === 5 && endTime.includes(':')) {
            // Already in correct format
          } else if (endTime.length === 4) {
            // Format like "2000" -> "20:00"
            endTime = endTime.substring(0, 2) + ':' + endTime.substring(2);
          } else if (endTime.length === 3) {
            // Format like "900" -> "09:00"
            endTime = '0' + endTime.substring(0, 1) + ':' + endTime.substring(1);
          }
        } else {
          endTime = '18:00';
        }
        
        
        return {
          dayValue: day.value,
          dayLabel: day.label,
          startTime: startTime,
          endTime: endTime,
          isActive: true,
          scheduleId: existingSchedule.id
        };
      } else {
        return {
          dayValue: day.value,
          dayLabel: day.label,
          startTime: '09:00',
          endTime: '18:00',
          isActive: false
        };
      }
    });
  }

  initializeWeeklySchedule(): void {
    this.weeklySchedule = this.daysOfWeek.map(day => ({
      dayValue: day.value,
      dayLabel: day.label,
      startTime: '09:00',
      endTime: '18:00',
      isActive: false
    }));
  }

  updateDaySchedule(dayValue: number, field: 'startTime' | 'endTime' | 'isActive', value: string | boolean): void {
    const daySchedule = this.weeklySchedule.find(d => d.dayValue === dayValue);
    if (daySchedule) {
      if (field === 'startTime' || field === 'endTime') {
        (daySchedule as any)[field] = value as string;
      } else if (field === 'isActive') {
        daySchedule.isActive = value as boolean;
      }
      
      // Validate start time vs end time
      if (field === 'startTime' || field === 'endTime') {
        this.validateTimeRange(daySchedule);
      }
    }
  }

  validateTimeRange(daySchedule: WeeklyScheduleDay): void {
    if (daySchedule.startTime && daySchedule.endTime) {
      const startHour = parseInt(daySchedule.startTime.split(':')[0]);
      const endHour = parseInt(daySchedule.endTime.split(':')[0]);
      
      if (startHour >= endHour) {
        // Reset end time to one hour after start time
        const newEndHour = Math.min(startHour + 1, 22);
        daySchedule.endTime = `${newEndHour.toString().padStart(2, '0')}:00`;
      }
    }
  }

  onSubmitWeeklySchedule(): void {
    if (!this.selectedSpaceId) {
      this.error = 'Debe seleccionar un espacio';
      return;
    }

    const activeSchedules = this.weeklySchedule.filter(day => day.isActive);
    if (activeSchedules.length === 0) {
      this.error = 'Debe seleccionar al menos un día';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    // Separate new schedules from updates
    const createPromises: Promise<any>[] = [];
    const updatePromises: Promise<any>[] = [];

    activeSchedules.forEach(day => {
      const scheduleData: CreateScheduleRequest = {
        space_id: this.selectedSpaceId!,
        day_of_week: day.dayValue,
        start_time: day.startTime,
        end_time: day.endTime
      };

      if (day.scheduleId) {
        // Update existing schedule
        updatePromises.push(this.adminService.updateSchedule(day.scheduleId, scheduleData).toPromise());
      } else {
        // Create new schedule
        createPromises.push(this.adminService.createSchedule(scheduleData).toPromise());
      }
    });

    // Handle inactive days (delete existing schedules)
    const inactiveSchedules = this.weeklySchedule.filter(day => !day.isActive && day.scheduleId);
    const deletePromises = inactiveSchedules.map(day => 
      this.adminService.deleteSchedule(day.scheduleId!).toPromise()
    );

    Promise.all([...createPromises, ...updatePromises, ...deletePromises])
      .then(() => {
        this.loading = false;
        const totalOperations = createPromises.length + updatePromises.length + deletePromises.length;
        this.success = `Horarios actualizados exitosamente (${totalOperations} operación(es))`;
        this.showScheduleForm = false;
        this.selectedSpaceId = null;
        this.initializeWeeklySchedule();
      })
      .catch((error) => {
        this.loading = false;
        this.error = error?.error?.error || 'Error al actualizar horarios';
        console.error('Error updating schedules:', error);
      });
  }

  getSelectedSpaceName(): string {
    if (!this.selectedSpaceId) return '';
    const space = this.spaces.find(s => s.id === this.selectedSpaceId);
    return space ? space.name : '';
  }

  getDayLabel(dayValue: number): string {
    const day = this.daysOfWeek.find(d => d.value === dayValue);
    return day ? day.label : 'N/A';
  }

  debugScheduleData(): void {
    console.log('=== SCHEDULE DEBUG INFO ===');
    console.log('Selected Space ID:', this.selectedSpaceId);
    console.log('Existing Schedules:', this.existingSchedules);
    console.log('Weekly Schedule:', this.weeklySchedule);
    console.log('Days of Week mapping:', this.daysOfWeek);
    
    // Check each existing schedule
    this.existingSchedules.forEach(schedule => {
      console.log(`Schedule ID ${schedule.id}: day_of_week=${schedule.day_of_week}, start_time=${schedule.start_time}, end_time=${schedule.end_time}`);
    });
  }


  // Form getters
  get name() { return this.spaceForm.get('name'); }
  get description() { return this.spaceForm.get('description'); }
  get capacity() { return this.spaceForm.get('capacity'); }
  get cost_credits() { return this.spaceForm.get('cost_credits'); }
}

interface WeeklyScheduleDay {
  dayValue: number;
  dayLabel: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  scheduleId?: number;
}
