import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'phoneNumberFormat',
    standalone: false
})
export class PhoneNumberFormatPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) {
      return '';
    }

    // Normalize string and remove all unnecessary characters
    value = value.replace(/\D/g, '');

    // Check if the input is of correct length
    if (value.length == 10) {
      return `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6, 10)}`;
    }

    return value; // Return original value if it is not a valid US phone number length
  }
}
