Add-Type -AssemblyName System.Drawing

$publicDir = Join-Path $PSScriptRoot "..\public"
$iconsDir = Join-Path $publicDir "icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
}

$sourcePath = Join-Path $PSScriptRoot "..\src\assets\logo.jpeg"
Copy-Item $sourcePath (Join-Path $publicDir "logo.jpeg") -Force

$img = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))

function Resize-And-Save($srcImg, [int]$w, [int]$h, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($srcImg, 0, 0, $w, $h)
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated $outPath"
}

Resize-And-Save $img 16 16 (Join-Path $publicDir "favicon-16x16.png")
Resize-And-Save $img 32 32 (Join-Path $publicDir "favicon-32x32.png")
Resize-And-Save $img 180 180 (Join-Path $publicDir "apple-touch-icon.png")
Resize-And-Save $img 192 192 (Join-Path $iconsDir "icon-192.png")
Resize-And-Save $img 512 512 (Join-Path $iconsDir "icon-512.png")
Resize-And-Save $img 192 192 (Join-Path $iconsDir "icon-192-maskable.png")
Resize-And-Save $img 512 512 (Join-Path $iconsDir "icon-512-maskable.png")

$img.Dispose()
Write-Host "All icons generated successfully!"
