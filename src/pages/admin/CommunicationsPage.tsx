import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Eye, ImagePlus, Italic, Link2, Mail, Paperclip, Redo2, Send, Underline, Undo2, X } from "lucide-react";
import {
  getCommunicationDirectory,
  previewCommunication,
  sendCommunication,
  sendCommunicationTest,
  type CommunicationAudience,
  type CommunicationDirectory,
  type CommunicationPerson,
  type CommunicationPreview,
  type CommunicationAttachment,
} from "../../services/communicationService";
import { useAuth } from "../../hooks/useAuth";

const audienceOptions: Array<{ value: CommunicationAudience; label: string }> = [
  { value: "parents", label: "Parents / Guardians" },
  { value: "staff", label: "Teachers & Staff" },
  { value: "students", label: "Students with email" },
  { value: "community", label: "Entire School Community" },
  { value: "class", label: "Selected Class" },
  { value: "people", label: "Selected People" },
  { value: "custom", label: "Custom Email Addresses" },
];

function selectedPersonKey(person: CommunicationPerson): string {
  return `${person.source}:${person.id}`;
}

function parseCustomEmails(value: string): string[] {
  return value.split(/[\s,;]+/).map((email) => email.trim()).filter(Boolean);
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attachmentTypes = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg"]);

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function htmlToText(value: string): string {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Unable to read this file."));
    reader.readAsDataURL(file);
  });
}

const COMMUNICATION_DRAFT_KEY = "grandessa-communications-draft";

type CommunicationDraft = {
  audience: CommunicationAudience;
  classId: string;
  selectedPeople: string[];
  customEmails: string;
  subject: string;
  message: string;
  messageHtml?: string;
};

function loadDraft(): CommunicationDraft | null {
  try {
    const savedDraft = sessionStorage.getItem(COMMUNICATION_DRAFT_KEY);
    if (!savedDraft) return null;

    const draft = JSON.parse(savedDraft) as Partial<CommunicationDraft>;
    const draftAudience = draft.audience;
    if (!draftAudience || !audienceOptions.some((option) => option.value === draftAudience)) return null;

    return {
      audience: draftAudience,
      classId: typeof draft.classId === "string" ? draft.classId : "",
      selectedPeople: Array.isArray(draft.selectedPeople) ? draft.selectedPeople.filter((value): value is string => typeof value === "string") : [],
      customEmails: typeof draft.customEmails === "string" ? draft.customEmails : "",
      subject: typeof draft.subject === "string" ? draft.subject : "",
      message: typeof draft.message === "string" ? draft.message : "",
    };
  } catch {
    return null;
  }
}

