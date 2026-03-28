/**
 * FileUploadZone
 * Drag-and-drop file upload component.
 * Accepts a file via drag-and-drop or click-to-browse, then calls the server
 * upload endpoint (which stores the file in Cloudinary and returns the URL).
 *
 * State machine: idle → dragging → uploading → done / error
 *
 * @param {string}   endpoint   — server API path, e.g. "/lab-orders/:id/upload"
 * @param {string}   fieldName  — form field name expected by multer (default "file")
 * @param {function} onUploaded — called with { url, publicId } after successful upload
 * @param {string[]} [accept]   — MIME types to accept (default: PDF + images)
 */
import { useState, useRef } from 'react';
import api from '../api/axios';

export default function FileUploadZone({
  endpoint,
  fieldName = 'file',
  onUploaded,
  accept = ['application/pdf', 'image/png', 'image/jpeg'],
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  /** Upload the File object to the server via multipart/form-data */
  async function uploadFile(file) {
    setUploading(true);
    setError(null);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append(fieldName, file);
      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
      setFileName(null);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleChange(e) {
    const file = e.target.files[0];
    if (file) uploadFile(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
        ${dragging ? 'border-teal-400 bg-teal-50' : 'border-gray-300 hover:border-teal-300 bg-gray-50'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        className="hidden"
        onChange={handleChange}
      />
      {uploading ? (
        <p className="text-sm text-gray-500">Uploading {fileName}...</p>
      ) : fileName ? (
        <p className="text-sm text-green-600 font-medium">✓ {fileName} uploaded</p>
      ) : (
        <>
          <p className="text-sm text-gray-500">Drag & drop a file here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG accepted</p>
        </>
      )}
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
