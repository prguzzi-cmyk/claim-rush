import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'filesize',
    standalone: false
})
export class FileSizePipe implements PipeTransform {
  transform(size: number, extension: string = 'MB') {
    if(size > 1000000)
      return (size / (1024 * 1024)).toFixed(2) + extension;
    else
      return (size / (1024)).toFixed(2) + 'KB';
  }
}
