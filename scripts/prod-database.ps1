# Mise en ligne de la base Supabase (projet gestion-location-vehicules).
# NE RIEN TAPER DANS CE FICHIER. Le mot de passe de la base se saisit dans le TERMINAL, a
# l'invite (masque), jamais ici, et ne passe jamais par l'assistant. Le script fait, dans l'ordre :
#   1. une sauvegarde complete (structure + donnees) dans C:\Users\imdad\sauvegarde-fima
#   2. la liste des migrations deja appliquees en ligne
#   3. une simulation (dry-run) des migrations a appliquer
#   4. UNIQUEMENT si vous tapez "oui" : l'application reelle des migrations
# Prerequis : Docker Desktop lance (utilise par la sauvegarde).

param([switch]$SansSauvegarde)

$ErrorActionPreference = 'Stop'
$ref = 'zkhpdpixwlimqnwublab'
$pooler = 'aws-0-eu-west-2.pooler.supabase.com'
$folder = Join-Path 'C:\Users\imdad\sauvegarde-fima' (Get-Date -Format 'yyyy-MM-dd_HHmm')
Set-Location (Join-Path $PSScriptRoot '..\supabase')

$secure = Read-Host 'Mot de passe de la base Supabase (saisie masquee)' -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$encoded = [Uri]::EscapeDataString($password)
$db = "postgresql://postgres.${ref}:${encoded}@${pooler}:5432/postgres"

if ($SansSauvegarde) {
  Write-Host "`n1/4  Sauvegarde deja faite (voir C:\Users\imdad\sauvegarde-fima) : etape ignoree" -ForegroundColor Yellow
} else {
  New-Item -ItemType Directory -Force $folder | Out-Null
  Write-Host "`n1/4  Sauvegarde dans $folder" -ForegroundColor Cyan
  npx supabase db dump --db-url $db -f (Join-Path $folder 'structure.sql')
  npx supabase db dump --db-url $db --data-only -f (Join-Path $folder 'donnees.sql')
  Write-Host 'Sauvegarde terminee. Les fichiers photos/documents (Storage) ne sont pas modifies par les migrations.' -ForegroundColor Green
}

# Une commande native qui echoue ne declenche pas 'Stop' : on controle le code de sortie.
function Assert-Ok($what) {
  if ($LASTEXITCODE -ne 0) {
    Write-Host "`nECHEC ($what) : le mot de passe est probablement incorrect. Rien n'a ete applique. Script arrete." -ForegroundColor Red
    exit 1
  }
}

Write-Host "`n2/4  Migrations deja appliquees en ligne" -ForegroundColor Cyan
npx supabase migration list --db-url $db
Assert-Ok 'liste des migrations'

Write-Host "`n3/4  Simulation des migrations a appliquer (rien n'est ecrit)" -ForegroundColor Cyan
npx supabase db push --db-url $db --dry-run
Assert-Ok 'simulation'

$answer = Read-Host "`n4/4  Appliquer ces migrations sur la base EN LIGNE ? Tapez oui pour confirmer"
if ($answer.Trim().ToLower() -eq 'oui') {
  npx supabase db push --db-url $db
  Assert-Ok 'application'
  Write-Host "`nMigrations appliquees. Verification :" -ForegroundColor Green
  npx supabase migration list --db-url $db
} else {
  Write-Host "`nAnnule : aucune migration appliquee." -ForegroundColor Yellow
}
Remove-Variable password, encoded, db, secure
