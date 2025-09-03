import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface WhatsAppOption {
  label: string;
  message: string;
  icon: string;
}

@Component({
  selector: 'app-floating-whatsapp',
  imports: [CommonModule],
  templateUrl: './floating-whatsapp.component.html',
  styleUrl: './floating-whatsapp.component.scss'
})
export class FloatingWhatsappComponent {
  isMenuOpen = false;
  phoneNumber = "524432461444"; // Correct WhatsApp number

  whatsappOptions: WhatsAppOption[] = [
    {
      label: 'Solicitar Información',
      message: 'Hola, me gustaría obtener más información sobre OMMA Consultorios y sus servicios especializados en salud y bienestar.',
      icon: 'ℹ️'
    },
    {
      label: 'Consultar Espacios',
      message: 'Hola, estoy interesado en conocer los espacios profesionales disponibles en OMMA Consultorios para terapeutas.',
      icon: '🏢'
    },
    {
      label: 'Ver Servicios',
      message: 'Hola, me interesa información sobre los servicios de psicoterapia, terapia familiar y servicios infantiles en OMMA Consultorios.',
      icon: '🩺'
    },
    {
      label: 'Conocer Instalaciones',
      message: 'Hola, me gustaría conocer más sobre las instalaciones completas y comodidades disponibles en OMMA Consultorios.',
      icon: '🏠'
    },
    {
      label: 'Reservar Cita',
      message: 'Hola, me interesa reservar una cita en OMMA Consultorios. ¿Podrían ayudarme con la disponibilidad?',
      icon: '📅'
    }
  ];

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  getWhatsAppUrl(message: string): string {
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${this.phoneNumber}?text=${encodedMessage}`;
  }

  sendMessage(option: WhatsAppOption) {
    const url = this.getWhatsAppUrl(option.message);
    window.open(url, '_blank');
    this.closeMenu();
  }
}
