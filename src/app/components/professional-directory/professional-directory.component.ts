import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfessionalService, Professional } from '../../services/professional.service';

@Component({
  selector: 'app-professional-directory',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './professional-directory.component.html',
  styleUrl: './professional-directory.component.scss'
})
export class ProfessionalDirectoryComponent implements OnInit {
  professionals: Professional[] = [];
  filteredProfessionals: Professional[] = [];
  loading = false;
  searchTerm = '';
  selectedSpecialty = '';
  specialties: string[] = [];

  constructor(private professionalService: ProfessionalService) {}

  ngOnInit(): void {
    this.loadProfessionals();
  }

  loadProfessionals(): void {
    this.loading = true;
    this.professionalService.getProfessionalDirectory().subscribe({
      next: (professionals) => {
        this.professionals = professionals;
        this.filteredProfessionals = professionals;
        this.extractSpecialties();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading professionals:', error);
        this.loading = false;
      }
    });
  }

  extractSpecialties(): void {
    const specialtySet = new Set(this.professionals.map(p => p.specialty));
    this.specialties = Array.from(specialtySet).sort();
  }

  onSearch(event: any): void {
    this.searchTerm = event.target.value.toLowerCase();
    this.filterProfessionals();
  }

  onSpecialtyFilter(event: any): void {
    this.selectedSpecialty = event.target.value;
    this.filterProfessionals();
  }

  filterProfessionals(): void {
    this.filteredProfessionals = this.professionals.filter(professional => {
      const matchesSearch = !this.searchTerm || 
        professional.name.toLowerCase().includes(this.searchTerm) ||
        professional.specialty.toLowerCase().includes(this.searchTerm) ||
        professional.description.toLowerCase().includes(this.searchTerm);
      
      const matchesSpecialty = !this.selectedSpecialty || 
        professional.specialty === this.selectedSpecialty;
      
      return matchesSearch && matchesSpecialty;
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedSpecialty = '';
    this.filteredProfessionals = this.professionals;
  }
  
  getWhatsAppLink(professional: Professional): string {
    const phone = professional.phone.replace(/\D/g, '');
    const fullPhone = phone.startsWith('52') ? phone : '52' + phone;
    const message = `Hola ${professional.name}, me gustaría agendar una cita. ¿Cuándo tienes disponibilidad?`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  }
}
