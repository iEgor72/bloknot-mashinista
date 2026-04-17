param(
  [ValidateSet('install', 'status', 'uninstall')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'

$TaskName = 'BloknotAgentMemoryWatcher'
$StartupLauncherName = 'BloknotAgentMemoryWatcher.vbs'
$LegacyStartupLauncherName = 'BloknotAgentMemoryWatcher.cmd'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$WatchScript = Join-Path $RepoRoot 'tools\agent-memory\watch.js'
$NodeExe = (Get-Command node -ErrorAction Stop).Source
$TaskRun = "node `"$WatchScript`" --daemon"
$StartupFolder = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$StartupLauncherPath = Join-Path $StartupFolder $StartupLauncherName
$LegacyStartupLauncherPath = Join-Path $StartupFolder $LegacyStartupLauncherName

function Invoke-Schtasks([string[]]$CommandArgs, [switch]$IgnoreExitCode) {
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'

  $nativePreferenceSupported = $false
  $previousNativePreference = $null
  if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $nativePreferenceSupported = $true
    $previousNativePreference = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
  }

  try {
    $output = & schtasks.exe @CommandArgs 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    if ($nativePreferenceSupported) {
      $PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
    $ErrorActionPreference = $previousErrorPreference
  }

  if (-not $IgnoreExitCode -and $exitCode -ne 0) {
    $message = ($output | Out-String).Trim()
    if (-not $message) { $message = "schtasks exited with code $exitCode" }
    throw $message
  }

  return [PSCustomObject]@{
    Output = $output
    ExitCode = $exitCode
  }
}

function Output-ToSingleLine([object[]]$OutputLines) {
  $lines = @()
  foreach ($line in $OutputLines) {
    if ($null -eq $line) {
      continue
    }
    if ($line -is [System.Management.Automation.ErrorRecord]) {
      if ($line.Exception -and $line.Exception.Message) {
        $lines += [string]$line.Exception.Message
      }
      continue
    }
    $text = [string]$line
    if ($text.Trim()) {
      $lines += $text.Trim()
    }
  }
  return ($lines -join ' | ').Trim()
}

function Get-TaskQueryResult() {
  return Invoke-Schtasks -CommandArgs @('/Query', '/TN', $TaskName, '/FO', 'LIST', '/V') -IgnoreExitCode
}

function Get-RelevantTaskLines([object[]]$OutputLines) {
  return $OutputLines | Where-Object {
    $_ -match '^(TaskName|Task To Run|Run As User|Status|Next Run Time|Last Run Time|Last Result|Schedule Type|Start Time):'
  }
}

function Write-StartupLauncher() {
  if (-not (Test-Path -LiteralPath $StartupFolder)) {
    New-Item -ItemType Directory -Path $StartupFolder | Out-Null
  }

  if (Test-Path -LiteralPath $LegacyStartupLauncherPath) {
    Remove-Item -LiteralPath $LegacyStartupLauncherPath -Force
  }

  $runCommand = "`"$NodeExe`" `"$WatchScript`" --daemon"
  $repoRootVbs = $RepoRoot.Replace('"', '""')
  $runCommandVbs = $runCommand.Replace('"', '""')
  $content = @(
    'Set WshShell = CreateObject("WScript.Shell")',
    "WshShell.CurrentDirectory = ""$repoRootVbs""",
    "WshShell.Run ""$runCommandVbs"", 0, False"
  ) -join "`r`n"

  Set-Content -LiteralPath $StartupLauncherPath -Value $content -Encoding Ascii
}

function Remove-StartupLauncher() {
  $removed = @()
  foreach ($launcherPath in @($StartupLauncherPath, $LegacyStartupLauncherPath)) {
    if (Test-Path -LiteralPath $launcherPath) {
      Remove-Item -LiteralPath $launcherPath -Force
      $removed += $launcherPath
    }
  }
  return $removed
}

function Get-TaskStatus() {
  $taskQuery = Get-TaskQueryResult
  $startupLauncher = $null
  if (Test-Path -LiteralPath $StartupLauncherPath) {
    $startupLauncher = $StartupLauncherPath
  } elseif (Test-Path -LiteralPath $LegacyStartupLauncherPath) {
    $startupLauncher = $LegacyStartupLauncherPath
  }
  $startupInstalled = [bool]$startupLauncher

  if ($taskQuery.ExitCode -eq 0) {
    Write-Output '[memory-autostart] status: installed (task-scheduler)'
    $relevant = Get-RelevantTaskLines -OutputLines $taskQuery.Output
    if ($relevant) {
      (Output-ToSingleLine -OutputLines $relevant) | Write-Output
    }
    if ($startupInstalled) {
      Write-Output "[memory-autostart] note: startup launcher also exists: $startupLauncher"
    }
    return
  }

  if ($startupInstalled) {
    Write-Output '[memory-autostart] status: installed (startup-shortcut)'
    Write-Output "[memory-autostart] launcher: $startupLauncher"
    Write-Output "[memory-autostart] command: `"$NodeExe`" `"$WatchScript`" --daemon"
    return
  }

  Write-Output '[memory-autostart] status: not installed'
}

if ($Action -eq 'install') {
  $createResult = Invoke-Schtasks -CommandArgs @(
    '/Create',
    '/TN', $TaskName,
    '/SC', 'ONLOGON',
    '/DELAY', '0000:20',
    '/TR', $TaskRun,
    '/F'
  ) -IgnoreExitCode

  if ($createResult.ExitCode -eq 0) {
    $null = Remove-StartupLauncher
    Write-Output "[memory-autostart] installed via task scheduler: $TaskName"
    Write-Output "[memory-autostart] command: $TaskRun"
    exit 0
  }

  $createMessage = Output-ToSingleLine -OutputLines $createResult.Output
  Write-StartupLauncher
  Write-Output '[memory-autostart] scheduler install failed, fallback enabled: startup-shortcut'
  if ($createMessage) {
    Write-Output "[memory-autostart] scheduler error: $createMessage"
  }
  Write-Output "[memory-autostart] launcher: $StartupLauncherPath"
  exit 0
}

if ($Action -eq 'uninstall') {
  $removedAny = $false

  $deleteResult = Invoke-Schtasks -CommandArgs @('/Delete', '/TN', $TaskName, '/F') -IgnoreExitCode
  if ($deleteResult.ExitCode -eq 0) {
    Write-Output "[memory-autostart] removed task-scheduler entry: $TaskName"
    $removedAny = $true
  } else {
    $deleteMessage = Output-ToSingleLine -OutputLines $deleteResult.Output
    if ($deleteMessage -and $deleteMessage -notmatch 'cannot find the file specified') {
      Write-Output "[memory-autostart] warning: could not remove scheduler entry: $deleteMessage"
    }
  }

  $removedLaunchers = @(Remove-StartupLauncher)
  if ($removedLaunchers.Count -gt 0) {
    foreach ($launcherPath in $removedLaunchers) {
      Write-Output "[memory-autostart] removed startup launcher: $launcherPath"
    }
    $removedAny = $true
  }

  if (-not $removedAny) {
    Write-Output '[memory-autostart] not installed'
  }

  exit 0
}

Get-TaskStatus
