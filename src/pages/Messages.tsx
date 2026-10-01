import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Search, Send, Users, User, Plus, X, Check, Paperclip, FileText, Download, ArrowLeft, MoreVertical, Folder } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import './Messages.css';

export interface Attachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  isImage: boolean;
}

export interface Conversation {
  id: string;
  type: 'dm' | 'group';
  name: string;
  subtitle: string;
  avatar: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
  memberCount?: number;
}

export interface GroupMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  joined_at: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  is_mine: boolean;
  attachment?: Attachment;
  replyTo?: { id: string; senderName: string; text: string };
}

export interface UserContact {
  id: string;
  full_name: string;
  email: string;
  role: string;
  shared_projects?: string[];
}

const MAX_BYTES = 10 * 1024 * 1024;

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Attachment | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [attachError, setAttachError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  
  // Modals/Dropdowns
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardModalMsg, setForwardModalMsg] = useState<Message | null>(null);
  const [emailModalMsg, setEmailModalMsg] = useState<Message | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  
  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const token = localStorage.getItem('token') || '';

  const fetchConversations = async () => {
    try {
      const res = await fetch('http://localhost:5001/messages/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        const formatted = data.conversations.map((c: any) => {
          const isGroup = Boolean(c.is_group);
          const name = isGroup
            ? (c.group_name || 'Group Chat')
            : (c.full_name || c.dm_user?.full_name || c.name || (c.email ? c.email.split('@')[0] : 'Unknown User'));
          const subtitle = isGroup
            ? (c.member_count ? `${c.member_count} members` : 'Group Chat')
            : (c.email || c.dm_user?.email || '');
          const avatar = isGroup
            ? ''
            : (name && name !== 'Unknown User' ? name.trim().charAt(0).toUpperCase() : (subtitle ? subtitle.trim().charAt(0).toUpperCase() : 'U'));
          
          return {
            id: String(c.conversation_id),
            type: (isGroup ? 'group' : 'dm') as 'group' | 'dm',
            name,
            subtitle,
            avatar,
            lastMessage: c.last_message || (isGroup ? 'New group' : 'New conversation'),
            lastTime: c.last_message_time ? new Date(c.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            unread: c.unread_count || 0,
            memberCount: c.member_count
          };
        });
        setConversations(formatted);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const res = await fetch(`http://localhost:5001/messages/conversations/${convId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        const formatted = data.messages.map((m: any) => {
          let attachment: Attachment | undefined = undefined;
          if (m.attachments && m.attachments.length > 0) {
            const att = m.attachments[0];
            const isImage = (att.mimeType || '').startsWith('image/') || m.message_type === 'image';
            const fileUrl = att.filePath
              ? (att.filePath.startsWith('http') ? att.filePath : `http://localhost:5001${att.filePath}`)
              : '';
            attachment = {
              name: att.originalName || att.fileName || 'Attachment',
              type: att.mimeType || 'application/octet-stream',
              size: Number(att.fileSize) || 0,
              dataUrl: fileUrl,
              isImage
            };
          }

          return {
            id: m.id,
            senderId: m.sender_id,
            senderName: m.sender_name || 'User',
            text: m.message_text || '',
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            is_mine: m.is_mine,
            attachment
          };
        });
        setMessages(formatted);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchConversations();
    
    // Connect socket
    socketRef.current = io('http://localhost:5001', {
      auth: { token }
    });
    
    socketRef.current.on('new_message', (msg: any) => {
      // Re-fetch conversations to update latest message
      fetchConversations();
      
      // If it belongs to active conversation, append it
      if (String(msg.conversation_id) === String(activeId)) {
        fetchMessages(String(msg.conversation_id));
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [activeId, token]);

  useEffect(() => {
    if (activeId) {
      fetchMessages(activeId);
      socketRef.current?.emit('join_conversation', activeId);
    } else {
      setMessages([]);
    }
  }, [activeId, token]);

  const active = conversations.find((c) => c.id === activeId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.name.toLowerCase().includes(q));
  }, [conversations, search]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeId]);

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

  const handleReport = (_msgId: string) => {
    if (window.confirm('Are you sure you want to report this message?')) {
      alert('Message has been reported to the administration.');
    }
  };

  const handleForward = async (targetConvId: string) => {
    if (!forwardModalMsg) return;
    try {
      await fetch('http://localhost:5001/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversationId: targetConvId,
          message: forwardModalMsg.text,
        })
      });
      fetchConversations();
      if (activeId === targetConvId) fetchMessages(targetConvId);
      setForwardModalMsg(null);
    } catch (e) {
      console.error(e);
    }
  };

  const openConversation = (id: string) => {
    setActiveId(id);
    fetch(`http://localhost:5001/messages/conversations/${id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(console.error);
    
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
      setPendingFile(file);
    } catch {
      setAttachError('Could not read that file.');
    }
  };

  const removeAttachment = () => {
    setPending(null);
    setPendingFile(null);
    setAttachError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageFile(file);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.kind === 'file');
    if (item) {
      const file = item.getAsFile();
      if (file) { e.preventDefault(); stageFile(file); }
    }
  };

  const send = async () => {
    const text = draft.trim();
    if ((!text && !pendingFile) || !activeId || sending) return;

    setSending(true);
    try {
      if (pendingFile) {
        const formData = new FormData();
        formData.append('conversationId', activeId);
        if (text) {
          formData.append('message', text);
        }
        formData.append('file', pendingFile);

        const res = await fetch('http://localhost:5001/messages/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          alert(data.message || 'Failed to upload attachment');
          return;
        }

        setDraft('');
        removeAttachment();
        await fetchMessages(activeId);
        await fetchConversations();
      } else {
        const res = await fetch('http://localhost:5001/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            conversationId: activeId,
            message: text,
          })
        });
        if (res.ok) {
          setDraft('');
          await fetchMessages(activeId);
          await fetchConversations();
        }
      }
    } catch (e) {
      console.error(e);
      alert('Error sending message');
    } finally {
      setSending(false);
    }
  };

  const createChat = async (userId: string) => {
    try {
      const res = await fetch('http://localhost:5001/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiverId: userId })
      });
      const data = await res.json();
      if (data.success) {
        await fetchConversations();
        setActiveId(String(data.conversationId));
        setShowCreate(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createGroupChat = async (name: string, userIds: string[]) => {
    try {
      const res = await fetch('http://localhost:5001/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isGroup: true, name, receiverIds: userIds })
      });
      const data = await res.json();
      if (data.success) {
        await fetchConversations();
        setActiveId(String(data.conversationId));
        setShowCreateGroup(false);
      } else {
        alert(data.message || 'Failed to create group');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating group chat');
    }
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
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button className="msg-new-group" onClick={() => setShowCreate(true)} title="New chat" style={{ flex: 1 }}>
              <Plus size={16} /> New Chat
            </button>
            <button className="msg-new-group" onClick={() => setShowCreateGroup(true)} title="New Group" style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
              <Users size={16} /> New Group
            </button>
          </div>
        </div>
        <div className="msg-search">
          <Search size={16} />
          <input type="text" placeholder="Search conversations" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="msg-conversations">
          {filtered.map((c) => (
            <button key={c.id} className={`msg-conv${c.id === activeId ? ' active' : ''}`} onClick={() => openConversation(c.id)}>
              <span className={`msg-avatar ${c.type === 'group' ? 'group' : 'dm'}`}>
                {c.type === 'group' ? <Users size={17} /> : c.avatar}
              </span>
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
          {conversations.length === 0 && (
             <div className="msg-empty" style={{ padding: '20px', minHeight: 'auto', textAlign: 'center' }}>
               <p style={{ color: 'var(--text-sub)' }}>No conversations yet.</p>
             </div>
          )}
        </div>
      </aside>

      <section className="msg-thread">
        {active ? (
          <>
            <header className="msg-thread-header">
              <span className={`msg-avatar ${active.type === 'group' ? 'group' : 'dm'}`}>
                {active.type === 'group' ? <Users size={18} /> : active.avatar}
              </span>
              <div 
                className="msg-thread-info"
                style={active.type === 'group' ? { cursor: 'pointer' } : undefined}
                onClick={active.type === 'group' ? () => setShowMembersModal(true) : undefined}
                title={active.type === 'group' ? 'Click to view group members' : undefined}
              >
                <div className="msg-thread-name">{active.name}</div>
                <div className="msg-thread-sub">
                  {active.subtitle}
                  {active.type === 'group' && <span className="msg-header-view-members-link"> • View members</span>}
                </div>
              </div>
              {active.type === 'group' && (
                <button
                  type="button"
                  className="msg-thread-members-btn"
                  onClick={() => setShowMembersModal(true)}
                  title="View group members"
                >
                  <Users size={15} />
                  <span>Members</span>
                </button>
              )}
            </header>

            <div className="msg-thread-body">
              {messages.map((m) => {
                const mine = m.is_mine;
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
                              <button onClick={() => { setForwardModalMsg(m); setActiveDropdownId(null); }}>Forward</button>
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
                              <button onClick={() => { setForwardModalMsg(m); setActiveDropdownId(null); }}>Forward</button>
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
                <button className="msg-attach-remove" onClick={removeAttachment} aria-label="Remove attachment"><X size={16} /></button>
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
                placeholder={`Message ${active.name}...`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onPaste={onPaste}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              />
              <button className="msg-send" onClick={send} disabled={(!draft.trim() && !pending) || sending}>
                <Send size={16} /> {sending ? 'Sending...' : 'Send'}
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

      {showCreate && <CreateChatModal onClose={() => setShowCreate(false)} onCreate={createChat} token={token} />}
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreate={createGroupChat} token={token} />}
      {showMembersModal && active && active.type === 'group' && (
        <GroupMembersModal
          conversationId={active.id}
          conversationName={active.name}
          onClose={() => setShowMembersModal(false)}
          token={token}
        />
      )}

      {forwardModalMsg && (
        <div className="msg-overlay" onClick={() => setForwardModalMsg(null)}>
          <div className="msg-modal" onClick={(e) => e.stopPropagation()}>
            <button className="msg-modal-close" onClick={() => setForwardModalMsg(null)} aria-label="Close"><X size={18} /></button>
            <h3 className="msg-modal-title">Forward Message</h3>
            <p className="msg-modal-sub">Select a conversation to forward this message to.</p>
            <div className="msg-member-list">
              {conversations.map((c) => (
                <button key={c.id} className="msg-member" onClick={() => handleForward(c.id)}>
                  <span className={`msg-avatar ${c.type === 'group' ? 'group' : 'dm'}`}>
                    {c.type === 'group' ? <Users size={17} /> : c.avatar}
                  </span>
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
      <a href={att.dataUrl} target="_blank" rel="noopener noreferrer" download={att.name} className="msg-img-link" title="Click to view/download image">
        <img src={att.dataUrl} alt={att.name} className="msg-img" />
      </a>
    );
  }
  return (
    <a href={att.dataUrl} download={att.name} target="_blank" rel="noopener noreferrer" className={`msg-file-card${mine ? ' mine' : ''}`} title={`Download ${att.name}`}>
      <span className="msg-file-icon"><FileText size={20} /></span>
      <span className="msg-file-info">
        <span className="msg-file-name">{att.name}</span>
        <span className="msg-file-size">{fmtSize(att.size)}</span>
      </span>
      <span className="msg-file-dl"><Download size={16} /></span>
    </a>
  );
};

/* Create Chat Modal */
const CreateChatModal: React.FC<{
  onClose: () => void;
  onCreate: (userId: string) => void;
  token: string;
}> = ({ onClose, onCreate, token }) => {
  const [users, setUsers] = useState<UserContact[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`http://localhost:5001/users/search?q=${encodeURIComponent(search)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setUsers(data.users || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, 300); // debounce search
    
    return () => clearTimeout(timeoutId);
  }, [search, token]);

  return (
    <div className="msg-overlay" onClick={onClose}>
      <div className="msg-modal" onClick={(e) => e.stopPropagation()}>
        <button className="msg-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h3 className="msg-modal-title">New Chat</h3>
        <p className="msg-modal-sub">Select a team member from your projects to start a conversation.</p>
        <div className="msg-field">
          <div className="msg-search-box-modal" style={{ marginBottom: '8px' }}>
            <Search size={15} color="#8A8270" />
            <input 
              type="text" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Search by name, email, or project..." 
              autoFocus 
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: '#8A8270', display: 'flex' }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="msg-member-list">
          {users.map((u) => {
            return (
              <button key={u.id} type="button" className="msg-member" onClick={() => onCreate(u.id)}>
                <span className="msg-avatar dm">{(u.full_name || 'U').charAt(0).toUpperCase()}</span>
                <span className="msg-member-main">
                  <span className="msg-member-name">{u.full_name}</span>
                  <span className="msg-member-role">{u.email} {u.role ? `• ${u.role}` : ''}</span>
                  {u.shared_projects && u.shared_projects.length > 0 && (
                    <span className="msg-member-projects">
                      {u.shared_projects.slice(0, 2).map((p, idx) => (
                        <span key={idx} className="msg-member-project-tag"><Folder size={11} /> {p}</span>
                      ))}
                      {u.shared_projects.length > 2 && (
                        <span className="msg-member-project-more">+{u.shared_projects.length - 2} more</span>
                      )}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {users.length === 0 && search && (
             <div className="msg-empty" style={{ padding: '20px', minHeight: 'auto', textAlign: 'center' }}>
               <p style={{ color: 'var(--text-sub)' }}>No project members found matching "{search}"</p>
             </div>
          )}
          {users.length === 0 && !search && (
             <div className="msg-empty" style={{ padding: '20px', minHeight: 'auto', textAlign: 'center' }}>
               <p style={{ color: 'var(--text-sub)' }}>No team members found in your projects yet. Only members of projects you own or belong to will appear here.</p>
             </div>
          )}
        </div>
        <div className="msg-modal-actions">
          <button type="button" className="msg-btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

/* Create Group Chat Modal */
const CreateGroupModal: React.FC<{
  onClose: () => void;
  onCreate: (name: string, userIds: string[]) => void;
  token: string;
}> = ({ onClose, onCreate, token }) => {
  const [users, setUsers] = useState<UserContact[]>([]);
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserContact[]>([]);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`http://localhost:5001/users/search?q=${encodeURIComponent(search)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setUsers(data.users || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [search, token]);

  const toggleUser = (user: UserContact) => {
    if (selectedUsers.some(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  return (
    <div className="msg-overlay" onClick={onClose}>
      <div className="msg-modal msg-create-group-modal" onClick={(e) => e.stopPropagation()}>
        <button className="msg-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        
        <div className="msg-members-header" style={{ marginBottom: '16px' }}>
          <div className="msg-members-title-row">
            <span className="msg-members-icon-wrap">
              <Users size={20} />
            </span>
            <div>
              <h3 className="msg-modal-title" style={{ margin: 0 }}>Create Group Chat</h3>
              <p className="msg-modal-sub" style={{ margin: '2px 0 0 0' }}>
                Name your group and choose members from your projects
              </p>
            </div>
          </div>
        </div>
        
        {/* Group Name */}
        <div className="msg-field" style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-sub)', marginBottom: '4px', display: 'block' }}>GROUP NAME *</label>
          <input 
            type="text" 
            value={groupName} 
            onChange={(e) => setGroupName(e.target.value)} 
            placeholder="e.g. Project Alpha Team" 
            autoFocus 
          />
        </div>

        {/* Added Members Preview Panel */}
        <div style={{ marginBottom: '14px' }}>
          <div className="msg-added-section-header">
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-sub)', margin: 0 }}>
              MEMBERS IN GROUP ({selectedUsers.length + 1})
            </label>
            {selectedUsers.length > 0 && (
              <button
                type="button"
                className="msg-clear-all-btn"
                onClick={() => setSelectedUsers([])}
              >
                Clear added ({selectedUsers.length})
              </button>
            )}
          </div>

          <div className="msg-added-members-tray">
            {/* Creator Badge (Always included) */}
            <div className="msg-added-chip creator" title="You will be in this group as creator">
              <span className="msg-chip-avatar">
                {(currentUser.full_name || currentUser.email || 'Y').charAt(0).toUpperCase()}
              </span>
              <span className="msg-chip-name">{currentUser.full_name || 'You'}</span>
              <span className="msg-chip-creator-tag">You (Creator)</span>
            </div>

            {/* Added Members Chips */}
            {selectedUsers.map(u => (
              <div key={u.id} className="msg-added-chip" title={`${u.full_name} (${u.email})`}>
                <span className="msg-chip-avatar">
                  {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                </span>
                <div className="msg-chip-info">
                  <span className="msg-chip-name">{u.full_name}</span>
                  {u.role && <span className="msg-chip-sub">{u.role}</span>}
                </div>
                <button 
                  type="button" 
                  className="msg-chip-remove" 
                  onClick={() => toggleUser(u)} 
                  title={`Remove ${u.full_name}`}
                  aria-label={`Remove ${u.full_name}`}
                >
                  <X size={13} />
                </button>
              </div>
            ))}

            {selectedUsers.length === 0 && (
              <div className="msg-added-empty-notice">
                <span>Select members below to add them to this group.</span>
              </div>
            )}
          </div>
        </div>

        {/* Search & Select Users */}
        <div className="msg-field">
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-sub)', marginBottom: '4px', display: 'block' }}>
            ADD MEMBERS FROM TEAM
          </label>
          <div className="msg-search-box-modal" style={{ marginBottom: '8px' }}>
            <Search size={15} color="#8A8270" />
            <input 
              type="text" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Search name, email, or role..." 
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: '#8A8270', display: 'flex' }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="msg-member-list" style={{ maxHeight: '180px' }}>
          {users.map((u) => {
            const isSelected = selectedUsers.some(su => su.id === u.id);
            return (
              <button 
                key={u.id} 
                type="button"
                className={`msg-member${isSelected ? ' selected' : ''}`} 
                onClick={() => toggleUser(u)}
              >
                <span className="msg-avatar dm">{(u.full_name || 'U').charAt(0).toUpperCase()}</span>
                <span className="msg-member-main">
                  <span className="msg-member-name">{u.full_name}</span>
                  <span className="msg-member-role">{u.email} {u.role ? `• ${u.role}` : ''}</span>
                  {u.shared_projects && u.shared_projects.length > 0 && (
                    <span className="msg-member-projects">
                      {u.shared_projects.slice(0, 2).map((p, idx) => (
                        <span key={idx} className="msg-member-project-tag"><Folder size={11} /> {p}</span>
                      ))}
                      {u.shared_projects.length > 2 && (
                        <span className="msg-member-project-more">+{u.shared_projects.length - 2} more</span>
                      )}
                    </span>
                  )}
                </span>
                {isSelected ? (
                  <span className="msg-member-badge-added">
                    <Check size={12} /> Added
                  </span>
                ) : (
                  <span className="msg-check">
                    <Plus size={12} color="#CBBFB0" />
                  </span>
                )}
              </button>
            );
          })}
          {users.length === 0 && (
            <div className="msg-empty" style={{ padding: '20px', minHeight: 'auto', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-sub)' }}>
                {search ? `No project members found matching "${search}"` : 'No team members found in your projects yet.'}
              </p>
            </div>
          )}
        </div>

        {/* Live Pre-Creation Summary */}
        <div className="msg-create-summary-bar">
          <Users size={16} />
          <span>
            {selectedUsers.length === 0
              ? 'Please select at least 1 member to create group'
              : `Group will have ${selectedUsers.length + 1} members (You + ${selectedUsers.length} added)`}
          </span>
        </div>
        
        <div className="msg-modal-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="msg-btn-cancel" onClick={onClose}>Cancel</button>
          <button 
            type="button"
            className="msg-btn-create" 
            onClick={() => onCreate(groupName, selectedUsers.map(u => u.id))}
            disabled={!groupName.trim() || selectedUsers.length === 0}
          >
            Create Group ({selectedUsers.length + 1} members)
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   Group Members Modal
   ============================================================================ */
interface GroupMembersModalProps {
  conversationId: string;
  conversationName: string;
  onClose: () => void;
  token: string;
}

const GroupMembersModal: React.FC<GroupMembersModalProps> = ({ conversationId, conversationName, onClose, token }) => {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:5001/messages/conversations/${conversationId}/members`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setMembers(data.members || []);
        } else {
          setError(data.message || 'Failed to load group members');
        }
      } catch (err) {
        console.error(err);
        setError('Error fetching members');
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [conversationId, token]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      (m.full_name && m.full_name.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.role && m.role.toLowerCase().includes(q))
    );
  }, [members, search]);

  return (
    <div className="msg-overlay" onClick={onClose}>
      <div className="msg-modal msg-members-modal" onClick={(e) => e.stopPropagation()}>
        <button className="msg-modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="msg-members-header">
          <div className="msg-members-title-row">
            <span className="msg-members-icon-wrap">
              <Users size={20} />
            </span>
            <div>
              <h3 className="msg-modal-title" style={{ margin: 0 }}>{conversationName}</h3>
              <p className="msg-modal-sub" style={{ margin: '2px 0 0 0' }}>
                {members.length} {members.length === 1 ? 'member' : 'members'} in this group
              </p>
            </div>
          </div>
        </div>

        <div className="msg-field" style={{ marginTop: '14px', marginBottom: '12px' }}>
          <div className="msg-search-box-modal">
            <Search size={15} color="#8A8270" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: '#8A8270', display: 'flex' }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="msg-empty" style={{ padding: '30px 20px', minHeight: 'auto', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-sub)' }}>Loading group members...</p>
          </div>
        ) : error ? (
          <div className="msg-empty" style={{ padding: '30px 20px', minHeight: 'auto', textAlign: 'center' }}>
            <p style={{ color: '#DC2626' }}>{error}</p>
          </div>
        ) : (
          <div className="msg-member-list msg-members-list-scroll">
            {filteredMembers.map((m) => {
              const isMe = m.id === currentUser.id || m.email === currentUser.email;
              const initials = (m.full_name || m.email || 'U').trim().charAt(0).toUpperCase();
              const joinedDate = m.joined_at ? new Date(m.joined_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) : '';

              return (
                <div key={m.id} className="msg-group-member-item">
                  <div className="msg-avatar dm">
                    {initials}
                  </div>
                  <div className="msg-group-member-info">
                    <div className="msg-group-member-top">
                      <span className="msg-group-member-name">{m.full_name || 'Unnamed User'}</span>
                      {isMe && <span className="msg-you-badge">You</span>}
                    </div>
                    <span className="msg-group-member-email">{m.email}</span>
                  </div>
                  <div className="msg-group-member-meta">
                    {m.role && <span className={`msg-role-pill role-${m.role.toLowerCase()}`}>{m.role}</span>}
                    {joinedDate && <span className="msg-joined-date">Joined {joinedDate}</span>}
                  </div>
                </div>
              );
            })}
            {filteredMembers.length === 0 && (
              <div className="msg-empty" style={{ padding: '24px 20px', minHeight: 'auto', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-sub)' }}>
                  {search ? `No members match "${search}"` : 'No members found.'}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="msg-modal-actions" style={{ marginTop: '16px' }}>
          <button className="msg-btn-cancel" onClick={onClose} style={{ width: '100%' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Messages;
