// Génère une paire de clés VAPID (identité du serveur d'alertes push).
// Usage : node scripts/generate-vapid.mjs
//   - La clé PUBLIQUE peut être copiée partout (variable NEXT_PUBLIC_VAPID_PUBLIC_KEY du site).
//   - La clé PRIVÉE ne doit être saisie que dans les secrets Supabase : jamais dans le code ni dans un chat.
import { createECDH } from 'node:crypto';

const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const b64url = (buffer) => buffer.toString('base64url');

console.log(JSON.stringify({ publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(ecdh.getPrivateKey()) }, null, 2));
