import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/contexts/AuthContext";
import { ChevronLeft, Mail, MapPin, Reply, Send, Tag, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { loadInAppUsers, type InAppUser } from "@/lib/inAppUsers";
import { useIsMobile } from "@/hooks/use-mobile";

type MailTab = "inbox" | "sent" | "compose";

interface EmailMessage {
  id: string;
  thread_id: string;
  sender_clerk_user_id: string;
  to_recipients: string[];
  cc_recipients: string[];
  tagged_user_ids: string[];
  subject: string;
  body: string;
  location_label: string | null;
  location_url: string | null;
  reply_to_id: string | null;
  created_at: string;
}

interface ComposeState {
  to: string[];
  cc: string[];
  tagged: string[];
  subject: string;
  body: string;
  location_label: string;
  location_url: string;
}

const initialCompose: ComposeState = {
  to: [],
  cc: [],
  tagged: [],
  subject: "",
  body: "",
  location_label: "",
  location_url: "",
};

export default function EmailPage() {
  const { user } = useUser();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<MailTab>("inbox");
  const [users, setUsers] = useState<InAppUser[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeState>(initialCompose);
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipientSearch, setRecipientSearch] = useState("");

  const currentUserIdentifiers = useMemo(() => {
    const primaryEmail = user?.emailAddresses?.[0]?.emailAddress;
    const allEmails = (user?.emailAddresses || []).map((e) => e.emailAddress);
    return new Set([user?.id, primaryEmail, ...allEmails].filter(Boolean));
  }, [user]);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      const data = await loadInAppUsers();
      setUsers(data);
      setLoadingUsers(false);
      if (data.length === 0) setError("No in-app users found yet.");
    };
    fetchUsers();
  }, []);

  const currentUserId = useMemo(() => {
    const profile = users.find(
      (u) => currentUserIdentifiers.has(u.clerk_user_id) || (u.email && currentUserIdentifiers.has(u.email)),
    );
    if (profile?.clerk_user_id) return profile.clerk_user_id;
    if (user?.id) return user.id;
    return user?.emailAddresses?.[0]?.emailAddress || "";
  }, [users, currentUserIdentifiers, user]);

  const recipients = useMemo(
    () =>
      users.filter(
        (u) =>
          !currentUserIdentifiers.has(u.clerk_user_id) &&
          !currentUserIdentifiers.has(u.email || ""),
      ),
    [users, currentUserIdentifiers],
  );

  const recipientMap = useMemo(() => new Map(users.map((u) => [u.clerk_user_id, u])), [users]);

  useEffect(() => {
    const fetchEmails = async () => {
      if (!currentUserId) return;
      setLoadingEmails(true);
      setError(null);

      const [sentResult, inboxResult, ccResult, taggedResult] = await Promise.all([
        supabase
          .from("user_emails")
          .select("*")
          .eq("sender_clerk_user_id", currentUserId),
        supabase
          .from("user_emails")
          .select("*")
          .contains("to_recipients", [currentUserId]),
        supabase
          .from("user_emails")
          .select("*")
          .contains("cc_recipients", [currentUserId]),
        supabase
          .from("user_emails")
          .select("*")
          .contains("tagged_user_ids", [currentUserId]),
      ]);

      const anyError = sentResult.error || inboxResult.error || ccResult.error || taggedResult.error;
      if (anyError) {
        setError("Email storage is not ready. Run latest Supabase migration for user_emails.");
        setEmails([]);
        setLoadingEmails(false);
        return;
      }

      const merged = new Map<string, EmailMessage>();
      [...(sentResult.data || []), ...(inboxResult.data || []), ...(ccResult.data || []), ...(taggedResult.data || [])]
        .forEach((mail: any) => merged.set(mail.id, mail as EmailMessage));
      const all = Array.from(merged.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setEmails(all);
      setSelectedThreadId((prev) => prev || all[0]?.thread_id || null);
      setLoadingEmails(false);
    };

    fetchEmails();
  }, [currentUserId]);

  const threadSummaries = useMemo(() => {
    const map = new Map<string, EmailMessage>();
    emails.forEach((mail) => {
      const current = map.get(mail.thread_id);
      if (!current || new Date(mail.created_at).getTime() > new Date(current.created_at).getTime()) {
        map.set(mail.thread_id, mail);
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [emails]);

  const visibleThreads = useMemo(() => {
    if (tab === "sent") return threadSummaries.filter((t) => t.sender_clerk_user_id === currentUserId);
    if (tab === "inbox") {
      return threadSummaries.filter((t) => {
        return (
          t.sender_clerk_user_id !== currentUserId &&
          (t.to_recipients.includes(currentUserId) ||
            t.cc_recipients.includes(currentUserId) ||
            t.tagged_user_ids.includes(currentUserId))
        );
      });
    }
    return threadSummaries;
  }, [threadSummaries, tab, currentUserId]);

  const activeThreadMails = useMemo(() => {
    if (!selectedThreadId) return [];
    return emails
      .filter((mail) => mail.thread_id === selectedThreadId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [emails, selectedThreadId]);

  const filteredRecipients = useMemo(() => {
    const needle = recipientSearch.trim().toLowerCase();
    if (!needle) return recipients;
    return recipients.filter((u) => {
      return (
        u.name.toLowerCase().includes(needle) ||
        (u.email || "").toLowerCase().includes(needle) ||
        u.clerk_user_id.toLowerCase().includes(needle)
      );
    });
  }, [recipients, recipientSearch]);

  const toggleRecipient = (field: "to" | "cc" | "tagged", id: string) => {
    setCompose((prev) => {
      const exists = prev[field].includes(id);
      return {
        ...prev,
        [field]: exists ? prev[field].filter((x) => x !== id) : [...prev[field], id],
      };
    });
  };

  const attachLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const label = `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`;
        const url = `https://maps.google.com/?q=${latitude},${longitude}`;
        setCompose((prev) => ({ ...prev, location_label: label, location_url: url }));
      },
      () => {
        setError("Location permission denied.");
      },
    );
  };

  const startReply = () => {
    const last = activeThreadMails[activeThreadMails.length - 1];
    if (!last) return;
    const replyTo = new Set<string>([last.sender_clerk_user_id, ...last.to_recipients, ...last.cc_recipients]);
    replyTo.delete(currentUserId);
    setCompose({
      to: Array.from(replyTo),
      cc: [],
      tagged: [],
      subject: last.subject.startsWith("Re:") ? last.subject : `Re: ${last.subject}`,
      body: "",
      location_label: "",
      location_url: "",
    });
    setReplyThreadId(last.thread_id);
    setReplyToId(last.id);
    setTab("compose");
  };

  const sendEmail = async () => {
    if (!currentUserId) return;
    if (compose.to.length === 0 && compose.cc.length === 0) {
      setError("Add at least one user to To or CC.");
      return;
    }
    if (!compose.subject.trim() || !compose.body.trim()) {
      setError("Subject and body are required.");
      return;
    }

    setSending(true);
    setError(null);

    const payload = {
      thread_id: replyThreadId || crypto.randomUUID(),
      sender_clerk_user_id: currentUserId,
      to_recipients: compose.to,
      cc_recipients: compose.cc,
      tagged_user_ids: compose.tagged,
      subject: compose.subject.trim(),
      body: compose.body.trim(),
      location_label: compose.location_label || null,
      location_url: compose.location_url || null,
      reply_to_id: replyToId,
    };

    const { error: insertError } = await supabase.from("user_emails").insert([payload]);
    if (insertError) {
      setError("Could not send email. Make sure migration for user_emails is applied.");
      setSending(false);
      return;
    }

    setCompose(initialCompose);
    setReplyThreadId(null);
    setReplyToId(null);
    setTab("sent");
    setSending(false);

    const { data } = await supabase.from("user_emails").select("*").eq("sender_clerk_user_id", currentUserId);
    if (data) {
      const merged = new Map<string, EmailMessage>();
      [...emails, ...(data as EmailMessage[])].forEach((m) => merged.set(m.id, m));
      setEmails(Array.from(merged.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    }
  };

  const renderUserName = (id: string) => recipientMap.get(id)?.name || id;
  const showThreadList = !isMobile || !selectedThreadId;
  const showConversation = !isMobile || !!selectedThreadId;

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">Email Center</h1>
              <p className="mt-1 text-sm text-muted-foreground">Send, receive, reply, tag users, and attach location.</p>
            </div>
            <Badge variant="secondary" className="w-fit gap-1">
              <Users className="h-3 w-3" />
              {recipients.length} in-app users
            </Badge>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          <Button variant={tab === "inbox" ? "default" : "outline"} onClick={() => setTab("inbox")} className="w-full sm:w-auto">Inbox</Button>
          <Button variant={tab === "sent" ? "default" : "outline"} onClick={() => setTab("sent")} className="w-full sm:w-auto">Sent</Button>
          <Button
            variant={tab === "compose" ? "default" : "outline"}
            onClick={() => {
              setReplyThreadId(null);
              setReplyToId(null);
              setCompose(initialCompose);
              setTab("compose");
            }}
            className="w-full sm:w-auto"
          >
            Compose
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {tab !== "compose" && (
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            {showThreadList && (
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle>{tab === "inbox" ? "Inbox Threads" : "Sent Threads"}</CardTitle></CardHeader>
                <CardContent className="max-h-[65vh] space-y-2 overflow-y-auto lg:max-h-[520px]">
                  {(loadingUsers || loadingEmails) && <p className="text-sm text-muted-foreground">Loading...</p>}
                  {!loadingEmails && visibleThreads.length === 0 && <p className="text-sm text-muted-foreground">No threads yet.</p>}
                  {visibleThreads.map((thread) => (
                    <button
                      key={thread.thread_id}
                      onClick={() => setSelectedThreadId(thread.thread_id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedThreadId === thread.thread_id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <p className="truncate font-medium">{thread.subject}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {renderUserName(thread.sender_clerk_user_id)} - {new Date(thread.created_at).toLocaleString()}
                      </p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {showConversation && (
              <Card className="lg:col-span-2">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isMobile && selectedThreadId && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedThreadId(null)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      )}
                      <CardTitle>Conversation</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2" onClick={startReply} disabled={!selectedThreadId}>
                      <Reply className="h-4 w-4" />
                      Reply
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!selectedThreadId && <p className="text-sm text-muted-foreground">Select a thread.</p>}
                  {activeThreadMails.map((mail) => (
                    <div key={mail.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{mail.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            From: {renderUserName(mail.sender_clerk_user_id)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            To: {mail.to_recipients.map(renderUserName).join(", ")}
                          </p>
                          {mail.cc_recipients.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              CC: {mail.cc_recipients.map(renderUserName).join(", ")}
                            </p>
                          )}
                          {mail.tagged_user_ids.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Tags: {mail.tagged_user_ids.map(renderUserName).join(", ")}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(mail.created_at).toLocaleString()}</p>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{mail.body}</p>
                      {mail.location_url && (
                        <a className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline" href={mail.location_url} target="_blank" rel="noreferrer">
                          <MapPin className="h-3 w-3" />
                          {mail.location_label || "Attached location"}
                        </a>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === "compose" && (
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle>Select Users</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder="Search users"
                />
                <div className="max-h-[440px] space-y-2 overflow-y-auto">
                  {filteredRecipients.map((recipient) => (
                    <div key={recipient.id} className="rounded-lg border border-border p-2">
                      <div className="mb-2 flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback>{recipient.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{recipient.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{recipient.email || recipient.clerk_user_id}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant={compose.to.includes(recipient.clerk_user_id) ? "default" : "outline"} onClick={() => toggleRecipient("to", recipient.clerk_user_id)}>To</Button>
                        <Button size="sm" variant={compose.cc.includes(recipient.clerk_user_id) ? "default" : "outline"} onClick={() => toggleRecipient("cc", recipient.clerk_user_id)}>CC</Button>
                        <Button size="sm" variant={compose.tagged.includes(recipient.clerk_user_id) ? "default" : "outline"} className="gap-1" onClick={() => toggleRecipient("tagged", recipient.clerk_user_id)}>
                          <Tag className="h-3 w-3" />
                          Tag
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>{replyThreadId ? "Reply" : "Compose Email"}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={compose.subject}
                  onChange={(e) => setCompose((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="Subject"
                />
                <Textarea
                  value={compose.body}
                  onChange={(e) => setCompose((prev) => ({ ...prev, body: e.target.value }))}
                  placeholder="Write your email..."
                  className="min-h-40"
                />
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">To: {compose.to.length}</Badge>
                  <Badge variant="outline">CC: {compose.cc.length}</Badge>
                  <Badge variant="outline">Tags: {compose.tagged.length}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="gap-2" onClick={attachLocation}>
                    <MapPin className="h-4 w-4" />
                    Attach Location
                  </Button>
                  {compose.location_url && (
                    <a href={compose.location_url} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm text-primary hover:underline">
                      {compose.location_label || "Location attached"}
                    </a>
                  )}
                </div>
                <Button onClick={sendEmail} disabled={sending} className="w-full gap-2 sm:w-auto">
                  <Send className="h-4 w-4" />
                  {sending ? "Sending..." : "Send Email"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
