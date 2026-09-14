/**
 * A tiny, dependency-free Prometheus client.
 *
 * `prom-client` is deliberately not used: adding it (and its transitive
 * dependencies) to the API's lockfile would pull new packages into every SBOM
 * for a feature that is ~150 lines of arithmetic. The exposition format is
 * stable and documented, so the risk of hand-rolling it is bounded and the
 * implementation is fully covered by `metrics.registry.spec.ts`.
 *
 * Names and labels intentionally match the alerting rules in
 * `monitoring/prometheus/rules/epay.yml`.
 */

export type MetricLabels = Readonly<Record<string, string>>;

const METRIC_NAME_RE = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;

function assertValidName(name: string): string {
  if (!METRIC_NAME_RE.test(name)) {
    throw new Error(`Invalid Prometheus metric name: ${name}`);
  }
  return name;
}

function sortedKeys(labels: MetricLabels): string[] {
  return Object.keys(labels).sort();
}

/** Stable map key for a label set, independent of property order. */
function labelKey(labels: MetricLabels): string {
  return sortedKeys(labels)
    .map((key) => `${key}=${String(labels[key] ?? '')}`)
    .join('\u0000');
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function renderLabels(labels: MetricLabels): string {
  const keys = sortedKeys(labels);
  if (keys.length === 0) {
    return '';
  }
  const pairs = keys.map((key) => `${key}="${escapeLabelValue(String(labels[key] ?? ''))}"`);
  return `{${pairs.join(',')}}`;
}

/** `-0` and `NaN` are not valid exposition values; normalise them. */
function formatValue(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Infinity) return '+Inf';
  if (value === -Infinity) return '-Inf';
  if (Object.is(value, -0)) return '0';
  return String(value);
}

interface CounterSeries {
  labels: MetricLabels;
  value: number;
}

/** Monotonically increasing counter. */
export class Counter {
  readonly type = 'counter';
  private readonly series = new Map<string, CounterSeries>();

  constructor(
    readonly name: string,
    readonly help: string,
  ) {
    assertValidName(name);
  }

  inc(labels: MetricLabels = {}, amount = 1): void {
    if (amount < 0) {
      throw new Error(`Counters cannot decrease: ${this.name}`);
    }
    const key = labelKey(labels);
    const existing = this.series.get(key);
    if (existing) {
      existing.value += amount;
    } else {
      this.series.set(key, { labels, value: amount });
    }
  }

  /** Current value for a label set, for tests. */
  get(labels: MetricLabels = {}): number {
    return this.series.get(labelKey(labels))?.value ?? 0;
  }

  reset(): void {
    this.series.clear();
  }

  expose(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const series of this.series.values()) {
      lines.push(`${this.name}${renderLabels(series.labels)} ${formatValue(series.value)}`);
    }
    return lines.join('\n');
  }
}

interface GaugeSeries {
  labels: MetricLabels;
  value: number;
}

/** A value that can go up or down (queue depth, pool size, uptime). */
export class Gauge {
  readonly type = 'gauge';
  private readonly series = new Map<string, GaugeSeries>();

  constructor(
    readonly name: string,
    readonly help: string,
  ) {
    assertValidName(name);
  }

  set(labels: MetricLabels, value: number): void {
    this.series.set(labelKey(labels), { labels, value });
  }

  inc(labels: MetricLabels = {}, amount = 1): void {
    const key = labelKey(labels);
    const existing = this.series.get(key);
    if (existing) {
      existing.value += amount;
    } else {
      this.series.set(key, { labels, value: amount });
    }
  }

  get(labels: MetricLabels = {}): number {
    return this.series.get(labelKey(labels))?.value ?? 0;
  }

  reset(): void {
    this.series.clear();
  }

  expose(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const series of this.series.values()) {
      lines.push(`${this.name}${renderLabels(series.labels)} ${formatValue(series.value)}`);
    }
    return lines.join('\n');
  }
}

interface HistogramSeries {
  labels: MetricLabels;
  /** Non-cumulative per-bucket counts; cumulative totals are computed on expose. */
  bucketCounts: number[];
  sum: number;
  count: number;
}

export const DEFAULT_LATENCY_BUCKETS: readonly number[] = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

/**
 * Prometheus histogram. Exposes `_bucket` (cumulative), `_sum`, and `_count`,
 * from which `histogram_quantile()` derives p50/p95/p99.
 */
export class Histogram {
  readonly type = 'histogram';
  private readonly series = new Map<string, HistogramSeries>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly buckets: readonly number[] = DEFAULT_LATENCY_BUCKETS,
  ) {
    assertValidName(name);
    if (buckets.length === 0) {
      throw new Error(`Histogram requires at least one bucket: ${name}`);
    }
  }

  observe(labels: MetricLabels = {}, value: number): void {
    const key = labelKey(labels);
    let series = this.series.get(key);
    if (!series) {
      series = {
        labels,
        bucketCounts: new Array<number>(this.buckets.length).fill(0),
        sum: 0,
        count: 0,
      };
      this.series.set(key, series);
    }

    const index = this.buckets.findIndex((bound) => value <= bound);
    if (index >= 0) {
      series.bucketCounts[index] = (series.bucketCounts[index] ?? 0) + 1;
    }
    // Values above the last bound are counted only in the +Inf bucket (`count`).
    series.sum += value;
    series.count += 1;
  }

  count(labels: MetricLabels = {}): number {
    return this.series.get(labelKey(labels))?.count ?? 0;
  }

  reset(): void {
    this.series.clear();
  }

  expose(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];
    for (const series of this.series.values()) {
      let cumulative = 0;
      for (let i = 0; i < this.buckets.length; i += 1) {
        cumulative += series.bucketCounts[i] ?? 0;
        const le = formatValue(this.buckets[i] ?? 0);
        lines.push(`${this.name}_bucket${renderLabels({ ...series.labels, le })} ${cumulative}`);
      }
      // The +Inf bucket always equals the total observation count.
      lines.push(
        `${this.name}_bucket${renderLabels({ ...series.labels, le: '+Inf' })} ${series.count}`,
      );
      lines.push(`${this.name}_sum${renderLabels(series.labels)} ${formatValue(series.sum)}`);
      lines.push(`${this.name}_count${renderLabels(series.labels)} ${series.count}`);
    }
    return lines.join('\n');
  }
}

/** Renders every registered metric as one exposition-format document. */
export class MetricsRegistry {
  private readonly metrics: (Counter | Gauge | Histogram)[] = [];

  register<T extends Counter | Gauge | Histogram>(metric: T): T {
    this.metrics.push(metric);
    return metric;
  }

  expose(): string {
    const families = this.metrics.map((metric) => metric.expose());
    return `${families.join('\n\n')}\n`;
  }
}
