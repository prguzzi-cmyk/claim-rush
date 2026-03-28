import { Injectable } from '@angular/core';
@Injectable({
  providedIn: 'root'
})
export class UsStatesService {

  protected statesList: any[] =
    [{"name":"Alabama","abbreviation":"AL"},{"name":"Alaska","abbreviation":"AK"},{"name":"Arizona","abbreviation":"AZ"},{"name":"Arkansas","abbreviation":"AR"},{"name":"California","abbreviation":"CA"},{"name":"Colorado","abbreviation":"CO"},{"name":"Connecticut","abbreviation":"CT"},{"name":"Delaware","abbreviation":"DE"},{"name":"Florida","abbreviation":"FL"},{"name":"Georgia","abbreviation":"GA"},{"name":"Hawaii","abbreviation":"HI"},{"name":"Idaho","abbreviation":"ID"},{"name":"Illinois","abbreviation":"IL"},{"name":"Indiana","abbreviation":"IN"},{"name":"Iowa","abbreviation":"IA"},{"name":"Kansas","abbreviation":"KS"},{"name":"Kentucky","abbreviation":"KY"},{"name":"Louisiana","abbreviation":"LA"},{"name":"Maine","abbreviation":"ME"},{"name":"Maryland","abbreviation":"MD"},{"name":"Massachusetts","abbreviation":"MA"},{"name":"Michigan","abbreviation":"MI"},{"name":"Minnesota","abbreviation":"MN"},{"name":"Mississippi","abbreviation":"MS"},{"name":"Missouri","abbreviation":"MO"},{"name":"Montana","abbreviation":"MT"},{"name":"Nebraska","abbreviation":"NE"},{"name":"Nevada","abbreviation":"NV"},{"name":"New Hampshire","abbreviation":"NH"},{"name":"New Jersey","abbreviation":"NJ"},{"name":"New Mexico","abbreviation":"NM"},{"name":"New York","abbreviation":"NY"},{"name":"North Carolina","abbreviation":"NC"},{"name":"North Dakota","abbreviation":"ND"},{"name":"Ohio","abbreviation":"OH"},{"name":"Oklahoma","abbreviation":"OK"},{"name":"Oregon","abbreviation":"OR"},{"name":"Pennsylvania","abbreviation":"PA"},{"name":"Rhode Island","abbreviation":"RI"},{"name":"South Carolina","abbreviation":"SC"},{"name":"South Dakota","abbreviation":"SD"},{"name":"Tennessee","abbreviation":"TN"},{"name":"Texas","abbreviation":"TX"},{"name":"Utah","abbreviation":"UT"},{"name":"Vermont","abbreviation":"VT"},{"name":"Virginia","abbreviation":"VA"},{"name":"Washington","abbreviation":"WA"},{"name":"West Virginia","abbreviation":"WV"},{"name":"Wisconsin","abbreviation":"WI"},{"name":"Wyoming","abbreviation":"WY"}]
  ;

  private fipsMap: Record<string, { name: string; abbreviation: string }> = {
    '01': { name: 'Alabama', abbreviation: 'AL' },
    '02': { name: 'Alaska', abbreviation: 'AK' },
    '04': { name: 'Arizona', abbreviation: 'AZ' },
    '05': { name: 'Arkansas', abbreviation: 'AR' },
    '06': { name: 'California', abbreviation: 'CA' },
    '08': { name: 'Colorado', abbreviation: 'CO' },
    '09': { name: 'Connecticut', abbreviation: 'CT' },
    '10': { name: 'Delaware', abbreviation: 'DE' },
    '12': { name: 'Florida', abbreviation: 'FL' },
    '13': { name: 'Georgia', abbreviation: 'GA' },
    '15': { name: 'Hawaii', abbreviation: 'HI' },
    '16': { name: 'Idaho', abbreviation: 'ID' },
    '17': { name: 'Illinois', abbreviation: 'IL' },
    '18': { name: 'Indiana', abbreviation: 'IN' },
    '19': { name: 'Iowa', abbreviation: 'IA' },
    '20': { name: 'Kansas', abbreviation: 'KS' },
    '21': { name: 'Kentucky', abbreviation: 'KY' },
    '22': { name: 'Louisiana', abbreviation: 'LA' },
    '23': { name: 'Maine', abbreviation: 'ME' },
    '24': { name: 'Maryland', abbreviation: 'MD' },
    '25': { name: 'Massachusetts', abbreviation: 'MA' },
    '26': { name: 'Michigan', abbreviation: 'MI' },
    '27': { name: 'Minnesota', abbreviation: 'MN' },
    '28': { name: 'Mississippi', abbreviation: 'MS' },
    '29': { name: 'Missouri', abbreviation: 'MO' },
    '30': { name: 'Montana', abbreviation: 'MT' },
    '31': { name: 'Nebraska', abbreviation: 'NE' },
    '32': { name: 'Nevada', abbreviation: 'NV' },
    '33': { name: 'New Hampshire', abbreviation: 'NH' },
    '34': { name: 'New Jersey', abbreviation: 'NJ' },
    '35': { name: 'New Mexico', abbreviation: 'NM' },
    '36': { name: 'New York', abbreviation: 'NY' },
    '37': { name: 'North Carolina', abbreviation: 'NC' },
    '38': { name: 'North Dakota', abbreviation: 'ND' },
    '39': { name: 'Ohio', abbreviation: 'OH' },
    '40': { name: 'Oklahoma', abbreviation: 'OK' },
    '41': { name: 'Oregon', abbreviation: 'OR' },
    '42': { name: 'Pennsylvania', abbreviation: 'PA' },
    '44': { name: 'Rhode Island', abbreviation: 'RI' },
    '45': { name: 'South Carolina', abbreviation: 'SC' },
    '46': { name: 'South Dakota', abbreviation: 'SD' },
    '47': { name: 'Tennessee', abbreviation: 'TN' },
    '48': { name: 'Texas', abbreviation: 'TX' },
    '49': { name: 'Utah', abbreviation: 'UT' },
    '50': { name: 'Vermont', abbreviation: 'VT' },
    '51': { name: 'Virginia', abbreviation: 'VA' },
    '53': { name: 'Washington', abbreviation: 'WA' },
    '54': { name: 'West Virginia', abbreviation: 'WV' },
    '55': { name: 'Wisconsin', abbreviation: 'WI' },
    '56': { name: 'Wyoming', abbreviation: 'WY' },
    '11': { name: 'District of Columbia', abbreviation: 'DC' },
    '72': { name: 'Puerto Rico', abbreviation: 'PR' },
  };

  private abbrevToFips: Record<string, string> = {};

  constructor() {
    for (const [fips, info] of Object.entries(this.fipsMap)) {
      this.abbrevToFips[info.abbreviation] = fips;
    }
  }

  getStatesList(): any | undefined {
    return this.statesList;
  }

  getFipsForState(abbreviation: string): string | undefined {
    return this.abbrevToFips[abbreviation.toUpperCase()];
  }

  getStateByFips(fips: string): { name: string; abbreviation: string } | undefined {
    return this.fipsMap[fips];
  }

  getStateNameByAbbrev(abbreviation: string): string | undefined {
    const fips = this.abbrevToFips[abbreviation.toUpperCase()];
    return fips ? this.fipsMap[fips]?.name : undefined;
  }
}


