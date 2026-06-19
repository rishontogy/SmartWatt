import { RouterProvider } from "react-router";
import { router } from "@/app/routes";
import { Toaster } from "@/app/components/ui/sonner";
import { ThemeProvider } from "@/app/contexts/theme-context";
import { AuthProvider } from "@/app/contexts/auth-context";
import { LeakNotifier } from "@/app/components/LeakNotifier";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
         <LeakNotifier />
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}