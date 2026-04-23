import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/contexts/AuthContext";
import { ChevronLeft, MessageSquare, Search, Send, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { loadInAppUsers, type InAppUser } from "@/lib/inAppUsers";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChatMessage {
  id: string;
  sender_clerk_user_id: string;
  recipient_clerk_user_id: string;
  message: string;
  created_at: string;
}

export default function ChatPage() {
  const { user } = useUser();
  const isMobile = useIsMobile();
  const [users, setUsers] = useState<InAppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<InAppUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserIdentifiers = useMemo(() => {
    const primaryEmail = user?.emailAddresses?.[0]?.emailAddress;
    const allEmails = (user?.emailAddresses || []).map((e) => e.emailAddress);
    return new Set([user?.id, primaryEmail, ...allEmails].filter(Boolean));
  }, [user]);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      setError(null);

      const loadedUsers = await loadInAppUsers();
      setUsers(loadedUsers);
      if (loadedUsers.length === 0) {
        setError("Failed to load in-app users.");
      }

      setLoadingUsers(false);
    };

    fetchUsers();
  }, []);

  const currentSenderId = useMemo(() => {
    const profile = users.find(
      (u) => currentUserIdentifiers.has(u.clerk_user_id) || (u.email && currentUserIdentifiers.has(u.email)),
    );

    if (profile?.clerk_user_id) return profile.clerk_user_id;
    if (user?.id) return user.id;
    return user?.emailAddresses?.[0]?.emailAddress || "";
  }, [users, currentUserIdentifiers, user]);

  const chatUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          !currentUserIdentifiers.has(u.clerk_user_id) &&
          !currentUserIdentifiers.has(u.email || ""),
      ),
    [users, currentUserIdentifiers],
  );

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return chatUsers;
    return chatUsers.filter((u) => {
      return (
        u.name.toLowerCase().includes(needle) ||
        (u.email || "").toLowerCase().includes(needle) ||
        u.clerk_user_id.toLowerCase().includes(needle)
      );
    });
  }, [chatUsers, search]);

  const loadMessages = async (recipientId: string) => {
    if (!currentSenderId) return;

    setLoadingMessages(true);
    setError(null);

    const [sentResult, receivedResult] = await Promise.all([
      supabase
        .from("chat_messages")
        .select("id, sender_clerk_user_id, recipient_clerk_user_id, message, created_at")
        .eq("sender_clerk_user_id", currentSenderId)
        .eq("recipient_clerk_user_id", recipientId),
      supabase
        .from("chat_messages")
        .select("id, sender_clerk_user_id, recipient_clerk_user_id, message, created_at")
        .eq("sender_clerk_user_id", recipientId)
        .eq("recipient_clerk_user_id", currentSenderId),
    ]);

    if (sentResult.error || receivedResult.error) {
      setError("Failed to load chat messages.");
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    const merged = [...(sentResult.data || []), ...(receivedResult.data || [])] as ChatMessage[];
    merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setMessages(merged);
    setLoadingMessages(false);
  };

  const handleSend = async () => {
    if (!selectedUser || !currentSenderId) return;
    const message = text.trim();
    if (!message) return;

    setSending(true);
    setError(null);

    const { error } = await supabase.from("chat_messages").insert([
      {
        sender_clerk_user_id: currentSenderId,
        recipient_clerk_user_id: selectedUser.clerk_user_id,
        message,
      },
    ]);

    if (error) {
      setError("Failed to send message.");
      setSending(false);
      return;
    }

    setText("");
    await loadMessages(selectedUser.clerk_user_id);
    setSending(false);
  };

  const showUserList = !isMobile || !selectedUser;
  const showConversation = !isMobile || !!selectedUser;

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">Chat</h1>
              <p className="mt-1 text-sm text-muted-foreground">Message only users available in the app.</p>
            </div>
            <Badge variant="secondary" className="w-fit gap-1">
              <Users className="h-3 w-3" />
              {chatUsers.length} users
            </Badge>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          {showUserList && (
            <Card className="lg:col-span-1">
              <CardHeader>
                <div className="space-y-3">
                  <CardTitle>In-App Users</CardTitle>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search user"
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="max-h-[65vh] space-y-2 overflow-y-auto lg:max-h-[520px]">
                {loadingUsers && <p className="text-sm text-muted-foreground">Loading users...</p>}
                {!loadingUsers && filteredUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground">No users available to chat.</p>
                )}
                {filteredUsers.map((chatUser) => {
                  const selected = selectedUser?.id === chatUser.id;
                  return (
                    <button
                      key={chatUser.id}
                      onClick={() => {
                        setSelectedUser(chatUser);
                        loadMessages(chatUser.clerk_user_id);
                      }}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{chatUser.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{chatUser.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {chatUser.email || chatUser.clerk_user_id}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {showConversation && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  {isMobile && selectedUser && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedUser(null)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    {selectedUser ? `Chat with ${selectedUser.name}` : "Select a user to start chatting"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedUser && (
                  <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                    Pick a user from the left panel to open the conversation.
                  </div>
                )}

                {selectedUser && (
                  <div className="space-y-4">
                    <div className="max-h-[58vh] space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 lg:max-h-[420px]">
                      {loadingMessages && <p className="text-sm text-muted-foreground">Loading messages...</p>}
                      {!loadingMessages && messages.length === 0 && (
                        <p className="text-sm text-muted-foreground">No messages yet. Send the first message.</p>
                      )}
                      {!loadingMessages &&
                        messages.map((msg) => {
                          const isMine = msg.sender_clerk_user_id === currentSenderId;
                          return (
                            <div
                              key={msg.id}
                              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                                isMine
                                  ? "ml-auto bg-primary text-primary-foreground"
                                  : "bg-card text-foreground"
                              }`}
                            >
                              <p>{msg.message}</p>
                              <p className="mt-1 text-[11px] opacity-70">
                                {new Date(msg.created_at).toLocaleString()}
                              </p>
                            </div>
                          );
                        })}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a message"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                      <Button className="gap-2 px-3 sm:px-4" onClick={handleSend} disabled={sending || !text.trim()}>
                        <Send className="h-4 w-4" />
                        <span className="hidden sm:inline">Send</span>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
