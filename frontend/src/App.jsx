import React, { useState } from "react";
import axios from "axios";
import LiveList from "./components/layout/LiveList";
import VideoRoom from "./components/rooms/VideoRoom";
import LinaRoom from "./components/rooms/LinaRoom";
import BIRoom from "./components/rooms/BIRoom";
import NovaRoom from "./components/rooms/NovaRoom";
import BlogSection from "./components/layout/BlogSection";
import AstraRoom from "./components/rooms/AstraRoom";
import RehearsalRoom from "./components/rooms/RehearsalRoom";
import SevaRoom from "./components/rooms/SevaRoom";
import MartechRoom from "./components/rooms/MartechRoom";
import OctaneRoom from "./components/rooms/OctaneRoom";
import DevopsGeniRoom from "./components/rooms/DevopsGeniRoom";
import AivyuhRoom from "./components/rooms/AivyuhRoom";
import ShoppeRoom from "./components/rooms/ShoppeRoom";
import ChangelogPage from "./pages/ChangelogPage";
import CareersPage from "./pages/CareersPage";
import DevopsOrb from "./components/layout/DevopsOrb";
import SwarmShortsPage from "./components/dashboard/SwarmShortsPage";
import DashboardPage from "./components/dashboard/DashboardPage";
import ComplianceDashboard from "./components/dashboard/ComplianceDashboard";
import GovernedDeployment from "./components/dashboard/GovernedDeployment";
import NotFoundPage from "./components/layout/NotFoundPage";
import CopilotWidget from "./components/layout/CopilotWidget";
import LoginPage from "./components/auth/LoginPage";
import ResetPasswordPage from "./components/auth/ResetPasswordPage";
import ConsoleLayout from "./components/layout/ConsoleLayout";
import '@livekit/components-styles/index.css';
import "./index.css";

const API = import.meta.env.VITE_API_URL || "";

