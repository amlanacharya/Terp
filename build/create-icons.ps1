# PowerShell script to create minimal valid icon files for development testing
# These are basic placeholders - replace with real icons before production

Add-Type -AssemblyName System.Drawing

# Create a 256x256 icon (required by electron-builder)
$size = 256
$bitmap = New-Object System.Drawing.Bitmap $size, $size
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Background: dark blue
$graphics.Clear([System.Drawing.Color]::FromArgb(30, 58, 138))

# Draw a white circle
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.FillEllipse($brush, 40, 40, 176, 176)

# Draw "T" letter in dark blue
$font = New-Object System.Drawing.Font("Arial", 100, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 58, 138))
$graphics.DrawString("T", $font, $textBrush, 68, 60)

$font.Dispose()
$textBrush.Dispose()
$brush.Dispose()
$graphics.Dispose()

# Save PNG first, then convert to ICO
$pngPath = [System.IO.Path]::Combine($PSScriptRoot, "icon.png")
$icoPath = [System.IO.Path]::Combine($PSScriptRoot, "icon.ico")
$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Convert PNG to ICO using BinaryWriter
$pngBytes = [System.IO.File]::ReadAllBytes($pngPath)
$pngSize = $pngBytes.Length

$stream = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$writer = New-Object System.IO.BinaryWriter($stream)

# ICO header
$writer.Write([UInt16]0)       # Reserved
$writer.Write([UInt16]1)       # Type: 1 = ICO
$writer.Write([UInt16]1)       # Number of images

# Directory entry for 256x256
$writer.Write([Byte]0)         # Width: 0 means 256
$writer.Write([Byte]0)         # Height: 0 means 256
$writer.Write([Byte]0)         # Color count
$writer.Write([Byte]0)         # Reserved
$writer.Write([UInt16]1)       # Color planes
$writer.Write([UInt16]32)      # Bits per pixel
$writer.Write([UInt32]$pngSize) # Size of image data
$writer.Write([UInt32]22)      # Offset to image data (6 header + 16 dir entry)

# Write PNG data directly (ICO supports embedded PNG for 256x256)
$writer.Write($pngBytes)

$writer.Close()
$stream.Close()
$bitmap.Dispose()

# Clean up temp png
Remove-Item $pngPath -ErrorAction SilentlyContinue

Write-Host "Created 256x256 icon.ico (development placeholder)"

# Create a minimal background.png
$bgBitmap = New-Object System.Drawing.Bitmap 800, 600
$bgGraphics = [System.Drawing.Graphics]::FromImage($bgBitmap)
$bgGraphics.Clear([System.Drawing.Color]::FromArgb(240, 240, 240))
$bgGraphics.DrawString("TravelERP Lite", [System.Drawing.Font]::new("Arial", 24), [System.Drawing.Brushes]::Black, 250, 275)
$bgGraphics.Dispose()
$bgBitmap.Save("background.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bgBitmap.Dispose()

Write-Host "Created minimal background.png (development placeholder)"

# Copy icon.ico as installer-icon.ico
Copy-Item "icon.ico" "installer-icon.ico"
Write-Host "Created installer-icon.ico (copy of icon.ico)"
