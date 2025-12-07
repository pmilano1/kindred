'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Plus } from 'lucide-react';
import { PageHeader, Button } from '@/components/ui';
import LoadingSpinner from '@/components/LoadingSpinner';
import { GET_SURNAME_CRESTS, SET_SURNAME_CREST, REMOVE_SURNAME_CREST } from '@/lib/graphql/queries';

interface SurnameCrest {
  id: string;
  surname: string;
  coat_of_arms: string;
  description: string | null;
  origin: string | null;
  motto: string | null;
}

export default function CoatsOfArmsPage() {
  const { data: session } = useSession();
  const isEditor = session?.user?.role === 'editor' || session?.user?.role === 'admin';

  const { data, loading, refetch } = useQuery<{ surnameCrests: SurnameCrest[] }>(GET_SURNAME_CRESTS);
  const [setSurnameCrest] = useMutation(SET_SURNAME_CREST);
  const [removeSurnameCrest] = useMutation(REMOVE_SURNAME_CREST);

  const crests = data?.surnameCrests || [];

  const [showForm, setShowForm] = useState(false);
  const [surname, setSurname] = useState('');
  const [description, setDescription] = useState('');
  const [origin, setOrigin] = useState('');
  const [motto, setMotto] = useState('');
  const [imageData, setImageData] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImageData(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surname || !imageData) return;
    try {
      await setSurnameCrest({
        variables: { surname, coatOfArms: imageData, description: description || null, origin: origin || null, motto: motto || null }
      });
      setShowForm(false);
      setSurname(''); setDescription(''); setOrigin(''); setMotto(''); setImageData('');
      refetch();
    } catch (err) {
      console.error('Failed to set surname crest:', err);
    }
  };

  const handleRemove = async (surnameToRemove: string) => {
    if (!confirm(`Remove coat of arms for "${surnameToRemove}"? All people with this surname will lose their crest.`)) return;
    try {
      await removeSurnameCrest({ variables: { surname: surnameToRemove } });
      refetch();
    } catch (err) {
      console.error('Failed to remove surname crest:', err);
    }
  };

  return (
    <>
      <PageHeader
        title="Coats of Arms"
        subtitle="Assign crests by surname - all people with matching surname inherit automatically"
        icon="Shield"
        actions={isEditor && (
          <Button
            onClick={() => setShowForm(!showForm)}
            icon={showForm ? null : <Plus className="w-4 h-4" />}
          >
            {showForm ? 'Cancel' : 'Add Surname Crest'}
          </Button>
        )}
      />
      <div className="content-wrapper">

        {showForm && isEditor && (
          <form onSubmit={handleSubmit} className="card p-6 mb-6 space-y-4">
            <h3 className="text-lg font-semibold">Add Coat of Arms for Surname</h3>
            <p className="text-sm text-gray-600">All people with this surname will automatically display this crest.</p>
            <input type="text" placeholder="Surname (e.g., Milanese)" value={surname}
              onChange={(e) => setSurname(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
            <input type="text" placeholder="Origin (e.g., Northern Italy)" value={origin}
              onChange={(e) => setOrigin(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            <input type="text" placeholder="Motto" value={motto}
              onChange={(e) => setMotto(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            <textarea placeholder="Description" value={description}
              onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={2} />
            <div>
              <label className="block text-sm font-medium mb-1">Upload Image</label>
              <input type="file" accept="image/*" onChange={handleFileChange} className="w-full" required />
            </div>
            {imageData && (
              <div className="relative w-32 h-32 border rounded">
                <Image src={imageData} alt="Preview" fill className="object-contain" unoptimized />
              </div>
            )}
            <Button type="submit" icon={<Plus className="w-4 h-4" />}>Add Surname Crest</Button>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" message="Loading coats of arms..." />
          </div>
        ) : crests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No surname crests added yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {crests.map((crest) => (
              <div key={crest.id} className="card p-4 text-center">
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <Image src={crest.coat_of_arms} alt={`${crest.surname} coat of arms`}
                    fill className="object-contain" unoptimized />
                </div>
                <h3 className="text-xl font-bold">{crest.surname}</h3>
                {crest.origin && <p className="text-sm text-gray-500">{crest.origin}</p>}
                {crest.motto && <p className="text-sm italic text-gray-600 mt-1">&ldquo;{crest.motto}&rdquo;</p>}
                {crest.description && <p className="text-sm text-gray-500 mt-2">{crest.description}</p>}
                {isEditor && (
                  <Button variant="link" size="sm" onClick={() => handleRemove(crest.surname)}
                    className="text-red-600 text-sm hover:underline mt-3 p-0">Remove</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

