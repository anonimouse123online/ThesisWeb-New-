import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Search, Send, Users, User, Plus, X, Check, Paperclip, FileText, Download, ArrowLeft, MoreVertical } from 'lucide-react';
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
}

const MAX_BYTES = 4 * 1024 * 1024;

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
  const [attachError, setAttachError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  
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
          const isGroup = c.is_group;
          const name = isGroup ? c.group_name : (c.dm_user?.full_name || 'Unknown User');
          const subtitle = isGroup ? 'Group Chat' : (c.dm_user?.email || '');
          const avatar = isGroup ? '👥' : (name.charAt(0).toUpperCase());
          
          return {
            id: c.conversation_id,
            type: isGroup ? 'group' : 'dm',
            name,
            subtitle,
            avatar,
            lastMessage: c.last_message || (isGroup ? 'New group' : 'New conversation'),
            lastTime: c.last_message_time ? new Date(c.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            unread: c.unread_count || 0
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
        const formatted = data.messages.map((m: any) => ({
          id: m.id,
          senderId: m.sender_id,
          senderName: m.sender_name || 'User',
          text: m.message_type === 'text' ? m.message_text : 'Sent an attachment',
          time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          is_mine: m.is_mine,
        }));
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
      if (msg.conversation_id === activeId) {
        // Only append if it's not our own message to prevent duplicates (our local send already updates UI)
        // Actually wait, sending doesn't append locally immediately in our new code, we re-fetch! So we should re-fetch or append safely.
        fetchMessages(msg.conversation_id);
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

  const handleReport = (msgId: string) => {
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
    } catch {
      setAttachError('Could not read that file.');
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) stageFile(file);
    e.target.value = '';
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
    if ((!text && !pending) || !activeId) return;

    if (pending) {
      alert("Attachment sending via backend not fully implemented in UI yet.");
      setPending(null);
      return;
    }

    try {
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
        fetchMessages(activeId);
        fetchConversations();
      }
    } catch (e) {
      console.error(e);
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
        setActiveId(data.conversationId);
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
        setActiveId(data.conversationId);
        setShowCreateGroup(false);
      }
    } catch (e) {
      console.error(e);
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
              <span className={`msg-avatar dm`}>{c.avatar}</span>
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
              <span className={`msg-avatar dm`}>{active.avatar}</span>
              <div>
                <div className="msg-thread-name">{active.name}</div>
                <div className="msg-thread-sub">{active.subtitle}</div>
              </div>
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
                placeholder={`Message ${active.name}...`}
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

      {showCreate && <CreateChatModal onClose={() => setShowCreate(false)} onCreate={createChat} token={token} />}
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreate={createGroupChat} token={token} />}

      {forwardModalMsg && (
        <div className="msg-overlay" onClick={() => setForwardModalMsg(null)}>
          <div className="msg-modal" onClick={(e) => e.stopPropagation()}>
            <button className="msg-modal-close" onClick={() => setForwardModalMsg(null)} aria-label="Close"><X size={18} /></button>
            <h3 className="msg-modal-title">Forward Message</h3>
            <p className="msg-modal-sub">Select a conversation to forward this message to.</p>
            <div className="msg-member-list">
              {conversations.map((c) => (
                <button key={c.id} className="msg-member" onClick={() => handleForward(c.id)}>
                  <span className={`msg-avatar dm`}>{c.avatar}</span>
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
        const res = await fetch(`http://localhost:5001/users/search?q=${search}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setUsers(data.users);
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
        <p className="msg-modal-sub">Search for a user to start a conversation.</p>
        <div className="msg-field">
          <input 
            type="text" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search name or email..." 
            autoFocus 
          />
        </div>
        <div className="msg-member-list">
          {users.map((u) => {
            return (
              <button key={u.id} className="msg-member" onClick={() => onCreate(u.id)}>
                <span className="msg-avatar dm">{(u.full_name || 'U').charAt(0).toUpperCase()}</span>
                <span className="msg-member-main">
                  <span className="msg-member-name">{u.full_name}</span>
                  <span className="msg-member-role">{u.email}</span>
                </span>
              </button>
            );
          })}
          {users.length === 0 && search && (
             <div className="msg-empty" style={{ padding: '20px', minHeight: 'auto', textAlign: 'center' }}>
               <p style={{ color: 'var(--text-sub)' }}>No users found matching "{search}"</p>
             </div>
          )}
          {users.length === 0 && !search && (
             <div className="msg-empty" style={{ padding: '20px', minHeight: 'auto', textAlign: 'center' }}>
               <p style={{ color: 'var(--text-sub)' }}>Type to search for users in the database.</p>
             </div>
          )}
        </div>
        <div className="msg-modal-actions">
          <button className="msg-btn-cancel" onClick={onClose}>Cancel</button>
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

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`http://localhost:5001/users/search?q=${search}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setUsers(data.users);
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
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  return (
    <div className="msg-overlay" onClick={onClose}>
      <div className="msg-modal" onClick={(e) => e.stopPropagation()}>
        <button className="msg-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h3 className="msg-modal-title">New Group Chat</h3>
        
        <div className="msg-field" style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-sub)', marginBottom: '4px', display: 'block' }}>GROUP NAME</label>
          <input 
            type="text" 
            value={groupName} 
            onChange={(e) => setGroupName(e.target.value)} 
            placeholder="e.g. Project Alpha Team" 
            autoFocus 
          />
        </div>

        <div className="msg-field">
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-sub)', marginBottom: '4px', display: 'block' }}>ADD MEMBERS</label>
          <input 
            type="text" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search name or email..." 
          />
        </div>

        {selectedUsers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {selectedUsers.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '12px', fontSize: '12px' }}>
                {u.full_name.split(' ')[0]}
                <button onClick={() => toggleUser(u)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="msg-member-list" style={{ maxHeight: '200px' }}>
          {users.map((u) => {
            const isSelected = selectedUsers.some(su => su.id === u.id);
            return (
              <button key={u.id} className="msg-member" onClick={() => toggleUser(u)} style={{ opacity: isSelected ? 0.6 : 1 }}>
                <span className="msg-avatar dm">{(u.full_name || 'U').charAt(0).toUpperCase()}</span>
                <span className="msg-member-main">
                  <span className="msg-member-name">{u.full_name}</span>
                  <span className="msg-member-role">{u.email}</span>
                </span>
                {isSelected && <Check size={16} color="var(--primary)" />}
              </button>
            );
          })}
        </div>
        
        <div className="msg-modal-actions" style={{ marginTop: '16px' }}>
          <button className="msg-btn-cancel" onClick={onClose}>Cancel</button>
          <button 
            className="msg-btn-create" 
            onClick={() => onCreate(groupName, selectedUsers.map(u => u.id))}
            disabled={!groupName.trim() || selectedUsers.length === 0}
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
};

export default Messages;
