# Watchdog: re-runs scrape.js whenever it exits.
# Stops after MAX_RUNS iterations or when the scraper writes DONE v5.
# Paths are anchored to this script so the watchdog works from any CWD and on
# any machine (the previous version hardcoded a Downloads folder and one
# machine's node install).
$root = $PSScriptRoot
Set-Location (Join-Path $root 'scraper')

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Write-Host "[watchdog] node not found on PATH." -ForegroundColor Red
  exit 1
}
$node = $nodeCmd.Source

$maxRuns = 30
$run = 0
while ($run -lt $maxRuns) {
  $run++
  Write-Host "[watchdog run $run] starting node scrape.js"
  & $node scrape.js 2>&1 | Out-Null
  Write-Host "[watchdog run $run] exited"

  # If progress.json says all 17 cities are done, stop.
  try {
    $prog = Get-Content (Join-Path $root 'progress.json') -Raw | ConvertFrom-Json
    if ($prog.done.Count -ge 17) {
      Write-Host "[watchdog] all cities done, stopping."
      break
    }
  } catch {}

  # Look for DONE v5 in log
  try {
    $tail = Get-Content (Join-Path $root 'run.log') -Tail 3 -ErrorAction SilentlyContinue
    if ($tail -match 'DONE v5') {
      Write-Host "[watchdog] DONE marker found, stopping."
      break
    }
  } catch {}

  Start-Sleep 4
}
Write-Host "[watchdog] finished after $run runs."
