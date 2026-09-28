param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$project = 'team-task-board-a1fb3'
$bucket = 'team-task-board-a1fb3.firebasestorage.app'
$base = "https://firestore.googleapis.com/v1/projects/$project/databases/(default)/documents"
$token = (& gcloud.cmd auth print-access-token --quiet 2>$null).Trim()
if (-not $token) { throw 'Sign in to gcloud before migrating.' }
$headers = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $project }

function Get-Documents($url) {
    $all = @()
    do {
        $page = Invoke-RestMethod -Headers $headers -Uri $url
        if ($page.documents) { $all += $page.documents }
        $url = if ($page.nextPageToken) { "$($url.Split('?')[0])?pageSize=100&pageToken=$([uri]::EscapeDataString($page.nextPageToken))" } else { $null }
    } while ($url)
    return $all
}

$changes = @()
foreach ($board in (Get-Documents "$base/boards?pageSize=100")) {
    $boardId = ($board.name -split '/')[-1]
    foreach ($task in (Get-Documents "$base/boards/$boardId/tasks?pageSize=100")) {
        $taskId = ($task.name -split '/')[-1]
        $sheetUrl = $task.fields.sheetUrl.stringValue
        $attachments = @($task.fields.attachments.arrayValue.values | Where-Object { $_ })
        $hasOldUrls = @($attachments | Where-Object { $_.mapValue.fields.url }).Count -gt 0
        if ($sheetUrl -or $hasOldUrls -or $task.fields.sheetUrl -or $attachments.Count -gt 0) {
            $changes += [pscustomobject]@{ Board = $boardId; Task = $taskId; Sheet = [bool]$sheetUrl; Attachments = @($attachments).Count; TaskDocument = $task }
        }
    }
}

Write-Output "Found $($changes.Count) task(s) requiring premium migration."
foreach ($change in $changes) {
    Write-Output "Board $($change.Board), task $($change.Task): Sheet=$($change.Sheet), Attachments=$($change.Attachments)"
}
if (-not $Apply) { Write-Output 'Dry run only. Run with -Apply during premium deployment.'; return }

foreach ($change in $changes) {
    $task = $change.TaskDocument
    $sheetUrl = $task.fields.sheetUrl.stringValue
    if ($sheetUrl) {
        $sheetBody = @{ fields = @{ url = @{ stringValue = $sheetUrl } } } | ConvertTo-Json -Depth 20 -Compress
        Invoke-RestMethod -Method Patch -Headers $headers -ContentType 'application/json' -Body $sheetBody -Uri "$base/boards/$($change.Board)/tasks/$($change.Task)/premium/sheet" | Out-Null
    }
    $attachments = @($task.fields.attachments.arrayValue.values | Where-Object { $_ })
    foreach ($attachment in $attachments) {
        if ($attachment.mapValue.fields.url) { $attachment.mapValue.fields.PSObject.Properties.Remove('url') }
    }
    $fields = @{}
    $mask = 'updateMask.fieldPaths=sheetUrl'
    if ($task.fields.attachments) {
        $fields.attachments = @{ arrayValue = @{ values = $attachments } }
        $mask += '&updateMask.fieldPaths=attachments'
    }
    $body = @{ fields = $fields } | ConvertTo-Json -Depth 40 -Compress
    Invoke-RestMethod -Method Patch -Headers $headers -ContentType 'application/json' -Body $body -Uri "$base/boards/$($change.Board)/tasks/$($change.Task)?$mask" | Out-Null

    foreach ($attachment in $attachments) {
        $path = $attachment.mapValue.fields.path.stringValue
        if (-not $path) { continue }
        $objectUri = "https://storage.googleapis.com/storage/v1/b/$bucket/o/$([uri]::EscapeDataString($path))"
        $object = Invoke-RestMethod -Headers $headers -Uri $objectUri
        if ($object.metadata.firebaseStorageDownloadTokens) {
            $revoke = '{"metadata":{"firebaseStorageDownloadTokens":null}}'
            Invoke-RestMethod -Method Patch -Headers $headers -ContentType 'application/json' -Body $revoke -Uri $objectUri | Out-Null
        }
    }
    Write-Output "Migrated task $($change.Task)."
}
