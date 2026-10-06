# Veritabanı yapısının (tablolar, view'lar, fonksiyonlar, trigger'lar,
# RLS kuralları ve yetkiler) yedeğini supabase/schema.sql dosyasına alır.
# Veri (öğrenci, tahsilat kayıtları vb.) ALINMAZ; yalnız yapı alınır.
#
# Kullanım (proje klasöründe):
#   npm run db:schema
#
# Yalnız veritabanı şifresi sorulur (yazarken görünmez).
# Şifre: Supabase > Database > Settings > Database password

$ErrorActionPreference = 'Stop'

# Supabase "Session pooler" bağlantı bilgileri (gizli değildir)
$dbHost = 'aws-0-eu-west-1.pooler.supabase.com'
$dbPort = '5432'
$dbName = 'postgres'
$dbUser = 'postgres.sttqkngamecprvganfcy'

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue

if ($pgDump) {
  $pgDumpPath = $pgDump.Source
} else {
  $installed = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1

  if (-not $installed) {
    throw 'pg_dump bulunamadı. PostgreSQL kurulumunu kontrol edin.'
  }

  $pgDumpPath = $installed.FullName
}

$securePassword = Read-Host 'Veritabanı şifresi' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

if (-not $env:PGPASSWORD) {
  throw 'Şifre girilmedi.'
}

$root = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $root 'supabase\schema.sql'

try {
  & $pgDumpPath `
    --host=$dbHost `
    --port=$dbPort `
    --username=$dbUser `
    --dbname=$dbName `
    --schema-only `
    --no-owner `
    --schema=public `
    --schema=private `
    --file=$outFile

  if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'Yedek alınamadı. "password authentication failed" yazıyorsa şifre yanlıştır;' -ForegroundColor Red
    Write-Host 'Supabase > Database > Settings sayfasından şifreyi yenileyip tekrar deneyin.' -ForegroundColor Red
    exit 1
  }

  Write-Host "Veritabanı yapısı kaydedildi: $outFile" -ForegroundColor Green
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
