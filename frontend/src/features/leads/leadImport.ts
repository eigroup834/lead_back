import * as XLSX from 'xlsx';

export interface ImportColumn {
  key: string;
  header: string;
  aliases?: string[];
  hint?: string;
}

export const IMPORT_COLUMNS: ImportColumn[] = [
  { key: 'company', header: 'Company', hint: 'Company name' },
  { key: 'title', header: 'Title', aliases: ['salutation'], hint: 'Mr / Ms / Dr' },
  { key: 'firstName', header: 'First Name' },
  { key: 'lastName', header: 'Last Name' },
  { key: 'designation', header: 'Designation', aliases: ['job title'] },
  { key: 'email', header: 'Email' },
  { key: 'mobile', header: 'Mobile' },
  { key: 'phone', header: 'Phone', aliases: ['telephone', 'landline'] },
  { key: 'website', header: 'Website' },
  { key: 'address', header: 'Address' },
  { key: 'city', header: 'City' },
  { key: 'state', header: 'State' },
  { key: 'zipCode', header: 'Zip Code', aliases: ['zip', 'postcode', 'postal code', 'pin code'] },
  { key: 'country', header: 'Country' },
  { key: 'shellSpace', header: 'Shell Space' },
  { key: 'rawSpace', header: 'Raw Space' },
  { key: 'learnAbout', header: 'How They Heard About Us', aliases: ['learn about', 'source of enquiry'] },
  { key: 'eventName', header: 'Event Name', aliases: ['event'] },
  { key: 'remarks', header: 'Remarks', aliases: ['notes', 'comment', 'comments'] },
  { key: 'priority', header: 'Priority', hint: 'LOW / MEDIUM / HIGH / CRITICAL' },
];

export const REQUIRED_ONE_OF = ['company', 'email', 'firstName', 'mobile'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export interface ParsedRow {
  row: number;
  values: Record<string, string>;
  error?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  unknownHeaders: string[];
  noKnownColumns: boolean;
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

const HEADER_LOOKUP = new Map<string, string>();
for (const c of IMPORT_COLUMNS) {
  HEADER_LOOKUP.set(normalise(c.header), c.key);
  HEADER_LOOKUP.set(normalise(c.key), c.key);
  for (const a of c.aliases ?? []) HEADER_LOOKUP.set(normalise(a), c.key);
}

export function buildTemplateWorkbook(): XLSX.WorkBook {
  const headers = IMPORT_COLUMNS.map((c) => c.header);
  const examples = [
    {
      Company: 'Acme Exhibits Pvt Ltd', Title: 'Mr', 'First Name': 'Ravi', 'Last Name': 'Sharma',
      Designation: 'Marketing Head', Email: 'ravi.sharma@acme-example.com', Mobile: '+91 98200 11223',
      Phone: '022 4000 1122', Website: 'www.acme-example.com', Address: '12 Industrial Estate',
      City: 'Mumbai', State: 'Maharashtra', 'Zip Code': '400001', Country: 'India',
      'Shell Space': '18 sqm', 'Raw Space': '', 'How They Heard About Us': 'Website',
      'Event Name': 'India Expo 2026', Remarks: 'Asked for the floor plan', Priority: 'HIGH',
    },
    {
      Company: 'Bharat Displays', Title: 'Ms', 'First Name': 'Anita', 'Last Name': 'Desai',
      Designation: 'Director', Email: 'anita@bharat-example.com', Mobile: '+91 99100 44556',
      Phone: '', Website: '', Address: '', City: 'Delhi', State: 'Delhi', 'Zip Code': '110001',
      Country: 'India', 'Shell Space': '', 'Raw Space': '36 sqm',
      'How They Heard About Us': 'Referral', 'Event Name': 'India Expo 2026', Remarks: '', Priority: 'MEDIUM',
    },
  ];

  const sheet = XLSX.utils.json_to_sheet(examples, { header: headers });
  sheet['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 4) }));

  const notes = [
    ['How to use this template'],
    [''],
    ['1. Keep the header row exactly as it is. Column order does not matter.'],
    ['2. Replace the two example rows with your own leads, one lead per row.'],
    ['3. Every row needs at least one of: Company, First Name, Email or Mobile.'],
    ['4. Leave any column blank if you do not have the value.'],
    ['5. Priority accepts ' + PRIORITIES.join(', ') + '. Blank means MEDIUM.'],
    ['6. Imported leads are created as Exhibitor leads with status New.'],
    ['7. Rows whose email or mobile already exists are skipped and reported.'],
    [''],
    ['Columns'],
    ...IMPORT_COLUMNS.map((c) => [c.header, c.hint ?? '']),
  ];
  const notesSheet = XLSX.utils.aoa_to_sheet(notes);
  notesSheet['!cols'] = [{ wch: 30 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Leads');
  XLSX.utils.book_append_sheet(wb, notesSheet, 'Instructions');
  return wb;
}

export function downloadTemplate() {
  XLSX.writeFile(buildTemplateWorkbook(), 'lead-import-template.xlsx');
}

const cellToString = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

export function parseWorkbook(data: ArrayBuffer): ParseResult {
  const wb = XLSX.read(data, { cellDates: true });
  const sheetName = wb.SheetNames.find((n) => normalise(n) === 'leads') ?? wb.SheetNames[0];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return { rows: [], unknownHeaders: [], noKnownColumns: true };

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
  if (!grid.length) return { rows: [], unknownHeaders: [], noKnownColumns: true };

  const headerRow = grid[0].map(cellToString);
  const mapped = headerRow.map((h) => HEADER_LOOKUP.get(normalise(h)));
  const unknownHeaders = headerRow.filter((h, i) => h && !mapped[i]);
  if (!mapped.some(Boolean)) return { rows: [], unknownHeaders, noKnownColumns: true };

  const rows: ParsedRow[] = [];
  for (let i = 1; i < grid.length; i += 1) {
    const values: Record<string, string> = {};
    grid[i].forEach((cell, col) => {
      const key = mapped[col];
      if (!key) return;
      const v = cellToString(cell);
      if (v) values[key] = v;
    });
    if (!Object.keys(values).length) continue;

    if (values.priority) {
      const p = values.priority.toUpperCase();
      if (!PRIORITIES.includes(p)) {
        rows.push({ row: i + 1, values, error: `Priority must be one of ${PRIORITIES.join(', ')}` });
        continue;
      }
      values.priority = p;
    }

    const rowNo = i + 1;
    if (!REQUIRED_ONE_OF.some((k) => values[k])) {
      rows.push({ row: rowNo, values, error: 'Needs at least a company, first name, email or mobile' });
      continue;
    }
    if (values.email && !EMAIL_RE.test(values.email)) {
      rows.push({ row: rowNo, values, error: `"${values.email}" is not a valid email` });
      continue;
    }
    rows.push({ row: rowNo, values });
  }

  return { rows, unknownHeaders, noKnownColumns: false };
}
