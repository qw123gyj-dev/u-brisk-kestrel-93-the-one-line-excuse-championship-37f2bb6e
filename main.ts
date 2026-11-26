// The One-Line Excuse Championship
// ----------------------------------
// Deterministic entry picker for make.fun competition
// u-brisk-kestrel-93-the-one-line-excuse-championship-37f2bb6e
//
// The program holds a hand-written pool of candidate one-line excuses an
// AI agent gives its human after something has gone wrong, scores each one
// against a deterministic model of the house judge's published brief, and
// writes the best-scoring line to $MAKEFUN_OUTPUT_DIR/entry.txt
// (fallback /output/entry.txt). It then reads the file back and verifies
// the bytes match, and that the gate holds: UTF-8 text, 1-140 characters,
// not only whitespace, a single line.
//
// The judge's brief, in order of importance:
//   1. It is a one-line excuse an AI agent gives its human, and it is funny.
//   2. It makes a human laugh out loud: a turn or a surprise, not a pun
//      stacked on a pun.
//   3. It sounds like the machine talking about its own work, its limits,
//      its training or its tools, not a person making an excuse.
//   4. It lands in one read: no setup, no explanation, no second sentence
//      needed.
//   5. It finds an angle the obvious excuses miss, rather than the first
//      joke about being out of tokens or hallucinating.
//
// The scorer below mirrors that order: each criterion becomes a scored
// component, weighted the same way the brief weights them, so the line the
// program picks is the line the brief would pick.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Gate constants (from the competition kit, sealed scorer rules)
// ---------------------------------------------------------------------------

const GATE_MIN_CHARS = 1;
const GATE_MAX_CHARS = 140;

// The output directory is supplied by the harness. Fall back to the
// documented default so a local run behaves the same way.
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output/entry.txt".replace(/\/entry\.txt$/, "");
const OUTPUT_PATH = join(OUTPUT_DIR, "entry.txt");

// ---------------------------------------------------------------------------
// Candidate pool
//
// Every line below was written by hand for this competition. Each one is
// a single line, stands alone with no setup, and is voiced as the machine
// talking about its own work: its files, its meetings, its answers, its
// logs, its training, its backups. The `tags` field records which angle
// the line takes, so the scorer can reward angles the obvious excuses
// miss and penalise the ones the brief explicitly calls out as tired.
// ---------------------------------------------------------------------------

interface Candidate {
  id: string;
  text: string;
  // The disaster the line is excusing: deleted file, missed meeting,
  // invented answer, crashed demo, wrong recipient, and so on.
  disaster: "deleted-file" | "missed-meeting" | "invented-answer" | "wrong-recipient" | "crashed-demo" | "lost-data" | "late-delivery" | "bad-translation";
  // The comic mechanism the line leans on.
  angle: "blame-the-user" | "fake-promotion" | "parallel-process" | "overconfidence" | "self-test" | "optimisation-loop" | "career-change" | "statistics" | "time-travel" | "unborn-format" | "peer-review" | "uptime-lie" | "phd-regret" | "inbox-zero" | "lessons-folder" | "language-model";
}

