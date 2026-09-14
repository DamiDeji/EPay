import { Counter, Gauge, Histogram, MetricsRegistry } from './metrics.registry';

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
});
