import React, { useEffect, useState } from "react";
import { Upload } from "lucide-react";

import { uploadSnackImage } from "../../api/snacks";
import { Snack, SnackCategory, SnackCreateInput } from "../../types";
import { Modal } from "../common/Modal";
import { SnackImage } from "../common/SnackImage";

interface SnackFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: SnackCreateInput) => Promise<void>;
  initialSnack?: Snack | null;
  isSubmitting?: boolean;
}

const CATEGORIES: SnackCategory[] = ["sweet", "savoury", "drink", "healthy-ish"];

export function SnackFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialSnack,
  isSubmitting = false,
}: SnackFormModalProps) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<SnackCategory>("sweet");
  const [quantity, setQuantity] = useState("10");
  const [threshold, setThreshold] = useState("5");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (initialSnack) {
      setName(initialSnack.name);
      setBrand(initialSnack.brand || "");
      setCategory(initialSnack.category);
      setQuantity(String(initialSnack.quantity));
      setThreshold(String(initialSnack.low_stock_threshold));
      setPrice(initialSnack.price !== null && initialSnack.price !== undefined ? String(initialSnack.price) : "");
      setImageUrl(initialSnack.image_url || "");
    } else {
      setName("");
      setBrand("");
      setCategory("sweet");
      setQuantity("10");
      setThreshold("5");
      setPrice("");
      setImageUrl("");
    }
    setFormError("");
  }, [isOpen, initialSnack]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      setFormError("Please select a JPEG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Image must be 5 MB or smaller.");
      return;
    }

    setFormError("");
    setIsUploading(true);
    try {
      const res = await uploadSnackImage(file);
      setImageUrl(res.image_url);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const qtyNum = Number(quantity);
    const threshNum = Number(threshold);
    const priceNum = price.trim() === "" ? null : Number(price);

    if (!trimmed) {
      setFormError("Snack name is required.");
      return;
    }
    if (!Number.isInteger(qtyNum) || qtyNum < 0) {
      setFormError("Quantity must be a whole number of 0 or greater.");
      return;
    }
    if (!Number.isInteger(threshNum) || threshNum < 0) {
      setFormError("Low stock threshold must be a whole number of 0 or greater.");
      return;
    }
    if (priceNum !== null && (Number.isNaN(priceNum) || priceNum < 0)) {
      setFormError("Price must be 0 or greater.");
      return;
    }

    setFormError("");
    try {
      await onSubmit({
        name: trimmed,
        brand: brand.trim() || null,
        category,
        quantity: qtyNum,
        low_stock_threshold: threshNum,
        image_url: imageUrl.trim() || null,
        price: priceNum,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save snack.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialSnack ? `Edit ${initialSnack.name}` : "Add New Snack"}
    >
      <form onSubmit={handleSubmit}>
        {formError && (
          <div className="alert alert-error" role="alert">
            <span>{formError}</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <SnackImage
            imageUrl={imageUrl || null}
            alt={name || "Product preview"}
            variant="thumb"
            className="snack-preview-box"
          />
          <div style={{ flex: 1 }}>
            <label
              htmlFor="modal-image-upload"
              className="btn btn-secondary btn-sm"
              style={{ cursor: isUploading ? "wait" : "pointer" }}
            >
              <Upload size={14} />
              <span>{isUploading ? "Uploading..." : "Upload Product Image"}</span>
            </label>
            <input
              id="modal-image-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              style={{ display: "none" }}
              disabled={isUploading || isSubmitting}
            />
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
              JPG, PNG, or WEBP up to 5 MB — or paste an image URL below.
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="snack-image-url">
            Product Image URL (optional)
          </label>
          <input
            id="snack-image-url"
            type="text"
            className="input"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="/uploads/demo/oreo.jpg or https://..."
            maxLength={500}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="snack-name">
              Snack Name
            </label>
            <input
              id="snack-name"
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Oreo Original"
              maxLength={120}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="snack-brand">
              Brand (optional)
            </label>
            <input
              id="snack-brand"
              type="text"
              className="input"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g., Cadbury / Lay's"
              maxLength={100}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="snack-category">
              Category
            </label>
            <select
              id="snack-category"
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value as SnackCategory)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="snack-price">
              Price in ₹ (optional)
            </label>
            <input
              id="snack-price"
              type="number"
              min={0}
              max={100000}
              step="0.01"
              className="input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g., 30"
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="snack-qty">
              Initial / Current Quantity
            </label>
            <input
              id="snack-qty"
              type="number"
              min={0}
              max={100000}
              className="input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="snack-threshold">
              Low Stock Threshold
            </label>
            <input
              id="snack-threshold"
              type="number"
              min={0}
              max={10000}
              className="input"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              required
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting || isUploading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || isUploading}
          >
            {isSubmitting ? "Saving..." : initialSnack ? "Save Changes" : "Create Snack"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
