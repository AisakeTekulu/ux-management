"use client";

/**
 * ContactInfoCard — Editable contact information card for the client profile.
 *
 * Displays primary email, secondary email, phone, website, location, and
 * preferred contact method in a Polaris-inspired Card layout. Supports inline
 * editing (click to edit) with validation feedback from the domain layer's
 * `validateClientFields`.
 *
 * _Requirements: 2.1, 12.1_
 */

import { useCallback, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { validateClientFields } from "@/lib/domain/client-crm";
import type { Client, ClientCRMInput, PreferredContactMethod } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ContactInfoCardProps {
  /** The full client record. */
  client: Client;
  /** Callback to save updated contact fields. */
  onUpdate: (fields: ClientCRMInput) => Promise<void>;
}

/** Fields managed by this card. */
interface ContactFields {
  primaryEmail: string;
  secondaryEmail: string;
  phone: string;
  website: string;
  location: string;
  preferredContactMethod: PreferredContactMethod;
}

/** Map of field name → error message. */
type FieldErrors = Partial<Record<keyof ContactFields, string>>;

// ─── Constants ──────────────────────────────────────────────────────────────

const CONTACT_METHOD_OPTIONS: { value: PreferredContactMethod; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "other", label: "Other" },
];

const FIELD_LABELS: Record<keyof ContactFields, string> = {
  primaryEmail: "Primary Email",
  secondaryEmail: "Secondary Email",
  phone: "Phone",
  website: "Website",
  location: "Location",
  preferredContactMethod: "Preferred Contact",
};

// ─── Component ──────────────────────────────────────────────────────────────

export function ContactInfoCard({ client, onUpdate }: ContactInfoCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Editable form state
  const [fields, setFields] = useState<ContactFields>(() => ({
    primaryEmail: client.primaryEmail ?? "",
    secondaryEmail: client.secondaryEmail ?? "",
    phone: client.phone ?? "",
    website: client.website ?? "",
    location: client.location ?? "",
    preferredContactMethod: client.preferredContactMethod,
  }));

  // Reset form to current client values
  const resetForm = useCallback(() => {
    setFields({
      primaryEmail: client.primaryEmail ?? "",
      secondaryEmail: client.secondaryEmail ?? "",
      phone: client.phone ?? "",
      website: client.website ?? "",
      location: client.location ?? "",
      preferredContactMethod: client.preferredContactMethod,
    });
    setErrors({});
  }, [client]);

  // Enter edit mode
  const handleEdit = useCallback(() => {
    resetForm();
    setEditing(true);
  }, [resetForm]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    setEditing(false);
    resetForm();
  }, [resetForm]);

  // Validate and save
  const handleSave = useCallback(async () => {
    // Build the input — use null for empty strings to match domain expectations
    const input: ClientCRMInput = {
      primaryEmail: fields.primaryEmail.trim() || null,
      secondaryEmail: fields.secondaryEmail.trim() || null,
      phone: fields.phone.trim() || null,
      website: fields.website.trim() || null,
      location: fields.location.trim() || null,
      preferredContactMethod: fields.preferredContactMethod,
    };

    // Validate using domain layer
    const result = validateClientFields(input);
    if (!result.ok) {
      const newErrors: FieldErrors = {};
      for (const fieldError of result.error.fields) {
        const key = fieldError.field as keyof ContactFields;
        if (key in FIELD_LABELS) {
          newErrors[key] = fieldError.message;
        }
      }
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await onUpdate(input);
      setEditing(false);
    } catch {
      // Let the parent handle error reporting via toast
    } finally {
      setSaving(false);
    }
  }, [fields, onUpdate]);

  // Update a field value
  const updateField = useCallback(
    (field: keyof ContactFields, value: string) => {
      setFields((prev) => ({ ...prev, [field]: value }));
      // Clear field error on change
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  // Check if any field has data (for empty state)
  const hasData = useMemo(
    () =>
      client.primaryEmail ||
      client.secondaryEmail ||
      client.phone ||
      client.website ||
      client.location,
    [client]
  );

  // Header action button
  const headerAction = editing ? null : (
    <button
      type="button"
      onClick={handleEdit}
      className="inline-flex items-center gap-1 rounded-md px-token-3 py-token-1 text-xs font-medium text-primary hover:bg-surface-hovered transition-colors"
    >
      <EditIcon />
      Edit
    </button>
  );

  return (
    <Card title="Contact Information" actions={headerAction}>
      <div className="p-token-4">
        {editing ? (
          <EditMode
            fields={fields}
            errors={errors}
            saving={saving}
            onUpdateField={updateField}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <DisplayMode client={client} hasData={!!hasData} onEdit={handleEdit} />
        )}
      </div>
    </Card>
  );
}

// ─── Display Mode ───────────────────────────────────────────────────────────

interface DisplayModeProps {
  client: Client;
  hasData: boolean;
  onEdit: () => void;
}

function DisplayMode({ client, hasData, onEdit }: DisplayModeProps) {
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-token-4 text-center">
        <p className="text-sm text-text-subdued">No contact information added yet.</p>
        <button
          type="button"
          onClick={onEdit}
          className="mt-token-2 text-sm font-medium text-primary hover:text-primary-hovered transition-colors"
        >
          Add contact details
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-token-4">
      <DisplayField label="Primary Email" value={client.primaryEmail} />
      <DisplayField label="Secondary Email" value={client.secondaryEmail} />
      <DisplayField label="Phone" value={client.phone} />
      <DisplayField label="Website" value={client.website} isLink />
      <DisplayField label="Location" value={client.location} />
      <DisplayField
        label="Preferred Contact"
        value={client.preferredContactMethod}
        capitalize
      />
    </div>
  );
}

