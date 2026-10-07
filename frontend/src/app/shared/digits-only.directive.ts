import { Directive, ElementRef, HostListener } from '@angular/core';
import { NgModel } from '@angular/forms';

@Directive({ standalone: true, selector: 'input[appDigitsOnly]' })
export class DigitsOnlyDirective {
  constructor(private el: ElementRef<HTMLInputElement>, private model: NgModel) {}

  @HostListener('keypress', ['$event'])
  onKeyPress(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!/^[0-9]$/.test(event.key)) event.preventDefault();
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const digits = (event.clipboardData?.getData('text') ?? '').replace(/\D+/g, '');
    const input = this.el.nativeElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + digits + input.value.slice(end);
    this.model.control.setValue(next);
  }

  @HostListener('input')
  onInput() {
    const input = this.el.nativeElement;
    const cleaned = input.value.replace(/\D+/g, '');
    if (cleaned !== input.value) this.model.control.setValue(cleaned);
  }
}
