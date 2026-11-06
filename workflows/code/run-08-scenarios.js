// Sends the spec's error scenarios (1-5) to the active `99 Error Test` flow, one per second.
// Scenario 6 (invalid email credential) is done by hand. Run: node workflows/code/run-08-scenarios.js [baseUrl]
const baseUrl = process.argv[2] || 'http://localhost:5678';

const scenarios = [
  { n: 1, message: 'Error: apartado 99 no encontrado' },
  { n: 2, message: 'Request failed: Authorization: Bearer abc123SECRET' },
  { n: 3, message: '{"api_key":"sk-test-123","detalle":"422"}' },
  { n: 4, message: 'x'.repeat(2000) },
  { n: 5, message: '' },
];

(async () => {
  for (const { n, message } of scenarios) {
    const response = await fetch(`${baseUrl}/webhook/error-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    console.log(`scenario ${n}: HTTP ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
})();
