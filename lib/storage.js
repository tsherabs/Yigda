import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";

let configured = false;

function configureCloudinary() {
  if (configured) return;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary credentials are required.");
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });
  configured = true;
}

export async function uploadPDF(buffer, publicId) {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        folder: "yigda/documents",
        format: "pdf"
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    Readable.from(Buffer.from(buffer)).pipe(stream);
  });
}

function parseCloudinaryUrl(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);
  const resourceTypeIndex = parts.findIndex((part) => ["raw", "image", "video"].includes(part));
  if (resourceTypeIndex === -1) return null;

  const resourceType = parts[resourceTypeIndex];
  const deliveryType = parts[resourceTypeIndex + 1] || "upload";
  let publicParts = parts.slice(resourceTypeIndex + 2);
  if (publicParts[0] && /^v\d+$/.test(publicParts[0])) {
    publicParts = publicParts.slice(1);
  }

  const publicId = decodeURIComponent(publicParts.join("/"));
  const extension = publicId.match(/\.([a-z0-9]+)$/i)?.[1] || "pdf";
  if (!publicId) return null;
  return { publicId, format: extension, resourceType, deliveryType };
}

function signedCloudinaryDownloadUrl(url) {
  configureCloudinary();
  const asset = parseCloudinaryUrl(url);
  if (!asset) return "";

  return cloudinary.utils.private_download_url(asset.publicId, asset.format, {
    resource_type: asset.resourceType,
    type: asset.deliveryType,
    attachment: true,
    expires_at: Math.floor(Date.now() / 1000) + 5 * 60
  });
}

async function readFetchBuffer(response) {
  return Buffer.from(await response.arrayBuffer());
}

export async function fetchCloudinaryPDF(url) {
  const response = await fetch(url);
  if (response.ok) return readFetchBuffer(response);

  if ([401, 403, 404].includes(response.status)) {
    const signedUrl = signedCloudinaryDownloadUrl(url);
    if (signedUrl) {
      const signedResponse = await fetch(signedUrl);
      if (signedResponse.ok) return readFetchBuffer(signedResponse);
      throw new Error(`Cloudinary signed download failed with HTTP ${signedResponse.status}.`);
    }
  }

  throw new Error(`Cloudinary download failed with HTTP ${response.status}.`);
}
