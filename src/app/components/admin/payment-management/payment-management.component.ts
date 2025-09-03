import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AdminService, Payment, RegisterPaymentRequest } from '../../../services/admin.service';
import { User } from '../../../services/auth.service';

@Component({
  selector: 'app-payment-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment-management.component.html',
  styleUrl: './payment-management.component.scss'
})
export class PaymentManagementComponent implements OnInit {
  payments: Payment[] = [];
  users: User[] = [];
  paymentForm: FormGroup;
  loading = false;
  error = '';
  success = '';
  showCreateForm = false;
  selectedUserId: number | null = null;
  userPaymentHistory: Payment[] = [];

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService
  ) {
    this.paymentForm = this.fb.group({
      user_id: ['', [Validators.required]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      credits: ['', [Validators.required, Validators.min(1)]],
      payment_method: ['cash', [Validators.required]],
      reference: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.loadPayments();
    this.loadUsers();
    this.setupAmountListener();
  }

  loadPayments(): void {
    this.adminService.getAllPayments().subscribe({
      next: (payments) => {
        this.payments = payments;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al cargar pagos';
        console.error('Error loading payments:', error);
      }
    });
  }

  loadUsers(): void {
    this.adminService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al cargar usuarios';
        console.error('Error loading users:', error);
      }
    });
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) {
      this.paymentForm.reset();
      this.paymentForm.patchValue({ payment_method: 'cash' });
      this.clearMessages();
    }
  }

  onSubmit(): void {
    if (this.paymentForm.valid) {
      this.loading = true;
      this.clearMessages();

      const formValue = this.paymentForm.value;
      const paymentData: RegisterPaymentRequest = {
        user_id: parseInt(formValue.user_id),
        amount: parseFloat(formValue.amount),
        credits: parseInt(formValue.credits),
        payment_method: formValue.payment_method,
        reference: formValue.reference,
        notes: formValue.notes
      };

      this.adminService.registerPayment(paymentData).subscribe({
        next: (payment) => {
          this.success = 'Pago registrado exitosamente';
          this.paymentForm.reset();
          this.paymentForm.patchValue({ payment_method: 'cash' });
          this.showCreateForm = false;
          this.loadPayments();
          this.loading = false;
        },
        error: (error) => {
          this.error = error?.error?.error || 'Error al registrar pago';
          this.loading = false;
          console.error('Error registering payment:', error);
        }
      });
    }
  }

  viewUserPaymentHistory(userId: number): void {
    this.selectedUserId = userId;
    this.adminService.getUserPaymentHistory(userId).subscribe({
      next: (payments) => {
        this.userPaymentHistory = payments;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Error al cargar historial de pagos';
        console.error('Error loading payment history:', error);
      }
    });
  }

  closeUserHistory(): void {
    this.selectedUserId = null;
    this.userPaymentHistory = [];
  }

  clearMessages(): void {
    this.error = '';
    this.success = '';
  }

  // Form getters
  get user_id() { return this.paymentForm.get('user_id'); }
  get amount() { return this.paymentForm.get('amount'); }
  get credits() { return this.paymentForm.get('credits'); }
  get payment_method() { return this.paymentForm.get('payment_method'); }
  get reference() { return this.paymentForm.get('reference'); }
  get notes() { return this.paymentForm.get('notes'); }

  private setupAmountListener(): void {
    this.paymentForm.get('amount')?.valueChanges.subscribe(amount => {
      if (amount && amount > 0) {
        const credits = Math.floor(amount / 10);
        this.paymentForm.get('credits')?.setValue(credits, { emitEvent: false });
      } else {
        this.paymentForm.get('credits')?.setValue('', { emitEvent: false });
      }
    });
  }
}
