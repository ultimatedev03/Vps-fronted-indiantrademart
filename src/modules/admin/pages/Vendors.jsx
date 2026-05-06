import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

import {
  Building2,
  Eye,
  Filter,
  Loader2,
  Mail,
  Phone,
  Package,
  Search,
  Download,
  UserX,
  ShieldCheck,
  Check,
} from "lucide-react";
import { fetchWithCsrf } from "@/lib/fetchWithCsrf";
import { useSubdomain } from "@/contexts/SubdomainContext";

const isLocalHost = () => {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
};
const getAdminBase = () => {
  const override = import.meta.env.VITE_ADMIN_API_BASE;
  if (override && String(override).trim()) return String(override).trim();
  return isLocalHost() ? "/api/admin" : "/.netlify/functions/admin";
};
async function safeReadJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text();
  throw new Error(
    `API returned non-JSON (${res.status}). Got: ${text.slice(0, 80)}...`
  );
}

const norm = (v) => String(v || "").toUpperCase();
const VENDOR_PAGE_SIZE = 10;
const VENDOR_EXPORT_BATCH_SIZE = 1000;
const REQUIRED_VENDOR_DOCUMENT_COUNT = 4;

const getVendorDocumentPriority = (vendor) => {
  const documentCount = Number(vendor?.document_count || 0);
  const normalizedKycStatus = norm(vendor?.kyc_status || "");
  const hasSubmittedKyc =
    vendor?.has_submitted_kyc === true ||
    documentCount > 0 ||
    ["SUBMITTED", "APPROVED", "VERIFIED"].includes(normalizedKycStatus);
  const hasAllRequiredDocuments =
    vendor?.has_all_required_documents === true || documentCount >= REQUIRED_VENDOR_DOCUMENT_COUNT;
  const createdAt = vendor?.created_at ? new Date(vendor.created_at).getTime() : 0;

  return {
    hasAllRequiredDocuments: hasAllRequiredDocuments ? 1 : 0,
    hasSubmittedKyc: hasSubmittedKyc ? 1 : 0,
    documentCount,
    createdAt,
  };
};

const sortVendorsByDocumentCompletion = (vendors = []) =>
  [...vendors].sort((a, b) => {
    const aPriority = getVendorDocumentPriority(a);
    const bPriority = getVendorDocumentPriority(b);

    if (bPriority.hasAllRequiredDocuments !== aPriority.hasAllRequiredDocuments) {
      return bPriority.hasAllRequiredDocuments - aPriority.hasAllRequiredDocuments;
    }

    if (bPriority.hasSubmittedKyc !== aPriority.hasSubmittedKyc) {
      return bPriority.hasSubmittedKyc - aPriority.hasSubmittedKyc;
    }

    if (bPriority.documentCount !== aPriority.documentCount) {
      return bPriority.documentCount - aPriority.documentCount;
    }

    return bPriority.createdAt - aPriority.createdAt;
  });

const kycBadgeClass = (s) => {
  const v = norm(s || "PENDING");
  const map = {
    APPROVED: "bg-green-100 text-green-800",
    VERIFIED: "bg-green-100 text-green-800",
    SUBMITTED: "bg-yellow-100 text-yellow-800",
    PENDING: "bg-gray-100 text-gray-800",
    REJECTED: "bg-red-100 text-red-800",
  };
  return map[v] || "bg-gray-100 text-gray-800";
};

const getJoinedDateRange = (filterValue, now = new Date()) => {
  if (filterValue === "all") return null;

  if (filterValue === "today") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from, to };
  }

  if (filterValue === "week") {
    const from = new Date(now);
    from.setDate(now.getDate() - now.getDay());
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    return { from, to };
  }

  if (filterValue === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { from, to };
  }

  if (filterValue === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    const to = new Date(now.getFullYear() + 1, 0, 1);
    return { from, to };
  }

  return null;
};

