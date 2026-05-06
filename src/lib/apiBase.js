export const getApiBase = () => {
  const raw = (import.meta.env.VITE_API_URL || "").trim();
  if (!raw) return "";

  const rawLower = raw.toLowerCase();
  const pointsToLocal =
    rawLower.includes("localhost") || rawLower.includes("127.0.0.1");

  if (pointsToLocal) {
    // Never hard-code localhost API bases into the browser runtime.
    // In dev, same-origin `/api` lets the Vite proxy handle the backend.
    // In preview/production, this prevents broken localhost requests.
    return "";
  }

  return raw.replace(/\/+$/, "");
};

export const apiUrl = (path = "") => {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
};
