import { FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

export function atLeastOneValidator(): ValidatorFn {
  return (group: FormGroup): ValidationErrors | null => {
    const controls = group.controls;
    let isAtLeastOne = false;

    // Iterate over the controls in the group
    Object.keys(controls).forEach((key) => {
      const control = controls[key];

      // Check if the control is selected/filled out
      if (control.value) {
        isAtLeastOne = true;
      }
    });

    // If at least one control is selected/filled out, return null (no error)
    if (isAtLeastOne) {
      return null;
    }

    // If no controls are selected/filled out, return an error
    return { atLeastOneRequired: true };
  };
}
