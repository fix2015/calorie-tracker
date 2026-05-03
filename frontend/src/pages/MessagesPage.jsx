import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { messagesApi } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { photoSrc } from '../services/photoUrl';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    messagesApi.list().then((data) => {
      setConversations(data.conversations);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner"></div>;

  return (
    <>
      {conversations.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--space-xl) 0' }}>
          No conversations yet
        </p>
      ) : (
        <div className="inbox-list">
          {conversations.map((c) => (
            <Link key={c.id} to={`/messages/${c.id}`} className={`inbox-item${c.unreadCount > 0 ? ' inbox-unread' : ''}`}>
              {c.otherUser?.avatarUrl ? (
                <img src={photoSrc(c.otherUser.avatarUrl)} alt="" className="inbox-avatar" />
              ) : (
                <div className="inbox-avatar-placeholder">
                  {c.otherUser?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <div className="inbox-info">
                <span className="inbox-name">{c.otherUser?.name}</span>
                <span className="inbox-preview">
                  {c.lastMessage?.text?.slice(0, 60) || 'No messages yet'}
                  {c.lastMessage?.text?.length > 60 ? '...' : ''}
                </span>
              </div>
              <div className="inbox-meta">
                <span className="inbox-time">{c.lastMessage ? timeAgo(c.lastMessage.createdAt) : ''}</span>
                {c.unreadCount > 0 && <span className="unread-badge">{c.unreadCount}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function ChatView({ conversationId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    // Get messages and conversation info
    messagesApi.getMessages(conversationId).then((data) => {
      setMessages(data.messages.reverse());
      setLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }).catch(() => {
      setLoading(false);
      navigate('/messages');
    });

    // Get other user info from conversation list
    messagesApi.list().then((data) => {
      const conv = data.conversations.find(c => c.id === conversationId);
      if (conv) setOtherUser(conv.otherUser);
    }).catch(() => {});

    // Mark as read
    messagesApi.markRead(conversationId).catch(() => {});
  }, [conversationId, navigate]);

  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await messagesApi.send(conversationId, text.trim());
      setMessages((prev) => [...prev, msg]);
      setText('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch { /* ignore */ }
    setSending(false);
  }, [conversationId, text, sending]);

  return (
    <>
      <div className="chat-header">
        <button className="btn btn-secondary" style={{ padding: 'var(--space-xs) var(--space-sm)' }} onClick={() => navigate('/messages')}>
          &larr;
        </button>
        {otherUser && (
          <Link to={`/u/${otherUser.username}`} className="chat-header-user">
            {otherUser.avatarUrl ? (
              <img src={photoSrc(otherUser.avatarUrl)} alt="" className="chat-header-avatar" />
            ) : (
              <div className="chat-header-avatar-placeholder">
                {otherUser.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <span className="chat-header-name">{otherUser.name}</span>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : (
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-bubble${msg.sender.id === user?.id ? ' chat-bubble-mine' : ''}`}>
              <p>{msg.text}</p>
              <span className="chat-bubble-time">{timeAgo(msg.createdAt)}</span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <form onSubmit={handleSend} className="chat-input-bar">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          maxLength={2000}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()}>
          Send
        </button>
      </form>
    </>
  );
}

export default function MessagesPage() {
  const { conversationId } = useParams();

  return (
    <div className="page messages-page">
      {conversationId ? (
        <ChatView conversationId={conversationId} />
      ) : (
        <Inbox />
      )}
    </div>
  );
}
