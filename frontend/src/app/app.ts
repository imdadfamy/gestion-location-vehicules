import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter } from 'rxjs';

@Component({ imports: [RouterOutlet], selector: 'app-root', styleUrl: './app.scss', template: '<router-outlet />' })
export class App implements AfterViewInit, OnDestroy {
  private observer?: MutationObserver;
  private readonly requiredLabels = new Set([
    'Prénom', 'Nom', 'Téléphone', 'Immatriculation', 'Marque', 'Modèle',
    'Client', 'Véhicule', 'Véhicule disponible', 'Départ', 'Retour',
    'Prix total', 'Caution', 'Location', 'Montant', 'Date', 'Type',
    'Description', 'Statut', 'Nom de l’entreprise', 'Nom complet', 'E-mail professionnel'
  ]);
  constructor(router: Router, title: Title) {
    router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe((event) => {
      const url = (event as NavigationEnd).urlAfterRedirects;
      const labels: Record<string, string> = { '/': 'Accueil', '/client/vehicles': 'Véhicules disponibles', '/client/reservations': 'Mes réservations', '/client/contracts': 'Mes contrats', '/client/inspections': 'Mes inspections', '/client/account': 'Mon profil', '/login': 'Connexion' };
      const key = Object.keys(labels).find(path => url === path || (path !== '/' && url.startsWith(path)));
      title.setTitle(`${labels[key ?? ''] ?? 'Gestion de flotte'} – FIMA AUTO`);
    });
  }
  ngAfterViewInit() {
    this.markRequired();
    this.observer = new MutationObserver(() => this.markRequired());
    this.observer.observe(document.body, { childList: true, subtree: true });
  }
  ngOnDestroy() { this.observer?.disconnect(); }
  private markRequired() {
    document.querySelectorAll('section.card label, .form-card label').forEach((label) => {
      const raw = label.textContent ?? '';
      const text = raw.replace('*', '').trim();
      if (!this.requiredLabels.has(text)) return;
      if (!raw.includes('*')) label.classList.add('required-label');
      const control = label.nextElementSibling as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (control && ['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tagName)) control.setAttribute('aria-required', 'true');
    });
  }
}
