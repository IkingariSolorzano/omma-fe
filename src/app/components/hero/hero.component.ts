import { Component, OnInit, OnDestroy, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-hero',
  imports: [CommonModule, RouterModule],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss'
})
export class HeroComponent implements OnInit, OnDestroy, AfterViewChecked {
  currentSlide = 0;
  slides = [0, 1, 2, 3, 4]; // 5 slides
  private autoSlideInterval: any;
  private previousSlide = -1;
  private animationTimeout: any;
  private isViewInitialized = false;

  @ViewChild('carouselContainer', { static: false }) carouselContainer!: ElementRef;

  ngOnInit() {
    this.startAutoSlide();
    // Force initial animation trigger for first slide
    setTimeout(() => {
      this.resetAnimations();
    }, 100);
  }

  ngAfterViewChecked() {
    // Detect slide changes and trigger animations
    if (this.previousSlide !== this.currentSlide) {
      setTimeout(() => {
        this.resetAnimations();
      }, 10);
      this.previousSlide = this.currentSlide;
    }
  }

  ngOnDestroy() {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
    }
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }
  }

  nextSlide() {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
    this.resetAutoSlideTimer();
  }

  prevSlide() {
    this.currentSlide = this.currentSlide === 0 ? this.slides.length - 1 : this.currentSlide - 1;
    this.resetAutoSlideTimer();
  }

  goToSlide(index: number) {
    this.currentSlide = index;
    this.resetAutoSlideTimer();
  }

  private resetAnimations() {
    // Clear any existing animation timeout
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }

    // Force DOM update to reset animations
    this.animationTimeout = setTimeout(() => {
      if (this.carouselContainer) {
        const slideElements = this.carouselContainer.nativeElement.querySelectorAll('.carousel-slide');

        slideElements.forEach((slide: Element, index: number) => {
          const slideDiv = slide as HTMLElement;

          // Remove existing animation classes
          const animatedElements = slide.querySelectorAll('.animate__animated');
          animatedElements.forEach((element: Element) => {
            const htmlElement = element as HTMLElement;
            // Remove all animation classes
            htmlElement.classList.remove('animate__animated', 'animate__fadeInUp', 'animate__fadeInRight', 'animate__fadeInUp', 'animate__delay-1s', 'animate__delay-2s', 'animate__delay-3s');
            // Force reflow
            htmlElement.offsetHeight;
          });

          // Only add animations to the current active slide
          if (index === this.currentSlide) {
            this.addAnimationsToSlide(slideDiv, index);
          }
        });
      }
    }, 50); // Small delay to ensure DOM is updated
  }

  private addAnimationsToSlide(slideElement: HTMLElement, slideIndex: number) {
    // Get the content container
    const contentDiv = slideElement.querySelector('.relative.z-10');
    const title = slideElement.querySelector('h1');
    const subtitle = slideElement.querySelector('p');
    const buttons = slideElement.querySelector('.flex.flex-col');

    if (contentDiv && title && subtitle && buttons) {
      const contentElement = contentDiv as HTMLElement;
      const titleElement = title as HTMLElement;
      const subtitleElement = subtitle as HTMLElement;
      const buttonsElement = buttons as HTMLElement;

      // Initially hide elements to prevent visual duplication
      contentElement.style.opacity = '0';
      titleElement.style.opacity = '0';
      subtitleElement.style.opacity = '0';
      buttonsElement.style.opacity = '0';

      // Content container animation (immediate)
      setTimeout(() => {
        contentElement.classList.add('animate__animated', 'animate__slideIn');
        contentElement.style.opacity = '1';
      }, 50);

      // Title animation (from above - slideInDown)
      setTimeout(() => {
        titleElement.classList.add('animate__animated', 'animate__slideInDown');
        titleElement.style.opacity = '1';
      }, 150);

      // Subtitle animation (from center/back)
      setTimeout(() => {
        subtitleElement.classList.add('animate__animated', 'animate__slideIn');
        subtitleElement.style.opacity = '1';
      }, 250);

      // Buttons animation (from below - slideInUp) - reduced delay
      setTimeout(() => {
        buttonsElement.classList.add('animate__animated', 'animate__slideInUp');
        buttonsElement.style.opacity = '1';
      }, 350);
    }
  }

  private resetAutoSlideTimer() {
    // Clear the current interval
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
    }
    // Start a new interval
    this.startAutoSlide();
  }

  private startAutoSlide() {
    this.autoSlideInterval = setInterval(() => {
      this.nextSlide();
    }, 5000); // Change slide every 5 seconds
  }

  getWhatsAppMessage(): string {
    const messages = {
      0: "Hola, me gustaría obtener más información sobre OMMA Consultorios y sus servicios especializados en salud y bienestar.",
      1: "Hola, estoy interesado en conocer los espacios profesionales disponibles en OMMA Consultorios para terapeutas.",
      2: "Hola, me interesa información sobre los servicios de psicoterapia, terapia familiar y servicios infantiles en OMMA Consultorios.",
      3: "Hola, me gustaría conocer más sobre las instalaciones completas y comodidades disponibles en OMMA Consultorios.",
      4: "Hola, me interesa reservar una cita en OMMA Consultorios. ¿Podrían ayudarme con la disponibilidad?"
    };
    return messages[this.currentSlide as keyof typeof messages] || messages[0];
  }

  getWhatsAppUrl(): string {
    const phoneNumber = "5491167424184"; // Replace with actual WhatsApp number
    const message = encodeURIComponent(this.getWhatsAppMessage());
    return `https://wa.me/${phoneNumber}?text=${message}`;
  }
}
