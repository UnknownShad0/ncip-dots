import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { ChevronDown, ShieldCheck, X } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';

const sections: { title: string; content: ReactNode }[] = [
    {
        title: 'Personal Data We Collect',
        content: <>
            <h4 className="mb-2 font-semibold">Online data collection</h4>
            <ul className="mb-4 list-inside list-disc space-y-1.5"><li>Name</li><li>Email Address</li><li>User IP Address</li><li>Search Terms</li><li>Pages and Internal Links Accessed</li><li>Date and Time of Visit</li><li>Geolocation</li><li>Referring Site or Platform</li><li>Browser Type and Operating System</li></ul>
            <h4 className="mb-2 font-semibold">On-site data collection</h4>
            <ul className="mb-4 list-inside list-disc space-y-1.5"><li>Name</li><li>Home Address</li><li>Contact Details (e.g., phone number, email address)</li><li>Proof of Identity (e.g., government-issued IDs)</li><li>Photographs and Videos</li><li>Ethnic Origin</li><li>Health Records (e.g., medical certificates, if required)</li><li>Other relevant information specific to the purpose of collection</li></ul>
            <h4 className="mb-2 font-semibold">Sensitive personal information</h4>
            <ul className="list-inside list-disc space-y-1.5"><li>Age</li><li>Gender</li><li>Ethnic Origin</li><li>Government-Issued IDs</li><li>Employment History</li><li>Health Information</li></ul>
        </>,
    },
    {
        title: 'Reasons for Collecting Personal Data',
        content: <ul className="list-inside list-disc space-y-1.5"><li>Responding to inquiries and requests for services or interventions.</li><li>Administering and maintaining stakeholder records.</li><li>Organizing and monitoring events, programs, and community outreach activities.</li><li>Ensuring compliance with statutory and regulatory requirements.</li><li>Facilitating programs, services, and benefits for Indigenous Peoples.</li></ul>,
    },
    {
        title: 'Sharing and Disclosure of Personal Data',
        content: <><h4 className="mb-1 font-semibold">Internal Sharing</h4><p className="mb-3">Personal data may be shared between NCIP offices to administer services and programs, monitor attendance and participation, and ensure safety and security within NCIP premises.</p><h4 className="mb-1 font-semibold">Sharing with External Parties</h4><p>Personal data may only be disclosed to external parties with explicit consent, to comply with legal obligations, or to fulfill NCIP's mandate in collaboration with partner agencies and organizations.</p></>,
    },
    {
        title: 'Retention and Disposal of Personal Data',
        content: <ul className="list-inside list-disc space-y-1.5"><li>NCIP retains personal data only as long as necessary to fulfill its declared purposes or comply with legal requirements.</li><li>Shredding of physical documents.</li><li>Permanent deletion of electronic data by authorized personnel.</li></ul>,
    },
    {
        title: 'Security Measures',
        content: <ul className="list-inside list-disc space-y-1.5"><li>Encryption of sensitive information during transmission.</li><li>Secure storage of both physical and digital records.</li><li>Access control, ensuring that only authorized personnel handle personal data.</li><li>Regular security audits to assess and mitigate risks.</li></ul>,
    },
    {
        title: 'Rights of Data Subjects',
        content: <ul className="list-inside list-disc space-y-1.5"><li>Right to Information - Be informed about the collection and use of your personal data.</li><li>Right to Access - Request a copy of the personal data held by NCIP.</li><li>Right to Rectification - Correct inaccurate or incomplete personal data.</li><li>Right to Erasure - Request the deletion of personal data that is no longer necessary for its intended purpose.</li><li>Right to Object - Decline participation in specific data processing activities, where applicable.</li></ul>,
    },
    {
        title: 'Responsibilities of Data Subjects',
        content: <ul className="list-inside list-disc space-y-1.5"><li>Update personal information when changes occur.</li><li>Comply with NCIP policies on the processing of personal data.</li></ul>,
    },
    {
        title: 'Changes to this Privacy Notice',
        content: <p>NCIP reserves the right to amend this Privacy Notice as necessary to reflect updates in laws, regulations, or internal policies. Changes will be communicated through NCIP's official channels.</p>,
    },
    {
        title: 'Contact Information',
        content: <><p className="mb-2">For inquiries, concerns, or requests related to this Privacy Notice, please contact:</p><p className="font-medium">Mervyn H. Espadero<br />Data Protection Officer (DPO)<br />Email: <a className="text-primary underline underline-offset-2" href="mailto:dpomail@ncip.gov.ph">dpomail@ncip.gov.ph</a><br />Contact: (02) 8575-1200<br />Address: Sunnymede IT Center, 1614 Quezon Ave., Quezon City, Philippines</p></>,
    },
];

export default function PrivacyNoticeModal({ open, onClose, onAcknowledge }: { open: boolean; onClose: () => void; onAcknowledge: () => void }) {
    const [expanded, setExpanded] = useState<number | null>(0);

    useEffect(() => {
        if (open) setExpanded(0);
    }, [open]);

    return <Dialog open={open} onClose={onClose} className="relative z-[100]">
        <div className="fixed inset-0 bg-foreground/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-6">
            <DialogPanel className="dots-workspace flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden bg-surface shadow-xl">
                <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-5 py-4 text-foreground sm:px-7">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="text-primary"><ShieldCheck size={23} aria-hidden="true" /></span>
                        <div className="min-w-0"><DialogTitle className="text-lg font-semibold">NCIP Privacy Notice</DialogTitle><p className="mt-1 text-xs text-muted">How we collect and protect personal data</p></div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close privacy notice" className="rounded-lg p-2 text-muted transition hover:bg-secondary hover:text-foreground"><X size={20} /></button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-4 sm:p-6">
                    <p className="mb-5 text-sm leading-relaxed text-muted">The National Commission on Indigenous Peoples (NCIP) is dedicated to protecting the privacy and personal data of all stakeholders, including Indigenous Peoples, employees, and clients, in compliance with the Data Privacy Act of 2012 (Republic Act No. 10173). This Privacy Notice details the procedures by which the NCIP collects, processes, stores, shares, and disposes of personal data, ensuring adherence to legal and ethical standards.</p>
                    <div className="divide-y divide-border border-y border-border">
                        {sections.map((section, index) => <section key={section.title} className="overflow-hidden">
                            <button type="button" aria-expanded={expanded === index} onClick={() => setExpanded(expanded === index ? null : index)} className="flex w-full items-center justify-between gap-4 bg-surface px-1 py-3 text-left text-sm font-semibold text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"><span>{index + 1}. {section.title}</span><ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-primary transition-transform ${expanded === index ? 'rotate-180' : ''}`} /></button>
                            {expanded === index && <div className="px-1 pb-4 text-sm leading-6 text-muted">{section.content}</div>}
                        </section>)}
                    </div>
                </div>
                <footer className="flex flex-col-reverse gap-3 border-t border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                    <p className="text-xs text-muted">Your privacy is important to us.</p>
                    <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary">Close</button><button type="button" onClick={onAcknowledge} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90">I Understand</button></div>
                </footer>
            </DialogPanel>
        </div>
    </Dialog>;
}
