import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Info,
  Sparkles,
  Upload,
} from "lucide-react";

import { predictSnackCategory } from "../api/scanner";
import { createSnack } from "../api/snacks";
import { SnackImage } from "../components/common/SnackImage";
import { useToast } from "../context/ToastContext";
import { ScannerPredictResponse, SnackCategory } from "../types";

const CATEGORIES: Array<{ value: SnackCategory; label: string }> = [
  { value: "sweet", label: "Sweet" },
  { value: "savoury", label: "Savoury" },
  { value: "drink", label: "Drink" },
  { value: "healthy-ish", label: "Healthy-ish" },
];

export function SmartScannerPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [dragging, setDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [prediction, setPrediction] = useState<ScannerPredictResponse | null>(null);

  // Explicit confirmation form state (nothing is saved until admin submits)
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<SnackCategory>("sweet");
  const [quantity, setQuantity] = useState("10");
  const [threshold, setThreshold] = useState("5");
  const [price, setPrice] = useState("");
  const [useUploadedImage, setUseUploadedImage] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const processFile = async (file: File) => {
    setScanError("");
    setSaveError("");

    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      setScanError("Unsupported file type. Please upload a JPEG, PNG, or WEBP snack image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setScanError("Image exceeds the 5 MB file size limit.");
      return;
    }

    setSelectedFileName(file.name);
    setIsScanning(true);
    setPrediction(null);

    try {
      const res = await predictSnackCategory(file);
      setPrediction(res);
      setCategory(res.predicted_category);
      setUseUploadedImage(true);
      toast.info(
        `Predicted category: ${res.predicted_category} (${Math.round(res.confidence * 100)}% confidence). Review details before saving.`,
        "Scan complete"
      );
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : "Smart Snack Scanner could not classify this image. You can still add the snack manually."
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prediction) return;

    const trimmedName = name.trim();
    const qtyNum = Number(quantity);
    const threshNum = Number(threshold);
    const priceNum = price.trim() === "" ? null : Number(price);

    if (!trimmedName) {
      setSaveError("Please enter the snack name before confirming.");
      return;
    }
    if (!Number.isInteger(qtyNum) || qtyNum < 0) {
      setSaveError("Quantity must be a whole number of 0 or greater.");
      return;
    }
    if (!Number.isInteger(threshNum) || threshNum < 0) {
      setSaveError("Low stock threshold must be a whole number of 0 or greater.");
      return;
    }
    if (priceNum !== null && (Number.isNaN(priceNum) || priceNum < 0)) {
      setSaveError("Price must be 0 or greater.");
      return;
    }

    setSaveError("");
    setIsSaving(true);
    try {
      const created = await createSnack({
        name: trimmedName,
        brand: brand.trim() || null,
        category,
        quantity: qtyNum,
        low_stock_threshold: threshNum,
        image_url: useUploadedImage ? prediction.image_url : null,
        price: priceNum,
      });
      toast.success(
        `Added "${created.name}" (${created.category}) to the Bipolar Factory pantry!`,
        "Snack saved"
      );
      navigate(`/snacks/${created.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save snack.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="page-container">
      <div className="page-header">
        <div>
          <div style={{ marginBottom: 8 }}>
            <Link to="/admin/snacks" className="btn btn-secondary btn-sm">
              <ArrowLeft size={14} />
              <span>Back to Manage Pantry</span>
            </Link>
          </div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Camera size={26} color="#0284c7" />
            <span>Smart Snack Scanner</span>
          </h1>
          <p className="page-subtitle">
            Upload a snack photo to predict its pantry category using a lightweight Hugging Face
            vision model, then review and confirm before saving.
          </p>
        </div>

        <Link to="/admin/snacks" className="btn btn-secondary">
          Add Snack Manually
        </Link>
      </div>

      <div className="scanner-grid">
        {/* Left Column: Image Upload + AI Prediction */}
        <section className="card" style={{ padding: 22 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.08rem", fontWeight: 700 }}>
            1. Upload Snack Photo
          </h2>

          <div
            className={`upload-dropzone${dragging ? " dragging" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Upload snack image for category prediction"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
            <Upload size={28} color="#0284c7" style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
              {isScanning
                ? "Analyzing image with Hugging Face CLIP..."
                : "Click or drag & drop a snack photo"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
              Supports JPEG, PNG, or WEBP up to 5 MB
              {selectedFileName ? ` · Selected: ${selectedFileName}` : ""}
            </div>
          </div>

          {scanError && (
            <div className="alert alert-error" role="alert" style={{ marginTop: 16, marginBottom: 0 }}>
              <span>{scanError}</span>
              <Link to="/admin/snacks" className="btn btn-secondary btn-sm">
                Manual Entry
              </Link>
            </div>
          )}

          {isScanning && (
            <div style={{ marginTop: 18 }}>
              <div className="skeleton" style={{ height: 220, borderRadius: 12, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 22, width: "60%" }} />
            </div>
          )}

          {prediction && !isScanning && (
            <div style={{ marginTop: 18 }}>
              <SnackImage
                imageUrl={prediction.image_url}
                alt="Uploaded snack preview"
                variant="detail"
              />

              {prediction.low_confidence && (
                <div className="alert alert-warning" role="status" style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong>Low confidence prediction.</strong> Please verify or manually select
                      the correct category on the right before saving.
                    </div>
                  </div>
                </div>
              )}

              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 12,
                  background: "var(--bg-subtle)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700 }}>
                    <Sparkles size={16} color="#059669" />
                    <span>
                      Predicted:{" "}
                      <span style={{ textTransform: "capitalize", color: "var(--brand-emerald-dark)" }}>
                        {prediction.predicted_category}
                      </span>
                    </span>
                  </div>
                  <span className="price-tag tabular-nums">
                    {Math.round(prediction.confidence * 100)}% confidence
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {CATEGORIES.map((cat) => {
                    const score = prediction.scores[cat.value] ?? 0;
                    const pct = Math.round(score * 100);
                    return (
                      <div key={cat.value} className="score-bar-row">
                        <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                          {cat.label}
                        </span>
                        <div className="score-bar-track">
                          <div className="score-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="tabular-nums" style={{ textAlign: "right", fontWeight: 600 }}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="alert alert-info" style={{ marginTop: 14, marginBottom: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.82rem" }}>
                  <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Model Scope ({prediction.model_name}):</strong> {prediction.limitations}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Review & Explicit Admin Confirmation */}
        <section className="card" style={{ padding: 22 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.08rem", fontWeight: 700 }}>
            2. Review & Confirm Details
          </h2>
          <p style={{ margin: "0 0 18px", fontSize: "0.86rem", color: "var(--text-secondary)" }}>
            Nothing is saved to the pantry database until you confirm below.
          </p>

          {saveError && (
            <div className="alert alert-error" role="alert">
              <span>{saveError}</span>
            </div>
          )}

          <form onSubmit={handleConfirmSave}>
            <div className="form-group">
              <label className="form-label">Category (correct manually if needed)</label>
              <div className="pill-group" role="group" aria-label="Select snack category">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    className={`filter-pill${category === cat.value ? " active-green" : ""}`}
                    onClick={() => setCategory(cat.value)}
                    disabled={!prediction}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="scanner-name">
                Snack Name *
              </label>
              <input
                id="scanner-name"
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Lay's Classic Salted"
                maxLength={120}
                disabled={!prediction}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="scanner-brand">
                  Brand (optional)
                </label>
                <input
                  id="scanner-brand"
                  type="text"
                  className="input"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g., Lay's / Cadbury"
                  maxLength={100}
                  disabled={!prediction}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="scanner-price">
                  Price in ₹ (optional)
                </label>
                <input
                  id="scanner-price"
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g., 20"
                  disabled={!prediction}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="scanner-qty">
                  Initial Quantity *
                </label>
                <input
                  id="scanner-qty"
                  type="number"
                  min={0}
                  max={100000}
                  className="input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={!prediction}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="scanner-threshold">
                  Low Stock Threshold
                </label>
                <input
                  id="scanner-threshold"
                  type="number"
                  min={0}
                  max={10000}
                  className="input"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  disabled={!prediction}
                  required
                />
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.88rem",
                marginBottom: 18,
                cursor: prediction ? "pointer" : "not-allowed",
                color: prediction ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              <input
                type="checkbox"
                checked={useUploadedImage}
                onChange={(e) => setUseUploadedImage(e.target.checked)}
                disabled={!prediction}
              />
              <span>Reuse uploaded photo as this snack&apos;s product image</span>
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "11px 16px" }}
              disabled={!prediction || isScanning || isSaving}
            >
              <CheckCircle2 size={17} />
              <span>{isSaving ? "Saving to Pantry..." : "Confirm & Add Snack to Pantry"}</span>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