export default function Vendors() {
  const { toast } = useToast();
  const { resolvePath } = useSubdomain();
  const ADMIN_API_BASE = getAdminBase();

  const [vendors, setVendors] = useState([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageJumpValue, setPageJumpValue] = useState("1");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterKyc, setFilterKyc] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [filterJoined, setFilterJoined] = useState("all");

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showVendorModal, setShowVendorModal] = useState(false);

  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const loadRequestIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  const isTerminationReasonValid = useMemo(
    () => terminationReason.trim().length > 0,
    [terminationReason]
  );

  const buildVendorQueryParams = useCallback(
    ({ limit = VENDOR_PAGE_SIZE, offset = 0 } = {}) => {
      const params = new URLSearchParams();
      const trimmedSearch = searchTerm.trim();
      if (trimmedSearch) params.set("search", trimmedSearch);
      if (filterKyc !== "all") params.set("kyc", filterKyc);
      if (filterActive !== "all") params.set("active", filterActive);
      const joinedRange = getJoinedDateRange(filterJoined);
      if (joinedRange?.from) params.set("joined_from", joinedRange.from.toISOString());
      if (joinedRange?.to) params.set("joined_to", joinedRange.to.toISOString());
      params.set("limit", String(limit));
      params.set("offset", String(Math.max(offset, 0)));
      return params;
    },
    [filterActive, filterJoined, filterKyc, searchTerm]
  );

  const fetchVendorPage = useCallback(
    async ({ limit = VENDOR_PAGE_SIZE, offset = 0, signal } = {}) => {
      const params = buildVendorQueryParams({ limit, offset });
      const queryString = params.toString();
      const url = queryString
        ? `${ADMIN_API_BASE}/vendors?${queryString}`
        : `${ADMIN_API_BASE}/vendors`;

      const res = await fetchWithCsrf(url, { signal });
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(data?.error || "Failed");

      const nextVendors = sortVendorsByDocumentCompletion(
        Array.isArray(data.vendors) ? data.vendors : []
      );
      return {
        vendors: nextVendors,
        total: Number(data.total) || nextVendors.length,
      };
    },
    [ADMIN_API_BASE, buildVendorQueryParams]
  );

  const load = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    try {
      const offset = (currentPage - 1) * VENDOR_PAGE_SIZE;
      const { vendors: nextVendors, total } = await fetchVendorPage({
        limit: VENDOR_PAGE_SIZE,
        offset,
        signal: controller.signal,
      });

      if (requestId !== loadRequestIdRef.current || controller.signal.aborted) return;
      setVendors(nextVendors);
      setServerTotal(total);
    } catch (e) {
      if (controller.signal.aborted || e?.name === "AbortError") return;
      if (requestId !== loadRequestIdRef.current) return;
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Failed to load vendors",
        variant: "destructive",
      });
      setVendors([]);
      setServerTotal(0);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (requestId === loadRequestIdRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [currentPage, fetchVendorPage, toast]);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    abortControllerRef.current?.abort();
  }, [currentPage, filterActive, filterJoined, filterKyc, searchTerm]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(serverTotal / VENDOR_PAGE_SIZE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, serverTotal]);

  const visibleCount = vendors.length;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(serverTotal / VENDOR_PAGE_SIZE)),
    [serverTotal]
  );
  const pageStart = serverTotal === 0 ? 0 : (currentPage - 1) * VENDOR_PAGE_SIZE + 1;
  const pageEnd = serverTotal === 0
    ? 0
    : Math.min(serverTotal, pageStart + Math.max(visibleCount - 1, 0));
  const hasActiveFilters = useMemo(
    () =>
      Boolean(searchTerm.trim()) ||
      filterKyc !== "all" ||
      filterActive !== "all" ||
      filterJoined !== "all",
    [filterActive, filterJoined, filterKyc, searchTerm]
  );

  useEffect(() => {
    setPageJumpValue(String(currentPage));
  }, [currentPage]);

  const exportVendors = async () => {
    if (serverTotal === 0) return;

    const header = [
      "vendor_id",
      "company_name",
      "owner_name",
      "email",
      "phone",
      "kyc_status",
      "package",
      "product_count",
      "joined_on",
      "status",
    ];

    const escapeCsv = (value) => {
      const text = String(value ?? "");
      if (text.includes(",") || text.includes('"') || text.includes("\n")) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    setExporting(true);
    try {
      const exportRows = [];
      let offset = 0;

      while (offset < serverTotal) {
        const { vendors: batchRows } = await fetchVendorPage({
          limit: VENDOR_EXPORT_BATCH_SIZE,
          offset,
        });

        if (!batchRows.length) break;

        exportRows.push(...batchRows);
        offset += batchRows.length;

        if (batchRows.length < VENDOR_EXPORT_BATCH_SIZE) break;
      }

      if (!exportRows.length) {
        throw new Error("No vendors available for export");
      }

      const sortedExportRows = sortVendorsByDocumentCompletion(exportRows);

      if (sortedExportRows.length < serverTotal) {
        throw new Error(`Export stopped after ${sortedExportRows.length} of ${serverTotal} vendors`);
      }

      const rows = sortedExportRows.map((vendor) =>
        [
          vendor?.vendor_id || "",
          vendor?.company_name || "",
          vendor?.owner_name || "",
          vendor?.email || "",
          vendor?.phone || "",
          norm(vendor?.kyc_status || "PENDING"),
          vendor?.package?.plan_name || "FREE",
          vendor?.product_count || 0,
          vendor?.joined_on || vendor?.created_at
            ? new Date(vendor.joined_on || vendor.created_at).toLocaleDateString("en-GB")
            : "",
          vendor?.is_active !== false ? "ACTIVE" : "TERMINATED",
        ]
          .map(escapeCsv)
          .join(",")
      );

      const csv = [header.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "vendors-export.csv";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Failed to export vendors",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const onSearch = (e) => {
    e.preventDefault();
    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }
    load();
  };

  const handlePageJumpSubmit = (e) => {
    e.preventDefault();
    const requestedPage = Number.parseInt(pageJumpValue, 10);
    const nextPage = Number.isFinite(requestedPage)
      ? Math.min(Math.max(requestedPage, 1), totalPages)
      : currentPage;

    setPageJumpValue(String(nextPage));
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage);
    }
  };

  const openVendor = (v) => {
    setSelectedVendor(v);
    setShowVendorModal(true);
  };

  const openTerminate = (v) => {
    setSelectedVendor(v);
    setTerminationReason("");
    setShowTerminateModal(true);
  };

  const doTerminate = async () => {
    if (!selectedVendor?.id) return;

    const reason = terminationReason.trim();
    if (!reason) {
      toast({
        title: "Reason required",
        description: "Please type a reason to terminate this vendor.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetchWithCsrf(
        `${ADMIN_API_BASE}/vendors/${selectedVendor.id}/terminate`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        }
      );
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(data?.error || "Terminate failed");
      toast({ title: "Success", description: "Vendor terminated" });
      setShowTerminateModal(false);
      setTerminationReason("");
      await load();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Terminate failed",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const doActivate = async (vendorId) => {
    setProcessing(true);
    try {
      const res = await fetchWithCsrf(`${ADMIN_API_BASE}/vendors/${vendorId}/activate`, {
        method: "POST",
      });
      const data = await safeReadJson(res);
      if (!data?.success) throw new Error(data?.error || "Activate failed");
      toast({ title: "Success", description: "Vendor activated" });
      await load();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e.message || "Activate failed",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    // ✅ full-height layout: top fixed + only table scrolls
    <div className="h-full min-h-0 flex flex-col gap-3 w-full max-w-full overflow-hidden">
      {/* TOP (fixed) */}
      <div className="shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h1 className="text-lg font-bold text-neutral-800">Vendor Management</h1>
            <p className="text-gray-500 text-sm">
              Vendor details, package, products and termination
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {serverTotal === 0 ? "No Vendors" : `Showing ${pageStart}-${pageEnd} of ${serverTotal}`}
            </Badge>
            {hasActiveFilters ? (
              <Badge variant="secondary" className="text-sm">
                Filters Active
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-sm">
              Page {currentPage} of {totalPages}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={exportVendors}
              disabled={serverTotal === 0 || exporting}
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-col md:flex-row gap-2 p-2 bg-white rounded-lg border w-full max-w-full">
          <form onSubmit={onSearch} className="flex-1 relative min-w-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              className="pl-9 h-9"
              placeholder="Search by company, owner, vendor ID, internal ID or email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </form>

          <Select
            value={filterKyc}
            onValueChange={(value) => {
              setFilterKyc(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full md:w-[180px] h-9">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="KYC Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All KYC</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterActive}
            onValueChange={(value) => {
              setFilterActive(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full md:w-[180px] h-9">
              <ShieldCheck className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Vendor Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Terminated</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterJoined}
            onValueChange={(value) => {
              setFilterJoined(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full md:w-[180px] h-9">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Joined On" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filterJoined !== "all" ? (
          <p className="mt-2 text-xs text-amber-700">
            Time filters use the vendor joined date. Vendors without a joined date are excluded.
          </p>
        ) : null}
      </div>

      {/* TABLE AREA (only this scrolls) */}
      <div className="flex-1 min-h-0 w-full max-w-full overflow-hidden">
        <Card className="h-full w-full max-w-full">
          <CardContent className="h-full p-0 w-full max-w-full">
            <div className="h-full overflow-y-auto overflow-x-hidden">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[22%] px-2">Company</TableHead>
                    <TableHead className="w-[20%] px-2">Owner / Contact</TableHead>
                    <TableHead className="w-[10%] px-2">KYC</TableHead>
                    <TableHead className="w-[12%] px-2">Package</TableHead>
                    <TableHead className="w-[8%] px-2">Products</TableHead>
                    <TableHead className="w-[10%] px-2">Joined</TableHead>
                    <TableHead className="w-[8%] px-2">Status</TableHead>
                    <TableHead className="w-[10%] px-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-7">
                        <Loader2 className="animate-spin mx-auto h-6 w-6 text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ) : vendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-7 text-gray-500">
                        <Building2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        No vendors found
                      </TableCell>
                    </TableRow>
                  ) : (
                    vendors.map((v) => {
                      const active = v.is_active !== false;
                      const planName = v.package?.plan_name || "FREE";
                      const planPrice = Number(v.package?.price || 0);

                      return (
                        <TableRow key={v.id} className="hover:bg-gray-50">
                          <TableCell className="px-2 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <Building2 className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{v.company_name || "—"}</p>
                                <p className="text-xs text-gray-500 truncate">{v.vendor_id || "Business"}</p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="px-2 py-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{v.owner_name || "—"}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1 min-w-0">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate min-w-0">{v.email || "—"}</span>
                              </div>
                              {v.phone ? (
                                <div className="text-xs text-gray-500 flex items-center gap-1 min-w-0">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{v.phone}</span>
                                </div>
                              ) : null}
                            </div>
                          </TableCell>

                          <TableCell className="px-2 py-2">
                            <div className="space-y-1">
                              <Badge className={`${kycBadgeClass(v.kyc_status)} text-xs`}>
                                {norm(v.kyc_status || "PENDING")}
                              </Badge>
                              <div className="text-[11px] text-gray-500">
                                Docs {Number(v.document_count || 0)}/4
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="px-2 py-2">
                            <div className="space-y-0.5">
                              <Badge variant="outline" className="font-medium text-xs">
                                {planName}
                              </Badge>
                              {planPrice ? (
                                <div className="text-[11px] text-gray-500 truncate">₹{planPrice}</div>
                              ) : null}
                            </div>
                          </TableCell>

                          <TableCell className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-gray-400 shrink-0" />
                              <span className="text-sm font-medium text-gray-700">
                                {v.product_count || 0}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="px-2 py-2 text-sm text-gray-500">
                            {v.joined_on || v.created_at
                              ? new Date(v.joined_on || v.created_at).toLocaleDateString("en-GB")
                              : "—"}
                          </TableCell>

                          <TableCell className="px-2 py-2">
                            <Badge
                              className={
                                active
                                  ? "bg-emerald-100 text-emerald-800 text-xs"
                                  : "bg-red-100 text-red-800 text-xs"
                              }
                            >
                              {active ? "ACTIVE" : "TERMINATED"}
                            </Badge>
                          </TableCell>

                          <TableCell className="px-2 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openVendor(v)}
                                title="View"
                                aria-label="View vendor"
                                className="h-9 w-9"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>

                              <Link to={resolvePath(`vendors/${v.id}/products`, 'admin')} className="inline-flex">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  title="Products"
                                  aria-label="Vendor products"
                                  className="h-9 w-9"
                                >
                                  <Package className="h-4 w-4" />
                                </Button>
                              </Link>

                              {active ? (
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  onClick={() => openTerminate(v)}
                                  disabled={processing}
                                  title="Terminate"
                                  aria-label="Terminate vendor"
                                  className="h-9 w-9"
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  size="icon"
                                  className="bg-emerald-600 hover:bg-emerald-700 h-9 w-9"
                                  onClick={() => doActivate(v.id)}
                                  disabled={processing}
                                  title="Activate"
                                  aria-label="Activate vendor"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {serverTotal === 0 ? "No vendors to display" : `Page ${currentPage} of ${totalPages}`}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form onSubmit={handlePageJumpSubmit} className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Jump to page</span>
            <Input
              value={pageJumpValue}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                setPageJumpValue(digitsOnly);
              }}
              onBlur={() => {
                if (!pageJumpValue) {
                  setPageJumpValue(String(currentPage));
                }
              }}
              className="h-9 w-20 text-center"
              inputMode="numeric"
              aria-label="Jump to page"
              placeholder="Page"
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={loading || serverTotal === 0 || !pageJumpValue}
            >
              Go
            </Button>
          </form>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={loading || currentPage === 1}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={loading || currentPage === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={loading || currentPage >= totalPages}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={loading || currentPage >= totalPages}
          >
            Last
          </Button>
        </div>
      </div>

      {/* Vendor Details Modal */}
      <Dialog open={showVendorModal} onOpenChange={setShowVendorModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
            <DialogDescription>Package and status details</DialogDescription>
          </DialogHeader>

          {selectedVendor ? (
            <div className="space-y-3 text-sm">
              <div className="font-semibold">{selectedVendor.company_name}</div>
              <div>
                Owner: <span className="font-medium">{selectedVendor.owner_name || "—"}</span>
              </div>
              <div>
                Email: <span className="font-medium">{selectedVendor.email || "—"}</span>
              </div>
              <div>
                Phone: <span className="font-medium">{selectedVendor.phone || "—"}</span>
              </div>
              <div>
                Package:{" "}
                <Badge variant="outline" className="font-medium">
                  {selectedVendor.package?.plan_name || "FREE"}{" "}
                  {Number(selectedVendor.package?.price || 0)
                    ? `• ₹${selectedVendor.package?.price}`
                    : ""}
                </Badge>
              </div>
              <div>
                Status:{" "}
                <Badge
                  className={
                    selectedVendor.is_active !== false
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }
                >
                  {selectedVendor.is_active !== false ? "ACTIVE" : "TERMINATED"}
                </Badge>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVendorModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terminate Modal */}
      <Dialog
        open={showTerminateModal}
        onOpenChange={(open) => {
          setShowTerminateModal(open);
          if (!open) setTerminationReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Terminate Vendor</DialogTitle>
            <DialogDescription>
              Vendor will be deactivated (is_active=false)
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Reason (required)"
            value={terminationReason}
            onChange={(e) => setTerminationReason(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-gray-500">
            Please type a reason to enable <b>Terminate</b>.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTerminateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={doTerminate}
              disabled={processing || !isTerminationReasonValid}
            >
              {processing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
