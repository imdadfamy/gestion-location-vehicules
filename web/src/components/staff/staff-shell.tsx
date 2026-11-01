import { cookies } from 'next/headers';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { can } from '@/lib/auth';
import { displayName, sessionProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { AppSidebar, type StaffUser } from './app-sidebar';
import { StaffHeader } from './staff-header';
import { ALL_ITEMS } from './staff-menu';

/** Cadre du back-office : menu latéral filtré selon les permissions, en-tête et contenu. */
export async function StaffShell({ children }: { children: React.ReactNode }) {
  const profile = await sessionProfile();
  const showNotifications = can(profile, 'notifications');
  let unread = 0;
  if (showNotifications && profile) {
    const db = await createClient();
    const { count } = await db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
    unread = count ?? 0;
  }
  const user: StaffUser = {
    name: displayName(profile),
    email: profile?.email ?? '',
    isAdmin: profile?.role === 'super_admin',
    modules: ALL_ITEMS.flatMap((item) => (item.module && can(profile, item.module) ? [item.module] : [])),
  };
  const defaultOpen = (await cookies()).get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar user={user} unread={unread} />
      <SidebarInset>
        <StaffHeader unread={unread} showNotifications={showNotifications} />
        <div className="min-w-0 flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
