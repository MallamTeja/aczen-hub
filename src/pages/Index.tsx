import DashboardLayout from "@/components/DashboardLayout";
import PunchCard from "@/components/PunchCard";
import WorkUpdateCard from "@/components/WorkUpdateCard";
import StatusCards from "@/components/StatusCards";
import MyWeeklySummary from "@/components/MyWeeklySummary";
import MyAssignments from "@/components/MyAssignments";
import TasksCalendar from "@/components/TasksCalendar";

export default function Index() {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in-fade">
        <div className="rounded-2xl bg-gradient-warm p-6 text-primary-foreground shadow-elegant sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Welcome back</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Your daily overview</h1>
          <p className="mt-1 text-sm opacity-90">Punch in, log updates and keep on top of your assignments.</p>
        </div>

        <StatusCards />

        <MyWeeklySummary />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <PunchCard />
          <WorkUpdateCard />
        </div>

        <MyAssignments />

        <TasksCalendar />
      </div>
    </DashboardLayout>
  );
}
