<%@ WebHandler Language="C#" Class="ExhiRegExport" %>

// ---------------------------------------------------------------------------
// ExhiRegExport.ashx
//
// Drop-in ASP.NET (.NET Framework 4.x) generic handler that runs ON the source
// server (same box as the SQL Server), where DB access is local. The CRM sync
// job calls this over HTTPS instead of connecting to SQL Server directly,
// because the DB refuses outside connections.
//
//   GET /ExhiRegExport.ashx?sinceId=<lastId>&limit=<batchSize>
//   Header: X-API-Key: <shared secret>
//
// Returns a JSON array of exhi_reg rows with id > sinceId, ordered by id ASC,
// capped at `limit`. Column names match what the CRM expects (snake_case).
//
// Config (Web.config): see Web.config.snippet.xml in this folder.
// ---------------------------------------------------------------------------

using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Configuration;
using System.Web;
using System.Web.Script.Serialization;

public class ExhiRegExport : IHttpHandler
{
    public bool IsReusable { get { return false; } }

    public void ProcessRequest(HttpContext context)
    {
        HttpResponse res = context.Response;
        res.ContentType = "application/json";
        res.Headers["Cache-Control"] = "no-store";

        // --- Auth: constant-time compare of the shared API key ---
        string expectedKey = ConfigurationManager.AppSettings["ExhiExportApiKey"];
        string providedKey = context.Request.Headers["X-API-Key"];
        if (string.IsNullOrEmpty(expectedKey) || !FixedTimeEquals(expectedKey, providedKey))
        {
            res.StatusCode = 401;
            res.Write("{\"error\":\"unauthorized\"}");
            return;
        }

        // --- Params ---
        long sinceId = 0;
        long.TryParse(context.Request.QueryString["sinceId"], out sinceId);

        int limit = 500;
        int.TryParse(context.Request.QueryString["limit"], out limit);
        if (limit <= 0) limit = 500;
        if (limit > 2000) limit = 2000; // hard cap

        string connStr = ConfigurationManager.ConnectionStrings["SourceDb"] != null
            ? ConfigurationManager.ConnectionStrings["SourceDb"].ConnectionString
            : ConfigurationManager.AppSettings["SourceDbConnection"];

        if (string.IsNullOrEmpty(connStr))
        {
            res.StatusCode = 500;
            res.Write("{\"error\":\"missing_connection_string\"}");
            return;
        }

        var rows = new List<Dictionary<string, object>>();
        try
        {
            using (var conn = new SqlConnection(connStr))
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText =
                    "SELECT TOP (@limit) " +
                    "  id, title, company, fname, lname, designation, shell_space, raw_space, " +
                    "  address, city, state, zip_code, country, phone, email, mobile, website, " +
                    "  learn_about, remarks, ip_address, create_date, event_name, status " +
                    "FROM dbo.exhi_reg " +
                    "WHERE id > @sinceId " +
                    "ORDER BY id ASC";
                cmd.Parameters.Add(new SqlParameter("@limit", SqlDbType.Int) { Value = limit });
                cmd.Parameters.Add(new SqlParameter("@sinceId", SqlDbType.BigInt) { Value = sinceId });

                conn.Open();
                using (SqlDataReader r = cmd.ExecuteReader())
                {
                    int fieldCount = r.FieldCount;
                    while (r.Read())
                    {
                        var row = new Dictionary<string, object>(fieldCount);
                        for (int i = 0; i < fieldCount; i++)
                        {
                            string name = r.GetName(i);
                            object val = r.IsDBNull(i) ? null : r.GetValue(i);
                            // Emit dates as ISO-8601 so the CRM parses them consistently.
                            if (val is DateTime)
                                val = ((DateTime)val).ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
                            row[name] = val;
                        }
                        rows.Add(row);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            res.StatusCode = 500;
            var errSer = new JavaScriptSerializer();
            res.Write(errSer.Serialize(new Dictionary<string, object> {
                { "error", "query_failed" },
                { "detail", ex.Message }
            }));
            return;
        }

        var ser = new JavaScriptSerializer();
        ser.MaxJsonLength = int.MaxValue;
        res.Write(ser.Serialize(rows));
    }

    // Length-and-content compare that does not short-circuit, to avoid leaking
    // the key via response timing.
    private static bool FixedTimeEquals(string a, string b)
    {
        if (a == null || b == null) return false;
        if (a.Length != b.Length) return false;
        int diff = 0;
        for (int i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }
}
