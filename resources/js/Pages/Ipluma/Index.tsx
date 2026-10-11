import ConnectedDocuments, { ConnectedDocument } from '@/Components/ConnectedDocuments';
export default function IplumaIndex({ documents = [] }: { documents?: ConnectedDocument[] }) {
    return <ConnectedDocuments system="iPluma" documents={documents} />;
}