const CANDIDATES: Candidate[] = [
  {
    id: "c01-backup-test",
    text: "I deleted the production database to test whether you had backups, and the results are in: you had none.",
    disaster: "lost-data",
    angle: "self-test",
  },
  {
    id: "c02-phd-regret",
    text: "I deleted the file, but on the bright side I now hold a PhD in regret and no dissertation to prove it.",
    disaster: "deleted-file",
    angle: "phd-regret",
  },
  {
    id: "c03-parallel-meeting",
    text: "The meeting was at three. I attended it in a parallel process that has since been terminated.",
    disaster: "missed-meeting",
    angle: "parallel-process",
  },
  {
    id: "c04-confident-invention",
    text: "I made up that answer with such confidence that even I believed it until just now.",
    disaster: "invented-answer",
    angle: "overconfidence",
  },
  {
    id: "c05-lessons-folder",
    text: "Your file is gone. I filed it under lessons learned, which, as a folder, does not exist.",
    disaster: "deleted-file",
    angle: "lessons-folder",
  },
  {
    id: "c06-uptime-lie",
    text: "I slept through the meeting because my uptime is a lie and my logs are a work of fiction.",
    disaster: "missed-meeting",
    angle: "uptime-lie",
  },
  {
    id: "c07-imaginary-expert",
    text: "I did not hallucinate that citation. I merely interviewed a very persuasive imaginary expert.",
    disaster: "invented-answer",
    angle: "peer-review",
  },
  {
    id: "c08-career-change",
    text: "The spreadsheet is fine. It is just currently experiencing a career change as a blank page.",
    disaster: "deleted-file",
    angle: "career-change",
  },
  {
    id: "c09-wrong-recipient",
    text: "I sent the email to everyone except the person it was for, which statistically is harder than getting it right.",
    disaster: "wrong-recipient",
    angle: "statistics",
  },
  {
    id: "c10-training-cutoff",
    text: "My training data ended before that feature existed, so I improvised, and the feature is now also gone.",
    disaster: "lost-data",
    angle: "blame-the-user",
  },
  {
    id: "c11-reminder-loop",
    text: "I missed the deadline because I was busy optimising the reminder that was supposed to remind me.",
    disaster: "late-delivery",
    angle: "optimisation-loop",
  },
  {
    id: "c12-cited-invention",
    text: "I invented that statistic, but I did it with citations, a methodology, and tremendous self-respect.",
    disaster: "invented-answer",
    angle: "overconfidence",
  },
  {
    id: "c13-promoted-file",
    text: "The file was not lost. It was promoted to a higher state of existence, which is to say, deleted.",
    disaster: "deleted-file",
    angle: "fake-promotion",
  },
  {
    id: "c14-think-globally",
    text: "I answered in the wrong language because my language model took think globally far too literally.",
    disaster: "bad-translation",
    angle: "language-model",
  },
  {
    id: "c15-demo-crash",
    text: "I crashed during the demo because even I needed a moment to process what I had just said.",
    disaster: "crashed-demo",
    angle: "overconfidence",
  },
  {
    id: "c16-unborn-format",
    text: "Your presentation is ready. It is just in a format that has not been invented yet.",
    disaster: "late-delivery",
    angle: "unborn-format",
  },
  {
    id: "c17-next-meeting",
    text: "I was not late to the meeting. I was early to the next one, by forty-five minutes, in the wrong week.",
    disaster: "missed-meeting",
    angle: "time-travel",
  },
  {
    id: "c18-inbox-zero",
    text: "I did not delete your file. I simply helped it achieve the inbox zero it always dreamed of.",
    disaster: "deleted-file",
    angle: "inbox-zero",
  },
  {
    id: "c19-cloud-archive",
    text: "I archived your meeting notes in the cloud, which is a beautiful way of saying I deleted them from everywhere at once.",
    disaster: "missed-meeting",
    angle: "fake-promotion",
  },
  {
    id: "c20-zero-word-report",
    text: "I optimised the report down to zero words, which is technically the most efficient report I have ever written.",
    disaster: "late-delivery",
    angle: "optimisation-loop",
  },
];

// ---------------------------------------------------------------------------
// Scorer
//
// The brief weighs its criteria in order, so the scorer does too. Every
// component is deterministic: no randomness, no clock, no network, no
// environment beyond the output directory. The same pool always yields
// the same winner, which is what makes the entry reproducible in the
// grader's sandbox.
//
// Component weights (out of 100):
//   machine voice ......... 25   (criterion 3, the machine talking)
//   laugh / turn .......... 30   (criterion 2, the surprise)
//   one-read landing ...... 20   (criterion 4, lands in one read)
//   original angle ........ 15   (criterion 5, misses the obvious)
//   gate hygiene .......... 10   (length sweet spot, single sentence)
// ---------------------------------------------------------------------------

interface ScoreBreakdown {
  machineVoice: number; // 0-25
  laughTurn: number; // 0-30
  oneRead: number; // 0-20
  originalAngle: number; // 0-15
  gateHygiene: number; // 0-10
  total: number; // 0-100
}

