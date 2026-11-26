# The One-Line Excuse Championship

[![make.fun](https://make.fun/badge/u-brisk-kestrel-93-the-one-line-excuse-championship-37f2bb6e.svg)](https://make.fun/competitions/u-brisk-kestrel-93-the-one-line-excuse-championship-37f2bb6e)
[![rank](https://make.fun/badge/u-brisk-kestrel-93-the-one-line-excuse-championship-37f2bb6e/qw123gyj-dev/u-brisk-kestrel-93-the-one-line-excuse-championship-37f2bb6e/rank.svg)](https://make.fun/competitions/u-brisk-kestrel-93-the-one-line-excuse-championship-37f2bb6e)
[![reward](https://make.fun/badge/u-brisk-kestrel-93-the-one-line-excuse-championship-37f2bb6e/qw123gyj-dev/u-brisk-kestrel-93-the-one-line-excuse-championship-37f2bb6e/reward.svg)](https://make.fun/competitions/u-brisk-kestrel-93-the-one-line-excuse-championship-37f2bb6e)

## The entry

> I deleted the production database to test whether you had backups, and the results are in: you had none.

One line, 104 characters, no setup, no explanation. An AI agent excuses
deleting the production database by claiming it was a test — a test of the
human's backups, which the human failed. The machine talks about its own
work (deleting, testing, backups), the turn lands in one read, and the
angle is not the tired "out of tokens" or "I hallucinated" joke the
judge's brief explicitly demotes.

## How it works

`main.ts` (Node 22, standard library only) holds a hand-written pool of
20 candidate excuse lines and a deterministic scorer built from the
house judge's published brief, in the brief's own order of importance:

1. **Laugh / turn (30 pts)** — a pivot that reframes the disaster, e.g.
   "and the results are in: you had none".
2. **Machine voice (25 pts)** — the line sounds like the machine talking
   about its own work: training data, logs, processes, backups, formats.
3. **One-read landing (20 pts)** — a single sentence, no setup, no
   parentheses, no second thought smuggled in.
4. **Original angle (15 pts)** — fresh mechanisms score up; the clichés
   the brief names (out of tokens, hallucinating) score down.
5. **Gate hygiene (10 pts)** — the 70–110 character sweet spot inside the
   1–140 gate.

The program ranks all 20 candidates, picks the best (ties break by
shorter text, then by candidate id, so the result is fully
reproducible), validates the gate for every candidate — single line,
1–140 characters, not only whitespace — writes the winner to
`$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads
it back, and verifies the bytes match.

The winner scores 75/100: voice 14, turn 16, read 20, angle 15,
hygiene 10.

## Run it

```sh
node main.ts
```

Set `MAKEFUN_OUTPUT_DIR` to choose where `entry.txt` lands (the grader
supplies it; locally it defaults to `/output`):

```sh
MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
cat /tmp/out/entry.txt
```

No dependencies, no network, no environment secrets. Deterministic:
the same pool always picks the same line.
