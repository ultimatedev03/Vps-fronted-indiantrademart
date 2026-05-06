
import React, { useEffect, useMemo, useState } from 'react';
import { dataEntryApi } from '@/modules/employee/services/dataEntryApi';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/shared/components/Badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';

const formatSubmissionDate = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= 0) return '-';
    return parsed.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

const DataEntryRecords = () => {
    const [stats, setStats] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const s = await dataEntryApi.getDashboardStats();
                setStats(s);
                const r = await dataEntryApi.getVendors({ createdByMe: true });
                setRecords(r);
            } catch(e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const filteredRecords = useMemo(() => {
        const query = String(searchTerm || '').trim().toLowerCase();
        if (!query) return records;

        return (records || []).filter((record) => {
            const haystack = [
                record?.company_name,
                record?.vendor_id,
                record?.owner_name,
                record?.email,
                record?.kyc_status,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(query);
        });
    }, [records, searchTerm]);

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">My Data Entry Records</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Vendors</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats?.totalVendors}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Products Listed</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{stats?.totalProducts}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">KYC Pending</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-orange-600">{stats?.pendingKyc}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">KYC Approved</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">{stats?.approvedKyc}</div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="space-y-4">
                    <CardTitle>Submission History</CardTitle>
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search by vendor, owner, email, vendor ID, or status..."
                            className="pl-9"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date & Time</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Products</TableHead>
                                <TableHead>KYC Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRecords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-8 text-center text-gray-500">
                                        No submission history found.
                                    </TableCell>
                                </TableRow>
                            ) : filteredRecords.map((r) => {
                                const normalizedStatus = String(r.kyc_status || 'PENDING').toUpperCase();
                                const isApproved = normalizedStatus === 'VERIFIED' || normalizedStatus === 'APPROVED';
                                return (
                                    <TableRow key={r.id}>
                                        <TableCell>{formatSubmissionDate(r.created_at)}</TableCell>
                                        <TableCell className="font-medium">{r.company_name}</TableCell>
                                        <TableCell>{r.products?.[0]?.count || 0}</TableCell>
                                        <TableCell>
                                            <Badge variant={isApproved ? 'success' : 'warning'}>
                                                {normalizedStatus === 'VERIFIED' ? 'APPROVED' : normalizedStatus}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default DataEntryRecords;
