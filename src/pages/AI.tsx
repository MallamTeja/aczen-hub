import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

const AI_AGENT_URL =
  "https://app.relevanceai.com/agents/f1db6c/bed250b6de1d-4fd1-a58c-65508e44f4ab/db82a4e3-fd75-433a-8da7-59e0029ea8b9/share?hide_tool_steps=false&hide_file_uploads=false&hide_conversation_list=false&bubble_style=agent&primary_color=%23685FFF&bubble_icon=pd%2Fchat&input_placeholder_text=Type+your+message...&hide_logo=false&hide_description=false";

export default function AI() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">AI</h1>
          <p className="text-sm text-muted-foreground">
            Open and use the shared Relevance AI assistant directly from your workspace.
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>AI Assistant</CardTitle>
              <CardDescription>
                If the embedded view is blocked by the provider, open it in a new tab.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="gap-2">
              <a href={AI_AGENT_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open full page
              </a>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <iframe
              title="AI Assistant"
              src={AI_AGENT_URL}
              className="h-[calc(100vh-16rem)] min-h-[640px] w-full border-0 bg-background"
              allow="clipboard-write"
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
