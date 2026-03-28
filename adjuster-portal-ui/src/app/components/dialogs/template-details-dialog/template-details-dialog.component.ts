import { Component, Inject, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { Template } from 'src/app/models/template.model';
import { TemplateService } from 'src/app/services/template.service';
import { UsStatesService } from 'src/app/services/us-states.service';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import PizZipUtils from 'pizzip/utils/index.js';
import { saveAs } from 'file-saver';

function loadFile(url, callback) {
  PizZipUtils.getBinaryContent(url, callback);
}

@Component({
    selector: 'app-template-details-dialog',
    templateUrl: './template-details-dialog.component.html',
    styleUrls: ['./template-details-dialog.component.scss'],
    standalone: false
})
export class TemplateDetailsDialogComponent implements OnInit {

  action: string = "add";
  template: Template;
  template_id: string = '';
  fileUploadFormDisabled: boolean = false;

  stateService: any = inject(UsStatesService);
  states: any[] = [];

  t: Template[] = [
    {id: "1", name: 'Proof of loss (NY, Simple)', description: 'This is a test template for NY state.', state: 'NY', size: 2014, type: "application/pdf", path: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"},
    {id: "2", name: 'UPA demand for appraisal', description: 'FL document template.', state: 'FL', size: 1889002, type: "application/pdf", path: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"},
    {id: "3", name: 'WA template', description: 'This is a test.', state: 'WA', path: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"},
    {id: "4", name: 'PA template', description: 'PA template.', state: 'PA', path: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"},
    {id: "5", name: 'NJ template', description: 'Some template', state: 'NJ', path: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"},
  ];

  displayedColumns: string[] = [
    "name",
  ];

  // Pagination
  dataSource = new MatTableDataSource<Template>();
  @ViewChild(MatPaginator, { static: false }) paginator: MatPaginator;

  templateForm = new FormGroup({
    fileName: new FormControl('', [
      Validators.required
    ]),
    description: new FormControl(''),
    state: new FormControl(''),
  });

  filename: string | undefined;
  file: File | undefined;
  fileType: string | undefined;

  templates: Template[];

  canBeRemoved: boolean = true;
  title: string = 'Add new template';

  constructor(
    private templateService: TemplateService,
    private dialogRef: MatDialogRef<TemplateDetailsDialogComponent>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: any
    ) { 

      if (data) {
        
        this.states = this.stateService.getStatesList();
        this.action = data.type;

        if (this.action == 'select') {
          this.title = "Claim letters and forms"
          this.getTemplates();

        } 
        else if (this.action == 'view' || this.action == 'delete' || this.action == 'edit') {
          this.template = data?.template;

          if(this.action == 'view') {
            this.title = this.template?.name;
          }

          if(this.action == 'delete') {
            this.title = 'Delete template - ' + this.template?.name;
          }
          
  
          if(this.action == 'edit') {
            this.title = 'Edit template - ' + this.template?.name;
            this.templateForm.controls['fileName'].setValue(this.template?.name);
            this.templateForm.controls['description'].setValue(this.template?.description);
            this.templateForm.controls['state'].setValue(this.template?.state);
            this.canBeRemoved = this.template?.can_be_removed;
          }
        } else if (this.action == 'add') {
  
          if (data) {
            this.template_id = data?.template?.id;
          }
  
        }
  
      }

    }

  ngOnInit(): void {

  }

  getTemplates() {
    return this.templateService.getTemplates().subscribe(
      templates => {
        this.templates = this.t;
        this.dataSource = new MatTableDataSource(this.t);
      }
    );
  }

  generate() {
    loadFile(
      'https://docxtemplater.com/tag-example.docx',
      function (error: Error | null, content: string) {
        if (error) {
          throw error;
        }
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
        });
        doc.setData({
          first_name: 'John',
          last_name: 'Doe',
          phone: '0652455478',
          description: 'New Website',
        });
        try {
          // render the document (replace all occurences of {first_name} by John, {last_name} by Doe, ...)
          doc.render();
        } catch (error) {
          // The error thrown here contains additional information when logged with JSON.stringify (it contains a properties object containing all suberrors).
          function replaceErrors(key, value) {
            if (value instanceof Error) {
              return Object.getOwnPropertyNames(value).reduce(function (
                error,
                key
              ) {
                error[key] = value[key];
                return error;
              },
              {});
            }
            return value;
          }
          console.log(JSON.stringify({ error: error }, replaceErrors));

          if (error.properties && error.properties.errors instanceof Array) {
            const errorMessages = error.properties.errors
              .map(function (error) {
                return error.properties.explanation;
              })
              .join('\n');
            console.log('errorMessages', errorMessages);
            // errorMessages is a humanly readable message looking like this :
            // 'The tag beginning with "foobar" is unopened'
          }
          throw error;
        }
        const out = doc.getZip().generate({
          type: 'blob',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        // Output the document using Data-URI
        saveAs(out, 'output.docx');
        this.dialogRef.close();

      }
    );
  }

  downloadTemplate() {
    this.generate();
  }

  saveTemplate() {

  }

  updateTemplate() {

  }
}
