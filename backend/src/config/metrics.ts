import client from 'prom-client';

// Prometheus-ready metrics registry. Exposed at GET /metrics.
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});
registry.registerMetric(httpRequestDuration);

export const queueJobsProcessed = new client.Counter({
  name: 'queue_jobs_processed_total',
  help: 'Total processed queue jobs',
  labelNames: ['queue', 'status'],
});
registry.registerMetric(queueJobsProcessed);
