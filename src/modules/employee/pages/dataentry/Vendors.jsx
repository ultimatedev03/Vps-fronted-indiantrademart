
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Eye, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const VENDOR_BATCH_SIZE = 1000;

const normalizeString = (value = '') =>
    String(value)
        .toLowerCase()
        .trim();

const normalizeLoose = (value = '') =>
    normalizeString(value).replace(/[^a-z0-9]/g, '');

const normalizeStatus = (value = 'PENDING') =>
    String(value || 'PENDING').trim().toUpperCase();

const isApprovedStatus = (status) => {
    const normalized = normalizeStatus(status);
    return normalized === 'VERIFIED' || normalized === 'APPROVED';
};

const getStatusLabel = (status) => {
    const normalized = normalizeStatus(status);
    return normalized === 'VERIFIED' ? 'APPROVED' : normalized;
};

const matchesSearch = (vendor, query) => {
    const strictQuery = normalizeString(query);
    const looseQuery = normalizeLoose(query);
    if (!strictQuery) return true;

    const values = [
        vendor?.vendor_id,
        vendor?.company_name,
        vendor?.owner_name,
        vendor?.email
    ];

    return values.some((raw) => {
        const strictValue = normalizeString(raw);
        const looseValue = normalizeLoose(raw);
        return strictValue.includes(strictQuery) || (looseQuery && looseValue.includes(looseQuery));
    });
};

const Vendors = () => {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState([]);
    const [totalVendors, setTotalVendors] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadVendors();
    }, []);

    const loadVendors = async () => {
        try {
            setLoading(true);
            const collectedVendors = [];
            let expectedTotal = 0;
            let offset = 0;

            while (true) {
                const query = offset === 0
                    ? supabase.from('vendors').select('*', { count: 'exact' })
                    : supabase.from('vendors').select('*');

                const { data, error, count } = await query
                    .order('company_name', { ascending: true })
                    .order('id', { ascending: true })
                    .range(offset, offset + VENDOR_BATCH_SIZE - 1);

                if (error) throw error;

                const batch = data || [];
                if (offset === 0) {
                    expectedTotal = Number(count) || batch.length;
                }

                collectedVendors.push(...batch);

                if (batch.length < VENDOR_BATCH_SIZE || collectedVendors.length >= expectedTotal) {
                    break;
                }

                offset += VENDOR_BATCH_SIZE;
            }

            setVendors(collectedVendors);
            setTotalVendors(expectedTotal || collectedVendors.length);
        } catch (error) {
            console.error(error);
            setVendors([]);
            setTotalVendors(0);
            toast({ title: "Error", description: "Failed to load vendors", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const filteredVendors = useMemo(() => {
        if (!searchQuery.trim()) return vendors;
        return vendors.filter((vendor) => matchesSearch(vendor, searchQuery));
    }, [searchQuery, vendors]);

    const displayedTotal = totalVendors || vendors.length;
    const hasSearchQuery = Boolean(searchQuery.trim());

    const handleSearchKeyDown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();

        if (filteredVendors.length === 1) {
            navigate(`/employee/dataentry/vendors/${filteredVendors[0].id}/products`);
            return;
        }

        if (filteredVendors.length === 0) {
            toast({
                title: "Not Found",
                description: `No vendors matched "${searchQuery}".`,
                variant: "destructive",
            });
            return;
        }

        toast({
            title: "Search Refined",
            description: `${filteredVendors.length} vendors matched. Select one from the list below.`,
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold mb-2">Vendor Management</h1>
                <p className="text-gray-600">View and manage all vendors</p>
            </div>

            {/* Vendor List */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>All Vendors ({displayedTotal})</CardTitle>
                    </div>
                    <div className="mt-4">
                        <Input 
                            placeholder="Search by company name, owner, vendor ID, or email..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="max-w-md"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            Press Enter to open the vendor directly when there is a single match.
                        </p>
                        {hasSearchQuery ? (
                            <p className="mt-1 text-xs text-gray-500">
                                Showing {filteredVendors.length} matched vendors out of {displayedTotal}.
                            </p>
                        ) : null}
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="animate-spin text-gray-400" />
                        </div>
                    ) : filteredVendors.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p>No vendors found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Vendor ID</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Owner</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>KYC Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredVendors.map((v) => {
                                        const normalizedStatus = normalizeStatus(v.kyc_status);
                                        const badgeVariant = isApprovedStatus(normalizedStatus)
                                            ? 'default'
                                            : normalizedStatus === 'REJECTED'
                                                ? 'destructive'
                                                : 'secondary';

                                        return (
                                            <TableRow key={v.id}>
                                                <TableCell className="font-mono font-semibold">{v.vendor_id}</TableCell>
                                                <TableCell className="font-medium">{v.company_name}</TableCell>
                                                <TableCell>{v.owner_name}</TableCell>
                                                <TableCell className="text-sm text-gray-600">{v.email}</TableCell>
                                                <TableCell>
                                                    <Badge variant={badgeVariant}>
                                                        {getStatusLabel(normalizedStatus)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Link to={`/employee/dataentry/vendors/${v.id}/products`}>
                                                        <Button size="sm" variant="outline" className="gap-1">
                                                            <Eye className="w-4 h-4" />
                                                            View Products
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
export default Vendors;
