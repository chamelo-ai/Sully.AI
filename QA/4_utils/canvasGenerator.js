/**
 * Generates a Cursor Canvas (.canvas.tsx) from a transcript analysis result.
 * Matches the style of transcript-analyzer-review.canvas.tsx:
 *   - PASS/FAIL pill + Download as HTML button
 *   - Terminal-style console output
 *   - Score bars, phrase pills, collapsible JSON
 */

import fs from 'fs/promises';

const CANVAS_PATH = '/Users/nathancha/.cursor/projects/Users-nathancha-Desktop-Tech-Sully-AI/canvases/transcript-score.canvas.tsx';

function esc(str = '') {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
}

export async function writeTranscriptCanvas(scenario, { qualityResults, transcriptText, originalText }, qualityThreshold = 40) {
  const {
    contentAccuracy, speakerAttribution,
    coherence, naturalness, overallScore,
    presentPhrases = [], missingPhrases = [],
    incorrectTranscriptions = [], improvementSuggestions = []
  } = qualityResults;

  // coherence/naturalness stored as 0-10 in qualityResults
  const coherencePct   = coherence * 10;
  const naturalnessPct = naturalness * 10;

  const runAt    = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const label    = scenario.charAt(0).toUpperCase() + scenario.slice(1);
  const passFail = overallScore > qualityThreshold ? 'PASS' : 'FAIL';

  const presentList   = JSON.stringify(presentPhrases.slice(0, 15));
  const missingList   = JSON.stringify(missingPhrases.slice(0, 8));
  const suggList      = JSON.stringify(improvementSuggestions.slice(0, 5));
  const incorrectList = JSON.stringify(
    incorrectTranscriptions.slice(0, 6).map(t => ({
      original: t.original || '', transcribed: t.transcribed || '', score: t.score || t.similarityScore || 0
    }))
  );

  const jsonBlock = `{
  "contentAccuracy": ${contentAccuracy},
  "speakerAttribution": ${speakerAttribution},
  "coherence": ${coherence},
  "naturalness": ${naturalness},
  "overallScore": ${overallScore},
  "presentPhrases": ${JSON.stringify(presentPhrases.slice(0, 10), null, 2)},
  "missingPhrases": ${JSON.stringify(missingPhrases.slice(0, 6), null, 2)},
  "improvementSuggestions": ${JSON.stringify(improvementSuggestions, null, 2)}
}`;

  const tsx = `import {
  Stack, Row, Grid, H1, H2, H3, Text, Card, CardHeader, CardBody,
  Table, Stat, Pill, Divider, Code, Button,
  useHostTheme,
} from "cursor/canvas";

const scenario         = "${label}";
const runAt            = "${runAt}";
const passFail         = "${passFail}";
const overallScore     = ${overallScore};
const qualityThreshold = ${qualityThreshold};

const metrics = {
  contentAccuracy:    ${contentAccuracy},
  speakerAttribution: ${speakerAttribution},
  coherence:          ${coherence},
  naturalness:        ${naturalness},
  coherencePct:       ${coherencePct},
  naturalnessPct:     ${naturalnessPct},
};

const presentPhrases:      string[]  = ${presentList};
const missingPhrases:      string[]  = ${missingList};
const suggestions:         string[]  = ${suggList};
const incorrectTranscriptions        = ${incorrectList};

const originalText   = \`${esc(originalText)}\`;
const transcriptText = \`${esc(transcriptText)}\`;

const jsonOutput = \`${esc(jsonBlock)}\`;

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, value }: { label: string; value: number }) {
  const theme = useHostTheme();
  const color = value >= 80 ? theme.accent.primary : value >= 60 ? "#d4a017" : "#c0392b";
  return (
    <Row gap={8} align="center">
      <Text size="small" tone="secondary" style={{ minWidth: 160 }}>{label}</Text>
      <div style={{ flex: 1, height: 6, background: theme.fill.tertiary, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: \`\${value}%\`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <Text size="small" weight="semibold" style={{ color, minWidth: 36, textAlign: "right" }}>
        {value}%
      </Text>
    </Row>
  );
}

// ─── Transcript pane ──────────────────────────────────────────────────────────
function TranscriptPane({ label, text }: { label: string; text: string }) {
  const theme = useHostTheme();
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Text size="small" weight="semibold" tone="secondary" style={{ marginBottom: 6 }}>{label}</Text>
      <div style={{
        background: theme.bg.chrome,
        border: \`1px solid \${theme.stroke.tertiary}\`,
        borderRadius: 6, padding: "10px 12px",
        fontFamily: "monospace", fontSize: 11,
        color: theme.text.secondary, lineHeight: 1.6,
        whiteSpace: "pre-wrap", overflowY: "auto", maxHeight: 220,
      }}>
        {text}
      </div>
    </div>
  );
}

// ─── Main canvas ─────────────────────────────────────────────────────────────
export default function TranscriptScoreReport() {
  const theme     = useHostTheme();
  const passColor = overallScore > qualityThreshold ? theme.accent.primary : "#c0392b";
  const overallTone = overallScore >= 80 ? "success" as const : overallScore >= 60 ? "warning" as const : "danger" as const;

  return (
    <Stack gap={24} style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div>
        <Row gap={12} align="center" justify="space-between">
          <Row gap={12} align="center">
            <H1>Transcript Score — {scenario}</H1>
            <Pill active style={{ background: passColor, color: "#fff" }}>{passFail}</Pill>
          </Row>
          <Text size="small" tone="tertiary">{runAt}</Text>
        </Row>
        <Text tone="secondary" size="small">
          Live E2E test result · Quality threshold: {qualityThreshold}%
        </Text>
      </div>

      {/* Console output */}
      <Stack gap={4}>
        <H2>Console Output</H2>
        <Text tone="secondary" size="small" style={{ marginBottom: 8 }}>
          What the test runner prints to stdout during <Code>analyzeAndValidate()</Code>
        </Text>
        <div style={{
          background: "#0d1117",
          border: \`1px solid \${theme.stroke.tertiary}\`,
          borderRadius: 6, padding: "12px 16px",
          fontFamily: "monospace", fontSize: 12,
          color: "#c9d1d9", lineHeight: 1.8,
        }}>
          <div style={{ color: "#8b949e" }}>Attempting to retrieve transcript...</div>
          <div style={{ color: "#8b949e" }}>Analyzing transcript quality...</div>
          <div style={{ marginTop: 8, color: "#58a6ff" }}>============= TRANSCRIPT COMPARISON =============</div>
          <div style={{ color: "#e3b341" }}>ORIGINAL:</div>
          <div>{originalText.split("\\n").slice(0, 2).join("\\n")} ...</div>
          <div style={{ color: "#e3b341", marginTop: 4 }}>TRANSCRIPT:</div>
          <div>{transcriptText.split("\\n").slice(0, 2).join("\\n")} ...</div>
          <div style={{ marginTop: 8, color: "#58a6ff" }}>============= TRANSCRIPT QUALITY METRICS =============</div>
          <div><span style={{ color: "#3fb950" }}>CONTENT ACCURACY: </span>{metrics.contentAccuracy}%</div>
          <div><span style={{ color: "#3fb950" }}>SPEAKER ATTRIBUTION: </span>{metrics.speakerAttribution}%</div>
          <div><span style={{ color: "#3fb950" }}>COHERENCE: </span>{metrics.coherence}/10</div>
          <div><span style={{ color: "#3fb950" }}>NATURALNESS: </span>{metrics.naturalness}/10</div>
          <div><span style={{ color: "#3fb950" }}>OVERALL SCORE: </span>
            <span style={{ color: passColor, fontWeight: "bold" }}>{overallScore}%</span>
          </div>
          {suggestions.length > 0 && <>
            <div style={{ marginTop: 8, color: "#58a6ff" }}>============= IMPROVEMENT SUGGESTIONS =============</div>
            {suggestions.map((s, i) => <div key={i}>{i + 1}. {s}</div>)}
          </>}
          {missingPhrases.length > 0 && <>
            <div style={{ marginTop: 8, color: "#58a6ff" }}>============= KEY MISSING PHRASES =============</div>
            {missingPhrases.slice(0, 5).map((p, i) => <div key={i}>{i + 1}. "{p}"</div>)}
          </>}
          <div style={{ marginTop: 8, color: passColor, fontWeight: "bold" }}>
            Quality score of {overallScore}% {overallScore > qualityThreshold ? "exceeds" : "is below"} minimum threshold of {qualityThreshold}%
          </div>
        </div>
      </Stack>

      {/* Quality metrics */}
      <Stack gap={12}>
        <H2>Quality Metrics</H2>
        <Grid columns={5} gap={12}>
          <Stat value={\`\${metrics.contentAccuracy}%\`}    label="Content Accuracy"    tone={metrics.contentAccuracy >= 80 ? "success" : "warning"} />
          <Stat value={\`\${metrics.speakerAttribution}%\`} label="Speaker Attribution" tone={metrics.speakerAttribution >= 80 ? "success" : "warning"} />
          <Stat value={\`\${metrics.coherence}/10\`}        label="Coherence"           tone={metrics.coherence >= 7 ? "success" : "warning"} />
          <Stat value={\`\${metrics.naturalness}/10\`}      label="Naturalness"         tone={metrics.naturalness >= 7 ? "success" : "warning"} />
          <Stat value={\`\${overallScore}%\`}               label="Overall Score"       tone={overallTone} />
        </Grid>
        <Stack gap={8}>
          <ScoreBar label="Content Accuracy"    value={metrics.contentAccuracy} />
          <ScoreBar label="Speaker Attribution" value={metrics.speakerAttribution} />
          <ScoreBar label="Coherence"           value={metrics.coherencePct} />
          <ScoreBar label="Naturalness"         value={metrics.naturalnessPct} />
        </Stack>
      </Stack>

      {/* Transcript comparison */}
      <Stack gap={8}>
        <H2>Transcript Comparison</H2>
        <Row gap={12} align="start">
          <TranscriptPane label="ORIGINAL DIALOGUE"   text={originalText} />
          <TranscriptPane label="SULLY TRANSCRIPT"    text={transcriptText} />
        </Row>
      </Stack>

      {/* Incorrect transcriptions */}
      {incorrectTranscriptions.length > 0 && (
        <Stack gap={8}>
          <H2>Incorrect Transcriptions</H2>
          <Text tone="secondary" size="small">Segments where similarity fell between 0.3–0.8 (partial match, not exact).</Text>
          <Table
            headers={["Original", "Transcribed", "Similarity"]}
            columnAlign={["left", "left", "right"]}
            striped
            rowTone={incorrectTranscriptions.map(() => "warning" as const)}
            rows={incorrectTranscriptions.map((t) => [
              <Text size="small">{t.original}</Text>,
              <Text size="small" tone="secondary">{t.transcribed}</Text>,
              <Text size="small" weight="semibold">{Math.round(t.score * 100)}%</Text>,
            ])}
          />
        </Stack>
      )}

      {/* Phrase coverage */}
      <Grid columns={2} gap={16}>
        {presentPhrases.length > 0 && (
          <Stack gap={8}>
            <H3>Present Phrases ({presentPhrases.length})</H3>
            <Row gap={6} wrap>
              {presentPhrases.map((p) => (
                <div key={p} style={{ display: "contents" }}>
                  <Pill active size="sm">{p}</Pill>
                </div>
              ))}
            </Row>
          </Stack>
        )}
        {missingPhrases.length > 0 && (
          <Stack gap={8}>
            <H3>Missing Phrases ({missingPhrases.length})</H3>
            <Row gap={6} wrap>
              {missingPhrases.map((p) => (
                <div key={p} style={{ display: "contents" }}>
                  <Pill size="sm" style={{ opacity: 0.6 }}>{p}</Pill>
                </div>
              ))}
            </Row>
          </Stack>
        )}
      </Grid>

      <Divider />

      {/* Collapsible JSON */}
      <Card collapsible defaultOpen={false}>
        <CardHeader>quality_results.json</CardHeader>
        <CardBody>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: theme.text.secondary, lineHeight: 1.7, whiteSpace: "pre" }}>
            {jsonOutput}
          </div>
        </CardBody>
      </Card>

    </Stack>
  );
}
`;

  await fs.writeFile(CANVAS_PATH, tsx, 'utf8');
  return CANVAS_PATH;
}