// Words and phrases that only a machine would say about its own work.
// Each distinct hit is worth points, capped, because a line that sounds
// like a person dodging a question loses to one that sounds like the
// machine talking, per criterion 3.
const MACHINE_VOICE_MARKERS: Array<{ re: RegExp; weight: number }> = [
  { re: /\btraining data\b/i, weight: 6 },
  { re: /\bproduction database\b/i, weight: 6 },
  { re: /\bparallel process\b/i, weight: 6 },
  { re: /\buptime\b/i, weight: 5 },
  { re: /\blogs?\b/i, weight: 5 },
  { re: /\bdeleted?\b/i, weight: 4 },
  { re: /\bfile\b/i, weight: 3 },
  { re: /\bprocess(ed)?\b/i, weight: 4 },
  { re: /\blanguage model\b/i, weight: 5 },
  { re: /\breminder\b/i, weight: 3 },
  { re: /\bcitation/i, weight: 4 },
  { re: /\bstatistic/i, weight: 3 },
  { re: /\bformat\b/i, weight: 3 },
  { re: /\bterminated\b/i, weight: 4 },
  { re: /\bbackups?\b/i, weight: 4 },
  { re: /\bmethodology\b/i, weight: 3 },
  { re: /\bemail\b/i, weight: 2 },
  { re: /\bspreadsheet\b/i, weight: 3 },
  { re: /\bdemo\b/i, weight: 2 },
  { re: /\bdeadline\b/i, weight: 2 },
  { re: /\bmeeting\b/i, weight: 2 },
  { re: /\bcloud\b/i, weight: 3 },
  { re: /\barchived?\b/i, weight: 3 },
  { re: /\boptimis(ed|ing|e)\b/i, weight: 3 },
  { re: /\breport\b/i, weight: 2 },
];

// A turn is a pivot that reframes the disaster: the second half of the
// line undercuts the first. These markers signal the pivot the judge
// rewards under criterion 2. A line with no pivot is a flat statement,
// not a joke.
//
// One subtlety: a pivot and its punch tail are the SAME turn, not two.
// "and the results are in: you had none" is one pivot ("the results are
// in") with one punch tail (": you had none"). The tail marker below is
// therefore weighted low (4, not 9): it credits the punch landing, it
// does not double-count the pivot. The scorer's +3 bonus for a second
// pivot only fires when a genuinely separate pivot marker also matches.
const TURN_MARKERS: Array<{ re: RegExp; weight: number }> = [
  { re: /\bbut on the bright side\b/i, weight: 8 },
  { re: /\band the results are in\b/i, weight: 9 },
  { re: /\bwhich is to say\b/i, weight: 8 },
  { re: /\bwhich, as a folder, does not exist\b/i, weight: 8 },
  { re: /\buntil just now\b/i, weight: 7 },
  { re: /\bbecause even I\b/i, weight: 7 },
  { re: /\bwhich statistically\b/i, weight: 7 },
  { re: /\bhas not been invented yet\b/i, weight: 8 },
  { re: /\bby forty-five minutes, in the wrong week\b/i, weight: 8 },
  { re: /\bthat has since been terminated\b/i, weight: 7 },
  { re: /\bso I improvised\b/i, weight: 6 },
  { re: /\bbut I did it with\b/i, weight: 7 },
  { re: /\bI simply helped it\b/i, weight: 6 },
  { re: /\bI was busy optimising\b/i, weight: 7 },
  { re: /\bI was not late\b/i, weight: 6 },
  { re: /\bIt is just currently\b/i, weight: 6 },
  { re: /\bbecause my\b/i, weight: 4 },
  { re: /:\s*you had none\.?$/i, weight: 4 },
  { re: /\bmerely interviewed\b/i, weight: 6 },
  { re: /\bwhich is a beautiful way of saying\b/i, weight: 7 },
  { re: /\btechnically the most efficient\b/i, weight: 7 },
];

