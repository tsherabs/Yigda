/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pg", "cloudinary", "nats", "stripe", "web-push", "unzipper"]
};

export default nextConfig;
