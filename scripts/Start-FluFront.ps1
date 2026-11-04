# Restores the already-published Flu3nce frontend without rebuilding or deploying.
$ErrorActionPreference = 'Stop'

$nginxPath = 'C:\Ngix\nginx-1.28.1'
$nginxExe = Join-Path $nginxPath 'nginx.exe'
$publishedIndex = Join-Path $nginxPath 'html\index.html'

function Wait-ForKey {
    [void](Read-Host 'Presiona Enter para cerrar')
}

function Test-LocalPort([int]$port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $pending = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne(2000)) { return $false }
        $client.EndConnect($pending)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

Write-Host 'Flu3nce - levantar front local' -ForegroundColor Cyan

try {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltinRole]::Administrator
    )
    if (-not $isAdmin) {
        $powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $PSCommandPath
        Write-Host 'Solicitando permiso de administrador para iniciar Nginx...' -ForegroundColor Yellow
        Start-Process -FilePath $powerShell -ArgumentList $arguments -Verb RunAs -WindowStyle Normal
        exit 0
    }

    if (-not (Test-Path -LiteralPath $nginxExe)) { throw "No se encontro $nginxExe" }
    if (-not (Test-Path -LiteralPath $publishedIndex)) {
        throw "No se encontro el front publicado en $publishedIndex. Este acceso no compila ni despliega."
    }

    $running = Get-Process nginx -ErrorAction SilentlyContinue
    if (-not $running) {
        Push-Location $nginxPath
        try {
            & $nginxExe -t
            if ($LASTEXITCODE -ne 0) { throw 'La configuracion de Nginx no es valida.' }
            Start-Process -FilePath $nginxExe -WorkingDirectory $nginxPath -WindowStyle Hidden
        } finally {
            Pop-Location
        }
        Write-Host 'Nginx iniciado. Comprobando puertos...' -ForegroundColor Yellow
    } else {
        Write-Host 'Nginx ya estaba en ejecucion. Comprobando puertos...' -ForegroundColor Yellow
    }

    $ready = $false
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        if ((Test-LocalPort 80) -and (Test-LocalPort 443)) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
    }

    if (-not $ready) { throw 'Nginx no esta escuchando en los puertos 80 y 443. Revisa C:\Ngix\nginx-1.28.1\logs\error.log.' }

    Write-Host 'Front local disponible en https://react.bimcon.com.mx/flu' -ForegroundColor Green
    Write-Host 'Este acceso no cambia archivos ni reinicia Nginx si ya funciona.' -ForegroundColor Gray
} catch {
    Write-Host "No se pudo levantar el front: $($_.Exception.Message)" -ForegroundColor Red
}

Wait-ForKey
