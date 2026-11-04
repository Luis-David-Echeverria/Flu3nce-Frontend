<#
.SYNOPSIS
    Compila el front y publica el dist/ en el nginx LOCAL de esta maquina.

.DESCRIPTION
    Reemplazo directo de actualizar-react-local.ps1 (el de servidor). NO usa ZIP ni
    la carpeta Downloads: toma el dist/ de este mismo repo y lo copia al html de
    nginx (C:\Ngix\nginx-1.28.1\html), con respaldo con timestamp y reinicio
    validado de nginx.

    Se compila con `npm run build`: primero valida TypeScript y despues genera el
    bundle de Vite. Si cualquiera de los dos pasos falla, no se publica nada.

.PARAMETER SkipBuild
    Omite la compilacion y publica el dist/ que ya exista.

.PARAMETER NginxPath
    Ruta de la instalacion de nginx. Default: C:\Ngix\nginx-1.28.1

.PARAMETER KeepBackups
    Cuantos respaldos html.backup.* conservar (borra los mas viejos). Default: 5.

.EXAMPLE
    .\deploy-local.ps1                # compila y despliega
    .\deploy-local.ps1 -SkipBuild     # despliega el dist/ actual sin recompilar

.NOTES
    Ejecutar en PowerShell como ADMINISTRADOR (escribe en C:\Ngix y controla nginx).
#>
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [string]$NginxPath = "C:\Ngix\nginx-1.28.1",
    [int]$KeepBackups = 5
)

$ErrorActionPreference = "Stop"

$RepoRoot     = $PSScriptRoot
$DistPath     = Join-Path $RepoRoot "dist"
$NginxExe     = Join-Path $NginxPath "nginx.exe"
$HtmlPath     = Join-Path $NginxPath "html"

