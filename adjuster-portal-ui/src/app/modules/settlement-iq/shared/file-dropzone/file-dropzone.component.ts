import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostBinding, HostListener, Input, Output } from '@angular/core';

/**
 * Drag-and-drop file picker. Validates extension + size client-side
 * before the upload service ever sees each file — keeps the 413/415
 * round-trips to the backend rare.
 *
 * Supports multi-file selection (both drag-drop of N files at once and
 * the browser file picker with `multiple`). Emits `(fileSelected)` once
 * per VALID file and `(rejected)` once per INVALID file. The parent
 * component accumulates and owns presentation of the file list.
 */
@Component({
  selector: 'si-file-dropzone',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-dropzone.component.html',
  styleUrls: ['./file-dropzone.component.scss'],
})
export class FileDropzoneComponent {
  /** Bytes. Matches the backend's MAX_UPLOAD_BYTES = 25 MB. */
  @Input() maxBytes = 25 * 1024 * 1024;

  /** Lowercase, including the leading dot. */
  @Input() allowedExtensions: readonly string[] = ['.pdf', '.docx'];

  @Output() fileSelected = new EventEmitter<File>();
  @Output() rejected = new EventEmitter<string>();

  @HostBinding('class.is-dragover')
  isDragover = false;

  @HostListener('dragover', ['$event'])
  onDragover(event: DragEvent): void {
    event.preventDefault();
    this.isDragover = true;
  }

  @HostListener('dragleave', ['$event'])
  onDragleave(event: DragEvent): void {
    event.preventDefault();
    this.isDragover = false;
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragover = false;
    const dropped = event.dataTransfer?.files;
    if (dropped && dropped.length) {
      for (let i = 0; i < dropped.length; i++) {
        const f = dropped.item(i);
        if (f) this.handleFile(f);
      }
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files;
    if (picked && picked.length) {
      for (let i = 0; i < picked.length; i++) {
        const f = picked.item(i);
        if (f) this.handleFile(f);
      }
    }
    // Reset so picking the same file twice still fires.
    input.value = '';
  }

  private handleFile(file: File): void {
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
    if (!this.allowedExtensions.includes(ext)) {
      this.rejected.emit(
        `Unsupported file type. Please upload one of: ${this.allowedExtensions.join(', ')}.`,
      );
      return;
    }
    if (file.size > this.maxBytes) {
      const mb = Math.round(this.maxBytes / (1024 * 1024));
      this.rejected.emit(`File is too large. The limit is ${mb} MB.`);
      return;
    }
    if (file.size === 0) {
      this.rejected.emit('That file is empty.');
      return;
    }
    this.fileSelected.emit(file);
  }
}
