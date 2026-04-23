import type { SocialPost } from "@/lib/social";
import SocialPostCard from "./SocialPostCard";

interface SocialPostListProps {
  posts: SocialPost[];
  onOpenPost: (post: SocialPost) => void;
}

export default function SocialPostList({ posts, onOpenPost }: SocialPostListProps) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        No posts yet. Create your first one with the New post button.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {posts.map((p) => (
        <SocialPostCard key={p.id} post={p} onOpen={onOpenPost} />
      ))}
    </div>
  );
}
