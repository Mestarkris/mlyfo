/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@libsql/client", "libsql"],
  // The "Verified by Kane" page reads the last Kane report from disk.
  outputFileTracingIncludes: { "/app/verified": ["./kane/results/latest.json"], "/app": ["./kane/results/latest.json"] },
};
