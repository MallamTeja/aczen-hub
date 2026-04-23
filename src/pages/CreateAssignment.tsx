import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, ArrowLeft } from "lucide-react";

interface UserOption {
  clerk_user_id: string;
  name: string;
  email: string;
}

export default function CreateAssignment() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assigned_to: "",
    due_date: "",
    priority: "Medium" as "Low" | "Medium" | "High" | "Critical",
    status: "Assigned" as "Assigned" | "In Progress" | "On Hold",
    remarks: "",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const { data, error } = await (supabase as any)
        .from("user_profiles")
        .select("clerk_user_id, name, email")
        .order("name", { ascending: true });
      if (error) throw error;
      setUsers((data || []) as UserOption[]);
      if (!data || data.length === 0) {
        setError("No users found. Ask them to sign up first.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch users.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!formData.title.trim()) return setError("Task title is required");
    if (!formData.assigned_to) return setError("Please select a user");
    if (!formData.due_date) return setError("Due date is required");

    try {
      setSubmitting(true);
      const assignedBy = user?.id || profile?.clerk_user_id || "admin";

      const { error: insertError } = await supabase.from("tasks").insert({
        title: formData.title,
        description: formData.description || null,
        assigned_to: formData.assigned_to,
        assigned_by: assignedBy,
        due_date: formData.due_date,
        priority: formData.priority,
        status: formData.status,
        remarks: formData.remarks || null,
        last_activity: new Date().toISOString(),
      });

      if (insertError) {
        setError(`Failed to create task: ${insertError.message}`);
        return;
      }

      await (supabase as any).from("notifications").insert({
        clerk_user_id: formData.assigned_to,
        title: "New task assigned",
        message: `${profile?.name || "Admin"} assigned you "${formData.title}" — due ${formData.due_date}.`,
        type: "task",
        link: "/assignments",
      });

      setSuccess(true);
      setFormData({
        title: "",
        description: "",
        assigned_to: "",
        due_date: "",
        priority: "Medium",
        status: "Assigned",
        remarks: "",
      });

      setTimeout(() => navigate("/cofaczen"), 1500);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = (u: UserOption) =>
    u.name && u.name.trim() ? `${u.name} · ${u.email}` : u.email;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border sticky top-0 z-50 bg-card/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Create Task Assignment</h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/cofaczen")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Assign Task to Team Member</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-6 bg-green-50 border-green-200 text-green-900">
                <AlertDescription>Task created. Redirecting…</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="e.g., Complete lead follow-up"
                  value={formData.title}
                  onChange={handleInputChange}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Longer explanation of the task…"
                  value={formData.description}
                  onChange={handleInputChange}
                  disabled={submitting}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign To *</Label>
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading users…</div>
                ) : (
                  <Select
                    value={formData.assigned_to}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, assigned_to: value }))
                    }
                    disabled={submitting || users.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user…" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.clerk_user_id} value={u.clerk_user_id}>
                          {displayName(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  {users.length} user{users.length !== 1 ? "s" : ""} available
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        priority: value as "Low" | "Medium" | "High" | "Critical",
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Initial Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: value as "Assigned" | "In Progress" | "On Hold",
                    }))
                  }
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Assigned">Assigned</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks (Optional)</Label>
                <Textarea
                  id="remarks"
                  name="remarks"
                  placeholder="Add any additional notes or instructions…"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  disabled={submitting}
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={submitting || loading || users.length === 0}
                  className="flex-1"
                >
                  {submitting ? "Creating…" : "Create Task"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/cofaczen")}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
