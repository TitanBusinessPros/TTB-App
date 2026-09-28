$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localSecret = Join-Path $projectRoot 'functions/.secret.local'
if (Test-Path -LiteralPath $localSecret) {
    throw 'A local secret override already exists; move it before running this test.'
}

try {
    Set-Content -LiteralPath $localSecret -Value 'STRIPE_WEBHOOK_SECRET=whsec_local_trial_test' -NoNewline
    Push-Location $projectRoot
    & firebase.cmd emulators:exec --only firestore,functions 'node test/trial-webhook.test.cjs' --project team-task-board-a1fb3
    if ($LASTEXITCODE -ne 0) { throw 'The signed trial webhook test failed.' }
} finally {
    Pop-Location
    Remove-Item -LiteralPath $localSecret -ErrorAction SilentlyContinue
}
