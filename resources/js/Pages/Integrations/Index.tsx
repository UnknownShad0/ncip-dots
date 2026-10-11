import ConnectedDocuments, { ConnectedDocument } from '@/Components/ConnectedDocuments';
export default function IntegrationsIndex({ system = 'DRIP', documents = [] }: { system?: string; documents?: ConnectedDocument[] }) {
    return <ConnectedDocuments key={system} system={system} documents={documents} />;
}
