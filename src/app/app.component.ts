import { Component } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { NgIf } from '@angular/common';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FloatingWhatsappComponent } from './components/floating-whatsapp/floating-whatsapp.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIf, NavbarComponent, FloatingWhatsappComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'omma';
  isAdminRoute = false;
  isLandingRoute = false;

  constructor(private router: Router) {
    // Set initial state
    this.isAdminRoute = this.router.url.startsWith('/admin');
    this.isLandingRoute = this.router.url === '/' || this.router.url === '';

    // Update on navigation
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.isAdminRoute = this.router.url.startsWith('/admin');
        this.isLandingRoute = this.router.url === '/' || this.router.url === '';
      }
    });
  }
}
