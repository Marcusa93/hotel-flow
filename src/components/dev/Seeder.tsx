
import { useState } from 'react';
import { seedDatabase } from '@/utils/seed';
import { Button } from '@/components/ui/button';
import { Database } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function Seeder() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const queryClient = useQueryClient();

    const handleSeed = async () => {
        if (!confirm('This will add mock data to the database. Are you sure?')) return;

        setLoading(true);
        setStatus('idle');

        try {
            const result = await seedDatabase();
            if (result.success) {
                setStatus('success');
                // Invalidate all queries to refresh UI
                queryClient.invalidateQueries();
                setTimeout(() => setStatus('idle'), 3000);
            } else {
                setStatus('error');
            }
        } catch (e) {
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-4 pt-4 border-t border-slate-700">
            <Button
                variant="outline"
                size="sm"
                onClick={handleSeed}
                disabled={loading}
                className="w-full bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
            >
                <Database className="w-4 h-4 mr-2" />
                {loading ? 'Seeding...' : 'Seed Database'}
            </Button>
            {status === 'success' && <p className="text-xs text-green-400 mt-1 text-center">Data added successfully!</p>}
            {status === 'error' && <p className="text-xs text-red-400 mt-1 text-center">Failed to seed data.</p>}
        </div>
    );
}
