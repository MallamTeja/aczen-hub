import { useState, useEffect, useMemo } from "react";
import { useUser } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CalendarClock, CheckCircle2, Clock3, ListTodo, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Task {
  id: string;
  title: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Assigned" | "In Progress" | "Completed" | "On Hold";
  due_date: string;
  remarks: string | null;
  assigned_to: string;
  assigned_by: string;
}

export default function TasksCalendar() {
  const { user } = useUser();
  const [date, setDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDateTasks, setSelectedDateTasks] = useState<Task[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    assigned_to: "",
    due_date: "",
    priority: "Medium" as "Low" | "Medium" | "High" | "Critical",
    remarks: "",
  });

  const [coworkers, setCoworkers] = useState<Array<{ id: string; clerk_user_id: string; name?: string }>>([]);

  const userIdentifiers = useMemo(() => {
    if (!user) return [];
    const allEmails = (user.emailAddresses || []).map((e) => e.emailAddress).filter(Boolean);
    return Array.from(new Set([user.id, ...allEmails]));
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchCoworkers();
    }
  }, [user]);

  useEffect(() => {
    updateSelectedDateTasks();
  }, [date, tasks]);

  useEffect(() => {
    if (showAddDialog) {
      const dateStr = date.toISOString().split("T")[0];
      setFormData((prev) => ({
        ...prev,
        due_date: dateStr,
      }));
    }
  }, [showAddDialog, date]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      if (userIdentifiers.length === 0) {
        setTasks([]);
        return;
      }

      const [assignedToRes, assignedByRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .in("assigned_to", userIdentifiers),
        supabase
          .from("tasks")
          .select("*")
          .in("assigned_by", userIdentifiers),
      ]);

      if (assignedToRes.error) console.warn("Error fetching assigned tasks:", assignedToRes.error);
      if (assignedByRes.error) console.warn("Error fetching created tasks:", assignedByRes.error);

      const merged = new Map<string, Task>();
      (assignedToRes.data || []).forEach((task: any) => merged.set(task.id, task as Task));
      (assignedByRes.data || []).forEach((task: any) => merged.set(task.id, task as Task));
      const finalTasks = Array.from(merged.values()).sort(
        (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
      );

      setTasks(finalTasks);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCoworkers = async () => {
    try {
      const { data: profiles } = await (supabase as any)
        .from("user_profiles")
        .select("id, clerk_user_id, name, email");

      const coworkerOptions = (profiles || [])
        .filter((p: any) => !userIdentifiers.includes(p.clerk_user_id))
        .map((p: any) => ({
          id: p.id,
          clerk_user_id: p.clerk_user_id,
          name: p.name || p.clerk_user_id,
        }));

      setCoworkers(coworkerOptions);
    } catch (err) {
      console.error("Error fetching coworkers:", err);
    }
  };

  const updateSelectedDateTasks = () => {
    const dateStr = date.toISOString().split("T")[0];
    const tasksForDate = tasks.filter((task) => task.due_date === dateStr);
    setSelectedDateTasks(tasksForDate);
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!formData.title.trim()) {
      setError("Task title is required");
      return;
    }

    if (!formData.assigned_to) {
      setError("Please select who to assign the task to");
      return;
    }

    try {
      setSubmitting(true);

      const { error: insertError } = await supabase.from("tasks").insert({
        title: formData.title,
        assigned_to: formData.assigned_to,
        assigned_by: user!.id,
        due_date: formData.due_date,
        priority: formData.priority,
        status: "Assigned",
        remarks: formData.remarks || null,
        last_activity: new Date().toISOString(),
      });

      if (insertError) {
        setError(`Failed to create task: ${insertError.message}`);
        return;
      }

      setSuccess(true);
      setFormData({
        title: "",
        assigned_to: "",
        due_date: formData.due_date,
        priority: "Medium",
        remarks: "",
      });

      await fetchTasks();

      setTimeout(() => {
        setShowAddDialog(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      console.error("Error creating task:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getTasksForDate = (checkDate: Date): number => {
    const dateStr = checkDate.toISOString().split("T")[0];
    return tasks.filter((task) => task.due_date === dateStr).length;
  };

  const isTaskAssignedToMe = (task: Task) => userIdentifiers.includes(task.assigned_to);
  const isTaskAssignedByMe = (task: Task) => userIdentifiers.includes(task.assigned_by);

  const todayString = new Date().toISOString().split("T")[0];
  const stats = useMemo(() => {
    const mine = tasks.filter((t) => isTaskAssignedToMe(t));
    const today = mine.filter((t) => t.due_date === todayString).length;
    const overdue = mine.filter((t) => t.due_date < todayString && t.status !== "Completed").length;
    const completed = mine.filter((t) => t.status === "Completed").length;
    return {
      totalMine: mine.length,
      today,
      overdue,
      completed,
    };
  }, [tasks, todayString, userIdentifiers]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      const existing = map.get(task.due_date) || [];
      existing.push(task);
      map.set(task.due_date, existing);
    });
    return map;
  }, [tasks]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Critical":
        return "bg-red-100 text-red-800";
      case "High":
        return "bg-orange-100 text-orange-800";
      case "Medium":
        return "bg-yellow-100 text-yellow-800";
      case "Low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800";
      case "In Progress":
        return "bg-blue-100 text-blue-800";
      case "On Hold":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">My Tasks</p>
              <ListTodo className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{stats.totalMine}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Due Today</p>
              <CalendarClock className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{stats.today}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Overdue</p>
              <Clock3 className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold">{stats.overdue}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Completed</p>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold">{stats.completed}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Tasks Calendar</CardTitle>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Has tasks
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Overdue date
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="flex flex-col items-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(newDate) => newDate && setDate(newDate)}
                className="rounded-md border bg-card p-3"
                modifiers={{
                  hasTasks: (day) => getTasksForDate(day) > 0,
                  hasOverdueTasks: (day) => {
                    const dayStr = day.toISOString().split("T")[0];
                    const dayTasks = tasksByDate.get(dayStr) || [];
                    return dayTasks.some((task) => task.status !== "Completed" && dayStr < todayString);
                  },
                }}
                modifiersClassNames={{
                  hasTasks: "border border-primary/40",
                  hasOverdueTasks: "border border-red-500/60",
                }}
              />
              <p className="text-sm text-muted-foreground mt-4 text-center">
                {date.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Tasks for Selected Date</h3>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Task
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <p>Loading calendar tasks...</p>
                </div>
              ) : selectedDateTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <p>No tasks scheduled for this date</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto">
                  {selectedDateTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 border border-border rounded-lg bg-card hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-foreground">
                            {task.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isTaskAssignedToMe(task) ? "Assigned to me" : ""}
                            {isTaskAssignedToMe(task) && isTaskAssignedByMe(task) ? " • " : ""}
                            {isTaskAssignedByMe(task) ? "Assigned by me" : ""}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs flex-shrink-0 ${getPriorityColor(task.priority)}`}
                        >
                          {task.priority}
                        </Badge>
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <Select
                          value={task.status}
                          onValueChange={async (value) => {
                            const { error: updateError } = await supabase
                              .from("tasks")
                              .update({ status: value, last_activity: new Date().toISOString() })
                              .eq("id", task.id);
                            if (!updateError) {
                              setTasks((prev) =>
                                prev.map((t) =>
                                  t.id === task.id ? { ...t, status: value as Task["status"] } : t
                                )
                              );
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Assigned">Assigned</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="On Hold">On Hold</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {task.remarks && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {task.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>
              Create a task for {date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200 text-green-900">
              <AlertDescription>Task created successfully!</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g., Review client proposal"
                value={formData.title}
                onChange={handleInputChange}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assign To *</Label>
              <Select
                value={formData.assigned_to}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    assigned_to: value,
                  }))
                }
                disabled={submitting || coworkers.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a person..." />
                </SelectTrigger>
                <SelectContent>
                  {coworkers.map((coworker) => (
                    <SelectItem
                      key={coworker.id}
                      value={coworker.clerk_user_id}
                    >
                      {coworker.name || coworker.clerk_user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="space-y-2">
              <Label htmlFor="remarks">Notes (Optional)</Label>
              <Textarea
                id="remarks"
                name="remarks"
                placeholder="Add any notes or instructions..."
                value={formData.remarks}
                onChange={handleInputChange}
                disabled={submitting}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? "Creating..." : "Create Task"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
