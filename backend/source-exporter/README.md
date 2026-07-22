# Exhi-Reg Exporter (ASP.NET / IIS)

The source SQL Server refuses outside connections, so instead of the CRM
connecting to the DB directly, this tiny endpoint runs **on the source server**
(local DB access) and the CRM's sync job pulls new leads from it over HTTPS.

```
CRM sync  ──HTTPS+X-API-Key──▶  ExhiRegExport.ashx  ──local──▶  dbo.exhi_reg
```

## Files
- `ExhiRegExport.ashx` — the endpoint (drop-in, no build step).
- `Web.config.snippet.xml` — config entries to merge into the site's `Web.config`.

## Deploy (on the IIS server)
1. Copy `ExhiRegExport.ashx` into an existing IIS site (or a new one), e.g.
   `C:\inetpub\wwwroot\exhi-export\ExhiRegExport.ashx`.
2. Merge the entries from `Web.config.snippet.xml` into that site's `Web.config`:
   - `SourceDb` connection string → point at `localhost` (the DB is on this box).
   - `ExhiExportApiKey` → a long random secret you generate.
3. Ensure the site runs on **.NET Framework 4.x** (Integrated pipeline). No NuGet
   packages needed — it uses only `System.Data.SqlClient` and
   `System.Web.Script.Serialization` from the framework.
4. Prefer HTTPS. If exposed to the internet, also restrict inbound to the CRM
   server's IP at the firewall/IIS level.

## Test
```
curl -H "X-API-Key: <secret>" "https://<server>/exhi-export/ExhiRegExport.ashx?sinceId=118709&limit=50"
```
Expect a JSON array of rows with `id > 118709`. `401` = bad/missing key.

## Contract
`GET ...ExhiRegExport.ashx?sinceId=<lastId>&limit=<batch>` with header `X-API-Key`.
Returns rows where `id > sinceId`, ordered by `id ASC`, capped at `limit`
(default 500, max 2000). Columns match `dbo.exhi_reg` snake_case names, dates as
ISO-8601. This mirrors the old direct query in `src/services/sourceDb.service.ts`.

## CRM side
Set in the CRM backend `.env`:
```
SOURCE_MODE=api
SOURCE_API_URL=https://<server>/exhi-export/ExhiRegExport.ashx
SOURCE_API_KEY=<same secret as ExhiExportApiKey>
```
Restart the worker. The existing 5-min sync cron and `POST /api/v1/sync/run`
then pull through this API instead of connecting to SQL Server directly.
