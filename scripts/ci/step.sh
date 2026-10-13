#!/usr/bin/env bash
# Run one step of the data refresh, record how it went, and decide whether the
# job may carry on.
#
#   scripts/ci/step.sh [--required] "Label" command args...
#
# Replaces `continue-on-error: true`, which kept every run green for a month
# while every Claude call failed with 401. Now:
#   - success                 → a row in the job summary.
#   - ordinary failure        → a ::warning:: and a summary row, and the job
#                               carries on: an ESPN outage must not cost the
#                               moves pipeline, or the other way round.
#   - exit 3 (CONFIG_EXIT in scripts/lib/claude.mts: bad key, bad model id,
#     invalid request), or any failure of a --required step
#                               → an ::error::, a summary row, and a mark in
#                               $RUNNER_TEMP/fatal. The job carries on so the
#                               data that DID refresh is still committed, and
#                               the last step fails the run.
#
# Always exits 0 itself; the decision is made at the end of the job.

set -u
required=0
if [ "${1:-}" = "--required" ]; then required=1; shift; fi
label=$1
shift

summary=${GITHUB_STEP_SUMMARY:-/dev/null}
fatal=${RUNNER_TEMP:-/tmp}/fatal

"$@"
rc=$?

if [ $rc -eq 0 ]; then
  echo "| $label | ok |" >> "$summary"
elif [ $rc -eq 3 ]; then
  echo "::error title=$label::The Anthropic API rejected the key or the request — see the log. Nothing will be written by Claude until it is fixed."
  echo "| $label | **failed: API key or request rejected** |" >> "$summary"
  echo "$label" >> "$fatal"
elif [ $required -eq 1 ]; then
  echo "::error title=$label::failed (exit $rc)"
  echo "| $label | **failed (exit $rc)** |" >> "$summary"
  echo "$label" >> "$fatal"
else
  echo "::warning title=$label::failed (exit $rc) — the rest of the refresh continues"
  echo "| $label | failed (exit $rc), carried on |" >> "$summary"
fi
exit 0