function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [roomData, setRoomData] = useState(null);
  // ponytail: unified view mode state
  const [viewMode, setViewMode] = useState(null); // 'blog' | 'shorts' | 'changelog' | 'careers' | null
  const [currentPath, setCurrentPath] = useState(window.location.hash || window.location.pathname);
  const [isWaPopupOpen, setIsWaPopupOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("fleet");

  // Sync currentPath to activeTab
  React.useEffect(() => {
    if (isDashboardPath) setActiveTab("analytics");
    else if (isDeploymentPath) setActiveTab("governance");
    else if (isShortsPath) setActiveTab("sneak-peak");
    else if (isInsightsPath) setActiveTab("insights");
    else if (isCompliancePath) setActiveTab("compliance");
    else if (isChangelogPath) setActiveTab("changelog");
    else if (isCareersPath) setActiveTab("careers");
    else setActiveTab("fleet");
  }, [currentPath]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setViewMode(null); // reset any view mode when changing tabs
    if (tabId === "analytics") {
      window.history.pushState({}, "", "/dashboard");
      setCurrentPath("/dashboard");
    } else if (tabId === "compliance") {
      window.history.pushState({}, "", "/compliance");
      setCurrentPath("/compliance");
    } else if (tabId === "governance") {
      window.history.pushState({}, "", "/governed-deployment");
      setCurrentPath("/governed-deployment");
    } else if (tabId === "sneak-peak") {
      window.history.pushState({}, "", "/sneak-peak");
      setCurrentPath("/sneak-peak");
    } else if (tabId === "insights") {
      window.history.pushState({}, "", "/insights");
      setCurrentPath("/insights");
      setViewMode('blog');
    } else if (tabId === "changelog") {
      window.history.pushState({}, "", "/changelog");
      setCurrentPath("/changelog");
      setViewMode('changelog');
    } else if (tabId === "careers") {
      window.history.pushState({}, "", "/careers");
      setCurrentPath("/careers");
    } else {
      window.history.pushState({}, "", "/");
      setCurrentPath("/");
    }
  };

  React.useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  React.useEffect(() => {
    // Auto-open WhatsApp popup after 5 seconds if not closed in this session
    const hasClosed = sessionStorage.getItem("wa-popup-closed");
    if (!hasClosed) {
      const timer = setTimeout(() => {
        setIsWaPopupOpen(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  React.useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.hash || window.location.pathname);
    };
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const navigateToShorts = () => setViewMode('shorts');
  const navigateToDashboard = () => handleTabChange('analytics');
  const navigateToDeployment = () => handleTabChange('governance');
  const navigateToCareers = () => {
    window.history.pushState({}, "", "/careers");
    setCurrentPath("/careers");
    setViewMode('careers');
  };
  const navigateHome = () => handleTabChange('fleet');
  const navigateToLogin = () => {
    console.log('navigateToLogin invoked');
    window.location.hash = "#/login";
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    setActiveTab("fleet");
    window.history.pushState({}, "", "/");
    setCurrentPath("/");
  };

  React.useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          const errorData = error.response.data;
          const errorMsg = errorData && (errorData.error || errorData.message || "");
          if (
            typeof errorMsg === "string" && (
              errorMsg.toLowerCase().includes("session expired") ||
              errorMsg.toLowerCase().includes("invalid token") ||
              errorMsg.toLowerCase().includes("please re-authenticate") ||
              errorMsg.toLowerCase().includes("access token required") ||
              errorMsg.toLowerCase().includes("please login")
            )
          ) {
            handleLogout();
          }
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const handleJoin = (data) => {
    console.log(`[FRONTEND] Entering room: ${data.roomName} | Agent: ${data.creatorId}`);
    setRoomData(data);
  };

  const handleLeave = () => {
    console.log(`[FRONTEND] Leaving room.`);
    setRoomData(null);
  };

  const toggleBlog = () => {
    setViewMode(viewMode === 'blog' ? null : 'blog');
  };

  // ponytail: replaced individual room type flags with a lookup map
  const ROOM_COMPONENTS = {
    LINA: LinaRoom,
    BI: BIRoom,
    BI2: BIRoom,
    NOVA: NovaRoom,
    ASTRA: AstraRoom,
    REHEARSAL: RehearsalRoom,
    SEVA: SevaRoom,
    MARTECH: MartechRoom,
    OCTANE: OctaneRoom,
    DEVOPS_GENI: DevopsGeniRoom,
    AIVYUH: AivyuhRoom,
    aivyuh: AivyuhRoom,
    SHOPPE: ShoppeRoom,
  };
  const CurrentRoom = ROOM_COMPONENTS[roomData?.creatorId] || VideoRoom; // fallback to generic VideoRoom


  const isFleetPath =
    currentPath.replace(/\/$/, "") === "/fleet" ||
    window.location.hash.replace(/\/$/, "") === "#/fleet" ||
    window.location.hash === "#fleet" ||
    window.location.hash === "#/fleet/";

  const isShortsPath =
    currentPath.split("?")[0].replace(/\/$/, "") === "/sneak-peak" ||
    window.location.hash.split("?")[0] === "#/sneak-peak" ||
    currentPath.includes("sneak-peak");

  const isDashboardPath =
    currentPath.replace(/\/$/, "") === "/dashboard" ||
    window.location.hash === "#/dashboard" ||
    window.location.hash === "#dashboard";

  const isCompliancePath =
    currentPath.replace(/\/$/, "") === "/compliance" ||
    window.location.hash.replace(/\/$/, "") === "#/compliance" ||
    window.location.hash === "#compliance" ||
    window.location.hash === "#/compliance/";

  const isDeploymentPath =
    currentPath.replace(/\/$/, "") === "/governed-deployment" ||
    window.location.hash.replace(/\/$/, "") === "#/governed-deployment" ||
    window.location.hash === "#governed-deployment" ||
    window.location.hash === "#/governed-deployment/";

  const isInsightsPath =
    currentPath.replace(/\/$/, "") === "/insights" ||
    window.location.hash.replace(/\/$/, "") === "#/insights" ||
    window.location.hash === "#insights" ||
    window.location.hash === "#/insights/";

  const isChangelogPath =
    currentPath.replace(/\/$/, "") === "/changelog" ||
    window.location.hash.replace(/\/$/, "") === "#/changelog" ||
    window.location.hash === "#changelog";

  const isBlogPath =
    currentPath.replace(/\/$/, "") === "/blog" ||
    currentPath.startsWith("/blog/") ||
    window.location.hash.replace(/\/$/, "") === "#/blog" ||
    window.location.hash.startsWith("#/blog/");

  const isCareersPath =
    currentPath.replace(/\/$/, "") === "/careers" ||
    window.location.hash.replace(/\/$/, "") === "#/careers" ||
    window.location.hash === "#careers";

  const isLoginPath =
    currentPath.replace(/\/$/, "") === "/login" ||
    window.location.hash.replace(/\/$/, "") === "#/login" ||
    window.location.hash === "#login";

  const isResetPasswordPath =
    currentPath.replace(/\/$/, "") === "/reset-password" ||
    window.location.hash.replace(/\/$/, "") === "#/reset-password";

  let content;
  if (viewMode === 'changelog' || isChangelogPath || activeTab === "changelog") {
    content = <ChangelogPage onBack={() => handleTabChange("fleet")} />;
  } else if (viewMode === 'blog' || isInsightsPath || isBlogPath || activeTab === "insights") {
    content = <BlogSection onBack={() => handleTabChange("fleet")} currentPath={currentPath} setCurrentPath={setCurrentPath} onCareersClick={navigateToCareers} />;
  } else if (viewMode === 'shorts' || isShortsPath || activeTab === "sneak-peak") {
    content = <SwarmShortsPage onBack={() => handleTabChange("fleet")} />;
  } else if (viewMode === 'careers' || isCareersPath || activeTab === "careers") {
    content = <CareersPage onBack={() => handleTabChange("fleet")} />;
  } else if (isDashboardPath || activeTab === "analytics") {
    content = <DashboardPage onBack={() => handleTabChange("fleet")} />;
  } else if (isCompliancePath || activeTab === "compliance") {
    content = <ComplianceDashboard onBack={() => handleTabChange("fleet")} />;
  } else if (isDeploymentPath || activeTab === "governance") {
    content = <GovernedDeployment onBack={() => handleTabChange("fleet")} />;
  } else if (roomData) {
    const RoomComponent = CurrentRoom;
    content = <RoomComponent roomData={roomData} onLeave={handleLeave} />;
  } else if (
    currentPath === "/" ||
    currentPath === "" ||
    isFleetPath ||
    (currentPath.startsWith("#") && !currentPath.startsWith("#/login") && !currentPath.startsWith("#/reset-password")) ||
    activeTab === "fleet"
  ) {
    content = (
      <LiveList 
        onJoin={handleJoin} 
        onBlogClick={() => handleTabChange("insights")} 
        onShortsClick={navigateToShorts}
        onDashboardClick={navigateToDashboard}
        onDeploymentClick={navigateToDeployment}
        onChangelogClick={() => handleTabChange("changelog")}
        onCareersClick={navigateToCareers}
        user={user}
        onLoginClick={navigateToLogin}
        onLogout={handleLogout}
      />
    );
  } else {
    content = <NotFoundPage onBack={navigateHome} />;
  }

  const handleLoginSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    if (currentPath === "/login" || window.location.hash === "#/login" || window.location.hash === "#login") {
      navigateHome();
    }
  }; // ponytail: kept unchanged

  React.useEffect(() => {
    if (token && user && isLoginPath) {
      navigateHome();
    }
  }, [token, user, isLoginPath]);

  const isAuthenticated = !!(token && user);

  // Reset password page: public, no auth required
  if (isResetPasswordPath) {
    return <ResetPasswordPage onBack={navigateToLogin} />;
  }

  // Active room sessions — full screen, no chrome
  if (roomData) {
    return (
      <div className="app-container">
        {content}
      </div>
    );
  }

  // The landing page (fleet/home at "/") is ALWAYS standalone for guests — never inside ConsoleLayout
  // When authenticated, the operator Control Panel Workspace is wrapped inside ConsoleLayout
  const isLandingPage =
    !isAuthenticated &&
    !isDashboardPath && !isDeploymentPath && !isCompliancePath && !viewMode &&
    (currentPath === "/" || currentPath === "" || isFleetPath ||
     (currentPath.startsWith("#") && !currentPath.startsWith("#/login") && !currentPath.startsWith("#/reset-password")) ||
     activeTab === "fleet");

  if (isLandingPage) {
    return (
      <div className="app-container">
        {content}
      </div>
    );
  }

  // Direct login page route (unauthenticated)
  if (isLoginPath) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Gate protected pages (Analytics/Dashboard, Compliance) behind login
  const isProtected = isDashboardPath || isCompliancePath;
  if (!isAuthenticated && isProtected) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Authenticated sub-pages: wrap in ConsoleLayout with sidebar nav
  if (isAuthenticated) {
    return (
      <ConsoleLayout
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      >
        {content}
        <DevopsOrb />
        <CopilotWidget />
      </ConsoleLayout>
    );
  }

  // Unauthenticated public sub-pages (Governance, Insights, Shorts) — no ConsoleLayout
  return (
    <div className="app-container">
      {content}
    </div>
  );
}

export default App;
