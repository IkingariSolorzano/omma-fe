import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { AdminService, CreateUserRequest, UpdateUserRequest, ChangePasswordRequest, RegisterPaymentRequest, AddCreditsRequest, ExtendExpiryRequest, ReactivateExpiredRequest, TransferCreditsRequest, DeductCreditsRequest, CreditLot, ExtendCreditLotRequest, ReactivateCreditLotRequest, TransferFromLotRequest, DeductFromLotRequest } from '../../../services/admin.service';
import { User } from '../../../services/auth.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  userForm: FormGroup;
  editForm: FormGroup;
  passwordForm: FormGroup;
  paymentForm: FormGroup;
  // Manage Credits forms
  addCreditsForm: FormGroup;
  extendExpiryForm: FormGroup;
  reactivateForm: FormGroup;
  transferForm: FormGroup;
  deductForm: FormGroup;
  loading = false;
  error = '';
  success = '';
  showCreateForm = false;
  showEditModal = false;
  showPasswordModal = false;
  showPaymentModal = false;
  showCreditsModal = false;
  activeCreditTab: 'add' | 'extend' | 'reactivate' | 'transfer' | 'deduct' = 'add';
  selectedUser: User | null = null;
  creditLots: CreditLot[] = [];

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService
  ) {
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      name: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      specialty: ['', [Validators.required]],
      description: ['']
    });

    this.editForm = this.fb.group({
      name: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      specialty: [''],
      description: ['']
    });

    this.passwordForm = this.fb.group({
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required]]
    }, { validators: this.passwordsMatchValidator });

    this.paymentForm = this.fb.group({
      amount: ['', [Validators.required]],
      credits: ['', [Validators.required]],
      payment_method: ['cash', [Validators.required]],
      reference: [''],
      notes: ['']
    });

    // Manage Credits forms
    this.addCreditsForm = this.fb.group({
      amount: ['', [Validators.required]]
    });
    this.extendExpiryForm = this.fb.group({
      credit_id: ['', [Validators.required]],
      days: [30, [Validators.required, Validators.min(1)]]
    });
    this.reactivateForm = this.fb.group({
      credit_id: ['', [Validators.required]],
      new_expiry: ['', [Validators.required]] // YYYY-MM-DD
    });
    this.transferForm = this.fb.group({
      credit_id: ['', [Validators.required]],
      to_user_id: ['', [Validators.required]],
      amount: ['', [Validators.required]]
    });
    this.deductForm = this.fb.group({
      credit_id: ['', [Validators.required]],
      amount: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.loadUsers();
    this.setupPaymentFormListener();
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

  onSubmit(): void {
    if (this.userForm.valid) {
      this.loading = true;
      this.error = '';
      this.success = '';

      const userData: CreateUserRequest = {
        ...this.userForm.value,
        role: 'professional'
      };

      this.adminService.createUser(userData).subscribe({
        next: (user) => {
          this.loading = false;
          this.success = 'Usuario creado exitosamente';
          this.userForm.reset();
          this.showCreateForm = false;
          this.loadUsers();
        },
        error: (error) => {
          this.loading = false;
          this.error = error?.error?.error || 'Error al crear usuario. Verifica que el email no esté en uso.';
          console.error('Error creating user:', error);
        }
      });
    }
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) {
      this.userForm.reset();
      this.error = '';
      this.success = '';
    }
  }

  openEditModal(user: User): void {
    this.selectedUser = user;
    this.editForm.patchValue({
      name: user.name,
      phone: user.phone,
      specialty: user.specialty || '',
      description: user.description || ''
    });
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedUser = null;
    this.editForm.reset();
  }

  updateUser(): void {
    if (!this.selectedUser || this.editForm.invalid) return;

    this.loading = true;
    const userData: UpdateUserRequest = this.editForm.value;

    this.adminService.updateUser(this.selectedUser.id, userData).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Usuario actualizado exitosamente';
        this.closeEditModal();
        this.loadUsers();
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.error || 'Error al actualizar usuario';
        console.error('Error updating user:', error);
      }
    });
  }

  openPasswordModal(user: User): void {
    this.selectedUser = user;
    this.passwordForm.reset();
    this.showPasswordModal = true;
  }

  closePasswordModal(): void {
    this.showPasswordModal = false;
    this.selectedUser = null;
    this.passwordForm.reset();
  }

  openPaymentModal(user: User): void {
    this.selectedUser = user;
    this.paymentForm.reset({ payment_method: 'cash' });
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.selectedUser = null;
    this.paymentForm.reset({ payment_method: 'cash' });
  }

  openCreditsModal(user: User): void {
    this.selectedUser = user;
    this.addCreditsForm.reset();
    this.extendExpiryForm.reset({ credit_id: '', days: 30 });
    this.reactivateForm.reset({ credit_id: '' });
    this.transferForm.reset({ credit_id: '' });
    this.deductForm.reset({ credit_id: '' });
    this.activeCreditTab = 'add';
    this.showCreditsModal = true;

    // Load credit lots for this user
    this.creditLots = [];
    this.adminService.getUserCreditLots(Number(user.id)).subscribe({
      next: ({ credits }) => {
        this.creditLots = credits || [];
        // Preselect first active lot if exists
        const firstActive = this.creditLots.find(l => l.is_active);
        const defaultId = firstActive?.id || this.creditLots[0]?.id;
        if (defaultId) {
          this.extendExpiryForm.get('credit_id')?.setValue(defaultId);
          this.reactivateForm.get('credit_id')?.setValue(defaultId);
          this.transferForm.get('credit_id')?.setValue(defaultId);
          this.deductForm.get('credit_id')?.setValue(defaultId);
        }
      },
      error: (error) => {
        console.error('Error loading credit lots:', error);
      }
    });
  }

  closeCreditsModal(): void {
    this.showCreditsModal = false;
    this.selectedUser = null;
    this.addCreditsForm.reset();
    this.extendExpiryForm.reset({ credit_id: '', days: 30 });
    this.reactivateForm.reset({ credit_id: '' });
    this.transferForm.reset({ credit_id: '' });
    this.deductForm.reset({ credit_id: '' });
    this.creditLots = [];
  }

  changePassword(): void {
    if (!this.selectedUser) return;
    // Trigger validation for match
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const passwordData: ChangePasswordRequest = {
      new_password: this.passwordForm.get('new_password')?.value
    };

    this.adminService.changeUserPassword(this.selectedUser.id, passwordData).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Contraseña cambiada exitosamente';
        this.closePasswordModal();
        this.loadUsers();
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.error || 'Error al cambiar contraseña';
        console.error('Error changing password:', error);
      }
    });
  }

  registerPayment(): void {
    if (!this.selectedUser || this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const form = this.paymentForm.value;
    const payload: RegisterPaymentRequest = {
      user_id: Number(this.selectedUser.id),
      amount: parseFloat(form.amount),
      credits: parseInt(form.credits, 10),
      payment_method: form.payment_method,
      reference: form.reference || undefined,
      notes: form.notes || undefined
    };
    this.adminService.registerPayment(payload).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Pago registrado exitosamente';
        this.closePaymentModal();
        this.loadUsers();
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.error || 'Error al registrar pago';
        console.error('Error registering payment:', error);
      }
    });
  }

  // Manage credits actions
  addCredits(): void {
    if (!this.selectedUser || this.addCreditsForm.invalid) {
      this.addCreditsForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const payload: AddCreditsRequest = {
      user_id: Number(this.selectedUser.id),
      amount: parseInt(this.addCreditsForm.get('amount')?.value, 10)
    };
    this.adminService.addCredits(payload).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Créditos agregados exitosamente';
        this.closeCreditsModal();
        this.loadUsers();
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.error || 'Error al agregar créditos';
        console.error('Error adding credits:', error);
      }
    });
  }

  extendExpiry(): void {
    if (!this.selectedUser || this.extendExpiryForm.invalid) {
      this.extendExpiryForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const payload: ExtendCreditLotRequest = {
      credit_id: parseInt(this.extendExpiryForm.get('credit_id')?.value, 10),
      days: parseInt(this.extendExpiryForm.get('days')?.value, 10)
    };
    this.adminService.extendCreditLot(payload).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Fecha de expiración extendida';
        this.closeCreditsModal();
        this.loadUsers();
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.error || 'Error al extender expiración del lote';
        console.error('Error extending expiry:', error);
      }
    });
  }

  reactivateCredits(): void {
    if (!this.selectedUser || this.reactivateForm.invalid) {
      this.reactivateForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const payload: ReactivateCreditLotRequest = {
      credit_id: parseInt(this.reactivateForm.get('credit_id')?.value, 10),
      new_expiry: this.reactivateForm.get('new_expiry')?.value
    };
    this.adminService.reactivateCreditLot(payload).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Lote reactivado';
        this.closeCreditsModal();
        this.loadUsers();
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.error || 'Error al reactivar lote de créditos';
        console.error('Error reactivating credits:', error);
      }
    });
  }

  transferCredits(): void {
    if (!this.selectedUser || this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const form = this.transferForm.value;
    const payload: TransferFromLotRequest = {
      credit_id: parseInt(form.credit_id, 10),
      to_user_id: parseInt(form.to_user_id, 10),
      amount: parseInt(form.amount, 10)
    };
    this.adminService.transferFromCreditLot(payload).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Créditos transferidos';
        this.closeCreditsModal();
        this.loadUsers();
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.error || 'Error al transferir desde el lote';
        console.error('Error transferring credits:', error);
      }
    });
  }

  deductCredits(): void {
    if (!this.selectedUser || this.deductForm.invalid) {
      this.deductForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const payload: DeductFromLotRequest = {
      credit_id: parseInt(this.deductForm.get('credit_id')?.value, 10),
      amount: parseInt(this.deductForm.get('amount')?.value, 10)
    };
    this.adminService.deductFromCreditLot(payload).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Créditos deducidos';
        this.closeCreditsModal();
        this.loadUsers();
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.error || 'Error al deducir créditos del lote';
        console.error('Error deducting credits:', error);
      }
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('es-MX');
  }

  get email() { return this.userForm.get('email'); }
  get password() { return this.userForm.get('password'); }
  get name() { return this.userForm.get('name'); }
  get phone() { return this.userForm.get('phone'); }
  get specialty() { return this.userForm.get('specialty'); }

  // Validator to ensure new password and confirmation match
  private passwordsMatchValidator = (group: AbstractControl): ValidationErrors | null => {
    const newPass = group.get('new_password')?.value;
    const confirm = group.get('confirm_password')?.value;
    if (!newPass || !confirm) {
      return null; // other validators handle required
    }
    return newPass === confirm ? null : { mismatch: true };
  };

  private setupPaymentFormListener(): void {
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