export default function CommunicationsPage() {
  const { user } = useAuth();
  const [draft] = useState<CommunicationDraft | null>(() => loadDraft());
  const [directory, setDirectory] = useState<CommunicationDirectory | null>(null);
  const [audience, setAudience] = useState<CommunicationAudience>(() => draft?.audience ?? "parents");
  const [classId, setClassId] = useState(() => draft?.classId ?? "");
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(() => new Set(draft?.selectedPeople ?? []));
  const [customEmails, setCustomEmails] = useState(() => draft?.customEmails ?? "");
  const [customRecipients, setCustomRecipients] = useState<string[]>(() => parseCustomEmails(draft?.customEmails ?? ""));
  const [recipientInput, setRecipientInput] = useState("");
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0);
  const [subject, setSubject] = useState(() => draft?.subject ?? "");
  const [message, setMessage] = useState(() => draft?.message ?? "");
  const [messageHtml, setMessageHtml] = useState(() => draft?.messageHtml ?? escapeHtml(draft?.message ?? ""));
  const [attachments, setAttachments] = useState<CommunicationAttachment[]>([]);
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState(() => user?.email ?? "");
  const [testSending, setTestSending] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<CommunicationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const people = useMemo(
    () => [...selectedPeople].map((key) => {
      const separator = key.indexOf(":");
      return { source: key.slice(0, separator) as CommunicationPerson["source"], id: key.slice(separator + 1) };
    }),
    [selectedPeople],
  );

  const target = useMemo(() => ({
    audience,
    ...(audience === "class" ? { class_id: classId } : {}),
    ...(audience === "people" ? { people } : {}),
    ...(audience === "custom" ? { custom_emails: customRecipients } : {}),
  }), [audience, classId, customRecipients, people]);

  const suggestions = useMemo(() => {
    const query = recipientInput.trim().toLowerCase();
    if (!query || !directory) return [];
    return directory.people.filter((person) => person.email && !customRecipients.includes(person.email) && `${person.name} ${person.email}`.toLowerCase().includes(query)).slice(0, 6);
  }, [customRecipients, directory, recipientInput]);

  function addRecipients(values: string[]): void {
    const valid = values.map((value) => value.trim().toLowerCase()).filter((value) => emailPattern.test(value));
    setCustomRecipients((current) => [...current, ...valid.filter((value) => !current.includes(value))]);
    setCustomEmails((current) => [...current.split(/[\s,;]+/).filter(Boolean), ...valid].join(", "));
  }

  function removeCustomRecipient(email: string): void {
    setCustomRecipients((current) => current.filter((value) => value !== email));
    setCustomEmails((current) => current.split(/[\s,;]+/).filter((value) => value && value.toLowerCase() !== email).join(", "));
  }

  function handleRecipientKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setHighlightedSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setHighlightedSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if ((event.key === "Enter" || event.key === ",") && recipientInput.trim()) {
      event.preventDefault();
      if (suggestions[highlightedSuggestion] && event.key === "Enter") {
        addRecipients([suggestions[highlightedSuggestion].email ?? ""]);
      } else {
        addRecipients(parseCustomEmails(recipientInput));
      }
      setRecipientInput("");
      setHighlightedSuggestion(0);
    }
  }

  function handleRecipientPaste(event: ClipboardEvent<HTMLInputElement>): void {
    const pasted = event.clipboardData.getData("text");
    if (pasted.includes(",") || pasted.includes(";")) {
      event.preventDefault();
      addRecipients(parseCustomEmails(pasted));
      setRecipientInput("");
    }
  }

  function executeEditor(command: string, value?: string): void {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setMessageHtml(editorRef.current?.innerHTML ?? "");
    setMessage(htmlToText(editorRef.current?.innerHTML ?? ""));
  }

  async function handleAttachment(event: ChangeEvent<HTMLInputElement>, inline = false): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!attachmentTypes.has(file.type)) {
      setError("This file type is not supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Each attachment must be 10 MB or smaller.");
      return;
    }
    try {
      const content = await fileToBase64(file);
      const contentId = inline ? `inline-${Date.now()}` : undefined;
      setAttachments((current) => [...current, { filename: file.name, content, content_type: file.type, size: file.size, ...(contentId ? { content_id: contentId } : {}) }]);
      if (inline) {
        executeEditor("insertHTML", `<img src="cid:${contentId}" alt="${escapeHtml(file.name)}" style="max-width:100%;height:auto" />`);
      }
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Unable to add this file.");
    }
  }

  const sendDisabledReason = useMemo(() => {
    if (loading) return "Loading recipient records...";
    if (previewLoading) return "Calculating recipients...";
    if (error) return "Resolve the preview error before sending.";
    if (!subject.trim()) return "Add a subject before sending.";
    if (!message.trim()) return "Add a message before sending.";
    if (audience === "class" && !classId) return "Choose a class before sending.";
    if (audience === "people" && people.length === 0) return "Select at least one person before sending.";
    if (audience === "custom" && parseCustomEmails(customEmails).length === 0) return "Enter at least one email address before sending.";
    if (!preview) return "Preview recipients before sending.";
    if (preview.recipient_count === 0) return "No valid email recipients were found.";
    if (preview.usage.remaining < preview.recipient_count) return "This message exceeds the remaining daily email quota.";
    return "";
  }, [audience, classId, customEmails, error, loading, message, people.length, preview, previewLoading, subject]);

  useEffect(() => {
    if (!testEmail && user?.email) setTestEmail(user.email);
  }, [testEmail, user?.email]);

  useEffect(() => {
    sessionStorage.setItem(COMMUNICATION_DRAFT_KEY, JSON.stringify({
      audience,
      classId,
      selectedPeople: [...selectedPeople],
      customEmails,
      subject,
      message,
      messageHtml,
    } satisfies CommunicationDraft));
  }, [audience, classId, customEmails, message, messageHtml, selectedPeople, subject]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getCommunicationDirectory()
      .then((data) => {
        if (active) setDirectory(data);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load communication recipients.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setPreviewLoading(true);
    void previewCommunication(target)
      .then((data) => {
        if (active) {
          setPreview(data);
          setError("");
        }
      })
      .catch((previewError) => {
        if (active) {
          setPreview(null);
          setError(previewError instanceof Error ? previewError.message : "Unable to preview recipients.");
        }
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [target]);

  function handleAudienceChange(nextAudience: CommunicationAudience): void {
    setAudience(nextAudience);
    setError("");
    setSuccess("");
  }

  function togglePerson(person: CommunicationPerson): void {
    const key = selectedPersonKey(person);
    setSelectedPeople((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSend(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (sending || Boolean(sendDisabledReason)) return;
    setShowConfirmationModal(true);
  }

  async function confirmMassSend(): Promise<void> {
    if (sending || Boolean(sendDisabledReason) || !preview?.recipient_count) return;

    setSending(true);
    setError("");
    setSuccess("");
    try {
      const latestPreview = await previewCommunication(target);
      const recipientListChanged = latestPreview.recipient_count !== preview.recipient_count || latestPreview.missing_email_count !== preview.missing_email_count || JSON.stringify(latestPreview.recipients) !== JSON.stringify(preview.recipients);
      setPreview(latestPreview);
      if (recipientListChanged) {
        setSuccess("The recipient list changed. Review the updated count and confirm again.");
        setShowConfirmationModal(true);
        return;
      }

      setShowConfirmationModal(false);
      const result = await sendCommunication({ ...target, subject: subject.trim(), body: message.trim(), body_html: messageHtml, attachments });
      setSuccess(result.duplicate ? "This message was already submitted." : `${result.accepted} email${result.accepted === 1 ? "" : "s"} accepted by the email provider.`);
      sessionStorage.removeItem(COMMUNICATION_DRAFT_KEY);
      setDirectory((current) => current ? { ...current, usage: result.usage } : current);
      setPreview((current) => current ? { ...current, usage: result.usage } : current);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleTestSend(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (testSending) return;
    const normalizedEmail = testEmail.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      setError("Enter a valid test email address.");
      return;
    }
    if (!subject.trim() || !message.trim()) {
      setError("Add a subject and message before sending a test email.");
      return;
    }

    setTestSending(true);
    setError("");
    try {
      const result = await sendCommunicationTest({ test_email: normalizedEmail, subject: subject.trim(), body: message.trim(), body_html: messageHtml, attachments });
      setSuccess(result.duplicate ? "This test message was already submitted." : `Test email accepted for ${normalizedEmail}.`);
      setShowTestModal(false);
      setDirectory((current) => current ? { ...current, usage: result.usage } : current);
      setPreview((current) => current ? { ...current, usage: result.usage } : current);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "The test email could not be sent.");
    } finally {
      setTestSending(false);
    }
  }

  const attachmentList = attachments.length
    ? <div><strong>Attachments</strong>{attachments.map((attachment) => <div key={`${attachment.filename}-${attachment.content_id ?? "attachment"}`}>{attachment.filename} · {Math.ceil(attachment.size / 1024)} KB</div>)}</div>
    : <div><strong>Attachments</strong><div>None</div></div>;

  return (
    <section className="admin-preview-page">
      <header className="admin-preview-page-header">
        <div>
          <p className="admin-preview-kicker">School communications</p>
          <h1>Communications</h1>
          <p>Send a clear message to the people who make up the Grandessa community.</p>
        </div>
        <button type="button" className="admin-preview-primary-action" onClick={() => document.getElementById("communication-subject")?.focus()}>
          <Mail size={16} />
          New Message
        </button>
      </header>

      <form className="admin-preview-panel" onSubmit={handleSend}>
        <div className="admin-preview-section-head">
          <div>
            <h3>New message</h3>
            <p>Recipients are resolved securely from the school records when you preview and send.</p>
          </div>
          <span className="admin-preview-badge">Today&apos;s email usage: {directory?.usage.used ?? 0} / 100</span>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            Audience
            <select value={audience} onChange={(event) => handleAudienceChange(event.target.value as CommunicationAudience)}>
              {audienceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          {audience === "class" ? (
            <label style={{ display: "grid", gap: 6 }}>
              Class
              <select value={classId} onChange={(event) => setClassId(event.target.value)} required>
                <option value="">Choose a class</option>
                {(directory?.classes ?? []).map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.class_name}</option>)}
              </select>
            </label>
          ) : null}
        </div>

        {audience === "people" ? (
          <fieldset style={{ marginTop: 18, border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
            <legend>Select people</legend>
            {loading ? <p>Loading recipients...</p> : (
              <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                {(directory?.people ?? []).map((person) => (
                  <label key={selectedPersonKey(person)} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={selectedPeople.has(selectedPersonKey(person))} onChange={() => togglePerson(person)} />
                    <span>{person.name} {!person.email_available ? <small>(no email)</small> : null}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ) : null}

        {audience === "custom" ? (
          <div style={{ marginTop: 18, position: "relative" }}>
            <label htmlFor="communication-recipient-input" style={{ display: "grid", gap: 6 }}>
              Recipients
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 10, border: "1px solid #cbd5e1", borderRadius: 10, background: "#fff" }}>
                {customRecipients.map((email) => (
                  <span key={email} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 999, background: "#e8f5ed", color: "#0f6b35", fontSize: 13 }}>
                    {email}
                    <button type="button" onClick={() => removeCustomRecipient(email)} aria-label={`Remove ${email}`} style={{ border: 0, background: "transparent", cursor: "pointer", padding: 0 }}><X size={14} /></button>
                  </span>
                ))}
                <input
                  id="communication-recipient-input"
                  value={recipientInput}
                  onChange={(event) => setRecipientInput(event.target.value)}
                  onKeyDown={handleRecipientKeyDown}
                  onPaste={handleRecipientPaste}
                  placeholder={customRecipients.length ? "Add another email" : "name@example.com, another@example.com"}
                  style={{ flex: 1, minWidth: 220, border: 0, outline: 0, padding: 4 }}
                  aria-describedby="communication-recipient-help"
                />
              </div>
            </label>
            <small id="communication-recipient-help">Type an email or person name, then press Enter or comma.</small>
            {suggestions.length ? (
              <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 10, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 10, boxShadow: "0 12px 24px rgba(15,23,42,.12)" }} role="listbox">
                {suggestions.map((person, index) => (
                  <button key={selectedPersonKey(person)} type="button" onClick={() => { addRecipients([person.email ?? ""]); setRecipientInput(""); }} style={{ display: "block", width: "100%", textAlign: "left", border: 0, background: index === highlightedSuggestion ? "#f0fdf4" : "#fff", padding: "10px 12px", cursor: "pointer" }}>
                    <strong>{person.name}</strong><br /><small>{person.email}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <label htmlFor="communication-subject" style={{ display: "grid", gap: 6, marginTop: 18 }}>
          Subject
          <input id="communication-subject" type="text" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} required />
        </label>

        <div style={{ display: "grid", gap: 6, marginTop: 18 }}>
          <label htmlFor="communication-message-editor">Message</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: 8, border: "1px solid #cbd5e1", borderBottom: 0, borderRadius: "10px 10px 0 0", background: "#f8fafc" }}>
            <button type="button" title="Bold" aria-label="Bold" onClick={() => executeEditor("bold")}><Bold size={16} /></button>
            <button type="button" title="Italic" aria-label="Italic" onClick={() => executeEditor("italic")}><Italic size={16} /></button>
            <button type="button" title="Underline" aria-label="Underline" onClick={() => executeEditor("underline")}><Underline size={16} /></button>
            <button type="button" title="Bulleted list" onClick={() => executeEditor("insertUnorderedList")}>• List</button>
            <button type="button" title="Numbered list" onClick={() => executeEditor("insertOrderedList")}>1. List</button>
            <button type="button" title="Heading" onClick={() => executeEditor("formatBlock", "h2")}>Heading</button>
            <button type="button" title="Align left" aria-label="Align left" onClick={() => executeEditor("justifyLeft")}><AlignLeft size={16} /></button>
            <button type="button" title="Align center" aria-label="Align center" onClick={() => executeEditor("justifyCenter")}><AlignCenter size={16} /></button>
            <button type="button" title="Align right" aria-label="Align right" onClick={() => executeEditor("justifyRight")}><AlignRight size={16} /></button>
            <button type="button" title="Add link" aria-label="Add link" onClick={() => { const url = window.prompt("Enter link URL"); if (url) executeEditor("createLink", url); }}><Link2 size={16} /></button>
            <button type="button" title="Undo" aria-label="Undo" onClick={() => executeEditor("undo")}><Undo2 size={16} /></button>
            <button type="button" title="Redo" aria-label="Redo" onClick={() => executeEditor("redo")}><Redo2 size={16} /></button>
            <button type="button" title="Clear formatting" onClick={() => executeEditor("removeFormat")}>Clear</button>
            <button type="button" title="Insert image" onClick={() => imageInputRef.current?.click()}><ImagePlus size={16} /> Image</button>
            <button type="button" title="Attach file" onClick={() => attachmentInputRef.current?.click()}><Paperclip size={16} /> Attach</button>
          </div>
          <div
            id="communication-message-editor"
            ref={editorRef}
            contentEditable
            dir="ltr"
            role="textbox"
            aria-multiline="true"
            onInput={(event) => { setMessageHtml(event.currentTarget.innerHTML); setMessage(htmlToText(event.currentTarget.innerHTML)); }}
            dangerouslySetInnerHTML={{ __html: messageHtml }}
            style={{ minHeight: 220, padding: 14, border: "1px solid #cbd5e1", borderRadius: "0 0 10px 10px", outline: 0, background: "#fff", direction: "ltr", textAlign: "left", unicodeBidi: "normal" }}
            data-placeholder="Write your message here..."
          />
          <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={(event) => void handleAttachment(event, true)} />
          <input ref={attachmentInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" hidden onChange={(event) => void handleAttachment(event)} />
          {attachments.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {attachments.map((attachment) => <span key={`${attachment.filename}-${attachment.content_id ?? "attachment"}`} style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}><Paperclip size={14} />{attachment.filename} ({Math.ceil(attachment.size / 1024)} KB)<button type="button" onClick={() => setAttachments((current) => current.filter((item) => item !== attachment))} aria-label={`Remove ${attachment.filename}`}><X size={14} /></button></span>)}
          </div> : null}
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
          <span><strong>{previewLoading ? "..." : preview?.recipient_count ?? 0}</strong> recipients</span>
          <span>{preview?.missing_email_count ?? 0} missing email</span>
          <span>{preview?.usage.remaining ?? 100} emails remaining today</span>
          <button type="button" className="admin-preview-secondary-action" onClick={() => setShowRecipientModal(true)} disabled={!preview || previewLoading}>View recipients</button>
        </div>

        {error ? <p role="alert" style={{ color: "#b91c1c", marginTop: 16 }}>{error}</p> : null}
        {success ? <p role="status" style={{ color: "#15803d", marginTop: 16 }}>{success}</p> : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <button type="button" className="admin-preview-secondary-action" onClick={() => setShowPreviewModal(true)}>
            <Eye size={16} />
            Preview
          </button>
          <button type="submit" className="admin-preview-primary-action" disabled={Boolean(sendDisabledReason) || sending} title={sendDisabledReason || "Send message"}>
            <Send size={16} />
            {sending ? "Sending..." : "Send Message"}
          </button>
          <button type="button" className="admin-preview-secondary-action" onClick={() => setShowTestModal(true)} disabled={sending || testSending || !subject.trim() || !message.trim()}>
            <Mail size={16} />
            Send test email
          </button>
        </div>
        {sendDisabledReason ? <p role="status" style={{ color: "#64748b", marginTop: 10 }}>Send unavailable: {sendDisabledReason}</p> : null}
        <p style={{ color: "#64748b", marginTop: 8 }}>Send the current message to yourself before sending it to the selected recipients.</p>
      </form>

      {showConfirmationModal ? (
        <div role="dialog" aria-modal="true" aria-labelledby="communication-confirm-title" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", padding: 20 }}>
          <article style={{ width: "min(560px, 100%)", maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 16, padding: 24, color: "#243424", boxShadow: "0 24px 60px rgba(15,23,42,.25)" }}>
            <h2 id="communication-confirm-title">Ready to send?</h2>
            <p style={{ fontWeight: 700, color: "#b45309", marginTop: 8 }}>You are about to send this message to {preview?.recipient_count ?? 0} recipients.</p>
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", marginTop: 18 }}>
              <dt>Audience</dt><dd>{audienceOptions.find((option) => option.value === audience)?.label}</dd>
              <dt>Recipients</dt><dd>{preview?.recipient_count ?? 0}</dd>
              <dt>Missing email</dt><dd>{preview?.missing_email_count ?? 0}</dd>
              <dt>Subject</dt><dd>{subject}</dd>
              <dt>Attachments</dt><dd>{attachments.length}</dd>
            </dl>
            <div style={{ marginTop: 18, padding: 14, borderRadius: 10, background: "#f8fafc", whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto" }}>{message.slice(0, 500)}{message.length > 500 ? "..." : ""}</div>
            <p style={{ marginTop: 16 }}>This will send this email to {preview?.recipient_count ?? 0} recipients.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
              <button type="button" className="admin-preview-secondary-action" onClick={() => setShowConfirmationModal(false)} disabled={sending}>Cancel</button>
              <button type="button" className="admin-preview-primary-action" onClick={() => void confirmMassSend()} disabled={sending}>
                <Send size={16} />
                {sending ? "Sending..." : `Send to ${preview?.recipient_count ?? 0} recipients`}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {showTestModal ? (
        <div role="dialog" aria-modal="true" aria-labelledby="communication-test-title" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", padding: 20 }}>
          <form onSubmit={(event) => void handleTestSend(event)} style={{ width: "min(480px, 100%)", background: "#fff", borderRadius: 16, padding: 24, color: "#243424", boxShadow: "0 24px 60px rgba(15,23,42,.25)" }}>
            <h2 id="communication-test-title">Send test email</h2>
            <p style={{ color: "#64748b", marginTop: 8 }}>Send the current message to one address only. It will not be sent to the selected audience.</p>
            <label htmlFor="communication-test-email" style={{ display: "grid", gap: 6, marginTop: 18 }}>Test email address<input id="communication-test-email" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} required /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button type="button" className="admin-preview-secondary-action" onClick={() => setShowTestModal(false)} disabled={testSending}>Cancel</button>
              <button type="submit" className="admin-preview-primary-action" disabled={testSending}>{testSending ? "Sending..." : "Send test email"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {showPreviewModal ? (
        <div role="dialog" aria-modal="true" aria-label="Email preview" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", padding: 20 }}>
          <article style={{ width: "min(720px, 100%)", maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 16, padding: 24, color: "#243424" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><h2>Email preview</h2><button type="button" onClick={() => setShowPreviewModal(false)} aria-label="Close preview"><X size={18} /></button></div>
            <p><strong>FROM:</strong> Grandessa Smart Campus &lt;no-reply@grandessaschool.com.ng&gt;</p>
            <p><strong>TO:</strong> {preview?.recipient_count ?? 0} recipients</p>
            <p><strong>SUBJECT:</strong> {subject || "(No subject)"}</p>
            <hr />
            <div dir="ltr" style={{ direction: "ltr", textAlign: "left", unicodeBidi: "normal" }} dangerouslySetInnerHTML={{ __html: messageHtml || `<p>${escapeHtml(message || "(No message)")}</p>` }} />
            <div style={{ marginTop: 20 }}>{attachmentList}</div>
            <p style={{ marginTop: 16 }}>{preview?.recipient_count ?? 0} recipients · {preview?.missing_email_count ?? 0} missing email · {preview?.usage.remaining ?? 100} emails remaining today</p>
          </article>
        </div>
      ) : null}

      {showRecipientModal ? (
        <div role="dialog" aria-modal="true" aria-label="Resolved recipients" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", padding: 20 }}>
          <article style={{ width: "min(620px, 100%)", maxHeight: "80vh", overflow: "hidden", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", background: "#fff", borderRadius: 16, padding: 24, color: "#243424" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><h2>Resolved recipients</h2><button type="button" title="Close recipients" onClick={() => setShowRecipientModal(false)} aria-label="Close recipients"><X size={18} /></button></div>
            <div style={{ minHeight: 0, overflowY: "auto" }}>
              {(preview?.recipients ?? []).map((recipient, index) => <div key={`${recipient.email ?? "missing"}-${index}`} style={{ padding: "10px 0", borderBottom: "1px solid #e2e8f0" }}><strong>{recipient.email ? "✓" : "⚠"} {recipient.name}</strong><div>{recipient.email ?? "No email address"}</div><small>{recipient.source}</small></div>)}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