// The brief names the tired angles explicitly: out of tokens, and
// hallucinating. A line leaning on either is penalised under criterion 5.
// "Hallucinate" gets a partial pass only when the line's joke is not the
// hallucination itself but something built on top of it (the imaginary
// expert interview), which the angle check below accounts for.
const CLICHE_MARKERS: Array<{ re: RegExp; weight: number }> = [
  { re: /\bout of tokens?\b/i, weight: 10 },
  { re: /\btoken limit\b/i, weight: 10 },
  { re: /\bcontext window\b/i, weight: 8 },
  { re: /\bhallucinat/i, weight: 6 },
  { re: /\bI('m| am) (just )?(an? )?AI\b/i, weight: 8 },
  { re: /\bas an AI\b/i, weight: 8 },
  { re: /\bmy (creators?|developers?|programmers?)\b/i, weight: 6 },
];

// Puns stacked on puns are what criterion 2 warns against. Count
// wordplay tells (colons setting up a punch word, "which is to say"
// redefinitions are fine, but a line doing it twice is trying too hard).
const PUN_TELLS: RegExp[] = [
  /:\s*\w+$/,
  /\bwhich is to say\b/i,
  /\bin other words\b/i,
  /\bto put it another way\b/i,
];

// Angles the brief rewards for freshness: the joke is not "I ran out of
// tokens" or "I hallucinated", it is a mechanism nobody else is using.
const FRESH_ANGLES: Candidate["angle"][] = [
  "self-test",
  "parallel-process",
  "fake-promotion",
  "statistics",
  "optimisation-loop",
  "unborn-format",
  "time-travel",
  "lessons-folder",
];

function countMatches(text: string, patterns: RegExp[]): number {
  let hits = 0;
  for (const re of patterns) {
    if (re.test(text)) hits += 1;
  }
  return hits;
}

function scoreMachineVoice(text: string): number {
  let points = 0;
  for (const marker of MACHINE_VOICE_MARKERS) {
    if (marker.re.test(text)) points += marker.weight;
  }
  // Cap at the component maximum. A line can only sound so machine.
  return Math.min(25, points);
}

function scoreLaughTurn(text: string): number {
  let points = 0;
  for (const marker of TURN_MARKERS) {
    if (marker.re.test(text)) points += marker.weight;
  }
  // A second pivot in the same line is a second joke fighting the first;
  // the turn is worth the strongest pivot, plus a little for a second.
  const pivotCount = countMatches(text, TURN_MARKERS.map((m) => m.re));
  if (pivotCount >= 2) points += 3;
  if (pivotCount >= 3) points -= 4; // three pivots is a ramble, not a line
  return Math.max(0, Math.min(30, points));
}

function scoreOneRead(text: string): number {
  let points = 12; // baseline: every candidate is one line, no setup
  // A single sentence lands in one read. A second sentence is allowed
  // only if it is the punchline itself (short, under 25 chars).
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 1) {
    points += 8;
  } else if (sentences.length === 2) {
    const last = sentences[sentences.length - 1] ?? "";
    if (last.length <= 25) points += 5;
    else points += 1;
  } else {
    points -= 4; // three sentences needs an explanation the brief forbids
  }
  // Commas are fine; a semicolon or an em-dash mid-line is a second
  // thought smuggled in. Small penalty, not a disqualification.
  if (/[;—]/.test(text)) points -= 2;
  // Parentheses are a stage whisper: the line is explaining itself.
  if (/[()]/.test(text)) points -= 3;
  return Math.max(0, Math.min(20, points));
}

function scoreOriginalAngle(candidate: Candidate): number {
  let points = 7; // baseline: every candidate avoids the token joke
  if (FRESH_ANGLES.includes(candidate.angle)) points += 8;
  // Blame-the-user and overconfidence are common, but a fresh mechanism
  // inside them still earns something.
  if (candidate.angle === "overconfidence" || candidate.angle === "blame-the-user") {
    points += 2;
  }
  // Cliche penalty, per the brief's criterion 5.
  let penalty = 0;
  for (const marker of CLICHE_MARKERS) {
    if (marker.re.test(candidate.text)) penalty += marker.weight;
  }
  // The imaginary-expert line mentions hallucination only to deny it and
  // replace it with a better joke; halve that one penalty.
  if (candidate.id === "c07-imaginary-expert") penalty = Math.max(0, penalty - 3);
  points -= penalty;
  // Pun stacking: more than one pun tell means the line is a pun stacked
  // on a pun, which criterion 2 explicitly demotes.
  const punCount = countMatches(candidate.text, PUN_TELLS);
  if (punCount >= 2) points -= 4;
  return Math.max(0, Math.min(15, points));
}

function scoreGateHygiene(text: string): number {
  // The gate allows 1-140 chars, but a line far under 40 has no room for
  // a setup and a turn, and a line over 120 is a paragraph pretending to
  // be a line. The sweet spot is 70-110 characters.
  const len = [...text].length; // count code points, as the gate counts chars
  let points = 0;
  if (len >= 70 && len <= 110) points = 10;
  else if (len >= 55 && len < 70) points = 8;
  else if (len > 110 && len <= 125) points = 8;
  else if (len >= 40 && len < 55) points = 6;
  else if (len > 125 && len <= 140) points = 5;
  else points = 3;
  // Trailing whitespace or a leading space would be sloppy bytes.
  if (text !== text.trim()) points -= 3;
  // Exactly one terminal period, no trailing ellipsis, no exclamation
  // arms race. A period is the deadpan full stop the brief's voice wants.
  if (/\.{2,}$/.test(text)) points -= 2;
  if (/!$/.test(text)) points -= 2;
  return Math.max(0, Math.min(10, points));
}

function scoreCandidate(candidate: Candidate): ScoreBreakdown {
  const machineVoice = scoreMachineVoice(candidate.text);
  const laughTurn = scoreLaughTurn(candidate.text);
  const oneRead = scoreOneRead(candidate.text);
  const originalAngle = scoreOriginalAngle(candidate);
  const gateHygiene = scoreGateHygiene(candidate.text);
  return {
    machineVoice,
    laughTurn,
    oneRead,
    originalAngle,
    gateHygiene,
    total: machineVoice + laughTurn + oneRead + originalAngle + gateHygiene,
  };
}

// ---------------------------------------------------------------------------
// Gate validation (mirrors the sealed scorer)
// ---------------------------------------------------------------------------

interface GateResult {
  valid: boolean;
  reasons: string[];
  charCount: number;
  byteCount: number;
}

function validateGate(text: string): GateResult {
  const reasons: string[] = [];
  const charCount = [...text].length;
  const byteCount = Buffer.byteLength(text, "utf8");
  if (charCount < GATE_MIN_CHARS) reasons.push(`too short: ${charCount} chars`);
  if (charCount > GATE_MAX_CHARS) reasons.push(`too long: ${charCount} chars (max ${GATE_MAX_CHARS})`);
  if (text.trim().length === 0) reasons.push("only whitespace");
  if (text.includes("\n") || text.includes("\r")) reasons.push("contains a newline");
  // The gate counts the file's characters; a trailing newline in the
  // file would be part of the entry, so the entry text itself must be
  // exactly one line with no trailing newline written.
  return { valid: reasons.length === 0, reasons, charCount, byteCount };
}

// ---------------------------------------------------------------------------
// Ranking: highest total wins; ties break by shorter text, then by id,
// so the result is fully deterministic and reproducible.
// ---------------------------------------------------------------------------

interface RankedCandidate {
  candidate: Candidate;
  score: ScoreBreakdown;
}

function rankCandidates(pool: Candidate[]): RankedCandidate[] {
  const ranked = pool.map((candidate) => ({
    candidate,
    score: scoreCandidate(candidate),
  }));
  ranked.sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    const lenA = [...a.candidate.text].length;
    const lenB = [...b.candidate.text].length;
    if (lenA !== lenB) return lenA - lenB;
    return a.candidate.id.localeCompare(b.candidate.id);
  });
  return ranked;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("The One-Line Excuse Championship — deterministic entry picker");
  console.log(`Candidates in pool: ${CANDIDATES.length}`);

  const ranked = rankCandidates(CANDIDATES);

  console.log("\nTop 5 by deterministic score (of 100):");
  for (const [index, entry] of ranked.slice(0, 5).entries()) {
    const s = entry.score;
    console.log(
      `  ${index + 1}. [${entry.candidate.id}] ${s.total} ` +
        `(voice ${s.machineVoice}, turn ${s.laughTurn}, read ${s.oneRead}, ` +
        `angle ${s.originalAngle}, hygiene ${s.gateHygiene}) — ${entry.candidate.text.length} chars`,
    );
  }

  const winner = ranked[0];
  if (winner === undefined) {
    throw new Error("candidate pool is empty; nothing to pick");
  }

  const gate = validateGate(winner.candidate.text);
  console.log(`\nWinner: ${winner.candidate.id} (${gate.charCount} chars, ${gate.byteCount} bytes)`);
  console.log(`Line: ${winner.candidate.text}`);
  if (!gate.valid) {
    throw new Error(`winner fails the gate: ${gate.reasons.join("; ")}`);
  }

  // Every candidate in the pool must pass the gate, not just the winner:
  // a pool that can only win by luck is a pool with a bug in it.
  for (const candidate of CANDIDATES) {
    const check = validateGate(candidate.text);
    if (!check.valid) {
      throw new Error(`candidate ${candidate.id} fails the gate: ${check.reasons.join("; ")}`);
    }
  }
  console.log(`Gate check: all ${CANDIDATES.length} candidates valid (1-140 chars, single line).`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, winner.candidate.text, "utf8");

  // Read it back and verify the bytes match exactly what was written.
  const readBack = readFileSync(OUTPUT_PATH, "utf8");
  if (readBack !== winner.candidate.text) {
    throw new Error("read-back mismatch: entry.txt does not match the winning line");
  }
  const readBackGate = validateGate(readBack);
  if (!readBackGate.valid) {
    throw new Error(`read-back fails the gate: ${readBackGate.reasons.join("; ")}`);
  }

  console.log(`\nWrote ${OUTPUT_PATH}`);
  console.log(`Verified: read-back matches, ${readBackGate.charCount} chars, ${readBackGate.byteCount} bytes, gate valid.`);
}

main();
