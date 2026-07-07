import { getSuperAdminToken } from '@/lib/superAdminApiClient';
import { apiUrl } from '@/lib/apiBase';

const HANDOFF_ACTION = apiUrl('/api/superadmin/impersonation/open');

const appendHiddenField = (form, name, value) => {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = String(value || '');
  form.appendChild(input);
};

export function submitAssistedDashboardHandoff({ targetType, targetId } = {}) {
  if (typeof document === 'undefined') {
    throw new Error('Assisted dashboard access is available only in the browser.');
  }

  const token = getSuperAdminToken();
  if (!token) {
    throw new Error('Superadmin session expired. Please log in again.');
  }

  const normalizedTargetType = String(targetType || '').trim().toUpperCase();
  const normalizedTargetId = String(targetId || '').trim();
  if (!['VENDOR', 'BUYER'].includes(normalizedTargetType) || !normalizedTargetId) {
    throw new Error('Invalid assisted dashboard target.');
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = HANDOFF_ACTION;
  form.style.display = 'none';
  form.acceptCharset = 'UTF-8';

  appendHiddenField(form, 'superadmin_token', token);
  appendHiddenField(form, 'target_type', normalizedTargetType);
  appendHiddenField(form, 'target_id', normalizedTargetId);
  appendHiddenField(form, 'return_to_origin', window.location.origin);

  document.body.appendChild(form);
  form.submit();
}
