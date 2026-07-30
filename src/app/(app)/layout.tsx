import { Navigation } from "@/components/Navigation";
import { AppMain } from "@/components/AppMain";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Navigation />
      <AppMain>{children}</AppMain>
    </div>
  );
}
