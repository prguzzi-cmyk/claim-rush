import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'durationFormat', standalone: false })
export class DurationFormatPipe implements PipeTransform {
  transform(seconds: number | null | undefined): string {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
