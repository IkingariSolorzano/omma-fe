import { Component } from '@angular/core';
import { FooterComponent } from "../footer/footer.component";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: 'app-inicio',
  imports: [ FooterComponent, RouterOutlet],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.scss'
})
export class InicioComponent {

}
