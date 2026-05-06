import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { quotationApi } from '@/modules/vendor/services/quotationApi';
import Card from '@/shared/components/Card';
import { Loader2, MessageSquare, Send, Pencil, Trash2, Check, CheckCheck, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';
import { supabase } from '@/lib/customSupabaseClient';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/modules/vendor/context/AuthContext';
import { useLocation } from 'react-router-dom';

const safeDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString();
};

const deriveDisplayNameFromEmail = (value) => {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return '';
  const localPart = email.split('@')[0] || '';
  const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const extractFirstToken = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.split(/\s+/).filter(Boolean)[0] || '';
};

const isLikelyHandle = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return true;
  if (raw.includes('@')) return true;
  if (/\d/.test(raw) && !/\s/.test(raw)) return true;
  return false;
};

const cleanPersonLikeName = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  if (normalized === 'buyer' || normalized === 'customer' || normalized === 'unknown' || normalized === 'unknown buyer') {
    return '';
  }
  if (isLikelyHandle(raw)) return '';
  return raw;
};

const toPreferredFirstName = (...values) => {
  for (const value of values) {
    const cleaned = cleanPersonLikeName(value);
    const firstToken = extractFirstToken(cleaned);
    if (firstToken) return cleaned;
  }
  return '';
};

const toDayKey = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatMessageTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDayLabel = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const now = new Date();
  const dayStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayDiff = Math.round((todayStart - dayStart) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  return parsed.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

const resolveBuyerName = (row) => {
  const profileName = toPreferredFirstName(row?.buyers?.full_name);
  const proposalName = toPreferredFirstName(row?.buyer_name);
  const companyName = toPreferredFirstName(row?.buyers?.company_name, row?.company_name);
  return profileName || proposalName || companyName || 'Buyer';
};

const resolveBuyerNameFromIdentity = (identity, row) => {
  const fromIdentity = toPreferredFirstName(identity?.name);
  if (fromIdentity) return fromIdentity;

  const fromRow = resolveBuyerName(row);
  if (fromRow && fromRow.toLowerCase() !== 'buyer') return fromRow;
  return fromRow || 'Buyer';
};

const maskEmail = (value) => {
  const email = String(value || '').trim();
  if (!email || !email.includes('@')) return '';
  const [localPartRaw, domainRaw] = email.split('@');
  const localPart = String(localPartRaw || '');
  const domain = String(domainRaw || '');
  const domainParts = domain.split('.');
  const domainName = String(domainParts[0] || '');
  const domainSuffix = domainParts.length > 1 ? `.${domainParts.slice(1).join('.')}` : '';

  const maskedLocal =
    localPart.length <= 2
      ? `${localPart.slice(0, 1)}*`
      : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(localPart.length - 2, 3))}`;
  const maskedDomain =
    domainName.length <= 2
      ? `${domainName.slice(0, 1)}*`
      : `${domainName.slice(0, 2)}${'*'.repeat(Math.max(domainName.length - 2, 3))}`;
  return `${maskedLocal}@${maskedDomain}${domainSuffix}`;
};

const maskCompanyName = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 2) return `${text.slice(0, 1)}*`;
  if (text.length <= 5) return `${text.slice(0, 2)}${'*'.repeat(text.length - 2)}`;
  return `${text.slice(0, 2)}${'*'.repeat(Math.max(text.length - 3, 3))}${text.slice(-1)}`;
};

const resolveBuyerEmail = (row) =>
  row?.buyers?.email ||
  row?.buyer_email ||
  '';

const resolveBuyerAvatar = (row) =>
  row?.buyers?.avatar_url ||
  row?.buyer_avatar ||
  '';

const resolveBuyerCompany = (row) =>
  cleanPersonLikeName(row?.buyers?.company_name) ||
  cleanPersonLikeName(row?.company_name) ||
  '';

const resolveBuyerVerificationLabel = (row) => {
  const badge = String(row?.buyers?.verification_badge || '').trim();
  if (badge) return badge;
  const kycStatus = String(row?.buyers?.kyc_status || '').trim().toUpperCase();
  if (row?.buyers?.is_verified === true || row?.buyers?.is_active === true || kycStatus === 'APPROVED') {
    return 'Verified';
  }
  return 'Unverified';
};

const isBuyerVerified = (row) => {
  const badge = String(row?.buyers?.verification_badge || '').trim().toLowerCase();
  if (badge && badge !== 'unverified') return true;
  const kycStatus = String(row?.buyers?.kyc_status || '').trim().toUpperCase();
  return row?.buyers?.is_verified === true || row?.buyers?.is_active === true || kycStatus === 'APPROVED';
};

const isPlaceholderBuyerLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return (
    !normalized ||
    normalized === 'buyer' ||
    normalized === 'customer' ||
    normalized === 'unknown' ||
    normalized === 'unknown buyer'
  );
};

const normalizeBuyerEmailForConversation = (value) => String(value || '').trim().toLowerCase();

const pickConversationText = (...values) => {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
};

const pickConversationName = (...values) => {
  let fallback = '';
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) continue;
    if (!fallback) fallback = text;
    if (!isPlaceholderBuyerLabel(text)) return text;
  }
  return fallback;
};

const mergeBuyerMetaForConversation = (current = {}, incoming = {}) => {
  const merged = {
    ...incoming,
    ...current,
    id: pickConversationText(current?.id, incoming?.id) || null,
    user_id: pickConversationText(current?.user_id, incoming?.user_id) || null,
    full_name: pickConversationName(
      current?.full_name,
      incoming?.full_name,
      current?.company_name,
      incoming?.company_name
    ) || null,
    company_name: pickConversationText(current?.company_name, incoming?.company_name) || null,
    email: pickConversationText(current?.email, incoming?.email).toLowerCase() || null,
    phone: pickConversationText(
      current?.phone,
      current?.mobile_number,
      current?.mobile,
      incoming?.phone,
      incoming?.mobile_number,
      incoming?.mobile
    ) || null,
    avatar_url: pickConversationText(current?.avatar_url, incoming?.avatar_url) || null,
    verification_badge: pickConversationText(current?.verification_badge, incoming?.verification_badge) || null,
    kyc_status: pickConversationText(current?.kyc_status, incoming?.kyc_status) || null,
  };

  const currentIsActive = typeof current?.is_active === 'boolean' ? current.is_active : null;
  const incomingIsActive = typeof incoming?.is_active === 'boolean' ? incoming.is_active : null;
  const currentIsVerified = typeof current?.is_verified === 'boolean' ? current.is_verified : null;
  const incomingIsVerified = typeof incoming?.is_verified === 'boolean' ? incoming.is_verified : null;

  merged.is_active = currentIsActive === null ? incomingIsActive : currentIsActive;
  merged.is_verified = currentIsVerified === null ? incomingIsVerified : currentIsVerified;

  return merged;
};

const mergeConversationRowWithHydratedProposal = (row = {}, proposal = {}) => {
  if (!proposal || typeof proposal !== 'object') return row;

  const mergedBuyerMeta = mergeBuyerMetaForConversation(row?.buyers || {}, proposal?.buyers || {});

  const mergedBuyerName = pickConversationName(
    row?.buyer_name,
    proposal?.buyer_name,
    mergedBuyerMeta?.full_name,
    mergedBuyerMeta?.company_name
  );
  const mergedBuyerEmail = pickConversationText(
    row?.buyer_email,
    proposal?.buyer_email,
    mergedBuyerMeta?.email
  ).toLowerCase();
  const mergedBuyerPhone = pickConversationText(
    row?.buyer_phone,
    row?.buyer_mobile,
    proposal?.buyer_phone,
    proposal?.buyer_mobile,
    mergedBuyerMeta?.phone
  );
  const mergedBuyerCompany = pickConversationText(
    row?.company_name,
    proposal?.company_name,
    mergedBuyerMeta?.company_name
  );
  const mergedBuyerAvatar = pickConversationText(
    row?.buyer_avatar,
    proposal?.buyer_avatar,
    mergedBuyerMeta?.avatar_url
  );

  const hasBuyerMeta = Object.values(mergedBuyerMeta).some(
    (value) => value !== null && value !== undefined && String(value).trim() !== ''
  );

  return {
    ...proposal,
    ...row,
    buyer_id: pickConversationText(row?.buyer_id, proposal?.buyer_id, mergedBuyerMeta?.id) || null,
    buyer_user_id: pickConversationText(row?.buyer_user_id, proposal?.buyer_user_id, mergedBuyerMeta?.user_id) || null,
    buyer_name: mergedBuyerName || null,
    buyer_email: mergedBuyerEmail || null,
    buyer_phone: mergedBuyerPhone || null,
    company_name: mergedBuyerCompany || null,
    buyer_avatar: mergedBuyerAvatar || null,
    buyers: hasBuyerMeta ? mergedBuyerMeta : row?.buyers || proposal?.buyers || null,
  };
};

const buildBuyerConversationKey = (row = {}) => {
  const buyerUserId = String(
    row?.buyers?.user_id ||
    row?.buyer_user_id ||
    row?.buyers?.id ||
    row?.buyer_id ||
    ''
  ).trim();
  if (buyerUserId) return `user:${buyerUserId}`;

  const buyerEmail = normalizeBuyerEmailForConversation(resolveBuyerEmail(row));
  if (buyerEmail) return `email:${buyerEmail}`;

  const buyerPhone = String(
    row?.buyers?.phone ||
    row?.buyers?.mobile_number ||
    row?.buyers?.mobile ||
    row?.buyer_phone ||
    row?.buyer_mobile ||
    row?.phone ||
    ''
  ).replace(/\D+/g, '');
  if (buyerPhone) return `phone:${buyerPhone}`;

  const nameSeedRaw = String(resolveBuyerName(row) || '').trim().toLowerCase();
  const nameSeed = isPlaceholderBuyerLabel(nameSeedRaw) ? '' : nameSeedRaw;
  const companySeed = String(resolveBuyerCompany(row) || '').trim().toLowerCase();
  const fallbackSeed = [nameSeed, companySeed].filter(Boolean).join('|');
  if (fallbackSeed) return `name:${fallbackSeed}`;

  const proposalId = String(row?.id || '').trim();
  return proposalId ? `proposal:${proposalId}` : 'proposal:unknown';
};

const MESSAGE_MARKERS = {
  edited: /^::itm_edited::$/i,
  deliveredBuyer: /^::itm_delivered_buyer::(.+)$/i,
  deliveredVendor: /^::itm_delivered_vendor::(.+)$/i,
  readBuyer: /^::itm_read_buyer::(.+)$/i,
  readVendor: /^::itm_read_vendor::(.+)$/i,
};

const parseStoredMessage = (rawValue) => {
  const lines = String(rawValue || '').replace(/\r\n/g, '\n').split('\n');
  const contentLines = [];
  const meta = {
    edited: false,
    delivered_buyer_at: null,
    delivered_vendor_at: null,
    read_buyer_at: null,
    read_vendor_at: null,
  };

  for (const line of lines) {
    const trimmed = String(line || '').trim();

    if (MESSAGE_MARKERS.edited.test(trimmed)) {
      meta.edited = true;
      continue;
    }

    const deliveredBuyerMatch = trimmed.match(MESSAGE_MARKERS.deliveredBuyer);
    if (deliveredBuyerMatch) {
      meta.delivered_buyer_at = String(deliveredBuyerMatch[1] || '').trim() || null;
      continue;
    }

    const deliveredVendorMatch = trimmed.match(MESSAGE_MARKERS.deliveredVendor);
    if (deliveredVendorMatch) {
      meta.delivered_vendor_at = String(deliveredVendorMatch[1] || '').trim() || null;
      continue;
    }

    const readBuyerMatch = trimmed.match(MESSAGE_MARKERS.readBuyer);
    if (readBuyerMatch) {
      meta.read_buyer_at = String(readBuyerMatch[1] || '').trim() || null;
      continue;
    }

    const readVendorMatch = trimmed.match(MESSAGE_MARKERS.readVendor);
    if (readVendorMatch) {
      meta.read_vendor_at = String(readVendorMatch[1] || '').trim() || null;
      continue;
    }

    contentLines.push(line);
  }

  return {
    text: contentLines.join('\n').trimEnd(),
    meta,
  };
};

const normalizeMessageRow = (row = {}, actorUserId = '', actorRole = 'vendor') => {
  const rawMessage = String(row?.message || '');
  const parsed = parseStoredMessage(rawMessage);

  const incomingIsMe =
    typeof row?.is_me === 'boolean'
      ? row.is_me
      : actorUserId
        ? String(row?.sender_id || '').trim() === String(actorUserId).trim()
        : false;

  const recipientRole = actorRole === 'buyer' ? 'vendor' : 'buyer';
  const deliveredKey = recipientRole === 'vendor' ? 'delivered_vendor_at' : 'delivered_buyer_at';
  const readKey = recipientRole === 'vendor' ? 'read_vendor_at' : 'read_buyer_at';

  const parsedDeliveredAt = parsed.meta?.[deliveredKey] || null;
  const parsedReadAt = parsed.meta?.[readKey] || null;
  const deliveredAt = row?.delivered_at || parsedDeliveredAt || parsedReadAt || null;
  const readAt = row?.read_at || parsedReadAt || null;

  let computedState = 'sent';
  if (readAt) computedState = 'read';
  else if (deliveredAt) computedState = 'delivered';

  return {
    ...row,
    message: parsed.text,
    is_edited: typeof row?.is_edited === 'boolean' ? row.is_edited : Boolean(parsed.meta.edited),
    is_me: incomingIsMe,
    delivered_at: deliveredAt,
    read_at: readAt,
    delivery_state: row?.delivery_state || (incomingIsMe ? computedState : 'received'),
  };
};

const getAvatarInitials = (name, email) => {
  const raw = String(name || email || '').trim();
  if (!raw) return 'U';
  const words = raw.split(/\s+/).filter(Boolean);
  if (!words.length) return 'U';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
};

const mergePresenceMeta = (existing = null, incoming = {}) => {
  if (!existing) return { ...incoming };

  const existingAt = Date.parse(existing?.at || '') || 0;
  const incomingAt = Date.parse(incoming?.at || '') || 0;
  const base = incomingAt >= existingAt ? { ...existing, ...incoming } : { ...incoming, ...existing };

  const existingOnline = typeof existing?.online === 'boolean' ? existing.online : null;
  const incomingOnline = typeof incoming?.online === 'boolean' ? incoming.online : null;
  if (existingOnline === true || incomingOnline === true) {
    base.online = true;
  } else if (existingOnline === false || incomingOnline === false) {
    base.online = false;
  } else {
    delete base.online;
  }

  const existingTyping = typeof existing?.typing === 'boolean' ? existing.typing : null;
  const incomingTyping = typeof incoming?.typing === 'boolean' ? incoming.typing : null;
  if (existingTyping === true || incomingTyping === true) {
    base.typing = true;
  } else if (existingTyping === false || incomingTyping === false) {
    base.typing = false;
  } else {
    delete base.typing;
  }

  return base;
};

const mapPresenceStateWithAliases = (state = {}) => {
  const mapped = {};
  Object.entries(state || {}).forEach(([key, value]) => {
    if (!Array.isArray(value) || !value.length) return;
    const normalizedKey = String(key || '').trim();
    value.forEach((entry) => {
      const meta = entry || {};
      const keys = new Set();
      const metaUserId = String(meta?.user_id || '').trim();
      if (normalizedKey) keys.add(normalizedKey);
      if (metaUserId) keys.add(metaUserId);

      const metaEmail = String(meta?.email || meta?.user_email || '').trim().toLowerCase();
      if (metaEmail) keys.add(metaEmail);

      const aliasIds = Array.isArray(meta?.alias_user_ids)
        ? meta.alias_user_ids
        : meta?.alias_user_id
          ? [meta.alias_user_id]
          : [];
      aliasIds
        .map((id) => String(id || '').trim())
        .filter(Boolean)
        .forEach((id) => keys.add(id));

      const aliasEmails = Array.isArray(meta?.alias_emails)
        ? meta.alias_emails
        : meta?.alias_email
          ? [meta.alias_email]
          : [];
      aliasEmails
        .map((email) => String(email || '').trim().toLowerCase())
        .filter(Boolean)
        .forEach((email) => keys.add(email));

      keys.forEach((resolvedKey) => {
        mapped[resolvedKey] = mergePresenceMeta(mapped[resolvedKey], meta);
      });
    });
  });
  return mapped;
};

const resolvePresenceEntry = (presenceMap = {}, { userIds = [], emails = [] } = {}) => {
  const normalizedUserIds = Array.from(
    new Set((userIds || []).map((value) => String(value || '').trim()).filter(Boolean))
  );
  const normalizedEmails = Array.from(
    new Set((emails || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))
  );

  for (const key of [...normalizedUserIds, ...normalizedEmails]) {
    if (presenceMap?.[key]) return presenceMap[key];
  }

  const entries = Object.values(presenceMap || {});
  for (const entry of entries) {
    const metaUserId = String(entry?.user_id || '').trim();
    const metaEmail = String(entry?.email || entry?.user_email || '').trim().toLowerCase();
    const aliasIds = Array.isArray(entry?.alias_user_ids)
      ? entry.alias_user_ids.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    const aliasEmails = Array.isArray(entry?.alias_emails)
      ? entry.alias_emails.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
      : [];

    if (normalizedUserIds.some((id) => id === metaUserId || aliasIds.includes(id))) {
      return entry;
    }
    if (normalizedEmails.some((email) => email === metaEmail || aliasEmails.includes(email))) {
      return entry;
    }
  }

  return null;
};

const DEFAULT_CHAT_BLOCK_STATUS = Object.freeze({
  blocked_by_me: false,
  blocked_me: false,
  can_message: true,
  counterpart_user_id: null,
});

const normalizeChatBlockStatus = (value) => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_CHAT_BLOCK_STATUS };
  }

  const blockedByMe = Boolean(value?.blocked_by_me);
  const blockedMe = Boolean(value?.blocked_me);
  const inferredCanMessage = !(blockedByMe || blockedMe);
  const canMessage =
    typeof value?.can_message === 'boolean'
      ? value.can_message && inferredCanMessage
      : inferredCanMessage;

  return {
    blocked_by_me: blockedByMe,
    blocked_me: blockedMe,
    can_message: canMessage,
    counterpart_user_id: String(value?.counterpart_user_id || '').trim() || null,
  };
};

const Messages = () => {
  const location = useLocation();
  const { portalPresenceByUserId } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [actorMessageUserId, setActorMessageUserId] = useState('');
  const [participantUserId, setParticipantUserId] = useState('');
  const [buyerIdentityByProposalId, setBuyerIdentityByProposalId] = useState({});
  const [presenceByUserId, setPresenceByUserId] = useState({});
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingProposalId, setEditingProposalId] = useState('');
  const [editingText, setEditingText] = useState('');
  const [savingMessageId, setSavingMessageId] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [deletingConversationId, setDeletingConversationId] = useState(null);
  const [blockStatus, setBlockStatus] = useState(() => ({ ...DEFAULT_CHAT_BLOCK_STATUS }));
  const [blockActionLoading, setBlockActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const messageListRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const presenceChannelRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingStateRef = useRef(false);
  const focusProposalId = String(location.state?.focusProposalId || '').trim();

  const selectedChat = useMemo(
    () => conversations.find((item) => item.id === selectedChatId) || null,
    [conversations, selectedChatId]
  );
  useEffect(() => {
    if (!focusProposalId || !conversations.length) return;

    const targetConversation = conversations.find((chat) => {
      if (String(chat?.id || '').trim() === focusProposalId) return true;
      return Array.isArray(chat?.proposal_ids) && chat.proposal_ids.some((id) => String(id || '').trim() === focusProposalId);
    });

    if (targetConversation?.id) {
      setSelectedChatId(targetConversation.id);
    }
  }, [conversations, focusProposalId]);

  const selectedBuyerIdentity = useMemo(() => {
    const proposalId = String(selectedChatId || '').trim();
    if (!proposalId) return null;
    return buyerIdentityByProposalId[proposalId] || null;
  }, [buyerIdentityByProposalId, selectedChatId]);
  const resolvedActorUserId = actorMessageUserId || actorUserId;

  const participantFromMessages = useMemo(() => {
    if (!resolvedActorUserId) return '';
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const senderId = String(messages[index]?.sender_id || '').trim();
      if (senderId && senderId !== resolvedActorUserId) return senderId;
    }
    return '';
  }, [messages, resolvedActorUserId]);

  const counterpartUserId = useMemo(
    () => String(participantUserId || selectedBuyerIdentity?.userId || participantFromMessages || '').trim(),
    [participantUserId, selectedBuyerIdentity?.userId, participantFromMessages]
  );
  const buyerName = resolveBuyerNameFromIdentity(selectedBuyerIdentity, selectedChat);
  const buyerEmail = selectedBuyerIdentity?.email || resolveBuyerEmail(selectedChat);
  const buyerAvatar = selectedBuyerIdentity?.avatar || resolveBuyerAvatar(selectedChat);
  const buyerCompany = selectedBuyerIdentity?.company || resolveBuyerCompany(selectedChat);
  const buyerEmailMasked = maskEmail(buyerEmail);
  const buyerCompanyMasked = maskCompanyName(buyerCompany);
  const buyerVerificationLabel =
    selectedBuyerIdentity?.verificationLabel || resolveBuyerVerificationLabel(selectedChat);
  const buyerVerified =
    typeof selectedBuyerIdentity?.isVerified === 'boolean'
      ? selectedBuyerIdentity.isVerified
      : isBuyerVerified(selectedChat);
  const counterpartPresenceIdentity = useMemo(
    () => ({
      userIds: [
        String(counterpartUserId || '').trim(),
        String(selectedChat?.buyers?.user_id || '').trim(),
        String(selectedChat?.buyers?.id || '').trim(),
        String(selectedChat?.buyer_id || '').trim(),
      ],
      emails: [String(buyerEmail || '').trim().toLowerCase()],
    }),
    [counterpartUserId, selectedChat?.buyers?.user_id, selectedChat?.buyers?.id, selectedChat?.buyer_id, buyerEmail]
  );

  const participantPresence = useMemo(
    () => resolvePresenceEntry(presenceByUserId, counterpartPresenceIdentity),
    [presenceByUserId, counterpartPresenceIdentity]
  );
  const globalParticipantPresence = useMemo(
    () => resolvePresenceEntry(portalPresenceByUserId, counterpartPresenceIdentity),
    [portalPresenceByUserId, counterpartPresenceIdentity]
  );
  const isParticipantTyping = Boolean(participantPresence?.typing);
  const localParticipantOnline = typeof participantPresence?.online === 'boolean' ? participantPresence.online : null;
  const globalParticipantOnline = typeof globalParticipantPresence?.online === 'boolean' ? globalParticipantPresence.online : null;
  const hasLocalParticipantPresence = Boolean(participantPresence);
  const hasGlobalParticipantPresence = Boolean(globalParticipantPresence);
  const isParticipantOnline = Boolean(
    (counterpartPresenceIdentity.userIds.some(Boolean) || counterpartPresenceIdentity.emails.some(Boolean)) &&
    (
      localParticipantOnline === true ||
      globalParticipantOnline === true ||
      hasLocalParticipantPresence ||
      hasGlobalParticipantPresence ||
      (localParticipantOnline === null && globalParticipantOnline === null && isParticipantTyping)
    )
  );
  const participantStatusText = isParticipantTyping ? 'Typing...' : (isParticipantOnline ? 'Online' : 'Offline');
  const selectedAvatarDotClass = isParticipantOnline ? 'bg-emerald-500' : 'bg-gray-300';
  const isMessagingBlocked = blockStatus?.can_message === false;
  const blockedNoticeText = blockStatus?.blocked_by_me
    ? 'You blocked this buyer. Unblock to send messages.'
    : blockStatus?.blocked_me
      ? 'This buyer has blocked you. Messaging is disabled.'
      : '';
  const messagePlaceholderText = isMessagingBlocked
    ? (blockStatus?.blocked_by_me ? 'Unblock this buyer to send messages' : 'Messaging unavailable for this chat')
    : 'Type a message...';

  const mergeBuyerIdentityForProposal = useCallback((proposalIdInput, candidate = {}) => {
    const proposalId = String(proposalIdInput || '').trim();
    if (!proposalId) return;

    const nextNameRaw = String(candidate?.name || '').trim();
    const nextEmail = String(candidate?.email || '').trim();
    const nextAvatar = String(candidate?.avatar || '').trim();
    const nextUserId = String(candidate?.userId || '').trim();
    const nextCompany = String(candidate?.company || '').trim();
    const nextVerificationLabel = String(candidate?.verificationLabel || '').trim();
    const nextIsVerified =
      typeof candidate?.isVerified === 'boolean' ? candidate.isVerified : null;
    const hasPayload = Boolean(nextNameRaw || nextEmail || nextAvatar || nextUserId || nextCompany);
    if (!hasPayload) return;

    setBuyerIdentityByProposalId((prev) => {
      const current = prev[proposalId] || {};
      const currentNameRaw = String(current?.name || '').trim();
      const preferredNextName = isPlaceholderBuyerLabel(nextNameRaw) ? '' : nextNameRaw;
      const preferredCurrentName = isPlaceholderBuyerLabel(currentNameRaw) ? '' : currentNameRaw;
      return {
        ...prev,
        [proposalId]: {
          name: preferredNextName || preferredCurrentName || nextNameRaw || currentNameRaw || '',
          email: nextEmail || String(current?.email || '').trim(),
          avatar: nextAvatar || String(current?.avatar || '').trim(),
          userId: nextUserId || String(current?.userId || '').trim(),
          company: nextCompany || String(current?.company || '').trim(),
          verificationLabel: nextVerificationLabel || String(current?.verificationLabel || '').trim(),
          isVerified:
            nextIsVerified === null
              ? (typeof current?.isVerified === 'boolean' ? current.isVerified : null)
              : nextIsVerified,
        },
      };
    });
  }, []);

  const hydrateBuyerIdentityFromServer = useCallback(async (proposalIdInput, fallbackUserId = '') => {
    const proposalId = String(proposalIdInput || '').trim();
    if (!proposalId) return null;

    try {
      const proposal = await vendorApi.proposals.get(proposalId);
      if (!proposal) return null;
      const buyers = proposal?.buyers || {};
      return {
        name:
          buyers?.full_name ||
          buyers?.company_name ||
          proposal?.buyer_name ||
          '',
        email: buyers?.email || proposal?.buyer_email || '',
        avatar: buyers?.avatar_url || proposal?.buyer_avatar || '',
        userId: buyers?.user_id || String(fallbackUserId || '').trim(),
        company: buyers?.company_name || proposal?.company_name || '',
        verificationLabel:
          buyers?.verification_badge ||
          (buyers?.is_verified === true || buyers?.is_active === true ? 'Verified' : 'Unverified'),
        isVerified: buyers?.is_verified === true || buyers?.is_active === true,
      };
    } catch (error) {
      console.warn('Failed to hydrate buyer identity:', error);
      return null;
    }
  }, []);

  const messageItems = useMemo(() => {
    const items = [];
    let previousDayKey = '';

    for (const row of messages) {
      const timeValue = row?.created_at || row?.updated_at || null;
      const dayKey = toDayKey(timeValue);
      if (dayKey && dayKey !== previousDayKey) {
        items.push({
          type: 'day-separator',
          id: `day-${dayKey}`,
          label: formatDayLabel(timeValue),
        });
        previousDayKey = dayKey;
      }

      items.push({
        type: 'message',
        id: `message-${row?.id || `idx-${items.length}`}`,
        value: row,
      });
    }

    return items;
  }, [messages]);


  const scrollMessagesToBottom = useCallback((behavior = 'smooth') => {
    const el = messageListRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const openImagePreview = useCallback((src, alt = 'Profile image') => {
    const normalizedSrc = String(src || '').trim();
    if (!normalizedSrc) return;
    setImagePreview({
      src: normalizedSrc,
      alt: String(alt || 'Profile image'),
    });
  }, []);

  const closeImagePreview = useCallback(() => {
    setImagePreview(null);
  }, []);

  const trackTypingPresence = useCallback(
    async (typing) => {
      const channel = presenceChannelRef.current;
      const userId = String(resolvedActorUserId || '').trim();
      if (!channel || !userId) return;
      if (typingStateRef.current === typing) return;
      typingStateRef.current = typing;
      try {
        await channel.track({
          user_id: userId,
          role: 'vendor',
          typing,
          at: new Date().toISOString(),
        });
      } catch (error) {
        console.warn('Failed to track vendor typing presence:', error);
      }
    },
    [resolvedActorUserId]
  );

  const handleMessageInputChange = useCallback(
    (event) => {
      const value = event.target.value;
      setNewMessage(value);

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }

      if (!value.trim()) {
        trackTypingPresence(false);
        return;
      }

      trackTypingPresence(true);
      typingTimerRef.current = setTimeout(() => {
        trackTypingPresence(false);
      }, 1200);
    },
    [trackTypingPresence]
  );

  const contextMenuStyle = useMemo(() => {
    if (!contextMenu) return null;
    const padding = 8;
    const menuWidth = 170;
    const menuHeight = contextMenu?.type === 'conversation' ? 54 : 96;
    let left = Number(contextMenu.x || 0);
    let top = Number(contextMenu.y || 0);

    if (typeof window !== 'undefined') {
      if (left + menuWidth > window.innerWidth - padding) {
        left = window.innerWidth - menuWidth - padding;
      }
      if (top + menuHeight > window.innerHeight - padding) {
        top = window.innerHeight - menuHeight - padding;
      }
    }

    return {
      left: `${Math.max(padding, left)}px`,
      top: `${Math.max(padding, top)}px`,
    };
  }, [contextMenu]);

  const acknowledgeDelivered = useCallback(async (proposalIds = []) => {
    const ids = Array.from(new Set((proposalIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
    if (!ids.length) return;

    try {
      await fetchWithCsrf(apiUrl('/api/quotation/messages/ack-delivered'), {
        method: 'POST',
        body: JSON.stringify({ proposal_ids: ids }),
      });
    } catch (error) {
      console.warn('Vendor delivery ack failed:', error);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setActorUserId(String(data?.user?.id || ''));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setEditingMessageId(null);
    setEditingProposalId('');
    setEditingText('');
    setSavingMessageId(null);
    setDeletingMessageId(null);
    setBlockStatus({ ...DEFAULT_CHAT_BLOCK_STATUS });
    setBlockActionLoading(false);
    setContextMenu(null);
  }, [selectedChatId]);

  useEffect(() => {
    const proposalId = String(selectedChatId || '').trim();
    if (!proposalId) return undefined;

    let active = true;
    mergeBuyerIdentityForProposal(proposalId, {
      name: resolveBuyerName(selectedChat),
      email: resolveBuyerEmail(selectedChat),
      avatar: resolveBuyerAvatar(selectedChat),
      userId: counterpartUserId || selectedChat?.buyers?.user_id || '',
      company: resolveBuyerCompany(selectedChat),
      verificationLabel: resolveBuyerVerificationLabel(selectedChat),
      isVerified: isBuyerVerified(selectedChat),
    });

    const hydrateFromServer = async () => {
      const identity = await hydrateBuyerIdentityFromServer(proposalId, counterpartUserId || selectedChat?.buyers?.user_id || '');
      if (!active || !identity) return;
      mergeBuyerIdentityForProposal(proposalId, identity);
    };

    hydrateFromServer();

    return () => {
      active = false;
    };
  }, [
    selectedChatId,
    selectedChat,
    counterpartUserId,
    mergeBuyerIdentityForProposal,
    hydrateBuyerIdentityFromServer,
  ]);

  useEffect(() => () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!contextMenu) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (target?.closest?.('[data-message-context-menu="true"]')) return;
      setContextMenu(null);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setContextMenu(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!imagePreview) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setImagePreview(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!selectedChatId) return;
    scrollMessagesToBottom('auto');
  }, [selectedChatId, scrollMessagesToBottom]);

  useEffect(() => {
    if (!selectedChatId) return;
    scrollMessagesToBottom('smooth');
  }, [messages.length, selectedChatId, scrollMessagesToBottom]);

  const loadConversations = async () => {
    setLoadingConversations(true);
    try {
      let combined = await vendorApi.proposals.list('all').catch(() => []);
      if (!Array.isArray(combined)) combined = [];

      // Last-resort fallback for deployments where /vendors/me/proposals is empty.
      if (combined.length === 0) {
        const sentFromQuotation = await quotationApi.getSentQuotations().catch(() => []);
        if (Array.isArray(sentFromQuotation) && sentFromQuotation.length > 0) {
          combined = sentFromQuotation;
        }
      }

      const uniqueById = new Map();
      combined.forEach((row) => {
        if (!row?.id) return;
        if (!uniqueById.has(row.id)) uniqueById.set(row.id, row);
      });

      let sortedRows = Array.from(uniqueById.values()).sort((a, b) => {
        const aTs = new Date(a?.created_at || 0).getTime();
        const bTs = new Date(b?.created_at || 0).getTime();
        return bTs - aTs;
      });

      const weakIdentityProposalIds = sortedRows
        .filter((row) => {
          const proposalId = String(row?.id || '').trim();
          if (!proposalId) return false;
          return buildBuyerConversationKey(row).startsWith('proposal:');
        })
        .map((row) => String(row?.id || '').trim());

      if (weakIdentityProposalIds.length > 0) {
        const hydratedByProposalId = new Map();
        const hydratedEntries = await Promise.allSettled(
          weakIdentityProposalIds.map(async (proposalId) => {
            const proposal = await vendorApi.proposals.get(proposalId);
            return { proposalId, proposal };
          })
        );

        hydratedEntries.forEach((entry) => {
          if (entry.status !== 'fulfilled') return;
          const proposalId = String(entry.value?.proposalId || '').trim();
          const proposal = entry.value?.proposal;
          if (!proposalId || !proposal) return;
          hydratedByProposalId.set(proposalId, proposal);
        });

        if (hydratedByProposalId.size > 0) {
          sortedRows = sortedRows.map((row) => {
            const proposalId = String(row?.id || '').trim();
            if (!proposalId) return row;
            const hydrated = hydratedByProposalId.get(proposalId);
            if (!hydrated) return row;
            return mergeConversationRowWithHydratedProposal(row, hydrated);
          });
        }
      }

      const groupedByBuyer = new Map();
      sortedRows.forEach((row) => {
        const proposalId = String(row?.id || '').trim();
        if (!proposalId) return;

        const key = buildBuyerConversationKey(row);
        const existing = groupedByBuyer.get(key);
        if (!existing) {
          groupedByBuyer.set(key, {
            key,
            primaryProposalId: proposalId,
            proposalIds: [proposalId],
            row,
          });
          return;
        }

        if (!existing.proposalIds.includes(proposalId)) {
          existing.proposalIds.push(proposalId);
        }

        const existingTs = new Date(existing.row?.created_at || 0).getTime();
        const incomingTs = new Date(row?.created_at || 0).getTime();
        if (incomingTs > existingTs) {
          existing.primaryProposalId = proposalId;
          existing.row = row;
        }
      });

      const groupedRows = Array.from(groupedByBuyer.values())
        .sort((a, b) => {
          const aTs = new Date(a?.row?.created_at || 0).getTime();
          const bTs = new Date(b?.row?.created_at || 0).getTime();
          return bTs - aTs;
        })
        .map((entry) => ({
          ...entry.row,
          id: entry.primaryProposalId,
          primary_proposal_id: entry.primaryProposalId,
          proposal_ids: Array.from(new Set(entry.proposalIds)),
          buyer_group_key: entry.key,
          proposal_count: entry.proposalIds.length,
        }));

      setConversations(groupedRows);
      setBuyerIdentityByProposalId((prev) => {
        const next = { ...prev };
        groupedRows.forEach((row) => {
          const proposalId = String(row?.id || '').trim();
          if (!proposalId) return;
          const name = String(resolveBuyerName(row) || '').trim();
          const email = String(resolveBuyerEmail(row) || '').trim();
          const avatar = String(resolveBuyerAvatar(row) || '').trim();
          const userId = String(row?.buyers?.user_id || '').trim();
          const company = String(resolveBuyerCompany(row) || '').trim();
          const verificationLabel = String(resolveBuyerVerificationLabel(row) || '').trim();
          const isVerified = isBuyerVerified(row);
          const existing = next[proposalId] || {};
          const existingName = String(existing?.name || '').trim();
          const preferredNewName = !isPlaceholderBuyerLabel(name) ? name : '';
          const preferredExistingName = !isPlaceholderBuyerLabel(existingName) ? existingName : '';
          next[proposalId] = {
            name: preferredNewName || preferredExistingName || existingName || name || '',
            email: email || String(existing?.email || '').trim(),
            avatar: avatar || String(existing?.avatar || '').trim(),
            userId: userId || String(existing?.userId || '').trim(),
            company: company || String(existing?.company || '').trim(),
            verificationLabel: verificationLabel || String(existing?.verificationLabel || '').trim(),
            isVerified:
              typeof existing?.isVerified === 'boolean'
                ? existing.isVerified
                : isVerified,
          };
        });
        return next;
      });
      setSelectedChatId((prev) => {
        if (prev && groupedRows.some((row) => row.id === prev)) return prev;
        return groupedRows[0]?.id || null;
      });
      acknowledgeDelivered(
        groupedRows.flatMap((row) =>
          Array.isArray(row?.proposal_ids) && row.proposal_ids.length ? row.proposal_ids : [row?.id]
        )
      );

      const hydrationTargets = groupedRows
        .map((row) => ({
          proposalId: String(row?.id || '').trim(),
          fallbackUserId: String(row?.buyers?.user_id || '').trim(),
          needsHydration:
            buildBuyerConversationKey(row).startsWith('proposal:') ||
            isPlaceholderBuyerLabel(resolveBuyerName(row)) ||
            !String(resolveBuyerEmail(row) || '').trim(),
        }))
        .filter((item) => item.proposalId && item.needsHydration);

      void Promise.allSettled(
        hydrationTargets.map(async (item) => {
          const identity = await hydrateBuyerIdentityFromServer(item.proposalId, item.fallbackUserId);
          if (!identity) return;
          mergeBuyerIdentityForProposal(item.proposalId, identity);
        })
      );
    } catch (error) {
      console.error('Error loading vendor conversations:', error);
      setConversations([]);
      setSelectedChatId(null);
    } finally {
      setLoadingConversations(false);
    }
  };

  const fetchMessages = async (proposalId, { silent = false, proposalIds: proposalIdsInput = [] } = {}) => {
    const fallbackProposalId = String(proposalId || '').trim();
    const proposalIds = Array.from(
      new Set(
        (proposalIdsInput?.length ? proposalIdsInput : [fallbackProposalId])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );

    if (!proposalIds.length) {
      setMessages([]);
      setBlockStatus({ ...DEFAULT_CHAT_BLOCK_STATUS });
      return;
    }

    if (!silent) setLoadingMessages(true);
    try {
      const results = await Promise.allSettled(
        proposalIds.map(async (id) => {
          const res = await fetchWithCsrf(apiUrl(`/api/quotation/${id}/messages`), {
            cache: 'no-store',
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error || 'Failed to load messages');
          return { proposalId: id, json };
        })
      );

      const successful = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);

      if (!successful.length) {
        const firstError = results.find((result) => result.status === 'rejected');
        throw firstError?.reason || new Error('Failed to load messages');
      }

      const responseActorId =
        successful.map((item) => String(item?.json?.actor_user_id || '').trim()).find(Boolean) || '';
      if (responseActorId) {
        setActorMessageUserId(responseActorId);
      }

      const responseBlockStatus =
        successful.map((item) => item?.json?.block_status).find((value) => value && typeof value === 'object') || null;
      setBlockStatus(normalizeChatBlockStatus(responseBlockStatus));

      const participantId =
        successful
          .map((item) => String(item?.json?.participants?.buyer_user_id || '').trim())
          .find(Boolean) || '';
      setParticipantUserId(participantId);

      const actorId = responseActorId || resolvedActorUserId;
      const merged = successful
        .flatMap((item) => {
          const incoming = Array.isArray(item?.json?.messages) ? item.json.messages : [];
          return incoming.map((row) => ({
            ...row,
            proposal_id: String(row?.proposal_id || item.proposalId || '').trim() || null,
          }));
        })
        .sort((a, b) => {
          const aTs = new Date(a?.created_at || a?.updated_at || 0).getTime();
          const bTs = new Date(b?.created_at || b?.updated_at || 0).getTime();
          return aTs - bTs;
        });

      const deduped = [];
      const seen = new Set();
      merged.forEach((row) => {
        const messageId = String(row?.id || '').trim();
        if (messageId && seen.has(messageId)) return;
        if (messageId) seen.add(messageId);
        deduped.push(row);
      });

      setMessages(deduped.map((row) => normalizeMessageRow(row, actorId, 'vendor')));
    } catch (error) {
      console.error('Error loading proposal messages:', error);
      if (!silent) {
        setMessages([]);
        setBlockStatus({ ...DEFAULT_CHAT_BLOCK_STATUS });
      }
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([]);
      setParticipantUserId('');
      setPresenceByUserId({});
      return;
    }

    let active = true;
    let fallbackPollId = null;
    const activeProposalIds = Array.from(
      new Set(
        ((Array.isArray(selectedChat?.proposal_ids) && selectedChat.proposal_ids.length)
          ? selectedChat.proposal_ids
          : [selectedChatId])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );
    const presenceKey =
      String(resolvedActorUserId || '').trim() ||
      `vendor-${selectedChatId}-${Date.now()}`;
    const syncMessages = async () => {
      if (!active || syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
        await fetchMessages(selectedChatId, { silent: true, proposalIds: activeProposalIds });
      } finally {
        syncInFlightRef.current = false;
      }
    };

    const backgroundSyncId = setInterval(() => {
      syncMessages();
    }, 1200);

    fetchMessages(selectedChatId, { proposalIds: activeProposalIds });

    let channel = supabase.channel(`proposal-chat-${selectedChatId}`, {
      config: { presence: { key: presenceKey } },
    });

    const attachProposalEvent = (event, handler) => {
      activeProposalIds.forEach((proposalId) => {
        channel = channel.on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table: 'proposal_messages',
            filter: `proposal_id=eq.${proposalId}`,
          },
          handler
        );
      });
    };

    attachProposalEvent('INSERT', (payload) => {
      if (!active) return;
      const row = payload?.new;
      if (!row?.id) return;
      const normalized = normalizeMessageRow(row, resolvedActorUserId, 'vendor');
      setMessages((prev) => {
        if (prev.some((item) => item.id === row.id)) return prev;
        return [...prev, normalized];
      });
    });

    attachProposalEvent('UPDATE', (payload) => {
      if (!active) return;
      const row = payload?.new;
      if (!row?.id) return;
      const normalized = normalizeMessageRow(row, resolvedActorUserId, 'vendor');
      setMessages((prev) => {
        const idx = prev.findIndex((item) => item.id === row.id);
        if (idx === -1) return [...prev, normalized];
        const next = [...prev];
        next[idx] = normalized;
        return next;
      });
    });

    attachProposalEvent('DELETE', (payload) => {
      if (!active) return;
      const deletedId = payload?.old?.id || payload?.new?.id;
      if (!deletedId) return;
      setMessages((prev) => prev.filter((item) => item.id !== deletedId));
    });

    channel = channel
      .on('presence', { event: 'sync' }, () => {
        if (!active) return;
        const state = channel.presenceState();
        const mapped = mapPresenceStateWithAliases(state);
        setPresenceByUserId(mapped);
      })
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          presenceChannelRef.current = channel;
          typingStateRef.current = false;
          if (resolvedActorUserId) {
            channel.track({
              user_id: resolvedActorUserId,
              role: 'vendor',
              typing: false,
              at: new Date().toISOString(),
            }).catch(() => {});
          }
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (!fallbackPollId) {
            fallbackPollId = setInterval(() => {
              syncMessages();
            }, 2500);
          }
        }
        if (status === 'SUBSCRIBED' && fallbackPollId) {
          clearInterval(fallbackPollId);
          fallbackPollId = null;
        }
      });

    return () => {
      active = false;
      presenceChannelRef.current = null;
      typingStateRef.current = false;
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      setPresenceByUserId({});
      clearInterval(backgroundSyncId);
      if (fallbackPollId) clearInterval(fallbackPollId);
      supabase.removeChannel(channel);
    };
  }, [selectedChatId, selectedChat, resolvedActorUserId]);

  const handleSend = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || !selectedChatId || sending || isMessagingBlocked || blockActionLoading) return;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    trackTypingPresence(false);

    setSending(true);
    try {
      const res = await fetchWithCsrf(apiUrl(`/api/quotation/${selectedChatId}/messages`), {
        method: 'POST',
        body: JSON.stringify({ message: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.block_status) {
          setBlockStatus(normalizeChatBlockStatus(json.block_status));
        }
        throw new Error(json?.error || 'Failed to send message');
      }

      if (json?.message?.id) {
        const normalized = normalizeMessageRow(json.message, resolvedActorUserId, 'vendor');
        setMessages((prev) => {
          if (prev.some((item) => item.id === normalized.id)) return prev;
          return [...prev, normalized];
        });
      } else {
        await fetchMessages(selectedChatId, { silent: true, proposalIds: selectedChat?.proposal_ids || [] });
      }
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send vendor message:', error);
      toast({
        title: 'Send failed',
        description: error?.message || 'Unable to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleToggleBlock = async () => {
    const proposalId = String(selectedChatId || '').trim();
    if (!proposalId || blockActionLoading) return;

    const action = blockStatus?.blocked_by_me ? 'unblock' : 'block';
    setBlockActionLoading(true);
    try {
      const res = await fetchWithCsrf(apiUrl(`/api/quotation/${proposalId}/block`), {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Failed to ${action} chat`);

      setBlockStatus(normalizeChatBlockStatus(json?.block_status));

      if (action === 'block') {
        if (typingTimerRef.current) {
          clearTimeout(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        trackTypingPresence(false);
        setNewMessage('');
      }

      toast({
        title: action === 'block' ? 'Buyer blocked' : 'Buyer unblocked',
        description:
          action === 'block'
            ? 'Messaging is disabled for this chat until you unblock.'
            : 'Messaging is enabled again for this chat.',
      });
    } catch (error) {
      console.error('Failed to update block status:', error);
      toast({
        title: 'Action failed',
        description: error?.message || 'Unable to update chat block status',
        variant: 'destructive',
      });
    } finally {
      setBlockActionLoading(false);
    }
  };

  const startEditing = (msg) => {
    if (!msg?.id || !msg?.is_me) return;
    setEditingMessageId(msg.id);
    setEditingProposalId(String(msg?.proposal_id || selectedChatId || '').trim());
    setEditingText(String(msg?.message || ''));
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingProposalId('');
    setEditingText('');
    setSavingMessageId(null);
  };

  const handleEditMessage = async () => {
    const messageId = String(editingMessageId || '').trim();
    const proposalId = String(editingProposalId || selectedChatId || '').trim();
    const updatedText = editingText.trim();
    if (!proposalId || !messageId || !updatedText) return;

    setSavingMessageId(messageId);
    try {
      const res = await fetchWithCsrf(apiUrl(`/api/quotation/${proposalId}/messages/${messageId}`), {
        method: 'PATCH',
        body: JSON.stringify({ message: updatedText }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to edit message');

      if (json?.message?.id) {
        const normalized = normalizeMessageRow(json.message, resolvedActorUserId, 'vendor');
        setMessages((prev) => prev.map((item) => (item.id === normalized.id ? normalized : item)));
      } else {
        await fetchMessages(proposalId, { silent: true, proposalIds: selectedChat?.proposal_ids || [] });
      }
      cancelEditing();
    } catch (error) {
      console.error('Failed to edit vendor message:', error);
      setSavingMessageId(null);
    }
  };

  const handleDeleteMessage = async (messageId, proposalIdInput = selectedChatId) => {
    const proposalId = String(proposalIdInput || '').trim();
    const targetMessageId = String(messageId || '').trim();
    if (!proposalId || !targetMessageId || deletingMessageId) return;

    setDeletingMessageId(targetMessageId);
    try {
      const res = await fetchWithCsrf(apiUrl(`/api/quotation/${proposalId}/messages/${targetMessageId}`), {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to delete message');

      setMessages((prev) => prev.filter((item) => item.id !== targetMessageId));
      if (editingMessageId === targetMessageId) {
        cancelEditing();
      }
      toast({ title: 'Message deleted' });
    } catch (error) {
      console.error('Failed to delete vendor message:', error);
      toast({
        title: 'Delete failed',
        description: error?.message || 'Unable to delete message',
        variant: 'destructive',
      });
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleDeleteConversation = async (proposalIdInput) => {
    const proposalId = String(proposalIdInput || '').trim();
    if (!proposalId || deletingConversationId) return;
    const conversation = conversations.find((item) => String(item?.id || '').trim() === proposalId);
    const proposalIds = Array.from(
      new Set(
        (Array.isArray(conversation?.proposal_ids) && conversation.proposal_ids.length
          ? conversation.proposal_ids
          : [proposalId]
        )
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );

    setDeletingConversationId(proposalId);
    try {
      for (const targetProposalId of proposalIds) {
        const res = await fetchWithCsrf(apiUrl(`/api/quotation/${targetProposalId}/messages`), {
          method: 'DELETE',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to delete chat');
      }

      if (String(selectedChatId || '').trim() === proposalId) {
        setMessages([]);
        cancelEditing();
      }

      await loadConversations();
      toast({
        title: 'Chat deleted',
        description:
          proposalIds.length > 1
            ? `${proposalIds.length} linked proposal chats were removed.`
            : 'Conversation removed successfully.',
      });
    } catch (error) {
      console.error('Failed to delete vendor conversation:', error);
      toast({
        title: 'Delete failed',
        description: error?.message || 'Unable to delete chat',
        variant: 'destructive',
      });
    } finally {
      setDeletingConversationId(null);
    }
  };

  const requestDeleteMessage = useCallback((messageId, proposalIdInput = selectedChatId) => {
    const proposalId = String(proposalIdInput || '').trim();
    const targetMessageId = String(messageId || '').trim();
    if (!proposalId || !targetMessageId || deletingMessageId) return;
    setConfirmDialog({
      type: 'message',
      proposalId,
      messageId: targetMessageId,
    });
  }, [selectedChatId, deletingMessageId]);

  const requestDeleteConversation = useCallback((proposalIdInput) => {
    const proposalId = String(proposalIdInput || '').trim();
    if (!proposalId || deletingConversationId) return;
    setConfirmDialog({
      type: 'conversation',
      proposalId,
    });
  }, [deletingConversationId]);

  const handleConfirmDialogAction = async () => {
    const pending = confirmDialog;
    if (!pending) return;

    if (pending.type === 'conversation') {
      await handleDeleteConversation(pending.proposalId);
    } else if (pending.type === 'message') {
      await handleDeleteMessage(pending.messageId, pending.proposalId);
    }

    setConfirmDialog(null);
  };

  const isConfirmBusy = confirmDialog?.type === 'conversation'
    ? deletingConversationId === String(confirmDialog?.proposalId || '').trim()
    : confirmDialog?.type === 'message'
      ? deletingMessageId === String(confirmDialog?.messageId || '').trim()
      : false;

  const confirmTitle = confirmDialog?.type === 'conversation' ? 'Delete chat?' : 'Delete message?';
  const confirmDescription = confirmDialog?.type === 'conversation'
    ? 'All chats in this conversation will be permanently deleted and cannot be recovered. Do you want to continue?'
    : 'This message will be permanently deleted and cannot be recovered. Do you want to continue?';

  return (
    <div className="h-[calc(100vh-140px)] min-h-[540px] flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      </div>

      <div className="grid flex-1 min-h-0 gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="min-h-0 flex flex-col overflow-hidden border-gray-200 rounded-xl shadow-sm bg-white">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-bold text-gray-800">Conversations</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="animate-spin text-gray-400" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No conversations yet</div>
            ) : (
              conversations.map((chat) => (
                (() => {
                  const proposalId = String(chat?.id || '').trim();
                  const identity = proposalId ? buyerIdentityByProposalId[proposalId] || null : null;
                  const conversationName = resolveBuyerNameFromIdentity(identity, chat);
                  const conversationEmail = identity?.email || resolveBuyerEmail(chat);
                  const conversationAvatar = identity?.avatar || resolveBuyerAvatar(chat);
                  const conversationCompany = identity?.company || resolveBuyerCompany(chat);
                  const proposalCount =
                    Array.isArray(chat?.proposal_ids) && chat.proposal_ids.length ? chat.proposal_ids.length : 1;
                  const conversationSummaryBase =
                    conversationCompany || chat?.product_name || chat?.title || 'Proposal conversation';
                  const conversationSummary =
                    proposalCount > 1 ? `${conversationSummaryBase} • ${proposalCount} proposals` : conversationSummaryBase;
                  const conversationPresenceIdentity = {
                    userIds: [
                      String(identity?.userId || '').trim(),
                      String(chat?.buyers?.user_id || '').trim(),
                      String(chat?.buyers?.id || '').trim(),
                      String(chat?.buyer_id || '').trim(),
                    ],
                    emails: [String(conversationEmail || '').trim().toLowerCase()],
                  };
                  const conversationPresence = resolvePresenceEntry(presenceByUserId, conversationPresenceIdentity);
                  const conversationGlobalPresence = resolvePresenceEntry(portalPresenceByUserId, conversationPresenceIdentity);
                  const conversationLocalOnline =
                    typeof conversationPresence?.online === 'boolean' ? conversationPresence.online : null;
                  const conversationGlobalOnline =
                    typeof conversationGlobalPresence?.online === 'boolean' ? conversationGlobalPresence.online : null;
                  const conversationHasLocalPresence = Boolean(conversationPresence);
                  const conversationHasGlobalPresence = Boolean(conversationGlobalPresence);
                  const conversationIsOnline = Boolean(
                    (conversationPresenceIdentity.userIds.some(Boolean) || conversationPresenceIdentity.emails.some(Boolean)) &&
                    (
                      conversationLocalOnline === true ||
                      conversationGlobalOnline === true ||
                      conversationHasLocalPresence ||
                      conversationHasGlobalPresence
                    )
                  );
                  const conversationDotClass = conversationIsOnline ? 'bg-emerald-500' : 'bg-gray-300';

                  return (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => setSelectedChatId(chat.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setSelectedChatId(chat.id);
                        setContextMenu({
                          type: 'conversation',
                          proposalId: String(chat?.id || '').trim(),
                          x: event.clientX,
                          y: event.clientY,
                        });
                      }}
                      className={`w-full p-4 border-b text-left hover:bg-blue-50/50 transition-colors ${
                        selectedChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-l-[#003D82]' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <Avatar
                            className={`h-10 w-10 border border-gray-200 ${conversationAvatar ? 'cursor-zoom-in' : ''}`}
                            onClick={() => {
                              if (!conversationAvatar) return;
                              setSelectedChatId(chat.id);
                              openImagePreview(conversationAvatar, conversationName);
                            }}
                          >
                            {conversationAvatar ? (
                              <AvatarImage src={conversationAvatar} alt={conversationName} />
                            ) : null}
                            <AvatarFallback className="bg-blue-50 text-[#003D82]">
                              {getAvatarInitials(conversationName, conversationEmail)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${conversationDotClass}`}
                            aria-hidden="true"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-2 mb-1">
                            <span className="font-semibold text-gray-900 text-sm truncate">{conversationName}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">{safeDate(chat?.created_at)}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {conversationSummary}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })()
              ))
            )}
          </div>
        </Card>

        <Card className="min-h-0 flex flex-col overflow-hidden border-gray-200 rounded-xl shadow-sm bg-white">
          {selectedChat ? (
            <>
              <div className="p-4 border-b bg-white flex items-start justify-between gap-3 shadow-sm z-10">
                <div className="min-w-0 flex items-start gap-3 flex-1">
                  <div className="relative shrink-0">
                    <Avatar
                      className={`h-11 w-11 border border-gray-200 ${buyerAvatar ? 'cursor-zoom-in' : ''}`}
                      onClick={() => openImagePreview(buyerAvatar, buyerName)}
                    >
                      {buyerAvatar ? <AvatarImage src={buyerAvatar} alt={buyerName} /> : null}
                      <AvatarFallback className="bg-blue-50 text-[#003D82]">
                        {getAvatarInitials(buyerName, buyerEmail)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${selectedAvatarDotClass}`}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{buyerName}</h3>
                    <p className="text-xs text-gray-500 truncate">{buyerEmailMasked || 'No email available'}</p>
                    <p className="text-xs text-gray-500 truncate">{buyerCompanyMasked || 'No company available'}</p>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      buyerVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {buyerVerificationLabel}
                  </span>
                  <p className={`text-xs ${isParticipantTyping ? 'text-[#003D82]' : 'text-gray-500'}`}>
                    {participantStatusText}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant={blockStatus?.blocked_by_me ? 'outline' : 'destructive'}
                    onClick={handleToggleBlock}
                    disabled={blockActionLoading}
                    className={
                      blockStatus?.blocked_by_me
                        ? 'h-8 px-3 text-xs'
                        : 'h-8 px-3 text-xs bg-red-600 text-white hover:bg-red-700'
                    }
                  >
                    {blockActionLoading ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Updating
                      </span>
                    ) : blockStatus?.blocked_by_me ? (
                      'Unblock'
                    ) : (
                      'Block'
                    )}
                  </Button>
                </div>
              </div>

              <div ref={messageListRef} className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-400 mt-10">Start the conversation...</div>
                ) : (
                  messageItems.map((entry) => {
                    if (entry.type === 'day-separator') {
                      return (
                        <div key={entry.id} className="flex justify-center py-1">
                          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] text-gray-500">
                            {entry.label}
                          </span>
                        </div>
                      );
                    }

                    const msg = entry.value;
                    const isMe = !!msg?.is_me;
                    const isEditing = editingMessageId === msg.id;
                    const isSavingThis = savingMessageId === msg.id;
                    const tickState = String(msg?.delivery_state || 'sent').toLowerCase();
                    const TickIcon = tickState === 'sent' ? Check : CheckCheck;
                    const tickTitle = tickState === 'read' ? 'Read' : tickState === 'delivered' ? 'Delivered' : 'Sent';
                    const tickClass = tickState === 'read' ? 'text-sky-300' : 'text-blue-100';
                    const messageTime = formatMessageTime(msg?.created_at || msg?.updated_at);
                    const canOpenContextMenu = isMe && !isEditing;

                    return (
                      <div key={entry.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          onContextMenu={(event) => {
                            if (!canOpenContextMenu) return;
                            event.preventDefault();
                            setContextMenu({
                              type: 'message',
                              messageId: msg.id,
                              proposalId: String(msg?.proposal_id || selectedChatId || '').trim(),
                              x: event.clientX,
                              y: event.clientY,
                            });
                          }}
                          className={`max-w-[70%] px-4 py-2 rounded-xl text-sm ${
                            isMe
                              ? 'bg-[#003D82] text-white rounded-tr-none'
                              : 'bg-white border text-gray-800 rounded-tl-none'
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditMessage();
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                                className="h-9 bg-white text-gray-900"
                                autoFocus
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEditing}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-100 hover:text-white"
                                  disabled={isSavingThis}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleEditMessage}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-100 hover:text-white disabled:opacity-60"
                                  disabled={isSavingThis || !editingText.trim()}
                                >
                                  {isSavingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                              <div className={`mt-1 flex items-center gap-2 text-[11px] ${isMe ? 'justify-end text-blue-100' : 'text-gray-500'}`}>
                                {messageTime ? <span>{messageTime}</span> : null}
                                {msg?.is_edited ? <span>edited</span> : null}
                                {isMe ? (
                                  <span className={`inline-flex items-center ${tickClass}`} title={tickTitle}>
                                    <TickIcon className="h-3.5 w-3.5" />
                                  </span>
                                ) : null}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 bg-white border-t space-y-2">
                {isMessagingBlocked ? (
                  <p className="text-xs text-red-600">{blockedNoticeText}</p>
                ) : null}
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={handleMessageInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSend();
                    }}
                    placeholder={messagePlaceholderText}
                    className="flex-1 h-11"
                    disabled={sending || isMessagingBlocked || blockActionLoading}
                  />
                  <Button
                    onClick={handleSend}
                    size="icon"
                    className="h-11 w-11 bg-[#003D82] hover:bg-[#003D82]/90"
                    disabled={sending || isMessagingBlocked || blockActionLoading}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {contextMenu && contextMenuStyle ? (
                <div
                  data-message-context-menu="true"
                  className="fixed z-50 min-w-[170px] rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl"
                  style={contextMenuStyle}
                >
                  {contextMenu.type === 'conversation' ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                      onClick={async () => {
                        const proposalId = String(contextMenu?.proposalId || '').trim();
                        setContextMenu(null);
                        requestDeleteConversation(proposalId);
                      }}
                      disabled={deletingConversationId === String(contextMenu?.proposalId || '').trim()}
                    >
                      {deletingConversationId === String(contextMenu?.proposalId || '').trim() ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Delete Chat
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          const selectedMessage = messages.find((item) => item.id === contextMenu.messageId);
                          if (selectedMessage) {
                            startEditing(selectedMessage);
                          }
                          setContextMenu(null);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={() => {
                          requestDeleteMessage(contextMenu.messageId, contextMenu.proposalId || selectedChatId);
                          setContextMenu(null);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
              <p>Select a conversation to view messages</p>
            </div>
          )}
        </Card>
      </div>
      {imagePreview ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          onClick={closeImagePreview}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${imagePreview.src})` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-black/45 backdrop-blur-md" aria-hidden="true" />
          <button
            type="button"
            onClick={closeImagePreview}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 z-10"
            aria-label="Close image preview"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative z-10 w-full max-w-sm rounded-xl bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={imagePreview.src}
              alt={imagePreview.alt}
              className="w-full max-h-[320px] rounded-lg object-contain bg-slate-50"
            />
            <p className="mt-2 text-sm font-semibold text-slate-900 text-center truncate">
              {imagePreview.alt || 'Profile image'}
            </p>
          </div>
        </div>
      ) : null}
      <AlertDialog
        open={Boolean(confirmDialog)}
        onOpenChange={(open) => {
          if (!open && !isConfirmBusy) setConfirmDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirmBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isConfirmBusy}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDialogAction();
              }}
            >
              {isConfirmBusy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Messages;
