Add-Type -AssemblyName System.Drawing
$src = Join-Path $PSScriptRoot "..\..\admin\static\favicon.png"
$pub = Join-Path $PSScriptRoot "..\public"

function Export-SquareIcon {
  param([string]$Dest, [int]$Size)
  $img = [System.Drawing.Image]::FromFile($src)
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::FromArgb(10, 10, 10))
  $scale = [Math]::Min($Size / $img.Width, $Size / $img.Height) * 0.92
  $nw = [int]($img.Width * $scale)
  $nh = [int]($img.Height * $scale)
  $x = [int](($Size - $nw) / 2)
  $y = [int](($Size - $nh) / 2)
  $g.DrawImage($img, $x, $y, $nw, $nh)
  $bmp.Save($Dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  $img.Dispose()
}

Export-SquareIcon -Dest (Join-Path $pub "favicon.png") -Size 192
Export-SquareIcon -Dest (Join-Path $pub "apple-touch-icon.png") -Size 180
Export-SquareIcon -Dest (Join-Path $pub "pwa-icon-192.png") -Size 192
Export-SquareIcon -Dest (Join-Path $pub "pwa-icon-512.png") -Size 512
Write-Host "Wrote shop icons from admin favicon."
