import { useRef, useState } from 'react';
import {
  Alert, AlertTitle, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useBulkImportLeadsMutation } from '@/features/leads/leadsApi';
import {
  IMPORT_COLUMNS, downloadTemplate, parseWorkbook, type ParseResult,
} from '@/features/leads/leadImport';

const PREVIEW_LIMIT = 8;
// Columns worth showing in the preview — the full set is too wide to scan.
const PREVIEW_KEYS = ['company', 'firstName', 'lastName', 'email', 'mobile', 'city', 'country'];

interface ImportResult {
  created: number;
  failed: number;
  total: number;
  errors: Array<{ row: number; message: string }>;
}

export default function LeadExcelImport({ assignToId, onImported }: {
  assignToId?: string;
  onImported?: (created: number) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [bulkImport, { isLoading }] = useBulkImportLeadsMutation();

  const valid = parsed?.rows.filter((r) => !r.error) ?? [];
  const invalid = parsed?.rows.filter((r) => r.error) ?? [];

  const reset = () => {
    setParsed(null); setFileName(''); setParseError(''); setResult(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const onFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const parsedFile = parseWorkbook(await file.arrayBuffer());
      if (parsedFile.noKnownColumns) {
        setParseError('No recognisable columns in this file. Download the sample below and use its header row.');
        return;
      }
      if (!parsedFile.rows.length) {
        setParseError('That file has headers but no data rows.');
        return;
      }
      setParsed(parsedFile);
    } catch {
      setParseError('Could not read that file. Make sure it is a .xlsx, .xls or .csv file.');
    }
  };

  const doImport = async () => {
    if (!valid.length) return;
    const res = await bulkImport({
      rows: valid.map((r) => ({ row: r.row, ...r.values })),
      assignToId: assignToId || undefined,
    }).unwrap();
    setResult(res.data);
    if (res.data.created > 0) onImported?.(res.data.created);
  };

  return (
    <Stack spacing={2.5}>
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>1. Start from the sample file</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The sample has the exact header row the importer expects, two example leads to replace,
            and an Instructions sheet. Column order doesn't matter and blank columns are fine.
          </Typography>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
            Download sample Excel
          </Button>
          <Stack direction="row" spacing={0.75} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.75 }}>
            {IMPORT_COLUMNS.map((c) => <Chip key={c.key} size="small" variant="outlined" label={c.header} />)}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>2. Upload your filled-in file</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Accepts .xlsx, .xls and .csv. Nothing is saved until you press Import below.
          </Typography>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
          />
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileInput.current?.click()}>
              Choose file
            </Button>
            {fileName && <Typography variant="body2">{fileName}</Typography>}
            {(parsed || parseError || result) && (
              <Button size="small" color="inherit" onClick={reset}>Clear</Button>
            )}
          </Stack>

          {parseError && <Alert severity="error" sx={{ mt: 2 }}>{parseError}</Alert>}

          {parsed && !!parsed.unknownHeaders.length && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Ignored {parsed.unknownHeaders.length} unrecognised column(s): {parsed.unknownHeaders.join(', ')}.
              Everything else will still import.
            </Alert>
          )}
        </CardContent>
      </Card>

      {parsed && !result && (
        <Card>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>3. Review</Typography>
              <Chip size="small" color="success" label={`${valid.length} ready`} />
              {invalid.length > 0 && <Chip size="small" color="error" label={`${invalid.length} with problems`} />}
            </Stack>

            {invalid.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <AlertTitle>These rows will be skipped</AlertTitle>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {invalid.slice(0, 10).map((r) => (
                    <li key={r.row}><Typography variant="body2">Row {r.row}: {r.error}</Typography></li>
                  ))}
                </Box>
                {invalid.length > 10 && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>…and {invalid.length - 10} more.</Typography>
                )}
              </Alert>
            )}

            {valid.length > 0 && (
              <>
                <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Row</TableCell>
                        {PREVIEW_KEYS.map((k) => (
                          <TableCell key={k} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {IMPORT_COLUMNS.find((c) => c.key === k)?.header ?? k}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {valid.slice(0, PREVIEW_LIMIT).map((r) => (
                        <TableRow key={r.row} hover>
                          <TableCell>{r.row}</TableCell>
                          {PREVIEW_KEYS.map((k) => (
                            <TableCell key={k}><Typography variant="caption">{r.values[k] || '—'}</Typography></TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {valid.length > PREVIEW_LIMIT && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Showing the first {PREVIEW_LIMIT} of {valid.length} rows.
                  </Typography>
                )}

                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Leads import as Exhibitor leads with status New
                  {assignToId ? ', assigned to the member selected above' : ' and unassigned'}.
                  Rows whose email or mobile already exists in Lead Management are skipped.
                </Typography>
                <Button
                  variant="contained" size="large" startIcon={isLoading ? <CircularProgress size={18} /> : <CloudUploadIcon />}
                  disabled={isLoading} onClick={doImport}
                >
                  {isLoading ? 'Importing…' : `Import ${valid.length} lead(s)`}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent>
            <Alert severity={result.created > 0 ? 'success' : 'warning'} sx={{ mb: result.errors.length ? 2 : 0 }}>
              <AlertTitle>
                Imported {result.created} of {result.total} row(s)
              </AlertTitle>
              {result.failed > 0 && `${result.failed} row(s) were skipped — see below.`}
            </Alert>
            {!!result.errors.length && (
              <TableContainer sx={{ maxHeight: 320 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, width: 80 }}>Row</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.errors.map((e, i) => (
                      <TableRow key={`${e.row}-${i}`}>
                        <TableCell>{e.row}</TableCell>
                        <TableCell><Typography variant="caption">{e.message}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
