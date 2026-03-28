import { Component } from '@angular/core';

@Component({
  selector: 'app-public-layout',
  templateUrl: './public-layout.component.html',
  styleUrls: ['./public-layout.component.scss'],
  standalone: false,
})
export class PublicLayoutComponent {
  mobileMenuOpen = false;
  currentYear = new Date().getFullYear();

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }
}
