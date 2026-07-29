/**
 * Import historical exhibitor master data from an Excel sheet.
 *
 *   npx tsx scripts/import-historical.ts <file.xlsx> [--sheet "Name"] [--truncate] [--dry]
 *
 * For each row it inserts one historical_leads record (auto hist_code). The
 * per-year columns (history_2022_sqm_spo, history_2023_sqm_spo, …) are collapsed
 * into a single JSON array stored on the lead's exh_history column, e.g.
 *   [{"year":2022,"sqm_spo":"9 shell"},{"year":2023,"sqm_spo":"8"}]
 *
 * Run the DDL in prisma/manual/historical_master.sql first.
 * Uses raw SQL (prisma.$queryRawUnsafe) so it needs no Prisma client regen.
 *
 * Flags:
 *   --sheet "Name"   pick a worksheet (default: first)
 *   --limit N        import only the first N rows (cross-check before full run)
 *   --truncate       first delete PREVIOUSLY IMPORTED rows (source_lead_id IS NULL);
 *                    leads archived from Lead Management (source_lead_id set) stay.
 *   --dry            parse & print, write nothing
 */
import 'dotenv/config';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- header (normalized) -> historical_leads column ------------------------
const FIELD_BY_HEADER: Record<string, string> = {
  branchoffice: 'branch_office',
  assignedto: 'assigned_to',
  company: 'company',
  eventname: 'event_name',
  industry: 'industry',
  city: 'city',
  country: 'country',
  name: 'name',
  designation: 'designation',
  email: 'email',
  mobile: 'mobile',
  remark: 'remark',
  spacesqm: 'space_sqm',
  sqmspo: 'space_sqm',          // current-year "Sqm / Spo" column
  dateofconfirmation: 'dateofconfirmation',
  specialremarks: 'specialremarks',
};

// Order of the 16 bound params in the INSERT below.
const LEAD_COLUMNS = [
  'branch_office', 'assigned_to', 'company', 'event_name', 'industry', 'city',
  'country', 'name', 'designation', 'email', 'mobile', 'remark', 'space_sqm',
  'dateofconfirmation', 'specialremarks', 'event_year',
] as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Pull a clean string out of any ExcelJS cell value. */
function cellStr(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return dateStr(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text.trim() || null;
    if ('result' in o) return cellStr(o.result as ExcelJS.CellValue);
    if (Array.isArray(o.richText)) return (o.richText as Array<{ text: string }>).map((r) => r.text).join('').trim() || null;
  }
  return String(v).trim() || null;
}

/** Excel dates come back as UTC-based Date objects — read them as UTC. */
function dateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function toDateStr(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) return dateStr(v);
  const s = cellStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : dateStr(d);
}

/**
 * The Excel "assigned_to" column holds a user's DB id (UUID). Resolve it to a
 * real user id, validated against the users table so a bad/stale id is left NULL
 * instead of failing the insert's foreign key. If a cell contains several ids
 * (delimited), the first one that matches a real user wins.
 */
function buildUserResolver(users: Array<{ id: string }>) {
  // lowercased id -> canonical id (Postgres uuids compare case-insensitively,
  // but we return the canonical form the DB uses).
  const byId = new Map(users.map((u) => [u.id.toLowerCase(), u.id]));
  return (assignedTo: string | null): string | null => {
    if (!assignedTo) return null;
    for (const part of assignedTo.split(/[;,/&|+\s]+/)) {
      const id = part.trim().toLowerCase();
      if (id && byId.has(id)) return byId.get(id)!;
    }
    return null;
  };
}

