import { Component } from '@angular/core';

@Component({
  selector: 'app-services',
  imports: [],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss'
})
export class ServicesComponent {

  getWhatsAppServicesUrl(): string {
    const phoneNumber = "524432461444";
    const message = encodeURIComponent(
      "Hola, me gustaría conocer más sobre los servicios incluidos en OMMA Consultorios y cómo pueden beneficiar mi práctica profesional."
    );
    return `https://wa.me/${phoneNumber}?text=${message}`;
  }

  getWhatsAppInfoUrl(): string {
    const phoneNumber = "524432461444";
    const message = encodeURIComponent(
      "Hola, me interesa obtener más información sobre OMMA Consultorios y sus espacios disponibles para terapeutas."
    );
    return `https://wa.me/${phoneNumber}?text=${message}`;
  }
}
