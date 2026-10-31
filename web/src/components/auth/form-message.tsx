import { CircleAlert, CircleCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

/** Message d'erreur ou de confirmation sous un formulaire (annoncé aux lecteurs d'écran). */
export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error)
    return (
      <Alert variant="destructive" role="alert">
        <CircleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  if (message)
    return (
      <Alert role="status">
        <CircleCheck />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  return null;
}
