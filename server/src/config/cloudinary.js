/**
 * Cloudinary configuration
 * Configures the Cloudinary v2 SDK singleton with credentials from environment variables.
 * Used for uploading and retrieving lab report files and discharge summary documents.
 * The configured instance is exported and imported wherever file uploads are needed.
 */
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.toLowerCase(), // Cloudinary requires lowercase
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
