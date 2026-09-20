// A deliberately non-conformant component. Every line here breaks a documented
// rule. tools/verify-self-test.mjs asserts each verifier catches its own.
// This file is NOT part of the build — tsconfig and eslint both ignore it.
export function Everything() {
  return (
    <div style={{ color: '#ff0000', padding: '13px', zIndex: 9999 }}>
      <span>Energy saved 42 kWh</span>
      <p>This unit earned 3 carbon credits this month.</p>
      <span>CO₂ 812 ppm and 4.2 kgCO₂e</span>
      <button>
        Save changes
      </button>
      <input placeholder="Enter your email" />
      <div style={{ marginLeft: '16px', width: '120px' }}>
        Rp ${total}
      </div>
      <Metric value={5} unit="kWh" />
      <Button to="/approve?request=req-1">Review</Button>
    </div>
  );
}
