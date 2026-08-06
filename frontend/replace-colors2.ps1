$replacements = @(
  # Remaining hardcoded blue in class names and text
  @{ old = 'bg-blue-600'; new = 'bg-red-700' },
  @{ old = 'bg-blue-500'; new = 'bg-red-600' },
  @{ old = 'text-blue-400'; new = 'text-red-300' },
  @{ old = 'text-blue-500'; new = 'text-red-400' },
  @{ old = 'text-blue-600'; new = 'text-red-600' },
  @{ old = 'text-blue-700'; new = 'text-red-700' },
  @{ old = 'border-blue-400'; new = 'border-red-400' },
  @{ old = 'border-blue-500'; new = 'border-red-500' },
  @{ old = 'border-blue-600'; new = 'border-red-600' },
  @{ old = 'hover:bg-blue-600'; new = 'hover:bg-red-700' },
  @{ old = 'hover:bg-blue-500'; new = 'hover:bg-red-600' },
  @{ old = 'hover:text-blue-400'; new = 'hover:text-red-300' },
  @{ old = 'hover:text-blue-500'; new = 'hover:text-red-400' },
  @{ old = 'hover:text-blue-600'; new = 'hover:text-red-600' },
  @{ old = 'hover:border-blue-400'; new = 'hover:border-red-400' },
  @{ old = 'hover:border-blue-500'; new = 'hover:border-red-500' },
  @{ old = 'hover:border-blue-600'; new = 'hover:border-red-600' },
  @{ old = 'bg-blue-600/20'; new = 'bg-red-700/20' },
  @{ old = 'hover:bg-blue-600/20'; new = 'hover:bg-red-700/20' },
  @{ old = 'border-blue-600/50'; new = 'border-red-700/50' },
  @{ old = 'hover:border-blue-600/50'; new = 'hover:border-red-700/50' },
  @{ old = 'via-blue-600'; new = 'via-red-700' },
  @{ old = 'bg-blue-50'; new = 'bg-red-50' },
  @{ old = 'bg-blue-100'; new = 'bg-red-100' },
  @{ old = 'border-blue-200'; new = 'border-red-200' },
  @{ old = 'border-blue-300'; new = 'border-red-300' },
  @{ old = 'hover:border-blue-300'; new = 'hover:border-red-300' },
  @{ old = 'hover:bg-blue-50'; new = 'hover:bg-red-50' },
  @{ old = 'bg-blue-50/50'; new = 'bg-red-50/50' },
  @{ old = 'hover:bg-blue-50/50'; new = 'hover:bg-red-50/50' },
  @{ old = 'text-[#1a56db]'; new = 'text-[#c62828]' },
  @{ old = 'bg-[#eff6ff]'; new = 'bg-[#fff5f5]' },
  @{ old = 'border-[#1a56db]'; new = 'border-[#c62828]' },
  @{ old = 'border-[#3b82f6]'; new = 'border-[#ef5350]' },
  @{ old = "accent-blue-600"; new = "accent-red-600" },
  @{ old = 'focus:border-blue-500'; new = 'focus:border-red-500' },
  @{ old = 'focus:ring-blue'; new = 'focus:ring-red' }
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
