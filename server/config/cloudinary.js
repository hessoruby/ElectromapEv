const cloudinary = require('cloudinary').v2;

// Configure at call time so credentials loaded by dotenv after this module is required are used.
const getClient = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    const error = new Error('Image uploads are not configured on this server');
    error.statusCode = 503;
    throw error;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  return cloudinary;
};

const uploadImage = async (filePath, folder = 'electromap') => {
  if (!filePath) {
    return null;
  }

  const result = await getClient().uploader.upload(filePath, {
    folder,
    resource_type: 'image',
  });

  return result.secure_url;
};

const uploadBufferToCloudinary = (buffer, folder) => {
  if (!buffer) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const stream = getClient().uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result.secure_url);
      },
    );

    stream.end(buffer);
  });
};

const deleteImage = async (publicId) => {
  if (!publicId) {
    return null;
  }

  return getClient().uploader.destroy(publicId, {
    resource_type: 'image',
  });
};

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  uploadBufferToCloudinary,
};
