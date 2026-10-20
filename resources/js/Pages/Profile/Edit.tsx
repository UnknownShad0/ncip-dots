import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({
    mustVerifyEmail,
    status,
}: PageProps<{ mustVerifyEmail: boolean; status?: string }>) {
    return (
        <AuthenticatedLayout
            header={
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Profile
                </h1>
            }
        >
            <Head title="Profile" />

            <div className="mx-auto max-w-4xl">
                <div className="divide-y divide-border rounded-lg border border-border bg-surface">
                    <div className="p-5 sm:p-6">
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                            className="max-w-2xl"
                        />
                    </div>

                    <div className="p-5 sm:p-6">
                        <UpdatePasswordForm className="max-w-2xl" />
                    </div>

                    <div className="p-5 sm:p-6">
                        <DeleteUserForm className="max-w-2xl" />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
