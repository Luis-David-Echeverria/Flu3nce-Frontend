# Official production entry point for Luis-David-Echeverria/Flu3nce-Frontend.
[CmdletBinding()]
param(
    [string]$NginxPath = 'C:\Ngix\nginx-1.28.1',
    [int]$KeepBackups = 9999
)
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $frontendRoot
try {
    $repository = (& git remote get-url origin).Trim().TrimEnd('/') -replace '\.git$', ''
    if ($LASTEXITCODE -ne 0 -or $repository -ine 'https://github.com/Luis-David-Echeverria/Flu3nce-Frontend') {
        throw 'La publicacion debe salir del repositorio Luis-David-Echeverria/Flu3nce-Frontend.'
    }
    $branch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw 'Publica desde main despues de integrar y verificar el PR.' }
    $pending = & git status --porcelain
    if ($LASTEXITCODE -ne 0 -or $pending) { throw 'Guarda e integra los cambios antes de publicar. La copia de produccion debe estar limpia.' }
    & npm run verify:production
    if ($LASTEXITCODE -ne 0) { throw 'La verificacion de produccion fallo. No se publico ningun archivo.' }
    & (Join-Path $frontendRoot 'deploy-local.ps1') -SkipBuild -NginxPath $NginxPath -KeepBackups $KeepBackups
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo completar la publicacion en Nginx.' }
} finally { Pop-Location }
