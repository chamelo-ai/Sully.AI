/**
 * Generates a self-contained HTML report from a transcript analysis result
 * and returns a clickable file:// link. Mirrors the Cursor Canvas layout:
 *   - PASS/FAIL badge + run timestamp
 *   - Terminal-style console block
 *   - Quality metric stats + score bars
 *   - Side-by-side transcript comparison
 *   - Present/missing phrase pills, incorrect-transcription table, raw JSON
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreColor(v) {
  return v >= 80 ? '#3fb950' : v >= 60 ? '#d4a017' : '#c0392b';
}

function scoreBar(label, value) {
  const color = scoreColor(value);
  return `
    <div class="bar-row">
      <span class="bar-label">${esc(label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${value}%;background:${color}"></div></div>
      <span class="bar-val" style="color:${color}">${value}%</span>
    </div>`;
}

function pills(items, muted = false) {
  return items
    .map(p => `<span class="pill${muted ? ' pill-muted' : ''}">${esc(p)}</span>`)
    .join('');
}

/**
 * @param {string} scenario
 * @param {{ qualityResults: object, transcriptText: string, originalText: string }} result
 * @param {number} [qualityThreshold] the minimum overall score the run had to exceed
 * @returns {Promise<string>} absolute path to the generated HTML file
 */
