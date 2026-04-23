import { useState, useEffect } from "react";
import { useUser } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle, Clock, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import AssignToCoworker from "./AssignToCoworker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Task {
  id: string;
  title: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Assigned" | "In Progress" | "Completed" | "On Hold";
  due_date: string;
  remarks: string | null;
}

export default function MyAssignments() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchMyAssignments();
  }, [user]);

  const fetchMyAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user!.id)
        .order("due_date", { ascending: true });

      if (error) {
        console.warn("Error fetching assignments:", error);
      } else {
        setTasks((data || []) as Task[]);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "High":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "Medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "Low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "In Progress":
        return <Zap className="h-4 w-4 text-blue-500" />;
      case "On Hold":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">My Assignments</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <AssignToCoworker />
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2 flex-1">
                    {getStatusIcon(task.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs flex-shrink-0 ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </Badge>
                </div>
                <div className="flex gap-2 items-center">
                  <Select
                    value={task.status}
                    onValueChange={async (value) => {
                      const { error } = await supabase
                        .from("tasks")
                        .update({ status: value, last_activity: new Date().toISOString() })
                        .eq("id", task.id);
                      if (!error) {
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
      </CardContent>
    </Card>
  );
}
