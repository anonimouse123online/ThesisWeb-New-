import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Search, Send, Users, User, Plus, X, Check, Paperclip, FileText, Download, ArrowLeft, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CONVERSATIONS, CURRENT_USER, CONTACTS } from '../data/messages.data';
import type { Conversation, Message, Contact, Attachment } from '../data/messages.data';
import './Messages.css';

const MAX_BYTES = 4 * 1024 * 1024; // ~4MB cap (client-side base64)

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileToAttachment = (file: File): Promise<Attachment> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl: reader.result as string,
      isImage: file.type.startsWith('image/'),
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const Messages: React.FC = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>(CONVERSATIONS);
  const [activeId, setActiveId] = useState<string>(CONVERSATIONS[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Attachment | null>(null); // staged attachment
  const [attachError, setAttachError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardModalMsg, setForwardModalMsg] = useState<Message | null>(null);
  const [emailModalMsg, setEmailModalMsg] = useState<Message | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = conversations.find((c) => c.id === activeId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.name.toLowerCase().includes(q));
  }, [conversations, search]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length, activeId]);

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleDropdown = (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    setActiveDropdownId((prev) => (prev === msgId ? null : msgId));
  };

  const handleEmailForward = () => {
    if (!emailModalMsg || !isValidEmail(emailRecipient)) return;
    const msg = emailModalMsg;
    const subject = encodeURIComponent(`Fwd: Message`);
    const body = encodeURIComponent(
      `---------- Forwarded message ----------\n` +
      `From: ${msg.senderName || 'Unknown'}\n` +
      `Date: ${msg.time || ''}\n` +
      `Subject: Message\n\n` +
      `${msg.text || ''}\n` +
      `${msg.attachment ? '\n(Attachment included: ' + msg.attachment.name + ')' : ''}`
    );

    window.location.href = `mailto:${encodeURIComponent(emailRecipient.trim())}?subject=${subject}&body=${body}`;
    setEmailModalMsg(null);
    setEmailRecipient('');
  };

  const handleReport = (msgId: string) => {
    if (window.confirm('Are you sure you want to report this message?')) {
      alert('Message has been reported to the administration.');
    }
  };

  const handleForward = (targetConvId: string) => {
    if (!forwardModalMsg) return;
    const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const msg: Message = {
      id: `m-${Date.now()}`,
      senderId: CURRENT_USER.id,
      senderName: CURRENT_USER.name,
      text: forwardModalMsg.text,
      time: now,
      attachment: forwardModalMsg.attachment,
    };
    
    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetConvId
          ? { ...c, messages: [...c.messages, msg], lastMessage: msg.text || 'Attachment', lastTime: now }
          : c
      )
    );
    setForwardModalMsg(null);
  };

  const openConversation = (id: string) => {
    setActiveId(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  };

  const stageFile = async (file: File) => {
    setAttachError('');
    if (file.size > MAX_BYTES) {
      setAttachError(`File too large (max ${fmtSize(MAX_BYTES)}).`);
      return;
    }
    try {
      const att = await fileToAttachment(file);
      setPending(att);
    } catch {
      setAttachError('Could not read that file.');
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageFile(file);
    e.target.value = ''; // allow re-picking same file
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.kind === 'file');
    if (item) {
      const file = item.getAsFile();
      if (file) { e.preventDefault(); stageFile(file); }
    }
  };

  const send = () => {
    const text = draft.trim();
    if ((!text && !pending) || !active) return;
    const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const msg: Message = {
      id: `m-${Date.now()}`,
      senderId: CURRENT_USER.id,
      senderName: CURRENT_USER.name,
      text,
      time: now,
      attachment: pending ?? undefined,
      replyTo: replyingTo ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text } : undefined,
    };
    const preview = pending ? `📎 ${pending.name}` : text;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? { ...c, messages: [...c.messages, msg], lastMessage: preview, lastTime: now }
          : c
      )
    );
    setDraft('');
    setPending(null);
    setAttachError('');
    setReplyingTo(null);
  };

  const createGroup = (name: string, members: Contact[]) => {
    const id = `g-${Date.now()}`;
    const newGroup: Conversation = {
      id, type: 'group', name,
      subtitle: `${members.length + 1} members`,
      avatar: name.charAt(0).toUpperCase(),
      lastMessage: 'Group created', lastTime: 'now', unread: 0,
      messages: [{
        id: 'm0', senderId: 'system', senderName: 'System',
        text: `${CURRENT_USER.name} created the group with ${members.map((m) => m.name).join(', ')}.`,
        time: 'now',
      }],
    };
    setConversations((prev) => [newGroup, ...prev]);
    setActiveId(id);
    setShowCreate(false);
  };

  return (
    <div className="msg-page">
      <aside className="msg-list">
        <div className="msg-list-header">
          <div className="msg-list-header-top">
            <button className="msg-back-btn" onClick={() => navigate(-1)} title="Go back">
              <ArrowLeft size={18} />
            </button>
            <h2>Messages</h2>
          </div>
          <button className="msg-new-group" onClick={() => setShowCreate(true)} title="New group chat">
            <Plus size={16} /> New Group
          </button>
        </div>
        <div className="msg-search">
          <Search size={16} />
          <input type="text" placeholder="Search conversations" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="msg-conversations">
          {filtered.map((c) => (
            <button key={c.id} className={`msg-conv${c.id === activeId ? ' active' : ''}`} onClick={() => openConversation(c.id)}>
              <span className={`msg-avatar ${c.type}`}>{c.type === 'group' ? <Users size={16} /> : c.avatar}</span>
              <span className="msg-conv-main">
                <span className="msg-conv-top">
                  <span className="msg-conv-name">{c.name}</span>
                  <span className="msg-conv-time">{c.lastTime}</span>
                </span>
                <span className="msg-conv-preview">{c.lastMessage}</span>
              </span>
              {c.unread > 0 && <span className="msg-unread">{c.unread}</span>}
            </button>
          ))}
        </div>
      </aside>

      <section className="msg-thread">
        {active ? (
          <>
            <header className="msg-thread-header">
              <span className={`msg-avatar ${active.type}`}>{active.type === 'group' ? <Users size={16} /> : active.avatar}</span>
              <div>
                <div className="msg-thread-name">{active.name}</div>
                <div className="msg-thread-sub">{active.subtitle}</div>
              </div>
            </header>

            <div className="msg-thread-body">
              {active.messages.map((m) => {
                if (m.senderId === 'system') {
                  return <div key={m.id} className="msg-system">{m.text}</div>;
                }
                const mine = m.senderId === CURRENT_USER.id;
                return (
                  <div key={m.id} className={`msg-bubble-row${mine ? ' mine' : ''}`}>
                    {!mine && active.type === 'group' && <span className="msg-bubble-sender">{m.senderName}</span>}
                    <div className="msg-bubble-wrapper">
                      {mine && (
                        <div className={`msg-options-container ${activeDropdownId === m.id ? 'active' : ''}`}>
                          <button className="msg-options-btn" onClick={(e) => toggleDropdown(e, m.id)}>
                            <MoreVertical size={16} />
                          </button>
                          {activeDropdownId === m.id && (
                            <div className="msg-options-dropdown right">
                              <button onClick={() => { setForwardModalMsg(m); setActiveDropdownId(null); }}>Forward to another group</button>
                              <button onClick={() => { setEmailModalMsg(m); setEmailRecipient(''); setActiveDropdownId(null); }}>Forward as email</button>
                              <button onClick={() => { setReplyingTo(m); setActiveDropdownId(null); }}>Reply</button>
                              <button className="text-red" onClick={() => { handleReport(m.id); setActiveDropdownId(null); }}>Report</button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`msg-bubble${mine ? ' mine' : ''}`}>
                        {m.replyTo && (
                          <div className="msg-reply-quote">
                            <span className="msg-reply-sender">{m.replyTo.senderName}</span>
                            <span className="msg-reply-text">{m.replyTo.text}</span>
                          </div>
                        )}
                        {m.attachment && <AttachmentView att={m.attachment} mine={mine} />}
                        {m.text && <span>{m.text}</span>}
                      </div>

                      {!mine && (
                        <div className={`msg-options-container ${activeDropdownId === m.id ? 'active' : ''}`}>
                          <button className="msg-options-btn" onClick={(e) => toggleDropdown(e, m.id)}>
                            <MoreVertical size={16} />
                          </button>
                          {activeDropdownId === m.id && (
                            <div className="msg-options-dropdown left">
                              <button onClick={() => { setForwardModalMsg(m); setActiveDropdownId(null); }}>Forward to another group</button>
                              <button onClick={() => { setEmailModalMsg(m); setEmailRecipient(''); setActiveDropdownId(null); }}>Forward as email</button>
                              <button onClick={() => { setReplyingTo(m); setActiveDropdownId(null); }}>Reply</button>
                              <button className="text-red" onClick={() => { handleReport(m.id); setActiveDropdownId(null); }}>Report</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="msg-bubble-time">{m.time}</span>
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>

            {/* staged attachment preview */}
            {pending && (
              <div className="msg-attach-preview">
                {pending.isImage ? (
                  <img src={pending.dataUrl} alt={pending.name} className="msg-attach-thumb" />
                ) : (
                  <span className="msg-attach-fileicon"><FileText size={18} /></span>
                )}
                <span className="msg-attach-meta">
                  <span className="msg-attach-name">{pending.name}</span>
                  <span className="msg-attach-size">{fmtSize(pending.size)}</span>
                </span>
                <button className="msg-attach-remove" onClick={() => setPending(null)} aria-label="Remove attachment"><X size={16} /></button>
              </div>
            )}
            {attachError && <div className="msg-attach-error">{attachError}</div>}

            {replyingTo && (
              <div className="msg-reply-preview">
                <div className="msg-reply-preview-content">
                  <span className="msg-reply-sender">Replying to {replyingTo.senderName}</span>
                  <span className="msg-reply-text">{replyingTo.text}</span>
                </div>
                <button className="msg-reply-cancel" onClick={() => setReplyingTo(null)}><X size={14} /></button>
              </div>
            )}

            <div className="msg-composer">
              <input ref={fileInputRef} type="file" hidden onChange={onPickFile} />
              <button className="msg-attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach file">
                <Paperclip size={18} />
              </button>
              <input
                type="text"
                placeholder={`Message ${active.name}...  (paste to attach)`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onPaste={onPaste}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              />
              <button className="msg-send" onClick={send} disabled={!draft.trim() && !pending}>
                <Send size={16} /> Send
              </button>
            </div>
          </>
        ) : (
          <div className="msg-empty">
            <User size={32} />
            <p>Select a conversation to start messaging.</p>
          </div>
        )}
      </section>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={createGroup} />}

      {forwardModalMsg && (
        <div className="msg-overlay" onClick={() => setForwardModalMsg(null)}>
          <div className="msg-modal" onClick={(e) => e.stopPropagation()}>
            <button className="msg-modal-close" onClick={() => setForwardModalMsg(null)} aria-label="Close"><X size={18} /></button>
            <h3 className="msg-modal-title">Forward Message</h3>
            <p className="msg-modal-sub">Select a conversation to forward this message to.</p>
            <div className="msg-member-list">
              {conversations.map((c) => (
                <button key={c.id} className="msg-member" onClick={() => handleForward(c.id)}>
                  <span className={`msg-avatar ${c.type}`}>{c.type === 'group' ? <Users size={16} /> : c.avatar}</span>
                  <span className="msg-member-main">
                    <span className="msg-member-name">{c.name}</span>
                    <span className="msg-member-role">{c.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {emailModalMsg && (
        <div className="msg-overlay" onClick={() => setEmailModalMsg(null)}>
          <div className="msg-modal" onClick={(e) => e.stopPropagation()}>
            <button className="msg-modal-close" onClick={() => setEmailModalMsg(null)} aria-label="Close">
              <X size={18} />
            </button>
            <h3 className="msg-modal-title">Forward as Email</h3>
            <p className="msg-modal-sub">Enter the email address of the recipient.</p>
            <div className="msg-field">
              <label>Recipient Email</label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValidEmail(emailRecipient)) handleEmailForward();
                }}
                placeholder="e.g., colleague@example.com"
                autoFocus
              />
              {emailRecipient.trim().length > 0 && !isValidEmail(emailRecipient) && (
                <span className="msg-field-error">Enter a valid email address.</span>
              )}
            </div>
            <div className="msg-modal-actions" style={{ marginTop: '16px' }}>
              <button className="msg-btn-cancel" onClick={() => setEmailModalMsg(null)}>
                Cancel
              </button>
              <button
                className="msg-btn-create"
                onClick={handleEmailForward}
                disabled={!isValidEmail(emailRecipient)}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* Attachment bubble content */
const AttachmentView: React.FC<{ att: Attachment; mine: boolean }> = ({ att, mine }) => {
  if (att.isImage) {
    return (
      <a href={att.dataUrl} download={att.name} className="msg-img-link">
        <img src={att.dataUrl} alt={att.name} className="msg-img" />
      </a>
    );
  }
  return (
    <a href={att.dataUrl} download={att.name} className={`msg-file-card${mine ? ' mine' : ''}`}>
      <span className="msg-file-icon"><FileText size={20} /></span>
      <span className="msg-file-info">
        <span className="msg-file-name">{att.name}</span>
        <span className="msg-file-size">{fmtSize(att.size)}</span>
      </span>
      <span className="msg-file-dl"><Download size={16} /></span>
    </a>
  );
};

/* Create Group modal */
const CreateGroupModal: React.FC<{
  onClose: () => void;
  onCreate: (name: string, members: Contact[]) => void;
}> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const members = CONTACTS.filter((c) => picked.has(c.id));
  const canCreate = name.trim().length > 0 && members.length >= 1;

  return (
    <div className="msg-overlay" onClick={onClose}>
      <div className="msg-modal" onClick={(e) => e.stopPropagation()}>
        <button className="msg-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h3 className="msg-modal-title">New Group Chat</h3>
        <p className="msg-modal-sub">Name the group and pick at least one member.</p>
        <div className="msg-field">
          <label>Group name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Foundation Crew" autoFocus />
        </div>
        <div className="msg-field">
          <label>Members ({members.length} selected)</label>
        </div>
        <div className="msg-member-list">
          {CONTACTS.map((c) => {
            const on = picked.has(c.id);
            return (
              <button key={c.id} className={`msg-member${on ? ' selected' : ''}`} onClick={() => toggle(c.id)}>
                <span className="msg-avatar dm">{c.avatar}</span>
                <span className="msg-member-main">
                  <span className="msg-member-name">{c.name}</span>
                  <span className="msg-member-role">{c.role}</span>
                </span>
                <span className="msg-check">{on ? <Check size={14} /> : null}</span>
              </button>
            );
          })}
        </div>
        <div className="msg-modal-actions">
          <button className="msg-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="msg-btn-create" onClick={() => onCreate(name.trim(), members)} disabled={!canCreate}>Create Group</button>
        </div>
      </div>
    </div>
  );
};

export default Messages;