export async function writeTranscriptHtml(scenario, { qualityResults, transcriptText, originalText }, qualityThreshold = 40) {
  const {
    contentAccuracy, speakerAttribution,
    coherence, naturalness, overallScore,
    presentPhrases = [], missingPhrases = [],
    incorrectTranscriptions = [], improvementSuggestions = []
  } = qualityResults;

  const label    = scenario.charAt(0).toUpperCase() + scenario.slice(1);
  const runAt    = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const passed   = overallScore > qualityThreshold;
  const passFail = passed ? 'PASS' : 'FAIL';
  const passColor = passed ? '#3fb950' : '#c0392b';

  const incorrectRows = incorrectTranscriptions.slice(0, 10).map(t => `
        <tr>
          <td>${esc(t.original || '')}</td>
          <td class="muted">${esc(t.transcribed || '')}</td>
          <td class="right">${Math.round((t.score || t.similarityScore || 0) * 100)}%</td>
        </tr>`).join('');

  const jsonBlock = esc(JSON.stringify({
    contentAccuracy, speakerAttribution, coherence, naturalness, overallScore,
    presentPhrases: presentPhrases.slice(0, 10),
    missingPhrases: missingPhrases.slice(0, 6),
    improvementSuggestions
  }, null, 2));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Transcript Score — ${esc(label)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f6f7f9; color: #1a1a1a; margin: 0; padding: 32px;
  }
  .wrap { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
  .header { display: flex; align-items: center; justify-content: space-between; }
  .title-row { display: flex; align-items: center; gap: 12px; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 16px; margin: 0 0 8px; }
  h3 { font-size: 14px; margin: 0 0 8px; }
  .badge { color: #fff; font-weight: 700; font-size: 12px; padding: 4px 12px; border-radius: 999px; background: ${passColor}; }
  .sub { color: #6b7280; font-size: 13px; }
  .console {
    background: #0d1117; border-radius: 8px; padding: 14px 18px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
    color: #c9d1d9; line-height: 1.8; overflow-x: auto; white-space: pre-wrap;
  }
  .console .sect { color: #58a6ff; margin-top: 8px; }
  .console .k { color: #3fb950; }
  .console .lbl { color: #e3b341; }
  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
  .stat { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
  .stat .v { font-size: 20px; font-weight: 700; }
  .stat .l { font-size: 11px; color: #6b7280; margin-top: 4px; }
  .bars { display: flex; flex-direction: column; gap: 8px; }
  .bar-row { display: flex; align-items: center; gap: 8px; }
  .bar-label { min-width: 160px; font-size: 13px; color: #6b7280; }
  .bar-track { flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; }
  .bar-val { min-width: 40px; text-align: right; font-size: 13px; font-weight: 600; }
  .cols { display: flex; gap: 12px; align-items: flex-start; }
  .pane { flex: 1; min-width: 0; }
  .pane .plabel { font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px; }
  .pane .ptext {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px;
    font-family: ui-monospace, monospace; font-size: 11px; color: #374151; line-height: 1.6;
    white-space: pre-wrap; max-height: 240px; overflow-y: auto;
  }
  .pillbox { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { background: #dbeafe; color: #1e40af; font-size: 12px; padding: 3px 10px; border-radius: 999px; }
  .pill-muted { background: #f3f4f6; color: #9ca3af; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  th, td { text-align: left; padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  th { background: #f9fafb; font-size: 12px; color: #6b7280; }
  td.right, th.right { text-align: right; }
  td.muted { color: #6b7280; }
  details { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
  summary { cursor: pointer; font-weight: 600; font-size: 13px; }
  pre { font-family: ui-monospace, monospace; font-size: 12px; color: #374151; line-height: 1.7; margin: 12px 0 0; white-space: pre; overflow-x: auto; }
  hr { border: none; border-top: 1px solid #e5e7eb; }
  @media (prefers-color-scheme: dark) {
    body { background: #0d1117; color: #e6edf3; }
    .stat, .pane .ptext, table, details { background: #161b22; border-color: #30363d; }
    th { background: #1c2128; }
    .sub, .bar-label, .stat .l, .td.muted { color: #8b949e; }
    .bar-track { background: #30363d; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="title-row">
        <h1>Transcript Score — ${esc(label)}</h1>
        <span class="badge">${passFail}</span>
      </div>
      <span class="sub">${esc(runAt)}</span>
    </div>
    <div class="sub">Live E2E test result · Quality threshold: ${qualityThreshold}%</div>

    <div>
      <h2>Console Output</h2>
      <div class="console"><span class="sect">============= TRANSCRIPT QUALITY METRICS =============</span>
<span class="k">CONTENT ACCURACY:</span> ${contentAccuracy}%
<span class="k">SPEAKER ATTRIBUTION:</span> ${speakerAttribution}%
<span class="k">COHERENCE:</span> ${coherence}/10
<span class="k">NATURALNESS:</span> ${naturalness}/10
<span class="k">OVERALL SCORE:</span> <b style="color:${passColor}">${overallScore}%</b>
${improvementSuggestions.length ? `<span class="sect">============= IMPROVEMENT SUGGESTIONS =============</span>\n${improvementSuggestions.map((s, i) => `${i + 1}. ${esc(s)}`).join('\n')}` : ''}
${missingPhrases.length ? `<span class="sect">============= KEY MISSING PHRASES =============</span>\n${missingPhrases.slice(0, 5).map((p, i) => `${i + 1}. "${esc(p)}"`).join('\n')}` : ''}
<b style="color:${passColor}">Quality score of ${overallScore}% ${passed ? 'exceeds' : 'is below'} minimum threshold of ${qualityThreshold}%</b></div>
    </div>

    <div>
      <h2>Quality Metrics</h2>
      <div class="stats">
        <div class="stat"><div class="v" style="color:${scoreColor(contentAccuracy)}">${contentAccuracy}%</div><div class="l">Content Accuracy</div></div>
        <div class="stat"><div class="v" style="color:${scoreColor(speakerAttribution)}">${speakerAttribution}%</div><div class="l">Speaker Attribution</div></div>
        <div class="stat"><div class="v" style="color:${scoreColor(coherence * 10)}">${coherence}/10</div><div class="l">Coherence</div></div>
        <div class="stat"><div class="v" style="color:${scoreColor(naturalness * 10)}">${naturalness}/10</div><div class="l">Naturalness</div></div>
        <div class="stat"><div class="v" style="color:${passColor}">${overallScore}%</div><div class="l">Overall Score</div></div>
      </div>
      <div class="bars" style="margin-top:12px">
        ${scoreBar('Content Accuracy', contentAccuracy)}
        ${scoreBar('Speaker Attribution', speakerAttribution)}
        ${scoreBar('Coherence', coherence * 10)}
        ${scoreBar('Naturalness', naturalness * 10)}
      </div>
    </div>

    <div>
      <h2>Transcript Comparison</h2>
      <div class="cols">
        <div class="pane"><div class="plabel">ORIGINAL DIALOGUE</div><div class="ptext">${esc(originalText)}</div></div>
        <div class="pane"><div class="plabel">SULLY TRANSCRIPT</div><div class="ptext">${esc(transcriptText)}</div></div>
      </div>
    </div>

    ${incorrectRows ? `<div>
      <h2>Incorrect Transcriptions</h2>
      <table>
        <thead><tr><th>Original</th><th>Transcribed</th><th class="right">Similarity</th></tr></thead>
        <tbody>${incorrectRows}</tbody>
      </table>
    </div>` : ''}

    <div class="grid2">
      ${presentPhrases.length ? `<div><h3>Present Phrases (${presentPhrases.length})</h3><div class="pillbox">${pills(presentPhrases.slice(0, 20))}</div></div>` : ''}
      ${missingPhrases.length ? `<div><h3>Missing Phrases (${missingPhrases.length})</h3><div class="pillbox">${pills(missingPhrases.slice(0, 12), true)}</div></div>` : ''}
    </div>

    <hr />
    <details>
      <summary>quality_results.json</summary>
      <pre>${jsonBlock}</pre>
    </details>
  </div>
</body>
</html>`;

  const outDir = path.join(__dirname, '../results/transcript-analysis');
  await fs.mkdir(outDir, { recursive: true });

  const safe = scenario.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(outDir, `transcript-score-${safe}-${ts}.html`);

  await fs.writeFile(file, html, 'utf8');

  return file;
}
