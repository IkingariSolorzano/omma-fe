import { Component } from '@angular/core';

@Component({
  selector: 'app-contact',
  imports: [],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {

  getWhatsAppReservationUrl(): string {
    const phoneNumber = "524432461444";
    const message = encodeURIComponent(
      "Hola, me gustaría reservar un espacio en OMMA Consultorios. ¿Podrían ayudarme con la disponibilidad de horarios?"
    );
    return `https://wa.me/${phoneNumber}?text=${message}`;
  }

  getWhatsAppInfoUrl(): string {
    const phoneNumber = "524432461444";
    const message = encodeURIComponent(
      "Hola, me gustaría obtener más información sobre OMMA Consultorios y sus servicios."
    );
    return `https://wa.me/${phoneNumber}?text=${message}`;
  }
}
