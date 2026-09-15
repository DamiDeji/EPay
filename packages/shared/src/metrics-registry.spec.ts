import { describe, expect, it } from 'vitest';

import { Counter, Gauge, Histogram, MetricsRegistry } from './metrics-registry';

describe('MetricsRegistry', () => {
  describe('Counter', () => {
    it('accumulates per label set independently', () => {
      const counter = new Counter('epay_test_total', 'test counter');

      counter.inc({ status: '200' });
      counter.inc({ status: '200' });
      counter.inc({ status: '500' });

      expect(counter.get({ status: '200' })).toBe(2);
      expect(counter.get({ status: '500' })).toBe(1);
      expect(counter.get({ status: '404' })).toBe(0);
    });

    it('renders HELP, TYPE, and one line per series', () => {
      const counter = new Counter('epay_test_total', 'test counter');
      counter.inc({ status: '200' }, 3);

      const exposed = counter.expose();

      expect(exposed).toContain('# HELP epay_test_total test counter');
      expect(exposed).toContain('# TYPE epay_test_total counter');
      expect(exposed).toContain('epay_test_total{status="200"} 3');
    });

    it('rejects negative increments', () => {
      const counter = new Counter('epay_negative_total', 'test');
      expect(() => counter.inc({}, -1)).toThrow(/cannot decrease/i);
    });

    it('emits an unlabelled line without braces', () => {
      const counter = new Counter('epay_bare_total', 'test');
      counter.inc();
      expect(counter.expose()).toContain('epay_bare_total 1');
    });
  });

  describe('Gauge', () => {
    it('sets and overwrites a value', () => {
      const gauge = new Gauge('epay_queue_waiting_jobs', 'queue depth');

      gauge.set({ queue: 'indexer' }, 10);
      expect(gauge.get({ queue: 'indexer' })).toBe(10);

      gauge.set({ queue: 'indexer' }, 4);
      expect(gauge.get({ queue: 'indexer' })).toBe(4);
      expect(gauge.expose()).toContain('# TYPE epay_queue_waiting_jobs gauge');
    });
  });

  describe('Histogram', () => {
    it('counts observations cumulatively across buckets', () => {
      const histogram = new Histogram(
        'epay_http_request_duration_seconds',
        'latency',
        [0.1, 1, 10],
      );

      histogram.observe({}, 0.05);
      histogram.observe({}, 0.5);
      histogram.observe({}, 5);
      histogram.observe({}, 60); // beyond the largest bucket -> +Inf only

      const exposed = histogram.expose();
      expect(exposed).toContain('# TYPE epay_http_request_duration_seconds histogram');
      expect(exposed).toContain('epay_http_request_duration_seconds_bucket{le="0.1"} 1');
      expect(exposed).toContain('epay_http_request_duration_seconds_bucket{le="1"} 2');
      expect(exposed).toContain('epay_http_request_duration_seconds_bucket{le="10"} 3');
      expect(exposed).toContain('epay_http_request_duration_seconds_bucket{le="+Inf"} 4');
      expect(exposed).toContain('epay_http_request_duration_seconds_count 4');
      expect(histogram.count({})).toBe(4);
    });

    it('rejects an empty bucket list', () => {
      expect(() => new Histogram('epay_bad_seconds', 'bad', [])).toThrow(/bucket/i);
    });
  });

  it('rejects invalid metric names', () => {
    expect(() => new Counter('not valid', 'bad')).toThrow(/invalid/i);
  });

  it('escapes quotes and backslashes in label values', () => {
    const counter = new Counter('epay_escape_total', 'test');
    counter.inc({ route: 'a"b\\c' });
    expect(counter.expose()).toContain('route="a\\"b\\\\c"');
  });

  it('joins families with a blank line and a trailing newline', () => {
    const registry = new MetricsRegistry();
    registry.register(new Counter('epay_a_total', 'a'));
    registry.register(new Counter('epay_b_total', 'b'));

    const exposed = registry.expose();
    expect(exposed).toContain('# TYPE epay_a_total counter\n\n# HELP epay_b_total');
    expect(exposed.endsWith('\n')).toBe(true);
  });

  it('renders an empty document when nothing is registered', () => {
    expect(new MetricsRegistry().expose()).toBe('\n');
  });

  describe('reset', () => {
    it('drops every series but keeps the metric usable', () => {
      const counter = new Counter('epay_reset_total', 'test');
      counter.inc({ a: '1' });
      counter.reset();

      expect(counter.get({ a: '1' })).toBe(0);
      expect(counter.expose()).not.toContain('epay_reset_total{');

      counter.inc({ a: '1' });
      expect(counter.get({ a: '1' })).toBe(1);
    });

    it('clears gauges and histograms', () => {
      const gauge = new Gauge('epay_reset_gauge', 'test');
      gauge.set({}, 5);
      gauge.reset();
      expect(gauge.get({})).toBe(0);

      const histogram = new Histogram('epay_reset_seconds', 'test', [1]);
      histogram.observe({}, 0.5);
      histogram.reset();
      expect(histogram.count({})).toBe(0);
      expect(histogram.expose()).not.toContain('_bucket');
    });
  });

  describe('Gauge.inc', () => {
    it('creates the series on first use, then accumulates', () => {
      const gauge = new Gauge('epay_gauge_inc', 'test');

      gauge.inc({ queue: 'indexer' }, 3);
      expect(gauge.get({ queue: 'indexer' })).toBe(3);

      gauge.inc({ queue: 'indexer' });
      expect(gauge.get({ queue: 'indexer' })).toBe(4);
    });

    it('accepts a negative amount, unlike a counter', () => {
      const gauge = new Gauge('epay_gauge_dec', 'test');
      gauge.inc({}, -2);
      expect(gauge.get({})).toBe(-2);
    });
  });

  describe('value formatting', () => {
    it('normalises non-finite and negative-zero values', () => {
      const gauge = new Gauge('epay_nonfinite', 'test');

      gauge.set({ kind: 'nan' }, Number.NaN);
      gauge.set({ kind: 'inf' }, Number.POSITIVE_INFINITY);
      gauge.set({ kind: 'neg_inf' }, Number.NEGATIVE_INFINITY);
      gauge.set({ kind: 'neg_zero' }, -0);

      const exposed = gauge.expose();
      expect(exposed).toContain('epay_nonfinite{kind="nan"} NaN');
      expect(exposed).toContain('epay_nonfinite{kind="inf"} +Inf');
      expect(exposed).toContain('epay_nonfinite{kind="neg_inf"} -Inf');
      expect(exposed).toContain('epay_nonfinite{kind="neg_zero"} 0');
    });

    it('escapes newlines in label values', () => {
      const counter = new Counter('epay_newline_total', 'test');
      counter.inc({ error: 'line1\nline2' });
      expect(counter.expose()).toContain('error="line1\\nline2"');
    });
  });

  describe('Histogram defaults and isolation', () => {
    it('uses the default latency buckets when none are supplied', () => {
      const histogram = new Histogram('epay_default_seconds', 'test');
      histogram.observe({}, 0.001);

      const exposed = histogram.expose();
      expect(exposed).toContain('epay_default_seconds_bucket{le="0.005"} 1');
      expect(exposed).toContain('epay_default_seconds_bucket{le="+Inf"} 1');
      expect(exposed).toContain('epay_default_seconds_count 1');

      const extra = new Histogram('epay_extra_seconds', 'test');
      // The shared default array must never be mutated by an instance.
      expect(extra.buckets).toEqual(histogram.buckets);
      expect(extra.buckets).toHaveLength(11);
    });

    it('keeps a separate series per label set with its own sum', () => {
      const histogram = new Histogram('epay_split_seconds', 'test', [1, 2]);
      histogram.observe({ route: '/a' }, 0.5);
      histogram.observe({ route: '/b' }, 1.5);
      histogram.observe({ route: '/b' }, 1.5);

      const exposed = histogram.expose();
      expect(exposed).toContain('epay_split_seconds_bucket{le="1",route="/a"} 1');
      expect(exposed).toContain('epay_split_seconds_count{route="/a"} 1');
      expect(exposed).toContain('epay_split_seconds_bucket{le="2",route="/b"} 2');
      expect(exposed).toContain('epay_split_seconds_sum{route="/b"} 3');
      expect(histogram.count({ route: '/a' })).toBe(1);
    });
  });
});
