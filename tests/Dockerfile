FROM grafana/k6:latest

WORKDIR /tests
COPY k6/load-tests.js .
COPY k6/README.md .

ENTRYPOINT ["k6", "run", "load-tests.js"]
