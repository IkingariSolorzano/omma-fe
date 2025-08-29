import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Room {
  id: number;
  title: string;
  description: string;
  images: string[];
  features: string[];
}

@Component({
  selector: 'app-spaces',
  imports: [CommonModule],
  templateUrl: './spaces.component.html',
  styleUrl: './spaces.component.scss'
})
export class SpacesComponent {
  lightboxOpen = false;
  currentRoomIndex = 0;
  currentImageIndex = 0;

  rooms: Room[] = [
    {
      id: 1,
      title: 'Consultorio 1 - Más Grande/Infantil',
      description: 'El consultorio más grande, especialmente adaptado para trabajo con niños, pero versátil para talleres y conferencias.',
      images: [
        'images/fotos/consultorio_infantil.jpg',
        'images/fotos/consultorio_infantil2.jpg'
      ],
      features: [
        'Espacio versátil',
        'Adaptado para niños',
        'Ideal para talleres',
        'Renta de sillas extra'
      ]
    },
    {
      id: 2,
      title: 'Consultorio 2 - Grande',
      description: 'Consultorio amplio y cómodo, perfecto para sesiones grupales y terapias familiares.',
      images: [
        'images/fotos/consultorio_grande.jpg'
      ],
      features: [
        'Sesiones grupales',
        'Terapia familiar',
        'Espacio amplio',
        'Comodidad total'
      ]
    },
    {
      id: 3,
      title: 'Consultorio 3 - Chico',
      description: 'Espacio íntimo y acogedor, ideal para sesiones individuales y terapia personal.',
      images: [
        'images/fotos/consultorio_chico.jpg'
      ],
      features: [
        'Sesiones individuales',
        'Ambiente íntimo',
        'Terapia personal',
        'Privacidad total'
      ]
    },
    {
      id: 4,
      title: 'Consultorio 4 - Mediano',
      description: 'Consultorio equilibrado y funcional, perfecto para terapia individual o familiar.',
      images: [
        'images/fotos/consultorio_mediano.jpg'
      ],
      features: [
        'Terapia individual',
        'Terapia familiar',
        'Equilibrado',
        'Funcional'
      ]
    },
    {
      id: 5,
      title: 'Consultorio 5 - Principal',
      description: 'El consultorio más equipado y representativo, con la máxima calidad y confort.',
      images: [
        'images/fotos/consultorio_principal.jpg'
      ],
      features: [
        'Máxima calidad',
        'Totalmente equipado',
        'Ambiente premium',
        'Confort excepcional'
      ]
    },
    {
      id: 6,
      title: 'Área de Recepción',
      description: 'Bienvenida profesional con recepcionista y sala de espera cómoda.',
      images: [
        'images/fotos/recepcion.jpg'
      ],
      features: [
        'Recepcionista 12:00-20:00',
        'Sala de espera',
        'Bienvenida profesional',
        'Ambiente acogedor'
      ]
    }
  ];

  get currentRoom(): Room {
    return this.rooms[this.currentRoomIndex];
  }

  openLightbox(roomIndex: number) {
    this.currentRoomIndex = roomIndex;
    this.currentImageIndex = 0;
    this.lightboxOpen = true;
  }

  closeLightbox() {
    this.lightboxOpen = false;
  }

  prevImage() {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
    } else {
      this.currentImageIndex = this.currentRoom.images.length - 1;
    }
  }

  nextImage() {
    if (this.currentImageIndex < this.currentRoom.images.length - 1) {
      this.currentImageIndex++;
    } else {
      this.currentImageIndex = 0;
    }
  }
}