interface DisplayFieldProps {
  label: string;
  value: string | null;
  isLink?: boolean;
  capitalize?: boolean;
}

function DisplayField({ label, value, isLink, capitalize }: DisplayFieldProps) {
  return (
    <div>
      <p className="text-xs font-medium text-text-subdued uppercase tracking-wide">
        {label}
      </p>
      {value ? (
        isLink ? (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-token-1 block text-sm text-primary hover:underline truncate"
          >
            {value}
          </a>
        ) : (
          <p className={cn("mt-token-1 text-sm text-text", capitalize && "capitalize")}>
            {value}
          </p>
        )
      ) : (
        <p className="mt-token-1 text-sm text-text-subdued">—</p>
      )}
    </div>
  );
}

// ─── Edit Mode ──────────────────────────────────────────────────────────────

interface EditModeProps {
  fields: ContactFields;
  errors: FieldErrors;
  saving: boolean;
  onUpdateField: (field: keyof ContactFields, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditMode({
  fields,
  errors,
  saving,
  onUpdateField,
  onSave,
  onCancel,
}: EditModeProps) {
  return (
    <div className="space-y-token-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-token-4">
        <EditField
          label="Primary Email"
          field="primaryEmail"
          type="email"
          placeholder="client@example.com"
          value={fields.primaryEmail}
          error={errors.primaryEmail}
          onChange={onUpdateField}
        />
        <EditField
          label="Secondary Email"
          field="secondaryEmail"
          type="email"
          placeholder="alternate@example.com"
          value={fields.secondaryEmail}
          error={errors.secondaryEmail}
          onChange={onUpdateField}
        />
        <EditField
          label="Phone"
          field="phone"
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={fields.phone}
          error={errors.phone}
          onChange={onUpdateField}
        />
        <EditField
          label="Website"
          field="website"
          type="url"
          placeholder="https://example.com"
          value={fields.website}
          error={errors.website}
          onChange={onUpdateField}
        />
        <EditField
          label="Location"
          field="location"
          type="text"
          placeholder="City, Country"
          value={fields.location}
          error={errors.location}
          onChange={onUpdateField}
        />
        <SelectField
          label="Preferred Contact"
          field="preferredContactMethod"
          value={fields.preferredContactMethod}
          error={errors.preferredContactMethod}
          options={CONTACT_METHOD_OPTIONS}
          onChange={onUpdateField}
        />
      </div>

      {/* Save / Cancel actions */}
      <div className="flex items-center justify-end gap-token-2 pt-token-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center rounded-lg px-token-4 py-[9px] text-sm font-medium text-text hover:bg-surface-hovered transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center rounded-lg bg-primary px-token-4 py-[9px] text-sm font-semibold text-text-on-primary hover:bg-primary-hovered transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Edit Field ─────────────────────────────────────────────────────────────

interface EditFieldProps {
  label: string;
  field: keyof ContactFields;
  type: string;
  placeholder: string;
  value: string;
  error?: string;
  onChange: (field: keyof ContactFields, value: string) => void;
}

function EditField({
  label,
  field,
  type,
  placeholder,
  value,
  error,
  onChange,
}: EditFieldProps) {
  return (
    <div>
      <label
        htmlFor={`contact-${field}`}
        className="block text-xs font-medium text-text-subdued uppercase tracking-wide"
      >
        {label}
      </label>
      <input
        id={`contact-${field}`}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(field, e.target.value)}
        className={cn(
          "mt-token-1 w-full rounded-lg border bg-surface px-token-3 py-[10px] text-sm text-text placeholder:text-text-subdued transition-colors focus:outline-none focus:ring-1",
          error
            ? "border-status-red focus:border-status-red focus:ring-status-red"
            : "border-border focus:border-primary focus:ring-primary"
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${field}-error` : undefined}
      />
      {error && (
        <p
          id={`${field}-error`}
          className="mt-token-1 text-xs text-status-red"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Select Field ───────────────────────────────────────────────────────────

interface SelectFieldProps {
  label: string;
  field: keyof ContactFields;
  value: string;
  error?: string;
  options: { value: string; label: string }[];
  onChange: (field: keyof ContactFields, value: string) => void;
}

function SelectField({
  label,
  field,
  value,
  error,
  options,
  onChange,
}: SelectFieldProps) {
  return (
    <div>
      <label
        htmlFor={`contact-${field}`}
        className="block text-xs font-medium text-text-subdued uppercase tracking-wide"
      >
        {label}
      </label>
      <select
        id={`contact-${field}`}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        className={cn(
          "mt-token-1 w-full rounded-lg border bg-surface px-token-3 py-[10px] text-sm text-text transition-colors focus:outline-none focus:ring-1",
          error
            ? "border-status-red focus:border-status-red focus:ring-status-red"
            : "border-border focus:border-primary focus:ring-primary"
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${field}-error` : undefined}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p
          id={`${field}-error`}
          className="mt-token-1 text-xs text-status-red"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function EditIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
