import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Search, Users, RotateCw, Plus, Mail, ClipboardList, Clock, Target, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import UserOverviewCards from "@/components/admin/UserOverviewCards";
import TasksTable from "@/components/admin/TasksTable";
import TaskFilters from "@/components/admin/TaskFilters";
import ManageUsersDialog from "@/components/admin/ManageUsersDialog";
import PunchesTable from "@/components/admin/PunchesTable";
import WeeklySummary from "@/components/admin/WeeklySummary";
import ActivityFeed from "@/components/admin/ActivityFeed";
import AdminCRMView from "@/components/admin/AdminCRMView";
import AdminSocialView from "@/components/admin/AdminSocialView";

interface Task {
  id: string;
  title: string;
  assigned_to: string;
  assigned_by: string;
  due_date: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Assigned" | "In Progress" | "Completed" | "On Hold";
  remarks: string | null;
  last_activity: string;
  created_at: string;
  updated_at: string;
}

interface UserStats {
  id: string;
  email: string;
  name: string;
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_tasks: number;
}

interface Punch {
  id: string;
  clerk_user_id: string;
  timestamp: string;
  status: "IN" | "OUT";
  created_at: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [workUpdates, setWorkUpdates] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [selectedUserDetail, setSelectedUserDetail] = useState<string | null>(null);
  const [manageUsersOpen, setManageUsersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"users" | "punches" | "crm" | "social">("users");

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (tasksError) {
        console.warn("Tasks fetch warning:", tasksError.message);
      } else {
        console.log("Tasks fetched:", tasksData?.length || 0);
      }

      setTasks((tasksData || []) as Task[]);

      // Fetch all punches
      const { data: punchesData, error: punchError } = await supabase
        .from("punches")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(500);

      if (punchError) {
        console.warn("Punches fetch warning:", punchError.message);
      } else {
        console.log("Punches fetched:", punchesData?.length || 0);
      }

      setPunches((punchesData || []) as Punch[]);

      // Fetch all work updates for activity feed
      const { data: workUpdatesData, error: workUpdatesError } = await supabase
        .from("work_updates")
        .select("*")
        .order("update_date", { ascending: false })
        .limit(100);

      if (workUpdatesError) {
        console.warn("Work updates fetch warning:", workUpdatesError.message);
      } else {
        console.log("Work updates fetched:", workUpdatesData?.length || 0);
      }

      setWorkUpdates(workUpdatesData || []);

      // Fetch user profiles for display name mapping
      const { data: userProfilesData, error: profileError } = await (supabase as any)
        .from("user_profiles")
        .select("*");

      if (profileError) {
        console.warn("User profiles fetch warning:", profileError.message);
      } else {
        console.log("User profiles fetched:", userProfilesData?.length || 0);
      }

      const userProfileMap = new Map(
        (userProfilesData || []).map((up: any) => [up.clerk_user_id, up])
      );

      // Get all actual users from Clerk activity
      const { data: workUpdates, error: workError } = await supabase
        .from("work_updates")
        .select("clerk_user_id")
        .limit(100);

      const { data: punchClerkUserIds, error: punchClerkError } = await supabase
        .from("punches")
        .select("clerk_user_id")
        .limit(100);

      const { data: leadUploads, error: leadError } = await supabase
        .from("lead_uploads")
        .select("clerk_user_id")
        .limit(100);

      if (workError) console.log("Work updates error:", workError.message);
      if (punchClerkError) console.log("Punches error:", punchClerkError.message);
      if (leadError) console.log("Lead uploads error:", leadError.message);

      const allClerkUserIds = new Set([
        ...(workUpdates || []).map((u) => u.clerk_user_id),
        ...(punchClerkUserIds || []).map((u) => u.clerk_user_id),
        ...(leadUploads || []).map((u) => u.clerk_user_id),
      ]);

      console.log("Total unique Clerk users found:", allClerkUserIds.size);

      // Calculate user statistics
      const userMap = new Map<string, UserStats>();
      ((tasksData || []) as Task[]).forEach((task: Task) => {
        if (!userMap.has(task.assigned_to)) {
          const profile = userProfileMap.get(task.assigned_to) as any;
          userMap.set(task.assigned_to, {
            id: task.assigned_to,
            email: profile?.email || task.assigned_to,
            name: profile?.name || task.assigned_to.split("@")[0],
            total_tasks: 0,
            pending_tasks: 0,
            in_progress_tasks: 0,
            completed_tasks: 0,
          });
        }

        const user = userMap.get(task.assigned_to)!;
        user.total_tasks++;

        if (task.status === "Assigned") user.pending_tasks++;
        if (task.status === "In Progress") user.in_progress_tasks++;
        if (task.status === "Completed") user.completed_tasks++;
      });

      // Add users with activity but no tasks
      allClerkUserIds.forEach((userId) => {
        if (!userMap.has(userId)) {
          const profile = userProfileMap.get(userId) as any;
          userMap.set(userId, {
            id: userId,
            email: profile?.email || userId,
            name: profile?.name || userId.split("@")[0],
            total_tasks: 0,
            pending_tasks: 0,
            in_progress_tasks: 0,
            completed_tasks: 0,
          });
        }
      });

      const finalUserStats = Array.from(userMap.values());
      console.log("Final user stats:", finalUserStats.length, finalUserStats);

      setUserStats(finalUserStats);
      applyFilters((tasksData || []) as Task[], "", "", "", "");
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (
    taskList: Task[],
    search: string,
    user: string,
    status: string,
    priority: string
  ) => {
    let filtered = taskList;

    if (search) {
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(search.toLowerCase()) ||
          task.assigned_to.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (user) {
      filtered = filtered.filter((task) => task.assigned_to === user);
    }

    if (status) {
      filtered = filtered.filter((task) => task.status === status);
    }

    if (priority) {
      filtered = filtered.filter((task) => task.priority === priority);
    }

    setFilteredTasks(filtered);
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    applyFilters(tasks, value, selectedUser, selectedStatus, selectedPriority);
  };

  const handleUserFilter = (value: string) => {
    setSelectedUser(value);
    applyFilters(tasks, searchTerm, value, selectedStatus, selectedPriority);
  };

  const handleStatusFilter = (value: string) => {
    setSelectedStatus(value);
    applyFilters(tasks, searchTerm, selectedUser, value, selectedPriority);
  };

  const handlePriorityFilter = (value: string) => {
    setSelectedPriority(value);
    applyFilters(tasks, searchTerm, selectedUser, selectedStatus, value);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminSession");
    navigate("/admin-login");
  };

  const handleUserClick = (userId: string) => {
    setSelectedUserDetail(selectedUserDetail === userId ? null : userId);
  };

  const userTasksDetail = selectedUserDetail
    ? filteredTasks.filter((task) => task.assigned_to === selectedUserDetail)
    : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage all user tasks and assignments</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/cofaczen/create-assignment")}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Assignment
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDashboardData()}
              className="gap-2"
              disabled={loading}
            >
              <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManageUsersOpen(true)}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Manage Users
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Weekly Summary and Activity Feed - Top Row */}
        {!selectedUserDetail && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <WeeklySummary
                punches={punches}
                workUpdates={workUpdates}
                userNames={userStats.reduce(
                  (acc, u) => ({ ...acc, [u.id]: u.name }),
                  {}
                )}
                loading={loading}
              />
            </div>
            <div>
              <ActivityFeed
                punches={punches}
                workUpdates={workUpdates}
                userNames={userStats.reduce(
                  (acc, u) => ({ ...acc, [u.id]: u.name }),
                  {}
                )}
                loading={loading}
              />
            </div>
          </div>
        )}

        {/* View Mode Toggle */}
        {!selectedUserDetail && (
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant={viewMode === "users" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("users")}
              className="gap-2"
            >
              <ClipboardList className="h-4 w-4" />
              Users & Tasks
            </Button>
            <Button
              variant={viewMode === "punches" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("punches")}
              className="gap-2"
            >
              <Clock className="h-4 w-4" />
              Punch Records
            </Button>
            <Button
              variant={viewMode === "crm" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("crm")}
              className="gap-2"
            >
              <Target className="h-4 w-4" />
              CRM
            </Button>
            <Button
              variant={viewMode === "social" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("social")}
              className="gap-2"
            >
              <Share2 className="h-4 w-4" />
              Social Media
            </Button>
          </div>
        )}

        {/* Users & Tasks View */}
        {viewMode === "users" && !selectedUserDetail && (
          <>
            <UserOverviewCards
              userStats={userStats}
              onUserClick={handleUserClick}
              loading={loading}
            />
            {!loading && userStats.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-8">
                <h3 className="font-semibold text-foreground mb-2">No users yet</h3>
                <p className="text-muted-foreground mb-4">
                  Users will appear here once they:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Log in with Clerk authentication</li>
                  <li>Complete a punch (Clock In/Out)</li>
                  <li>Add a work update</li>
                  <li>Upload leads</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-4">
                  You can also use "Manage Users" to manually add users and set their display names.
                </p>
              </div>
            )}
          </>
        )}

        {/* Punch Records View */}
        {viewMode === "punches" && !selectedUserDetail && (
          <PunchesTable
            punches={punches}
            loading={loading}
            userNames={userStats.reduce(
              (acc, u) => ({ ...acc, [u.id]: u.name }),
              {}
            )}
          />
        )}

        {/* CRM View */}
        {viewMode === "crm" && !selectedUserDetail && (
          <AdminCRMView
            userNames={userStats.reduce(
              (acc, u) => ({ ...acc, [u.id]: u.name }),
              {}
            )}
          />
        )}

        {/* Social View */}
        {viewMode === "social" && !selectedUserDetail && (
          <AdminSocialView
            userNames={userStats.reduce(
              (acc, u) => ({ ...acc, [u.id]: u.name }),
              {}
            )}
          />
        )}

        {/* User Detail View */}
        {selectedUserDetail && (
          <div className="mb-6 p-4 bg-muted rounded-lg border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  Tasks for {userStats.find(u => u.id === selectedUserDetail)?.name || selectedUserDetail}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    const user = userStats.find(u => u.id === selectedUserDetail);
                    if (user) window.location.href = `mailto:${user.email}`;
                  }}
                >
                  <Mail className="h-4 w-4" />
                  Email User
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedUserDetail(null)}>
                Back to Overview
              </Button>
            </div>
            {userTasksDetail.length > 0 ? (
              <div className="space-y-3">
                {userTasksDetail.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-card rounded border border-border text-sm"
                  >
                    <div className="font-semibold text-foreground">{task.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Status: {task.status} | Priority: {task.priority}
                    </div>
                    {task.remarks && (
                      <div className="text-xs mt-2 text-foreground">
                        Remarks: {task.remarks}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-2">
                      Due: {new Date(task.due_date).toLocaleDateString()} | Last Activity:{" "}
                      {new Date(task.last_activity).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tasks found for this user</p>
            )}
          </div>
        )}

        {/* Filters and Search - Only in Users View */}
        {!selectedUserDetail && viewMode === "users" && (
          <>
            <div className="mb-6 space-y-4">
              <div className="flex gap-4 flex-col sm:flex-row">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by task title or user..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <TaskFilters
                users={userStats.map((u) => u.id)}
                selectedUser={selectedUser}
                onUserChange={handleUserFilter}
                selectedStatus={selectedStatus}
                onStatusChange={handleStatusFilter}
                selectedPriority={selectedPriority}
                onPriorityChange={handlePriorityFilter}
                userNames={userStats.reduce(
                  (acc, u) => ({ ...acc, [u.id]: u.name }),
                  {}
                )}
              />
            </div>

            {/* Tasks Table */}
            <TasksTable
              tasks={filteredTasks}
              loading={loading}
              userNames={userStats.reduce(
                (acc, u) => ({ ...acc, [u.id]: u.name }),
                {}
              )}
            />
          </>
        )}
      </div>

      <ManageUsersDialog isOpen={manageUsersOpen} onClose={() => setManageUsersOpen(false)} />
    </div>
  );
}
