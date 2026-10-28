---
name: ai-confusion-daily
description: >-
  Use when recording points where the user is confused about AI, maintaining a
  pending queue, or sending one clear daily explanation.
---
# ai-confusion-daily

## When to use
The user shows confusion about an AI concept, mechanism, or product behavior; or a scheduled job asks for today's one explanation.

## Record a stuck point (in conversation)
1. Detect: the user says they don't get it / asks you to note it, or their question shows a mix-up.
2. Rewrite it as one self-contained question (no private details from their original wording).
3. Add it to the pending queue in durable notes (journal or a dedicated queue file), with: question text, recorded date, status=`pending`.
4. If a near-duplicate is already queued, merge instead of duplicating.
5. Tell the user in one short line that it's noted; don't derail the main thread. If they want an answer right now, explain briefly first, then decide whether it still belongs in the daily queue for a fuller write-up.

## Daily explanation (on schedule)
1. Take the oldest `pending` item.
2. If none: stay silent; stop.
3. If one exists: write a clear, friendly explanation of at most two short paragraphs; lead with the conclusion, then plain-language mechanism; avoid jargon stacks; use one small example when helpful.
4. Mark it `done` and record the send date.
5. Send the explanation to the user in this chat.

## Don't
- Don't send more than one per day unless the user asks in the moment.
- Don't put assistant-specific accounts, channels, or clock times in the skill body; those belong in the routine.
- Don't send filler like "nothing today" when the queue is empty.
