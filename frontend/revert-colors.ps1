# Revert ALL color changes: red/dark-red back to original blue/navy
$replacements = @(
  # CSS hex colors — red back to blue
  @{ old = '#E53935'; new = '#2563EB' },
  @{ old = '#C62828'; new = '#1D4ED8' },
  @{ old = '#c62828'; new = '#1D4ED8' },
  @{ old = '#B71C1C'; new = '#185FA5' },
  @{ old = '#EF5350'; new = '#3B82F6' },
  @{ old = '#EF9A9A'; new = '#60A5FA' },
  @{ old = '#FFCDD2'; new = '#DBEAFE' },
  @{ old = '#FFEBEE'; new = '#EBF2FF' },
  @{ old = '#ffebee'; new = '#ebf2ff' },
  @{ old = '#FFF5F5'; new = '#EFF6FF' },
  @{ old = '#fff5f5'; new = '#eff6ff' },
  @{ old = '#7f0000'; new = '#0B2345' },
  @{ old = '#1a0000'; new = '#0A1628' },
  @{ old = '#3e0000'; new = '#0C1E3C' },
  @{ old = '#5c0000'; new = '#0D1F45' },
  @{ old = 'rgba(229,57,53'; new = 'rgba(37,99,235' },
  @{ old = 'rgba(198,40,40'; new = 'rgba(29,78,216' },

  # Tailwind class replacements — red back to blue
  @{ old = 'bg-red-700'; new = 'bg-blue-600' },
  @{ old = 'bg-red-600'; new = 'bg-blue-500' },
  @{ old = 'text-red-300'; new = 'text-blue-400' },
  @{ old = 'text-red-400'; new = 'text-blue-500' },
  @{ old = 'text-red-600'; new = 'text-blue-600' },
  @{ old = 'text-red-700'; new = 'text-blue-700' },
  @{ old = 'border-red-400'; new = 'border-blue-400' },
  @{ old = 'border-red-500'; new = 'border-blue-500' },
  @{ old = 'border-red-600'; new = 'border-blue-600' },
  @{ old = 'hover:bg-red-700'; new = 'hover:bg-blue-600' },
  @{ old = 'hover:bg-red-600'; new = 'hover:bg-blue-500' },
  @{ old = 'hover:text-red-300'; new = 'hover:text-blue-400' },
  @{ old = 'hover:text-red-400'; new = 'hover:text-blue-500' },
  @{ old = 'hover:text-red-600'; new = 'hover:text-blue-600' },
  @{ old = 'hover:border-red-400'; new = 'hover:border-blue-400' },
  @{ old = 'hover:border-red-500'; new = 'hover:border-blue-500' },
  @{ old = 'hover:border-red-600'; new = 'hover:border-blue-600' },
  @{ old = 'bg-red-700/20'; new = 'bg-blue-600/20' },
  @{ old = 'hover:bg-red-700/20'; new = 'hover:bg-blue-600/20' },
  @{ old = 'border-red-700/50'; new = 'border-blue-600/50' },
  @{ old = 'hover:border-red-700/50'; new = 'hover:border-blue-600/50' },
  @{ old = 'via-red-700'; new = 'via-blue-600' },
  @{ old = 'bg-red-50'; new = 'bg-blue-50' },
  @{ old = 'bg-red-100'; new = 'bg-blue-100' },
  @{ old = 'border-red-200'; new = 'border-blue-200' },
  @{ old = 'border-red-300'; new = 'border-blue-300' },
  @{ old = 'hover:border-red-300'; new = 'hover:border-blue-300' },
  @{ old = 'hover:bg-red-50'; new = 'hover:bg-blue-50' },
  @{ old = 'bg-red-50/50'; new = 'bg-blue-50/50' },
  @{ old = 'hover:bg-red-50/50'; new = 'hover:bg-blue-50/50' },
  @{ old = 'text-[#c62828]'; new = 'text-[#1a56db]' },
  @{ old = 'bg-[#fff5f5]'; new = 'bg-[#eff6ff]' },
  @{ old = 'border-[#c62828]'; new = 'border-[#1a56db]' },
  @{ old = 'border-[#ef5350]'; new = 'border-[#3b82f6]' },
  @{ old = 'accent-red-600'; new = 'accent-blue-600' },
  @{ old = 'focus:border-red-500'; new = 'focus:border-blue-500' },
  @{ old = 'focus:ring-red'; new = 'focus:ring-blue' },
  # Social icon hover (footer) - keep blue as it was restored correctly already
  @{ old = 'hover:bg-blue-500/20'; new = 'hover:bg-blue-600/20' },
  @{ old = 'hover:border-blue-400/50'; new = 'hover:border-blue-600/50' },
  @{ old = 'hover:text-blue-300'; new = 'hover:text-blue-400' }
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
    Write-Host "Reverted: $($file.Name)"
  }
}
Write-Host "Done!"
