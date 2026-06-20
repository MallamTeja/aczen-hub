import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Mail } from "lucide-react";
import EmailAutomationPanel from "@/components/automations/EmailAutomationPanel";
import EmailAutomationAnalytics from "@/components/automations/EmailAutomationAnalytics";

export default function Automations() {
  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Automations</h1>
          <p className="text-sm text-muted-foreground">
            Automated outreach workflows that turn cold business leads into conversations.
          </p>
        </div>

        <Tabs defaultValue="email" className="space-y-4">
          <TabsList>
            <TabsTrigger value="email" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Email Automation
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <EmailAutomationPanel />
          </TabsContent>

          <TabsContent value="analytics">
            <EmailAutomationAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
