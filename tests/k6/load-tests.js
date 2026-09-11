import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const paymentSuccessRate = new Rate('payment_success');
const requestDuration = new Trend('request_duration', true);

// Configuration
export const options = {
  scenarios: {
    steady_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
    },
    spike_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '10s', target: 50 },
        { duration: '10s', target: 50 },
        { duration: '10s', target: 0 },
      ],
    },
    stress_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    'payment_success': ['rate>0.95'],
    'request_duration': ['p(95)<500'],
    'http_req_duration': ['p(90)<300', 'p(99)<1000'],
    'http_req_failed': ['rate<0.05'],
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:4000';
const API_KEY = __ENV.API_KEY || '';

function makeRequest(endpoint, method = 'GET', data = null) {
  const url = `${API_URL}/api/${endpoint}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
  };

  const response = data
    ? http[method.toLowerCase()](url, JSON.stringify(data), params)
    : http[method.toLowerCase()](url, null, params);

  requestDuration.add(response.timings.duration);
  return response;
}

export default function () {
  group('Health checks', () => {
    const res = makeRequest('health');
    check(res, {
      'health endpoint returns 200': (r) => r.status === 200,
    });
  });

  group('Payment operations', () => {
    const listRes = makeRequest('payments');
    check(listRes, {
      'list payments returns 200': (r) => r.status === 200,
    });
    paymentSuccessRate.add(listRes.status === 200);

    if (listRes.status === 200) {
      try {
        const body = JSON.parse(listRes.body);
        if (body.data && body.data.length > 0) {
          const paymentId = body.data[0].id;
          const getRes = makeRequest(`payments/${paymentId}`);
          check(getRes, {
            'get payment returns 200': (r) => r.status === 200,
          });
          paymentSuccessRate.add(getRes.status === 200);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  group('Merchant operations', () => {
    const res = makeRequest('merchants');
    check(res, {
      'list merchants returns 200': (r) => r.status === 200,
    });
    paymentSuccessRate.add(res.status === 200);
  });

  group('Invoice operations', () => {
    const res = makeRequest('invoices');
    check(res, {
      'list invoices returns 200': (r) => r.status === 200,
    });
    paymentSuccessRate.add(res.status === 200);
  });

  sleep(1);
}
