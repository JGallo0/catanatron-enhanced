export const API_URL: string =
  import.meta.env.VITE_API_URL ||
  import.meta.env.CTRON_API_URL ||
  (import.meta.env.PROD ? "" : "http://localhost:5001");
