import { useState, useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../supabase";
import { DS } from "../design/tokens";

export const NotificationBell = ({ userType = "team" }) => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const bellRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_type", userType)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        setNotifications(data || []);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_type=eq.${userType}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userType]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (notificationId) => {
    if (!isSupabaseConfigured()) return;
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!isSupabaseConfigured()) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .in("id", unreadIds);

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "stage_change": return "🔄";
      case "note_added": return "📝";
      case "action_required": return "⚡";
      case "metric_update": return "📈";
      default: return "🔔";
    }
  };

  return (
    <div ref={bellRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          padding: "8px", borderRadius: DS.radius.sm, position: "relative",
          color: DS.colors.textMuted, fontSize: "18px",
          transition: "background 0.2s",
        }}
        onMouseOver={(e) => e.currentTarget.style.background = DS.colors.bgHover}
        onMouseOut={(e) => e.currentTarget.style.background = "none"}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: "4px", right: "4px",
            width: "16px", height: "16px", borderRadius: "50%",
            background: DS.colors.shock, color: "#fff",
            fontSize: "10px", fontWeight: 600, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "8px",
          width: "340px", maxHeight: "400px", overflowY: "auto",
          background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
          borderRadius: DS.radius.md, boxShadow: DS.shadow.deep,
          zIndex: 200, animation: "fadeUp 0.2s ease",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: `1px solid ${DS.colors.border}`,
          }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: DS.colors.shock, fontSize: "12px", fontFamily: DS.fonts.body,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: "24px", textAlign: "center", color: DS.colors.textMuted }}>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: DS.colors.textMuted }}>
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                style={{
                  padding: "12px 16px", borderBottom: `1px solid ${DS.colors.border}`,
                  cursor: "pointer", background: notification.read ? "transparent" : `${DS.colors.shock}08`,
                  transition: "background 0.2s",
                }}
                onMouseOver={(e) => e.currentTarget.style.background = DS.colors.bgHover}
                onMouseOut={(e) => e.currentTarget.style.background = notification.read ? "transparent" : `${DS.colors.shock}08`}
              >
                <div style={{ display: "flex", gap: "10px" }}>
                  <span style={{ fontSize: "16px" }}>{getTypeIcon(notification.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px",
                    }}>
                      <span style={{
                        fontWeight: notification.read ? 400 : 600, fontSize: "13px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {notification.title}
                      </span>
                      {!notification.read && (
                        <span style={{
                          width: "6px", height: "6px", borderRadius: "50%",
                          background: DS.colors.shock, flexShrink: 0,
                        }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: "12px", color: DS.colors.textMuted,
                      overflow: "hidden", textOverflow: "ellipsis",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {notification.message}
                    </div>
                    <div style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "4px" }}>
                      {formatTime(notification.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
