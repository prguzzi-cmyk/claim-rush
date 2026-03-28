import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

@Injectable({
  providedIn: 'root'
})
export class DownloaderService {
  wopts: XLSX.WritingOptions = { bookType: 'xlsx', type: 'array' };

  constructor() { }

  downloadXLSXFromArray(filename: string, data: any)
  {
    /* generate worksheet */
		const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(data);

		/* generate workbook and add the worksheet */
		const wb: XLSX.WorkBook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

		/* save to file */
		XLSX.writeFile(wb, filename);
  }

  downloadXLSXToMultipleSheets(filename: string, datasets: Object, headers?: Object)
  {
    // Generate the workbook
    let wb: XLSX.WorkBook = XLSX.utils.book_new();

    // Loop through the datasets
    for (const key in datasets) {
        let dataset = datasets[key];

        let ws: XLSX.WorkSheet;

        if(Array.isArray(dataset)) {
          if(headers && headers.hasOwnProperty(key)) {
            dataset = [headers[key]].concat(dataset);
          }
          ws = XLSX.utils.aoa_to_sheet(dataset);
        }
        else {
          ws = XLSX.utils.json_to_sheet([dataset]);
        }

        // Add worksheet to the workbook
        XLSX.utils.book_append_sheet(wb, ws, key);
    }

		// Save the workbook to file
		XLSX.writeFile(wb, filename);
  }

  downloadCSV(filename: string, data: any) {
    const replacer = (key, value) => value === null ? '' : value;
    const header = Object.keys(data[0]);
    let csv = data.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','));
    csv.unshift(header.join(','));
    let csvArray = csv.join('\r\n');

    var blob = new Blob([csvArray], {type: 'text/csv' })
    saveAs(blob, filename);
  }

  downloadCSVFromArray(filename: string, data: any) {
    let csvArray = data.map(function(d){
      return d.join();
    }).join('\n');

    var blob = new Blob([csvArray], {type: 'text/csv' })
    saveAs(blob, filename);
  }

  downloadPreparedCSV(filename: string, data: any) {
    var blob = new Blob([data], {type: 'text/csv' })
    saveAs(blob, filename);
  }

  downloadUsageCSV(filename: string, data: any) {
    var blob = new Blob([data], {type: 'text/csv' })
    saveAs(blob, filename);
  }

  downloadBase64File(filename: string, base64string: string) {
    let arr = base64string.split(',');
    let mime = arr[0].match(/:(.*?);/)[1];
    let bstr = atob(arr[1]);
    let n = bstr.length;
    let uint8Array = new Uint8Array(n);
    while (n--) {
       uint8Array[n] = bstr.charCodeAt(n);
    }
    let file = new File([uint8Array], filename, { type: mime });
    saveAs(file, filename);
  }

  downloadCSVForMultiDimensionArray(column, filename: string, data: any, headers: any) {
    let csvArray = '';

    for (let i = 0; i < data.length; i++) {

      let line = '';

      line += data[i]['name'];

      for (var j in headers) {
        if(line != '') line += ','

        for (var index in data[i]['series']) {
          if (headers[j] === data[i]['series'][index]['name']) {
            line +=   data[i]['series'][index]['value'];
            break;
          }
        }
      }
      csvArray += line + '\r\n';
    }

    headers.unshift(column);
    csvArray = headers.join(',')  +  '\r\n' + csvArray ;

    var blob = new Blob([csvArray], {type: 'text/csv' })
    saveAs(blob, filename);
  }


  downloadCSVForMultiDimensionMatrix(column, filename: string, data: any, headers: any) {
    let csvArray = '';

    for (let i = 0; i < data.length; i++) {

      let line = '';

      line += data[i]['name'];

      for (var j in headers) {
        if (line != '') line += ','

        for (var index in data[i]['series']) {
          if (headers[j] === data[i]['series'][index]['name']) {
            line +=   data[i]['series'][index]['value'];
            break;
          }
        }
      }
      csvArray += line + '\r\n';
    }

    headers.unshift(column);
    csvArray = headers.join(',')  +  '\r\n' + csvArray ;

    var blob = new Blob([csvArray], {type: 'text/csv' })
    saveAs(blob, filename);
  }

  downloadPreparedZip(filename: string, data: any) {

    var blob = new Blob([data], {type: 'application/zip' });

    saveAs(blob, filename);
  }

  downloadPreparedExcel(filename: string, data: any) {

    var blob = new Blob([data], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    saveAs(blob, filename);
  }

}
