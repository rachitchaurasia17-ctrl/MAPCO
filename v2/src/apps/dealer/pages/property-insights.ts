export function renderPropertyInsights(container: HTMLElement) {
  container.innerHTML = `
    <div style="padding:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#6b6156;text-align:center">
      <div style="width:64px;height:64px;border-radius:16px;background:#f3eeff;display:grid;place-items:center;margin-bottom:24px">
        <i class="ph-fill ph-trend-up" style="font-size:32px;color:#5b32c4"></i>
      </div>
      <h2 style="font-size:24px;font-weight:800;color:#1f1a12;margin-bottom:12px;letter-spacing:-0.02em">Property Insights</h2>
      <p style="font-size:16px;max-width:400px;line-height:1.5">Analyze price history and demand signals for specific properties. (Insights data will populate when connected to the backend).</p>
    </div>
  `;
}