# Impide publicar por error un checkout del repositorio anterior.
$RepositoryUrl = (& git -C $RepoRoot remote get-url origin).Trim().TrimEnd('/') -replace '\.git$', ''
if ($LASTEXITCODE -ne 0 -or $RepositoryUrl -ine 'https://github.com/Luis-David-Echeverria/Flu3nce-Frontend') {
    throw 'El origen de produccion es Luis-David-Echeverria/Flu3nce-Frontend.'
}
$NginxPath = [IO.Path]::GetFullPath($NginxPath).TrimEnd('\')
$NginxExe = Join-Path $NginxPath 'nginx.exe'
$HtmlPath = Join-Path $NginxPath 'html'

function Info($m) { Write-Host $m -ForegroundColor Gray }
function Ok($m)   { Write-Host "     $m" -ForegroundColor Green }
function Warn($m) { Write-Host "     $m" -ForegroundColor Yellow }

# Si nginx quedo abajo (p.ej. tras detenerlo y fallar antes de re-arrancarlo), lo
# vuelve a levantar: nunca dejar el sitio caido por un error del script.
function Ensure-NginxUp {
    if (-not (Test-Path $NginxExe)) { return }
    if (-not (Get-Process nginx -ErrorAction SilentlyContinue)) {
        Write-Host "     Levantando nginx para no dejar el sitio caido..." -ForegroundColor Yellow
        Start-Process -FilePath $NginxExe -WorkingDirectory $NginxPath -WindowStyle Hidden
    }
}

function Die($m)  { Write-Host "     ERROR: $m" -ForegroundColor Red; Ensure-NginxUp; exit 1 }

# Red de seguridad ante cualquier error terminante inesperado.
trap {
    Write-Host "`n[ERROR inesperado] $($_.Exception.Message)" -ForegroundColor Red
    Ensure-NginxUp
    exit 1
}

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  DEPLOY LOCAL - front -> nginx ($NginxPath)" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Aviso si no es admin (escribir en C:\Ngix suele requerirlo) ──
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
if (-not $isAdmin) {
    Warn "No estas como Administrador. Si falla al copiar/reiniciar nginx, reabre PowerShell como admin."
    Write-Host ""
}

# ============================================================================
# [1/6] COMPILAR (vite build)
# ============================================================================
Write-Host "[1/6] Compilando el front..." -ForegroundColor Yellow
if ($SkipBuild) {
    Info "     -SkipBuild: se usa el dist/ existente."
} else {
    Push-Location $RepoRoot
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { Die "npm run build fallo (codigo $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
    Ok "Build completado"
}
Write-Host ""

# ============================================================================
# [2/6] VALIDAR RUTAS
# ============================================================================
Write-Host "[2/6] Validando dist/ y nginx..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $DistPath "index.html"))) {
    Die "No hay dist/index.html en $DistPath. Compila primero (quita -SkipBuild)."
}
Ok "dist/ valido"
if (-not (Test-Path $NginxExe)) { Die "nginx.exe no encontrado en $NginxExe" }
Ok "nginx.exe encontrado"

$releaseCommit = (& git -C $RepoRoot rev-parse HEAD).Trim()
$releaseBranch = (& git -C $RepoRoot branch --show-current).Trim()
$releaseContract = (& git -C (Join-Path $RepoRoot 'contract') rev-parse HEAD).Trim()
@{
    repository = $RepositoryUrl
    branch = $releaseBranch
    commit = $releaseCommit
    contract = $releaseContract
    publishedAt = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DistPath 'frontend-release.json') -Encoding UTF8
Write-Host ""

# ============================================================================
# [3/6] DETENER NGINX (si corre)
# ============================================================================
Write-Host "[3/6] Deteniendo nginx (si esta corriendo)..." -ForegroundColor Yellow
$nginxProc = Get-Process nginx -ErrorAction SilentlyContinue
if ($nginxProc) {
    Push-Location $NginxPath
    try { & $NginxExe -s stop | Out-Null } catch {} finally { Pop-Location }
    Start-Sleep -Seconds 2
    # Si algun worker quedo vivo, forzar.
    $still = Get-Process nginx -ErrorAction SilentlyContinue
    if ($still) { $still | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1 }
    Ok "nginx detenido"
} else {
    Info "     nginx no estaba corriendo"
}
Write-Host ""

# ============================================================================
# [4/6] RESPALDAR html ACTUAL Y COPIAR dist/
# ============================================================================
Write-Host "[4/6] Respaldando y publicando..." -ForegroundColor Yellow
$BackupPath = "N/A"
if (Test-Path $HtmlPath) {
    $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
    $BackupName = "html.backup.$ts"
    $BackupPath = Join-Path $NginxPath $BackupName
    Rename-Item -LiteralPath $HtmlPath -NewName $BackupName
    Ok "Respaldo: $BackupPath"
} else {
    Info "     No habia html previo (primera vez)"
}

New-Item -ItemType Directory -Path $HtmlPath -Force | Out-Null
Get-ChildItem -Path $DistPath -Force | Copy-Item -Destination $HtmlPath -Recurse -Force
$copied = (Get-ChildItem -Path $HtmlPath -Force | Measure-Object).Count
Ok "Publicados $copied items en html/"

# Poda de respaldos viejos
$backups = Get-ChildItem -Path $NginxPath -Directory -Filter "html.backup.*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending
if ($backups.Count -gt $KeepBackups) {
    $backups | Select-Object -Skip $KeepBackups | ForEach-Object {
        $backupTarget = [IO.Path]::GetFullPath($_.FullName)
        if (-not $backupTarget.StartsWith($NginxPath + '\', [StringComparison]::OrdinalIgnoreCase) -or $_.Name -notmatch '^html\.backup\.\d{8}-\d{6}$') {
            throw "Respaldo fuera del destino autorizado: $backupTarget"
        }
        Remove-Item -LiteralPath $backupTarget -Recurse -Force -ErrorAction SilentlyContinue
        Info "     Respaldo viejo eliminado: $($_.Name)"
    }
}
Write-Host ""

# ============================================================================
# [5/6] VALIDAR CONFIG E INICIAR NGINX
# ============================================================================
Write-Host "[5/6] Validando config e iniciando nginx..." -ForegroundColor Yellow
Push-Location $NginxPath
try {
    # nginx -t escribe su resultado por STDERR (normal). Con 2>&1 y EAP=Stop,
    # PowerShell 5.1 lo trata como error terminante aunque la config sea valida:
    # se baja EAP a Continue solo para esta llamada y se juzga por $LASTEXITCODE.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $testOut = & $NginxExe -t 2>&1
    $testExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP
    if ($testExit -ne 0) {
        Write-Host ($testOut | Out-String) -ForegroundColor Red
        Die "nginx -t fallo. Se conservo el respaldo en $BackupPath"
    }
    Ok "nginx.conf valido"
    # Start-Process (no '& nginx.exe'): '&' se queda esperando al master y cuelga.
    Start-Process -FilePath $NginxExe -WorkingDirectory $NginxPath -WindowStyle Hidden
    Start-Sleep -Seconds 2
} finally {
    Pop-Location
}
Ok "nginx iniciado"
Write-Host ""

# ============================================================================
# [6/6] VERIFICACION
# ============================================================================
Write-Host "[6/6] Verificacion..." -ForegroundColor Yellow
if (Test-Path (Join-Path $HtmlPath "index.html")) { Ok "index.html presente" } else { Warn "index.html NO encontrado" }
if (Test-Path (Join-Path $HtmlPath "assets"))     { Ok "assets/ presente" }     else { Warn "assets/ NO encontrado" }
$running = Get-Process nginx -ErrorAction SilentlyContinue
if ($running) { Ok "nginx en ejecucion (PID $($running[0].Id))" } else { Warn "nginx no aparece en ejecucion" }
$port443 = netstat -ano | Select-String ":443\s" | Select-String "LISTENING"
if ($port443) { Ok "Escuchando en 443 (HTTPS)" } else { Warn "No se detecto 443 LISTENING (puede tardar en levantar)" }
Write-Host ""

Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  LISTO. Front actualizado en $HtmlPath" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Verifica:   https://react.bimcon.com.mx  (Ctrl+F5 para saltar cache)" -ForegroundColor White
Write-Host "  Rollback:   nginx -s stop; borra html; renombra $BackupPath a html; nginx" -ForegroundColor Gray
Write-Host ""
