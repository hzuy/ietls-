$replacements = @(
  @{ old = '#2563EB'; new = '#E53935' },
  @{ old = '#2563eb'; new = '#E53935' },
  @{ old = '#1D4ED8'; new = '#C62828' },
  @{ old = '#1d4ed8'; new = '#C62828' },
  @{ old = '#3B82F6'; new = '#EF5350' },
  @{ old = '#3b82f6'; new = '#EF5350' },
  @{ old = '#60A5FA'; new = '#EF9A9A' },
  @{ old = '#93C5FD'; new = '#FFCDD2' },
  @{ old = '#DBEAFE'; new = '#FFCDD2' },
  @{ old = '#EFF6FF'; new = '#FFF5F5' },
  @{ old = '#EBF2FF'; new = '#FFEBEE' },
  @{ old = '#C2D7FF'; new = '#FFCDD2' },
  @{ old = '#0B2345'; new = '#7f0000' },
  @{ old = '#0F2247'; new = '#7f0000' },
  @{ old = '#0A1628'; new = '#1a0000' },
  @{ old = '#0C1E3C'; new = '#3e0000' },
  @{ old = '#185FA5'; new = '#B71C1C' },
  @{ old = '#1a56db'; new = '#c62828' },
  @{ old = 'rgba(37,99,235'; new = 'rgba(229,57,53' },
  @{ old = 'rgba(29,78,216'; new = 'rgba(198,40,40' }
)

$files = Get-ChildItem -Path 'src' -Recurse -Include '*.jsx','*.css','*.js' | Where-Object { $_.FullName -notmatch 'node_modules' }

foreach ($file in $files) {
  $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
  $modified = $false
  foreach ($r in $replacements) {
    if ($content.Contains($r.old)) {
      $content = $content.Replace($r.old, $r.new)
      $modified = $true
    }
  }
  if ($modified) {
    [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
    Write-Host "Updated: $($file.Name)"
  }
}
Write-Host "Done!"
