import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';

@Directive({ standalone: true, selector: '[appReveal]' })
export class ScrollRevealDirective implements OnInit, OnDestroy {
  @Input('appReveal') delay: number | string = 0;
  private observer?: IntersectionObserver;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit() {
    const node = this.el.nativeElement;
    node.classList.add('reveal');
    node.style.transitionDelay = `${Number(this.delay) || 0}ms`;
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.classList.add('reveal-visible');
      return;
    }
    this.observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) { node.classList.add('reveal-visible'); this.observer?.unobserve(node); }
      }
    }, { threshold: 0.15 });
    this.observer.observe(node);
  }

  ngOnDestroy() { this.observer?.disconnect(); }
}
