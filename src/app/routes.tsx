import { createBrowserRouter } from "react-router";
import { WelcomePage } from "@/app/pages/welcome-page";
import { DashboardLayout } from "@/app/layouts/dashboard-layout";
import { HomePage } from "@/app/pages/home-page";
import { ProfilePage } from "@/app/pages/profile-page";
import { GraphsPage } from "@/app/pages/graphs-page";
import { ConsumptionPage } from "@/app/pages/consumption-page";
import { BillPage } from "@/app/pages/bill-page";
import { DeviceControlPage } from "@/app/pages/device-control-page";
import { AddDevicePage } from "@/app/pages/add-device-page";
import { ZonesPage } from "@/app/pages/zones-page";
import { ZoneDetailsPage } from "@/app/pages/zone-details-page";
import { SignInPage } from "@/app/pages/signin-page";
import { LoginPage } from "@/app/pages/login-page";
import { ProtectedRoute } from "@/app/components/ProtectedRoute";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: WelcomePage,
    },
    {
      path: "/signin",
      Component: SignInPage,
    },
    {
      path: "/login",
      Component: LoginPage,
    },
    {
      path: "/dashboard",
      element: (
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      ),
      children: [
        {
          index: true,
          Component: HomePage,
        },
        {
          path: "profile",
          Component: ProfilePage,
        },
        {
          path: "graphs",
          Component: GraphsPage,
        },
        {
          path: "consumption",
          Component: ConsumptionPage,
        },
        {
          path: "bill",
          Component: BillPage,
        },
        {
          path: "devices",
          Component: DeviceControlPage,
        },
        {
          path: "add-device",
          Component: AddDevicePage,
        },
        {
          path: "zones",
          Component: ZonesPage,
        },
        {
          path: "zones/:zoneName",
          Component: ZoneDetailsPage,
        },
      ],
    },
  ],
  {
    basename: "/SmartWatt",
  }
);
