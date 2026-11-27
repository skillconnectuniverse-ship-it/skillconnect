import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config.js';
import { Media } from '../models/Media.js';

// Cloudinary when CLOUDINARY_URL is set, otherwise images are stored in MongoDB (works on free hosts with no disk).
export async function saveImage(file, ownerId) {
  if (config.cloudinaryEnabled) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'skillconnect', resource_type: 'image', transformation: [{ width: 1600, crop: 'limit', quality: 'auto' }] },
        (err, result) => (err ? reject(err) : resolve(result.secure_url))
      );
      stream.end(file.buffer);
    });
  }
  const doc = await Media.create({ data: file.buffer, contentType: file.mimetype, owner: ownerId });
  return `${config.publicUrl}/media/${doc._id}`;
}