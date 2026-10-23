# Non-production replay only. Never boot, clear, uninstall, or select a target implicitly.
# Existing Maestro flows clearState: run ONLY on an explicitly disposable emulator.
param(
    [Parameter(Mandatory = $true)][ValidatePattern('^emulator-[0-9]+$')][string]$Serial,
    [Parameter(Mandatory = $true)][string]$ExpectedAvd,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$SourceSha,
    [switch]$DisposableTarget,
    [switch]$PreflightOnly
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not $DisposableTarget) { throw 'Explicit -DisposableTarget acknowledgement required. Flows reset fixture app data.' }

$Evidence = Join-Path (Get-Location) ('simulation-output/native/campaign-b/replay-' + (Get-Date -Format 'yyyyMMddTHHmmss'))
New-Item -ItemType Directory -Path $Evidence -Force | Out-Null
function Invoke-Recorded([string]$Name, [string]$File, [string[]]$Arguments) {
    $Log = Join-Path $Evidence ($Name + '.log')
    $Previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $File @Arguments *> $Log
        $Code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $Previous }
    Get-Content $Log -Tail 12
    if ($Code -ne 0) { throw "$Name exited $Code; retained $Log. Do not retry blindly." }
}

# Refuse before ADB, any native build output, or fixture modification. No bypass.
Invoke-Recorded 'resources' 'node' @('--input-type=module', '-e', "import {requireNativeResources} from './scripts/native-resource-preflight.mjs'; console.log(JSON.stringify(requireNativeResources(process.cwd(),{build:true}),null,2));")
if ($PreflightOnly) { return }
if ((git rev-parse HEAD).Trim() -ne $SourceSha) { throw 'Requested source SHA is not HEAD.' }
if (git status --porcelain=v1 --untracked-files=all) { throw 'Certification requires an entirely clean checkout.' }
# Refuse ambient backend configuration rather than silently changing the shell.
if (Get-ChildItem Env: | Where-Object { $_.Name -match '^EXPO_PUBLIC_(SUPABASE|AI_COMMAND_BACKEND|AI_COMMAND_PROXY|AI_COMMAND_SUPABASE)' }) {
    throw 'Unset ambient backend EXPO_PUBLIC_* variables in a clean shell first. Values are not printed.'
}
$Avd = (& adb -s $Serial shell getprop ro.boot.qemu.avd_name).Trim()
if ($LASTEXITCODE -ne 0 -or $Avd -ne $ExpectedAvd) { throw 'Explicit disposable AVD identity did not match; no installation or flow permitted.' }
Invoke-Recorded 'target' 'adb' @('-s', $Serial, 'shell', 'getprop')
Invoke-Recorded 'jdk' 'java' @('-version')
Invoke-Recorded 'maestro' 'maestro' @('--version')
Invoke-Recorded 'provision' 'node' @('scripts/qa-native-provision.mjs', '--serial', $Serial)
$MetadataPath = 'simulation-output/native/native-android-build.json'
Copy-Item $MetadataPath (Join-Path $Evidence 'build.json')
$Build = Get-Content $MetadataPath -Raw | ConvertFrom-Json
if ($Build.sourceSha -ne $SourceSha -or -not $Build.sourceTreeClean -or $Build.remoteConfiguration.mode -ne 'local-only') { throw 'Build provenance mismatch.' }
$Apk = (Resolve-Path $Build.apkPath).Path
if ((Get-FileHash $Apk -Algorithm SHA256).Hash -ne $Build.apkSha256) { throw 'Built APK hash mismatch.' }
$RemoteApk = (& adb -s $Serial shell pm path com.dale16.superhabits).Trim() -replace '^package:', ''
$InstalledHash = (& adb -s $Serial shell sha256sum $RemoteApk).Trim().Split(' ')[0]
if ($LASTEXITCODE -ne 0 -or $InstalledHash.ToUpperInvariant() -ne $Build.apkSha256) { throw 'Freshly installed APK differs from the build.' }
$InstalledHash | Set-Content (Join-Path $Evidence 'installed-apk-sha256.txt')
Invoke-Recorded 'package' 'adb' @('-s', $Serial, 'shell', 'dumpsys', 'package', 'com.dale16.superhabits')
Invoke-Recorded 'gradle' '.\android\gradlew.bat' @('-p', 'android', '--version')
# Existing SDK signer verifier only: this does NOT issue signing credentials.
$Signer = Join-Path $env:ANDROID_HOME 'build-tools/36.0.0/apksigner.bat'
Invoke-Recorded 'signing' $Signer @('verify', '--verbose', '--print-certs', $Apk)

$Flows = @(
    'native-smoke',
    'todo-persistence',
    'habit-persistence',
    'calories-persistence',
    'settings-persistence',
    'workout-persistence',
    'workout-gym-v2-persistence',
    'workout-gym-v2-session-lifecycle',
    'pomodoro-lifecycle',
    'pomodoro-notification-path',
    'habit-reminder-permission-denied'
)
foreach ($Flow in $Flows) {
    Invoke-Recorded $Flow 'node' @('scripts/qa-native.mjs', '--platform', 'android', '--serial', $Serial, '--no-provision', '--flow', ".maestro/flows/$Flow.yaml")
}
# This script does NOT inject SH-11 native scheduler faults, toggle system
# networking, prove tray delivery, or certify iOS. Record those rows separately.
Write-Output "Replay complete; inspect individual assertions/reports in $Evidence and simulation-output/native. No emulator was started or stopped by this script."
