import { Component } from '@angular/core';

@Component({
  selector: 'app-pricing',
  imports: [],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss'
})
export class PricingComponent {

  getWhatsAppPricingUrl(): string {
    const phoneNumber = "524432461444";
    const message = encodeURIComponent(
      "Hola, estoy interesado en conocer las tarifas y paquetes disponibles en OMMA Consultorios. ¿Podrían enviarme más información sobre precios y opciones?"
    );
    return `https://wa.me/${phoneNumber}?text=${message}`;
  }

  getWhatsAppReservationUrl(): string {
    const phoneNumber = "524432461444";
    const message = encodeURIComponent(
      "Hola, me gustaría reservar un espacio en OMMA Consultorios. ¿Podrían ayudarme con la disponibilidad y proceso de reserva?"
    );
    return `https://wa.me/${phoneNumber}?text=${message}`;
  }
}