async function main() {
  const args = process.argv.slice(2);
  const flagVal = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--sheet' && args[i - 1] !== '--limit');
  const sheetArg = flagVal('--sheet');
  const headerRowNum = flagVal('--header') ? Number(flagVal('--header')) : 1;
  const limit = flagVal('--limit') ? Number(flagVal('--limit')) : Infinity;
  const truncate = args.includes('--truncate');
  const dryRun = args.includes('--dry');

  if (!file) {
    console.error('Usage: npx tsx scripts/import-historical.ts <file.xlsx> [--header N] [--sheet "Name"] [--limit N] [--truncate] [--dry]');
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(file));
  const ws = sheetArg ? wb.getWorksheet(sheetArg) : wb.worksheets[0];
  if (!ws) { console.error(`Sheet not found: ${sheetArg ?? '(first)'}`); process.exit(1); }
  console.log(`📄 ${path.basename(file)} · sheet "${ws.name}" · ${ws.rowCount} rows`);

  // Map header columns: col index -> lead field, plus year columns -> year.
  const headerRow = ws.getRow(headerRowNum);
  const fieldByCol = new Map<number, string>();
  const yearByCol = new Map<number, number>();
  headerRow.eachCell((cell, col) => {
    const key = norm(cellStr(cell.value) ?? '');
    if (!key) return;
    const yr = /^history(\d{4})sqmspo$/.exec(key);
    if (yr) { yearByCol.set(col, Number(yr[1])); return; }
    if (FIELD_BY_HEADER[key]) fieldByCol.set(col, FIELD_BY_HEADER[key]);
  });

  const mappedFields = [...new Set(fieldByCol.values())];
  const years = [...yearByCol.values()].sort();
  console.log(`   mapped fields: ${mappedFields.join(', ')}`);
  console.log(`   year columns : ${years.join(', ') || '(none)'}`);
  if (fieldByCol.size === 0) {
    console.error('❌ No recognizable columns. Check the header row matches the documented names.');
    process.exit(1);
  }

  // Load users so the assigned_to id can be validated against real users.
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  const matchUser = buildUserResolver(users);
  console.log(`   users loaded : ${users.length} (for assigned_to id lookup)`);
  const unmatched = new Map<string, number>(); // assigned_to id -> count

  if (truncate && !dryRun) {
    const del = await prisma.$executeRawUnsafe('DELETE FROM historical_leads WHERE source_lead_id IS NULL');
    console.log(`🧹 --truncate: removed ${del} previously imported row(s) (+ their exh_history)`);
  }

  const leadSql =
    `INSERT INTO historical_leads
       (id, archived_at, status, ${LEAD_COLUMNS.join(', ')}, exh_history, assigned_user_id)
     VALUES
       (gen_random_uuid(), now(), 'CONVERTED',
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::date,$15,$16, $17::jsonb, $18::uuid)
     RETURNING hist_code`;

  let imported = 0;
  let skipped = 0;
  let yearEntries = 0;

  for (let r = headerRowNum + 1; r <= ws.rowCount; r++) {
    if (imported >= limit) break;
    const row = ws.getRow(r);

    // Collect mapped lead values by column name.
    const byField: Record<string, string | null> = {};
    for (const [col, field] of fieldByCol) {
      byField[field] = field === 'dateofconfirmation'
        ? toDateStr(row.getCell(col).value)
        : cellStr(row.getCell(col).value);
    }

    // Collect this row's per-year history into a sorted array (skip blank years).
    const history: Array<{ year: number; sqm_spo: string }> = [];
    for (const [col, year] of yearByCol) {
      const val = cellStr(row.getCell(col).value);
      if (val) history.push({ year, sqm_spo: val });
    }
    history.sort((a, b) => a.year - b.year);

    // Skip empty rows (nothing identifying and no history).
    const identifying = byField.company || byField.name || byField.email || byField.mobile;
    if (!identifying && history.length === 0) { skipped++; continue; }

    // event_year: infer from date of confirmation year, else the latest history year.
    const confYear = byField.dateofconfirmation ? Number(byField.dateofconfirmation.slice(0, 4)) : null;
    const eventYear = confYear ?? (history.length ? Math.max(...history.map((h) => h.year)) : null);

    // Resolve assigned_to text -> user id (null if no confident match).
    const assignedUserId = matchUser(byField.assigned_to ?? null);
    if (byField.assigned_to && !assignedUserId) {
      unmatched.set(byField.assigned_to, (unmatched.get(byField.assigned_to) ?? 0) + 1);
    }

    const params: Array<string | number | null> = LEAD_COLUMNS.map((c) => (c === 'event_year' ? eventYear : byField[c] ?? null));
    params.push(JSON.stringify(history));
    params.push(assignedUserId);

    if (dryRun) {
      console.log(`row ${r}: ${identifying ?? '(no id)'} · assigned_to="${byField.assigned_to ?? ''}"→${assignedUserId ? 'matched' : 'NO MATCH'} · exh_history=${JSON.stringify(history)}`);
      imported++;
      yearEntries += history.length;
      continue;
    }

    const [{ hist_code: histCode }] = await prisma.$queryRawUnsafe<Array<{ hist_code: string }>>(leadSql, ...params);
    imported++;
    yearEntries += history.length;
    if (imported % 200 === 0) console.log(`   … ${imported} imported`);
  }

  console.log(
    `\n✅ Done${dryRun ? ' (dry run — nothing written)' : ''}: ` +
      `${imported} lead(s), ${yearEntries} year-entries, ${skipped} empty row(s) skipped.`,
  );

  if (unmatched.size) {
    const total = [...unmatched.values()].reduce((a, b) => a + b, 0);
    console.log(`\n⚠️  ${total} row(s) had an assigned_to that matched no user (assigned_user_id left NULL):`);
    [...unmatched.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, n]) => console.log(`   "${name}" × ${n}`));
    console.log('   Fix the spelling in Excel, or add/rename the user, then re-run with --truncate.');
  }
}

main()
  .catch((e) => { console.error('❌ Import failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
