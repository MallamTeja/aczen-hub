import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

const POSITIONS = [
  "CEO",
  "CFO",
  "CPO",
  "Marketing Manager",
  "Social Media",
  "Developer",
] as const;

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export default function Signup() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState<string>("");
  const [bloodGroup, setBloodGroup] = useState<string>("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) navigate("/", { replace: true });
  }, [isLoaded, isSignedIn, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    setError(
      "[SERVER] 400 Sign-Up Server Window Closed — Please contact admin, you exceeded the time limit 17:00:42PM IST. (ref: AUTH_SIGNUP_LOCKED)"
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Aczen Connect</h1>
      </div>

      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-lg p-8">
        <h2 className="text-xl font-bold text-foreground mb-2">Create account</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Join your team on Aczen Connect.
        </p>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-mono text-xs leading-relaxed break-words">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {info && (
          <Alert className="mb-6">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Role</Label>
            <Select
              value={position}
              onValueChange={setPosition}
              disabled={loading}
            >
              <SelectTrigger id="position">
                <SelectValue placeholder="Select your role…" />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blood_group">Blood group</Label>
            <Select
              value={bloodGroup}
              onValueChange={setBloodGroup}
              disabled={loading}
            >
              <SelectTrigger id="blood_group">
                <SelectValue placeholder="Select your blood group…" />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
