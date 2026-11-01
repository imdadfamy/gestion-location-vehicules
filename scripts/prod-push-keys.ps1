# Clés des alertes push (notifications sur le téléphone de l'équipe) pour la mise en ligne.
# Ce script tourne dans VOTRE terminal : la clé privée ne passe jamais par l'assistant.
#   1. génère une paire de clés (identité du serveur d'alertes)
#   2. copie la clé PRIVÉE dans votre presse-papiers, pour la coller dans les secrets Supabase
#   3. copie ensuite la clé PUBLIQUE, à coller aussi, et l'écrit dans web\.vapid-public.txt
#      (la clé publique n'est pas secrète : l'assistant la lit pour déployer le site)
# Les secrets se saisissent ici :
#   https://supabase.com/dashboard/project/zkhpdpixwlimqnwublab/functions/secrets

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$keys = node scripts/generate-vapid.mjs | ConvertFrom-Json
Set-Content -Path 'web\.vapid-public.txt' -Value $keys.publicKey -NoNewline

Write-Host "`nDans Supabase > Edge Functions > Secrets, ajoutez 3 secrets (un par un) :" -ForegroundColor Cyan
Write-Host '  VAPID_PRIVATE_KEY  (la clé privée : déjà copiée dans votre presse-papiers)'
Write-Host '  VAPID_PUBLIC_KEY   (la clé publique : copiée à l''étape suivante)'
Write-Host '  VAPID_SUBJECT      (mailto:votre-adresse@exemple.com)'

Set-Clipboard -Value $keys.privateKey
Read-Host "`n1/2  La clé PRIVÉE est dans le presse-papiers. Collez-la dans le secret VAPID_PRIVATE_KEY, enregistrez, puis appuyez sur Entrée"

Set-Clipboard -Value $keys.publicKey
Read-Host '2/2  La clé PUBLIQUE est maintenant dans le presse-papiers. Collez-la dans VAPID_PUBLIC_KEY, ajoutez VAPID_SUBJECT, enregistrez, puis appuyez sur Entrée'

Set-Clipboard -Value ' '
Remove-Variable keys
Write-Host "`nTerminé. Dites à l'assistant que les secrets sont enregistrés : il déploiera la fonction et le site." -ForegroundColor Green
