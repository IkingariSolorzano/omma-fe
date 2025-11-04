import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AdminService, AddCreditsRequest, ExtendExpiryRequest } from '../../../services/admin.service';
import { User } from '../../../services/auth.service';

@Component({
  selector: 'app-credits-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './credits-management.component.html',
  styleUrl: './credits-management.component.scss'
})
export class CreditsManagementComponent implements OnInit {
  users: User[] = [];
  creditsForm: FormGroup;
  extendForm: FormGroup;
  loading = false;
  error = '';
  success = '';

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService
  ) {
    this.creditsForm = this.fb.group({
      user_id: ['', [Validators.required]],
      amount: ['', [Validators.required, Validators.min(1)]]
    });

    this.extendForm = this.fb.group({
      user_id: ['', [Validators.required]],
      days: ['', [Validators.required, Validators.min(1), Validators.max(365)]]
    });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.adminService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users.filter(user => user.role === 'professional');
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al cargar usuarios';
        console.error('Error loading users:', error);
      }
    });
  }

  onSubmit(): void {
    if (this.creditsForm.valid) {
      this.loading = true;
      this.error = '';
      this.success = '';

      const creditsData: AddCreditsRequest = {
        user_id: parseInt(this.creditsForm.value.user_id),
        amount: parseInt(this.creditsForm.value.amount)
      };

      this.adminService.addCredits(creditsData).subscribe({
        next: () => {
          this.loading = false;
          this.success = 'Créditos agregados exitosamente';
          this.creditsForm.reset();
          this.loadUsers(); // Refresh to show updated credits
        },
        error: (error) => {
          this.loading = false;
          this.error = error?.error?.error || 'Error al agregar créditos';
          console.error('Error adding credits:', error);
        }
      });
    }
  }

  onExtendSubmit(): void {
    if (this.extendForm.valid) {
      this.loading = true;
      this.error = '';
      this.success = '';

      const extendData: ExtendExpiryRequest = {
        user_id: parseInt(this.extendForm.value.user_id),
        days: parseInt(this.extendForm.value.days)
      };

      this.adminService.extendCreditExpiry(extendData).subscribe({
        next: () => {
          this.loading = false;
          this.success = 'Vigencia de créditos extendida exitosamente';
          this.extendForm.reset();
          this.loadUsers(); // Refresh to show updated credits
        },
        error: (error) => {
          this.loading = false;
          this.error = error?.error?.error || 'Error al extender vigencia';
          console.error('Error extending expiry:', error);
        }
      });
    }
  }

  getSelectedUser(): User | undefined {
    const userId = this.creditsForm.get('user_id')?.value;
    return this.users.find(user => user.id === parseInt(userId));
  }

  get extend_user_id() { return this.extendForm.get('user_id'); }
  get days() { return this.extendForm.get('days'); }

  get user_id() { return this.creditsForm.get('user_id'); }
  get amount() { return this.creditsForm.get('amount'); }
}
