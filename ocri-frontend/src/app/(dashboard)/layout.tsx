import { cookies } from 'next/headers';
import { UserProvider } from '@/components/user-provider';
import { parseUserCookie } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const user = parseUserCookie(cookieStore.get('user')?.value);

    return (
        <UserProvider user={user}>
            <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
                <Sidebar />

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <Header />

                    <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8 2xl:p-10">
                        <div className="mx-auto w-full max-w-[1920px]">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </UserProvider>
    );
}
