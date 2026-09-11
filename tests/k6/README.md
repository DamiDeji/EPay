# EPay Load Testing with k6

## Prerequisites

- k6 installed: `brew install k6` or `sudo apt-get install k6`
- API running locally or accessible via API_URL

## Running Tests

### Local Development
```bash
cd tests/k6
API_URL=http://localhost:4000 k6 run load-tests.js
```

### With API Key
```bash
API_URL=https://api.epay.dev API_KEY=your-api-key k6 run load-tests.js
```

### Stress Test
```bash
k6 run --vus 100 --duration 3m load-tests.js
```

### Spike Test
```bash
k6 run --vus 50 --duration 10s load-tests.js
```

### Run all scenarios
```bash
k6 run load-tests.js
```

## SLOs (Service Level Objectives)

| Metric | Target |
|--------|--------|
| Payment success rate | >95% |
| P95 response time | <500ms |
| P90 response time | <300ms |
| P99 response time | <1000ms |
| Error rate | <5% |

## Output

k6 generates a summary report at the end of each run. For detailed analysis:
```bash
k6 run --out json=results.json load-tests.js
```

Then visualize with `k6 cloud` or import into Grafana.

## Docker

```bash
docker build -t epay-k6-tests .
docker run --rm -e API_URL=http://host.docker.internal:4000 epay-k6-tests
```
