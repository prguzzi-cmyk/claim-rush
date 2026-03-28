import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// UUID regex pattern
const UUID_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function uuidValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value || UUID_REGEX.test(value)) {
      return null; // valid UUID or empty
    }
    return { invalidUUID: true }; // invalid UUID
  };
}
