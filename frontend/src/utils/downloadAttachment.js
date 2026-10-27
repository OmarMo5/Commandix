import { toast } from 'react-toastify';
import api from '../api/axios';

// An <a href> can't send the Bearer token, so files are fetched as a blob through the API
// (which checks access) and then opened/saved from a short-lived object URL.

const VIEWABLE = (type = '') => type.startsWith('image/') || type === 'application/pdf';

async function errorMessage(err) {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text()).message; } catch { return null; }
  }
  return data?.message ?? null;
}

/** Opens images/PDFs in a new tab and saves everything else under its original name. */
export async function openAttachment(attachment) {
  // Open the tab synchronously (inside the click) so popup blockers allow it; fill it in after the fetch.
  const tab = VIEWABLE(attachment.file_type) ? window.open('', '_blank') : null;

  try {
    const { data } = await api.get(`/attachments/${attachment.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);

    if (tab) {
      tab.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    toast.error((await errorMessage(err)) || 'Could not open the file');
  }
}
